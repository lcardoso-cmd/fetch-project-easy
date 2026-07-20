import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Hit = {
  id: string;
  document_id: string;
  case_id: string | null;
  content: string;
  score?: number | null;
  vector_similarity?: number | null;
};

export default defineTool({
  name: "search_documents",
  title: "Buscar nos documentos (RAG)",
  description:
    "Faz busca semântica + textual (RAG híbrido) nos documentos do usuário no JurisMind. Retorna trechos relevantes com o id do documento e do caso. Pode ser escopado a um caso específico.",
  inputSchema: {
    query: z.string().min(2).max(500).describe("Pergunta ou termo a buscar."),
    case_id: z
      .string()
      .uuid()
      .optional()
      .describe("Se informado, restringe a busca a esse caso."),
    limit: z.number().int().min(1).max(20).optional().describe("Máx. de trechos (padrão 8)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, case_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const matchCount = limit ?? 8;

    // Embedding via Lovable AI Gateway
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { content: [{ type: "text", text: "LOVABLE_API_KEY ausente" }], isError: true };
    }
    const embRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: query,
      }),
    });
    if (!embRes.ok) {
      const t = await embRes.text();
      return {
        content: [{ type: "text", text: `Falha ao gerar embedding: ${embRes.status} ${t}` }],
        isError: true,
      };
    }
    const embJson = (await embRes.json()) as { data?: Array<{ embedding: number[] }> };
    const embedding = embJson.data?.[0]?.embedding;
    if (!embedding) {
      return { content: [{ type: "text", text: "Embedding vazio" }], isError: true };
    }

    const { data, error } = await sb.rpc("hybrid_search_chunks", {
      query_embedding: embedding as unknown as string,
      query_text: query,
      filter_user_id: userId,
      filter_case_id: case_id ?? undefined,
      match_count: matchCount,
    });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const hits = (data ?? []) as Hit[];
    const text = hits.length
      ? hits
          .map(
            (h, i) =>
              `[${i + 1}] doc=${h.document_id} case=${h.case_id ?? "—"} score=${(h.score ?? h.vector_similarity ?? 0).toFixed(3)}\n${h.content}`,
          )
          .join("\n\n---\n\n")
      : "Nenhum trecho encontrado.";

    return {
      content: [{ type: "text", text }],
      structuredContent: { hits },
    };
  },
});
