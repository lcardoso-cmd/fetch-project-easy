import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { withAudit } from "../with-audit";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const SORTABLE = ["created_at", "updated_at", "filename", "file_size", "processing_status"] as const;

export default defineTool({
  name: "list_documents",
  title: "Listar documentos",
  description:
    "Lista documentos do usuário com paginação, ordenação e filtros (caso, status de indexação, tipo de arquivo, busca por nome, período). O 'case_id' é opcional — sem ele lista todos os documentos do usuário. Retorna 'total' e 'nextOffset'.",
  inputSchema: {
    case_id: z.string().uuid().optional().describe("Filtra por caso."),
    processing_status: z
      .enum(["pending", "processing", "ready", "error", "all"])
      .optional()
      .describe("Filtra por status de indexação."),
    file_type: z.string().optional().describe("Filtra por MIME/tipo (substring, case-insensitive)."),
    search: z.string().optional().describe("Busca em filename."),
    created_from: z.string().optional().describe("created_at >= (ISO)."),
    created_to: z.string().optional().describe("created_at < (ISO)."),
    sort_by: z.enum(SORTABLE).optional().describe("Padrão: created_at."),
    sort_dir: z.enum(["asc", "desc"]).optional().describe("Padrão: desc."),
    limit: z.number().int().min(1).max(200).optional().describe("Padrão 50."),
    offset: z.number().int().min(0).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const sortBy = input.sort_by ?? "created_at";
    const ascending = (input.sort_dir ?? "desc") === "asc";

    let q = sb
      .from("documents")
      .select(
        "id, case_id, filename, file_type, file_size, processing_status, created_at, updated_at",
        { count: "exact" },
      )
      .eq("user_id", ctx.getUserId()!);

    if (input.case_id) q = q.eq("case_id", input.case_id);
    if (input.processing_status && input.processing_status !== "all")
      q = q.eq("processing_status", input.processing_status);
    if (input.file_type) q = q.ilike("file_type", `%${input.file_type}%`);
    if (input.search) q = q.ilike("filename", `%${input.search}%`);
    if (input.created_from) q = q.gte("created_at", input.created_from);
    if (input.created_to) q = q.lt("created_at", input.created_to);

    q = q.order(sortBy, { ascending }).range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const total = count ?? rows.length;
    const nextOffset = offset + rows.length < total ? offset + rows.length : null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ total, count: rows.length, offset, nextOffset, documents: rows }, null, 2),
        },
      ],
      structuredContent: { total, count: rows.length, offset, nextOffset, documents: rows },
    };
  },
});
