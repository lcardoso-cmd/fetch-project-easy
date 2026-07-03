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
        let auth;
        try {
          auth = await authenticateRequest(request);
        } catch (e) {
          if (e instanceof Response) return e;
          return new Response("Unauthorized", { status: 401 });
        }

        let body: z.infer<typeof AskSchema>;
        try {
          body = AskSchema.parse(await request.json());
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Payload inválido";
          return new Response(msg, { status: 400 });
        }

        const { prepareRagRun, persistChatTurn } = await import("@/lib/chat-rag.server");
        const { chatCompleteStream } = await import("@/lib/ai.server");
        const { runWithUsageContext } = await import("@/lib/ai-usage.server");
        type ChatMessage = import("@/lib/ai.server").ChatMessage;

        const encoder = new TextEncoder();
        const abortSignal = request.signal;

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            return runWithUsageContext(
              {
                userId: auth.userId,
                caseId: body.case_id,
                threadId: body.thread_id ?? null,
                feature: "chat_stream",
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
              const run = await prepareRagRun({
                supabase: auth.supabase,
                userId: auth.userId,
                data: body,
              });
              if (abortSignal.aborted) return;

              send("citations", { citations: run.citations });

              const convo: ChatMessage[] = [...run.messages];
              const steps: { name: string; args: unknown; result: unknown }[] = [];
              let finalContent = "";
              const maxSteps = 6;

              for (let i = 0; i < maxSteps; i++) {
                if (abortSignal.aborted) break;
                const r = await chatCompleteStream(convo, {
                  model: run.model,
                  temperature: 0.2,
                  tools: run.tools,
                  signal: abortSignal,
                  onDelta: (delta) => send("token", { text: delta }),
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
                    args = JSON.parse(tc.function.arguments || "{}");
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
                const final = await chatCompleteStream(convo, {
                  model: run.model,
                  temperature: 0.2,
                  signal: abortSignal,
                  onDelta: generatedDocument ? undefined : (delta) => send("token", { text: delta }),
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

              const toolSteps = visibleSteps.map((s) => ({
                name: s.name,
                args_json: JSON.stringify(s.args),
                result_json: JSON.stringify(s.result),
              }));

              let persistedThreadId: string | null = null;
              if (body.thread_id && !abortSignal.aborted) {
                persistedThreadId = body.thread_id;
                await persistChatTurn({
                  supabase: auth.supabase,
                  userId: auth.userId,
                  threadId: body.thread_id,
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

              if (!abortSignal.aborted) {
                send("done", {
                  answer: finalContent,
                  citations: run.citations,
                  steps: toolSteps,
                  thread_id: persistedThreadId,
                });
              } else {
                send("aborted", { partial: finalContent });
              }
            } catch (e) {
              // Aborts do fetch propagam como AbortError — silenciar
              if (!abortSignal.aborted) {
                const msg = e instanceof Error ? e.message : String(e);
                send("error", { message: msg });
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
          },
        });

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
