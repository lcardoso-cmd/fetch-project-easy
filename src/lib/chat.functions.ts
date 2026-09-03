import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAiEnabled } from "@/lib/org-middleware";

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
  .middleware([requireAiEnabled])
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
      organizationId: context.organizationId,
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
      organizationId: context.organizationId,
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
        organizationId: context.organizationId,
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
  .middleware([requireAiEnabled])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { chatComplete } = await import("./ai.server");
    const { stripMarkdown } = await import("./strip-markdown");

    // RLS já limita ao dono e aos membros autorizados do caso.
    const { data: docs } = await context.supabase
      .from("documents")
      .select("id, filename, processing_status")
      .eq("case_id", data.case_id)
      .order("created_at", { ascending: true });

    const docRows = (docs ?? []) as Array<{
      id: string;
      filename: string;
      processing_status: string;
    }>;
    const indexed = docRows.filter(
      (d) => d.processing_status === "ready" || d.processing_status.startsWith("partial"),
    );
    const notProcessed = docRows.filter((d) => !indexed.some((i) => i.id === d.id));

    if (indexed.length === 0) {
      throw new Error("Nenhum documento indexado para este caso.");
    }

    // 1ª etapa: resumo por documento (hierárquico), com procedência.
    const perDoc: Array<{ filename: string; summary: string; chunks: number }> = [];
    for (const doc of indexed.slice(0, 12)) {
      const { data: chunks } = await context.supabase
        .from("document_chunks")
        .select("content, page_start, section_title")
        .eq("document_id", doc.id)
        .order("chunk_index", { ascending: true })
        .limit(60);

      const rows = (chunks ?? []) as Array<{
        content: string;
        page_start: number | null;
        section_title: string | null;
      }>;
      if (rows.length === 0) continue;

      const body = rows
        .map((c) => {
          const loc = [c.page_start != null ? `p. ${c.page_start}` : null, c.section_title]
            .filter(Boolean)
            .join(" · ");
          return loc ? `(${loc}) ${c.content}` : c.content;
        })
        .join("\n\n")
        .slice(0, 24_000);

      const { content } = await chatComplete(
        [
          {
            role: "system",
            content:
              "Você é o JurisMind. Resuma o documento jurídico em até 140 palavras, em texto corrido, sem Markdown. Registre partes, datas, valores, obrigações e prazos que apareçam. Quando citar um fato, indique a página ou seção entre parênteses se ela constar no trecho. Não invente informação ausente.",
          },
          { role: "user", content: body },
        ],
        { temperature: 0.2, feature: "case_summary_doc" },
      );
      perDoc.push({ filename: doc.filename, summary: stripMarkdown(content), chunks: rows.length });
    }

    if (perDoc.length === 0) {
      throw new Error("Nenhum documento indexado para este caso.");
    }

    // 2ª etapa: consolidação a partir dos resumos por documento.
    const consolidatedInput = perDoc
      .map((d) => `DOCUMENTO: ${d.filename}\n${d.summary}`)
      .join("\n\n---\n\n");

    const { content: rawSummary } = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você é o JurisMind. A partir dos resumos por documento, gere um resumo executivo do caso em português. Estruture em quatro blocos com títulos em MAIÚSCULAS seguidos de dois-pontos: VISÃO GERAL, PARTES ENVOLVIDAS, PONTOS-CHAVE, PRÓXIMOS PASSOS. Aponte contradições entre documentos quando existirem e declare o que não foi possível apurar. Texto corrido, parágrafos curtos, sem Markdown. Máximo 400 palavras.",
        },
        { role: "user", content: consolidatedInput.slice(0, 40_000) },
      ],
      { temperature: 0.3, feature: "case_summary" },
    );

    const pendingNote =
      notProcessed.length > 0
        ? `\n\nDOCUMENTOS NÃO CONSIDERADOS: ${notProcessed
            .map((d) => d.filename)
            .slice(0, 10)
            .join(", ")} (ainda não indexados).`
        : "";

    const summary = stripMarkdown(rawSummary) + pendingNote;

    await context.supabase
      .from("cases")
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq("id", data.case_id);

    return { summary, documents_summarized: perDoc.length, documents_pending: notProcessed.length };
  });
