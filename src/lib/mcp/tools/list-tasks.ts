import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description:
    "Lista as tarefas do usuário no JurisMind, opcionalmente filtradas por caso e por status (pending, in_progress, blocked, done).",
  inputSchema: {
    case_id: z.string().uuid().optional().describe("Filtra por caso."),
    status: z
      .enum(["pending", "in_progress", "blocked", "done", "all"])
      .optional()
      .describe("Filtra por status."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ case_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("tasks")
      .select("id, title, description, status, priority, due_date, case_id, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 100);
    if (case_id) q = q.eq("case_id", case_id);
    if (status && status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});
