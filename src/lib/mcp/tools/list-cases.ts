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
  name: "list_cases",
  title: "Listar casos",
  description:
    "Lista os casos (processos, perícias e assistências técnicas) do usuário autenticado no JurisMind. Retorna id, título, cliente, número CNJ, jurisdição, tipo e status.",
  inputSchema: {
    status: z
      .enum(["active", "archived", "closed", "all"])
      .optional()
      .describe("Filtra por status. Padrão: todos."),
    limit: z.number().int().min(1).max(100).optional().describe("Máx. de casos (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("cases")
      .select("id, title, client_name, case_number, jurisdiction, case_type, status, created_at")
      .eq("user_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status && status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { cases: data ?? [] },
    };
  },
});
