import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const askWithRag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AskSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { chatWithTools } = await import("./ai.server");
    const { prepareRagRun, persistChatTurn } = await import("./chat-rag.server");
    const { splitSources, stripInvalidRefs } = await import("./rag/citations");
    const { logRetrievalEvent } = await import("./rag/log.server");
    const { EMBEDDING_MODEL } = await import("./rag.functions");

    const run = await prepareRagRun({
      supabase: context.supabase,
      userId: context.userId,
      data,
    });

    const { content, steps } = await chatWithTools(run.messages, run.tools, run.executor, {
      model: run.model,
      temperature: 0.2,
      maxSteps: 6,
    });

    // Rastreabilidade: remove refs inexistentes e separa citadas de apoio.
    const answer = stripInvalidRefs(content, run.citations);
    const sources = splitSources(answer, run.citations);

    await logRetrievalEvent({
      supabase: context.supabase,
      userId: context.userId,
      caseId: data.case_id,
      threadId: data.thread_id ?? null,
      log: run.retrievalLog,
      embeddingModel: EMBEDDING_MODEL,
    });

    const toolSteps = steps.map((s) => ({
      name: s.name,
      args_json: JSON.stringify(s.args),
      result_json: JSON.stringify(s.result),
    }));

    let persistedThreadId: string | null = null;
    if (data.thread_id) {
      persistedThreadId = data.thread_id;
      await persistChatTurn({
        supabase: context.supabase,
        userId: context.userId,
        threadId: data.thread_id,
        question: data.question,
        images: data.images,
        tier: run.tier,
        content: answer,
        toolSteps,
        citations: run.citations,
      });
    }

    return {
      answer,
      citations: run.citations,
      retrieved_sources: sources.retrieved_sources,
      cited_sources: sources.cited_sources,
      supporting_sources: sources.supporting_sources,
      invalid_refs: sources.invalid_refs,
      sufficiency: run.sufficiency,
      steps: toolSteps,
      thread_id: persistedThreadId,
    };
  });

export const summarizeCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai.server");

    const { data: chunks } = await context.supabase
      .from("document_chunks")
      .select("content")
      .eq("case_id", data.case_id)
      .eq("user_id", context.userId)
      .limit(40);

    if (!chunks || chunks.length === 0) {
      throw new Error("Nenhum documento indexado para este caso.");
    }

    const text = chunks.map((c) => c.content).join("\n\n");
    const { content: rawSummary } = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você é o JurisMind. Gere um resumo executivo em português do caso jurídico a partir dos trechos fornecidos. Estruture em quatro blocos com títulos em MAIÚSCULAS seguidos de dois-pontos: VISÃO GERAL, PARTES ENVOLVIDAS, PONTOS-CHAVE, PRÓXIMOS PASSOS. Use texto corrido em parágrafos curtos. NÃO use Markdown: nada de **negrito**, *itálico*, # títulos, listas com - ou *, nem blocos de código. Máximo 400 palavras.",
        },
        { role: "user", content: text.slice(0, 30_000) },
      ],
      { temperature: 0.3 },
    );

    const { stripMarkdown } = await import("./strip-markdown");
    const summary = stripMarkdown(rawSummary);

    await context.supabase
      .from("cases")
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq("id", data.case_id)
      .eq("user_id", context.userId);

    return { summary };
  });
