import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskSchema = z.object({
  case_id: z.string().uuid().optional(),
  question: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(20)
    .optional(),
});

interface Citation {
  document_id: string;
  filename: string;
  snippet: string;
  similarity: number;
}

export const askWithRag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AskSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { embedTexts, chatComplete } = await import("./ai.server");

    // 1. Embedding da pergunta
    const [qEmb] = await embedTexts([data.question]);
    if (!qEmb) throw new Error("Falha ao gerar embedding");

    // 2. Buscar trechos relevantes (escopo por user; se case_id, filtra depois)
    const { data: matches, error } = await context.supabase.rpc("match_chunks", {
      query_embedding: qEmb as unknown as string,
      match_count: 8,
      filter_user_id: context.userId,
    });
    if (error) throw error;

    const filtered = (matches ?? []).filter(
      (m: { case_id: string }) => !data.case_id || m.case_id === data.case_id,
    );

    // 3. Resolver nomes dos arquivos
    const docIds = Array.from(new Set(filtered.map((m: { document_id: string }) => m.document_id)));
    const { data: docs } = await context.supabase
      .from("documents")
      .select("id, filename")
      .in("id", docIds.length ? docIds : ["00000000-0000-0000-0000-000000000000"]);
    const nameById = new Map((docs ?? []).map((d) => [d.id, d.filename]));

    const citations: Citation[] = filtered.map(
      (m: { document_id: string; content: string; similarity: number }) => ({
        document_id: m.document_id,
        filename: nameById.get(m.document_id) ?? "documento",
        snippet: m.content.slice(0, 400),
        similarity: m.similarity,
      }),
    );

    // 4. Montar prompt
    const contextBlock = filtered.length
      ? filtered
          .map(
            (m: { content: string; document_id: string }, idx: number) =>
              `[${idx + 1}] (${nameById.get(m.document_id) ?? "doc"})\n${m.content}`,
          )
          .join("\n\n---\n\n")
      : "(Nenhum trecho relevante encontrado nos documentos indexados.)";

    const systemPrompt = `Você é o JurisMind, assistente jurídico em português brasileiro. \
Responda à pergunta do(a) advogado(a) usando EXCLUSIVAMENTE o contexto fornecido abaixo. \
Cite as fontes ao final no formato [n] indicando o número entre colchetes do trecho. \
Se o contexto for insuficiente, diga claramente que não há informação nos documentos.\n\n\
CONTEXTO:\n${contextBlock}`;

    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...(data.history ?? []).map((h) => ({ role: h.role, content: h.content })),
      { role: "user" as const, content: data.question },
    ];

    const answer = await chatComplete(messages, { temperature: 0.2 });
    return { answer, citations };
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
    const summary = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você é o JurisMind. Gere um resumo executivo em português do caso jurídico a partir dos trechos fornecidos. Estruture em: (1) Visão geral, (2) Partes envolvidas, (3) Pontos-chave, (4) Próximos passos sugeridos. Máximo 400 palavras.",
        },
        { role: "user", content: text.slice(0, 30_000) },
      ],
      { temperature: 0.3 },
    );

    await context.supabase
      .from("cases")
      .update({ summary, summary_updated_at: new Date().toISOString() })
      .eq("id", data.case_id)
      .eq("user_id", context.userId);

    return { summary };
  });
