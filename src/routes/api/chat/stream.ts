import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const AskSchema = z.object({
  case_id: z.string().uuid(),
  question: z.string().min(1).max(8000),
  selected_doc_ids: z.array(z.string().uuid()).optional(),
  images: z.array(z.string()).max(6).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
  model_tier: z.enum(["fast", "balanced", "max"]).optional(),
  thread_id: z.string().uuid().optional(),
  input_kind: z.enum(["text", "voice"]).optional(),
  audio_path: z.string().max(500).optional(),
  audio_duration_ms: z.number().int().min(0).max(3_600_000).optional(),
});

type StreamToolStep = { name: string; args: unknown; result: unknown };

function extractArtifactPayload(step: StreamToolStep): { kind: string; title: string; body: string } | null {
  const result = step.result;
  if (!result || typeof result !== "object") return null;
  const r = result as { kind?: unknown; titulo?: unknown; conteudo?: unknown };
  const kind = typeof r.kind === "string" ? r.kind : "";
  if (kind !== "petition" && kind !== "pdf") return null;
  return {
    kind,
    title: typeof r.titulo === "string" ? r.titulo.trim() : "",
    body: typeof r.conteudo === "string" ? r.conteudo.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "",
  };
}

function dedupeGeneratedDocumentSteps(steps: StreamToolStep[]): StreamToolStep[] {
  const byBody = new Map<string, number>();
  const out: StreamToolStep[] = [];
  for (const step of steps) {
    const payload = extractArtifactPayload(step);
    if (!payload) {
      out.push(step);
      continue;
    }
    const key = payload.body || `${payload.kind}:${payload.title}`;
    const existingIndex = byBody.get(key);
    if (existingIndex == null) {
      byBody.set(key, out.length);
      out.push(step);
      continue;
    }
    const existing = extractArtifactPayload(out[existingIndex]);
    if (existing?.kind === "pdf" && payload.kind === "petition") {
      out[existingIndex] = step;
    }
  }
  return out;
}

function hasGeneratedDocument(steps: StreamToolStep[]): boolean {
  return steps.some((step) => Boolean(extractArtifactPayload(step)));
}

function isGeneratedDocumentToolName(name: string): boolean {
  return name === "create_petition" || name === "create_pdf";
}

function pickGeneratedDocumentToolCall<T extends { function: { name: string } }>(toolCalls: T[]): T | null {
  return (
    toolCalls.find((tc) => tc.function.name === "create_petition") ??
    toolCalls.find((tc) => tc.function.name === "create_pdf") ??
    null
  );
}

export const Route = createFileRoute("/api/chat/stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateRequest } = await import("@/lib/route-auth.server");
        type Auth = Awaited<ReturnType<typeof authenticateRequest>>;
        let auth: Auth;
        try {
          auth = await authenticateRequest(request);
        } catch (e) {
          if (e instanceof Response) return e;
          return new Response("Unauthorized", { status: 401 });
        }

        // Autorização real no servidor: apenas quem tem `ai.use` na organização
        // ativa pode consumir o JurisMind AI (ocultar o botão não é suficiente).
        {
          const { data: allowed, error: permError } = await (
            auth.supabase as unknown as {
              rpc: (
                fn: string,
                args: Record<string, unknown>,
              ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
            }
          ).rpc("has_org_permission", {
            _organization_id: auth.organizationId,
            _user_id: auth.userId,
            _permission: "ai.use",
          });
          if (permError) return new Response(permError.message, { status: 500 });
          if (allowed !== true) {
            return new Response("Forbidden: permissão \"ai.use\" necessária", { status: 403 });
          }
        }



        let body: z.infer<typeof AskSchema>;
        try {
          body = AskSchema.parse(await request.json());
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Payload inválido";
          return new Response(msg, { status: 400 });
        }

        const { prepareRagRun, persistChatTurn } = await import("@/lib/chat-rag.server");
        const { legalChatStream, removeNullArguments } = await import("@/lib/legal-ai.server");
        const { runWithUsageContext } = await import("@/lib/ai-usage.server");
        type ChatMessage = import("@/lib/ai.server").ChatMessage;

        const encoder = new TextEncoder();
        const abortSignal = request.signal;

        let hasPriorHistory = false;
        if (body.thread_id) {
          const { data: thread } = await auth.supabase
            .from("ai_chat_threads")
            .select("id, case_id")
            .eq("id", body.thread_id)
            .eq("case_id", body.case_id)
            .eq("organization_id", auth.organizationId)
            .maybeSingle();
          if (!thread) return new Response("Conversa não encontrada neste caso.", { status: 404 });
          const { data: persistedMessages, error: historyError } = await auth.supabase
            .from("ai_chat_messages")
            .select("role, content")
            .eq("thread_id", body.thread_id)
            .eq("organization_id", auth.organizationId)
            .order("created_at", { ascending: true });
          if (historyError) return new Response(historyError.message, { status: 500 });
          hasPriorHistory = (persistedMessages ?? []).length > 0;
          body.history = (persistedMessages ?? []).map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
          }));
        } else {
          body.history = [];
          const { data: createdThread, error: createThreadError } = await auth.supabase
            .from("ai_chat_threads")
            .insert({
              case_id: body.case_id,
              organization_id: auth.organizationId,
              created_by_user_id: auth.userId,
              title: "Nova conversa",
            })
            .select("id")
            .single();
          if (createThreadError || !createdThread) {
            return new Response(createThreadError?.message ?? "Não foi possível iniciar a conversa.", { status: 500 });
          }
          body.thread_id = createdThread.id;
        }

        const sessionId =
          (globalThis.crypto?.randomUUID?.() as string | undefined) ??
          `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            return runWithUsageContext(
              {
                userId: auth.userId,
                organizationId: auth.organizationId,
                caseId: body.case_id,
                threadId: body.thread_id ?? null,
                feature: "chat_stream",
                sessionId,
              },
              () => runStream(controller),
            );
          },
        });


        async function runStream(controller: ReadableStreamDefaultController<Uint8Array>) {
            let closed = false;
            const safeEnqueue = (chunk: Uint8Array) => {
              if (closed) return;
              try {
                controller.enqueue(chunk);
              } catch {
                closed = true;
              }
            };
            const send = (event: string, data: unknown) => {
              safeEnqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            };
            // keep-alive ping every 15s (evita proxies fecharem a conexão)
            const ping = setInterval(() => {
              safeEnqueue(encoder.encode(`: ping\n\n`));
            }, 15000);

            // Se o cliente abortar (botão "parar" / fechar aba), interrompemos
            // o loop e o fetch ao gateway via abortSignal.
            const onAbort = () => {
              closed = true;
              clearInterval(ping);
              try {
                controller.close();
              } catch {
                /* noop */
              }
            };
            if (abortSignal.aborted) {
              onAbort();
              return;
            }
            abortSignal.addEventListener("abort", onAbort, { once: true });

            try {
              send("session", { session_id: sessionId });
              const run = await prepareRagRun({
                supabase: auth.supabase,
                userId: auth.userId,
                organizationId: auth.organizationId,
                data: body,
              });
              if (abortSignal.aborted) return;

              const { buildLegalCacheKey, getLegalCache, isSafeLegalCacheQuestion, setLegalCache } =
                await import("@/lib/legal-response-cache.server");
              const cacheEligible = !hasPriorHistory && isSafeLegalCacheQuestion(
                body.question,
                Boolean(body.images?.length),
              );
              const cacheKey = cacheEligible
                ? await buildLegalCacheKey({
                    organizationId: auth.organizationId,
                    caseId: body.case_id,
                    question: body.question,
                    selectedDocIds: run.selectedDocumentIds,
                    documentVersion: run.documentVersion,
                    tier: run.tier,
                  })
                : null;
              const cached = cacheKey
                ? await getLegalCache({ supabase: auth.supabase, organizationId: auth.organizationId, key: cacheKey })
                : null;
              if (cached && body.thread_id) {
                send("citations", { citations: cached.citations });
                for (let index = 0; index < cached.content.length; index += 48) {
                  send("token", { text: cached.content.slice(index, index + 48) });
                }
                await persistChatTurn({
                  supabase: auth.supabase,
                  userId: auth.userId,
                  organizationId: auth.organizationId,
                  threadId: body.thread_id,
                  question: body.question,
                  images: body.images,
                  tier: run.tier,
                  content: cached.content,
                  toolSteps: [],
                  citations: cached.citations,
                  inputKind: body.input_kind,
                  audioPath: body.audio_path ?? null,
                  audioDurationMs: body.audio_duration_ms ?? null,
                });
                send("done", {
                  answer: cached.content,
                  citations: cached.citations,
                  steps: [],
                  thread_id: body.thread_id,
                  cached: true,
                });
                return;
              }

              send("citations", { citations: run.citations });


              const convo: ChatMessage[] = [...run.messages];
              const steps: { name: string; args: unknown; result: unknown }[] = [];
              let finalContent = "";
              let reasoningSummary = "";
              let gatewayRunId = request.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
              const maxSteps = 6;

              for (let i = 0; i < maxSteps; i++) {
                if (abortSignal.aborted) break;
                const r = await legalChatStream(convo, {
                  depth: run.tier,
                  tools: run.tools,
                  signal: abortSignal,
                  onDelta: (delta) => send("token", { text: delta }),
                  onReasoningDelta: (delta) => {
                    reasoningSummary += delta;
                    send("reasoning", { text: delta });
                  },
                  initialRunId: gatewayRunId,
                  onRunId: (runId) => { gatewayRunId = runId; },
                  feature: "legal_chat",
                });
                if (abortSignal.aborted) break;
                if (!r.tool_calls || r.tool_calls.length === 0) {
                  finalContent = r.content;
                  break;
                }
                const generatedToolCall = pickGeneratedDocumentToolCall(r.tool_calls);
                const toolCallsToRun = generatedToolCall
                  ? r.tool_calls.filter(
                      (tc) =>
                        tc === generatedToolCall ||
                        !isGeneratedDocumentToolName(tc.function.name),
                    )
                  : r.tool_calls;

                convo.push({
                  role: "assistant",
                  content: r.content,
                  tool_calls: toolCallsToRun,
                });
                for (const tc of toolCallsToRun) {
                  if (abortSignal.aborted) break;
                  let args: Record<string, unknown> = {};
                  try {
                    args = removeNullArguments(JSON.parse(tc.function.arguments || "{}")) as Record<string, unknown>;
                  } catch {
                    args = {};
                  }
                  send("tool_start", { name: tc.function.name });
                  let result: unknown;
                  try {
                    result = await run.executor(tc.function.name, args);
                  } catch (e) {
                    result = { error: e instanceof Error ? e.message : String(e) };
                  }
                  steps.push({ name: tc.function.name, args, result });
                  send("tool_result", { name: tc.function.name, result });
                  convo.push({
                    role: "tool",
                    tool_call_id: tc.id,
                    name: tc.function.name,
                    content: JSON.stringify(result),
                  });
                }
                if (hasGeneratedDocument(steps)) {
                  finalContent = "Documento pronto para revisar, editar e baixar.";
                  break;
                }
              }

              if (!abortSignal.aborted && !finalContent && steps.length > 0) {
                // Última tentativa forçando resposta final sem tools
                const generatedDocument = hasGeneratedDocument(steps);
                const final = await legalChatStream(convo, {
                  depth: run.tier,
                  signal: abortSignal,
                  onDelta: generatedDocument ? undefined : (delta) => send("token", { text: delta }),
                  onReasoningDelta: (delta) => {
                    reasoningSummary += delta;
                    send("reasoning", { text: delta });
                  },
                  initialRunId: gatewayRunId,
                  onRunId: (runId) => { gatewayRunId = runId; },
                  feature: "legal_chat_final",
                });
                finalContent = final.content;
              }


              const visibleSteps = dedupeGeneratedDocumentSteps(steps);
              if (hasGeneratedDocument(visibleSteps)) {
                const compact = finalContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                if (!compact || compact.length > 280) {
                  finalContent = "Documento pronto para revisar, editar e baixar.";
                }
              }

              // Rastreabilidade: remove refs inventadas antes de persistir/enviar.
              const { stripInvalidRefs, splitSources } = await import("@/lib/rag/citations");
              const { logRetrievalEvent } = await import("@/lib/rag/log.server");
              const { EMBEDDING_MODEL } = await import("@/lib/rag.functions");
              finalContent = stripInvalidRefs(finalContent, run.citations);
              const sources = splitSources(finalContent, run.citations);
              await logRetrievalEvent({
                supabase: auth.supabase,
                userId: auth.userId,
                organizationId: auth.organizationId,
                caseId: body.case_id,
                threadId: body.thread_id ?? null,
                log: run.retrievalLog,
                embeddingModel: EMBEDDING_MODEL,
              });

              const toolSteps = visibleSteps.map((s) => ({
                name: s.name,
                args_json: JSON.stringify(s.args),
                result_json: JSON.stringify(s.result),
              }));

              const persistedThreadId: string | null = body.thread_id ?? null;
              if (persistedThreadId && !abortSignal.aborted) {
                await persistChatTurn({
                  supabase: auth.supabase,
                  userId: auth.userId,
                  organizationId: auth.organizationId,
                  threadId: persistedThreadId,
                  question: body.question,
                  images: body.images,
                  tier: run.tier,
                  content: finalContent,
                  toolSteps,
                  citations: run.citations,
                  inputKind: body.input_kind,
                  audioPath: body.audio_path ?? null,
                  audioDurationMs: body.audio_duration_ms ?? null,
                });
              }
              if (cacheKey && steps.length === 0 && finalContent && !abortSignal.aborted) {
                await setLegalCache({
                  supabase: auth.supabase,
                  organizationId: auth.organizationId,
                  caseId: body.case_id,
                  key: cacheKey,
                  documentVersion: run.documentVersion,
                  tier: run.tier,
                  content: finalContent,
                  citations: run.citations,
                });
              }

              if (!abortSignal.aborted) {
                send("done", {
                  answer: finalContent,
                  citations: run.citations,
                  cited_sources: sources.cited_sources,
                  supporting_sources: sources.supporting_sources,
                  sufficiency: run.sufficiency,
                  steps: toolSteps,
                  thread_id: persistedThreadId,
                  reasoning_summary: reasoningSummary || undefined,
                });
              } else {
                send("aborted", { partial: finalContent });
              }
            } catch (e) {
              // Aborts do fetch propagam como AbortError — silenciar
              if (!abortSignal.aborted) {
                const msg = e instanceof Error ? e.message : String(e);
                const code =
                  e && typeof e === "object" && "code" in e
                    ? String((e as { code?: unknown }).code ?? "")
                    : "";
                send("error", { message: msg, code });
              }
            } finally {
              abortSignal.removeEventListener("abort", onAbort);
              clearInterval(ping);
              closed = true;
              try {
                controller.close();
              } catch {
                /* noop */
              }
            }
        }



        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
