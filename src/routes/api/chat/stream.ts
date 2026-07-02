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
});

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
        type ChatMessage = import("@/lib/ai.server").ChatMessage;

        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: string, data: unknown) => {
              controller.enqueue(
                encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
              );
            };
            // keep-alive ping every 15s (evita proxies fecharem a conexão)
            const ping = setInterval(() => {
              try {
                controller.enqueue(encoder.encode(`: ping\n\n`));
              } catch {
                /* noop */
              }
            }, 15000);

            try {
              const run = await prepareRagRun({
                supabase: auth.supabase,
                userId: auth.userId,
                data: body,
              });

              send("citations", { citations: run.citations });

              const convo: ChatMessage[] = [...run.messages];
              const steps: { name: string; args: unknown; result: unknown }[] = [];
              let finalContent = "";
              const maxSteps = 6;

              for (let i = 0; i < maxSteps; i++) {
                const r = await chatCompleteStream(convo, {
                  model: run.model,
                  temperature: 0.2,
                  tools: run.tools,
                  onDelta: (delta) => send("token", { text: delta }),
                });
                if (!r.tool_calls || r.tool_calls.length === 0) {
                  finalContent = r.content;
                  break;
                }
                convo.push({
                  role: "assistant",
                  content: r.content,
                  tool_calls: r.tool_calls,
                });
                for (const tc of r.tool_calls) {
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
              }

              if (!finalContent && steps.length > 0) {
                // Última tentativa forçando resposta final sem tools
                const final = await chatCompleteStream(convo, {
                  model: run.model,
                  temperature: 0.2,
                  onDelta: (delta) => send("token", { text: delta }),
                });
                finalContent = final.content;
              }

              const toolSteps = steps.map((s) => ({
                name: s.name,
                args_json: JSON.stringify(s.args),
                result_json: JSON.stringify(s.result),
              }));

              let persistedThreadId: string | null = null;
              if (body.thread_id) {
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
                });
              }

              send("done", {
                answer: finalContent,
                citations: run.citations,
                steps: toolSteps,
                thread_id: persistedThreadId,
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              send("error", { message: msg });
            } finally {
              clearInterval(ping);
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
