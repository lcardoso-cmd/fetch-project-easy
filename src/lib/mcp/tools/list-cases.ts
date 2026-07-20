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

const SORTABLE = ["created_at", "updated_at", "title", "client_name", "status"] as const;

export default defineTool({
  name: "list_cases",
  title: "Listar casos",
  description:
    "Lista casos do usuário com paginação, ordenação e filtros (status, tipo, jurisdição/tribunal, busca textual, intervalo de datas de criação). Retorna também 'total' e 'nextOffset' para paginação consistente.",
  inputSchema: {
    status: z.enum(["active", "archived", "closed", "all"]).optional(),
    case_type: z.string().optional().describe("Filtra por tipo de caso."),
    jurisdiction: z
      .string()
      .optional()
      .describe("Filtra por jurisdição/tribunal (ex.: 'STF', 'TJSP'). Substring, case-insensitive."),
    search: z
      .string()
      .optional()
      .describe("Busca textual em título, cliente ou número CNJ."),
    created_from: z.string().optional().describe("Data ISO inicial (created_at >=)."),
    created_to: z.string().optional().describe("Data ISO final (created_at <)."),
    sort_by: z.enum(SORTABLE).optional().describe("Padrão: created_at."),
    sort_dir: z.enum(["asc", "desc"]).optional().describe("Padrão: desc."),
    limit: z.number().int().min(1).max(100).optional().describe("Padrão 25."),
    offset: z.number().int().min(0).optional().describe("Padrão 0."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const limit = input.limit ?? 25;
    const offset = input.offset ?? 0;
    const sortBy = input.sort_by ?? "created_at";
    const ascending = (input.sort_dir ?? "desc") === "asc";

    let q = sb
      .from("cases")
      .select(
        "id, title, client_name, case_number, jurisdiction, case_type, status, created_at, updated_at",
        { count: "exact" },
      )
      .eq("user_id", ctx.getUserId()!);

    if (input.status && input.status !== "all") q = q.eq("status", input.status);
    if (input.case_type) q = q.eq("case_type", input.case_type);
    if (input.jurisdiction) q = q.ilike("jurisdiction", `%${input.jurisdiction}%`);
    if (input.created_from) q = q.gte("created_at", input.created_from);
    if (input.created_to) q = q.lt("created_at", input.created_to);
    if (input.search) {
      const s = input.search.replace(/[,()]/g, " ").trim();
      q = q.or(
        `title.ilike.%${s}%,client_name.ilike.%${s}%,case_number.ilike.%${s}%`,
      );
    }

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
          text: JSON.stringify({ total, count: rows.length, offset, nextOffset, results: rows }, null, 2),
        },
      ],
      structuredContent: { total, count: rows.length, offset, nextOffset, results: rows },
    };
  },
});
