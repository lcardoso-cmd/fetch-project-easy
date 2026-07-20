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

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description:
    "Cria uma nova tarefa para o usuário autenticado no JurisMind, opcionalmente vinculada a um caso.",
  inputSchema: {
    title: z.string().min(1).max(300).describe("Título da tarefa."),
    description: z.string().max(4000).optional().describe("Descrição opcional."),
    case_id: z.string().uuid().optional().describe("UUID do caso vinculado (opcional)."),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    due_date: z.string().optional().describe("Data ISO (YYYY-MM-DD) do prazo."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: withAudit("create_task", async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("tasks")
      .insert({
        user_id: ctx.getUserId()!,
        title: input.title,
        description: input.description ?? null,
        case_id: input.case_id ?? null,
        priority: input.priority ?? "medium",
        status: "pending",
        due_date: input.due_date ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Tarefa criada: ${data.id}` }],
      structuredContent: { task: data },
    };
  }),
});
