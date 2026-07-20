import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const SORTABLE = ["created_at", "updated_at", "due_date", "priority", "status", "title"] as const;

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description:
    "Lista tarefas do usuário com paginação, ordenação e filtros (caso, status, prioridade, intervalo de due_date, busca textual). Retorna 'total' e 'nextOffset'.",
  inputSchema: {
    case_id: z.string().uuid().optional(),
    status: z.enum(["pending", "in_progress", "blocked", "done", "all"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent", "all"]).optional(),
    due_from: z.string().optional().describe("due_date >= (ISO)."),
    due_to: z.string().optional().describe("due_date < (ISO)."),
    overdue: z.boolean().optional().describe("Se true, retorna apenas tarefas vencidas não concluídas."),
    search: z.string().optional().describe("Busca em título/descrição."),
    sort_by: z.enum(SORTABLE).optional().describe("Padrão: created_at."),
    sort_dir: z.enum(["asc", "desc"]).optional().describe("Padrão: desc."),
    limit: z.number().int().min(1).max(200).optional(),
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
      .from("tasks")
      .select("id, title, description, status, priority, due_date, case_id, created_at, updated_at", {
        count: "exact",
      })
      .eq("user_id", ctx.getUserId()!);

    if (input.case_id) q = q.eq("case_id", input.case_id);
    if (input.status && input.status !== "all") q = q.eq("status", input.status);
    if (input.priority && input.priority !== "all") q = q.eq("priority", input.priority);
    if (input.due_from) q = q.gte("due_date", input.due_from);
    if (input.due_to) q = q.lt("due_date", input.due_to);
    if (input.overdue) q = q.lt("due_date", new Date().toISOString()).neq("status", "done");
    if (input.search) {
      const s = input.search.replace(/[,()]/g, " ").trim();
      q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }

    q = q.order(sortBy, { ascending, nullsFirst: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const total = count ?? rows.length;
    const nextOffset = offset + rows.length < total ? offset + rows.length : null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ total, count: rows.length, offset, nextOffset, tasks: rows }, null, 2),
        },
      ],
      structuredContent: { total, count: rows.length, offset, nextOffset, tasks: rows },
    };
  },
});
