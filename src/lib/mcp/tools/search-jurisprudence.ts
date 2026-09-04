import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { withAudit } from "../with-audit";
import {
  SUPPORTED_COURTS,
  formatJurisprudenceText,
  searchJurisprudence,
} from "@/lib/jurisprudence/jurisprudence-search.server";

/**
 * search_jurisprudence — busca decisões judiciais em sites oficiais
 * (STF, STJ, TST, TSE e TJs estaduais). A lógica de busca e normalização
 * é a mesma usada pelo chat do caso: src/lib/jurisprudence/jurisprudence-search.server.ts
 */

const CourtEnum = z.enum([
  "STF",
  "STJ",
  "TST",
  "TSE",
  "TJSP",
  "TJRJ",
  "TJMG",
  "TJRS",
  "TJPR",
  "TJDFT",
]);

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireCasesCapability(ctx: ToolContext): Promise<string | null> {
  const sb = supabaseForUser(ctx);
  const [{ data: isAdmin }, { data: canCases }] = await Promise.all([
    sb.rpc("has_capability", { _user_id: ctx.getUserId()!, _capability: "super_admin" }),
    sb.rpc("has_capability", { _user_id: ctx.getUserId()!, _capability: "cases" }),
  ]);
  if (isAdmin === true || canCases === true) return null;
  return "Acesso negado: é necessária a capacidade 'cases' para pesquisar jurisprudência.";
}

export default defineTool({
  name: "search_jurisprudence",
  title: "Buscar jurisprudência",
  description:
    "Pesquisa decisões judiciais em tribunais brasileiros (STF, STJ, TST, TSE, TJs). Retorna URL oficial, tribunal, órgão julgador, número, data e trechos. Requer capacidade 'cases' do usuário autenticado.",
  inputSchema: {
    query: z.string().min(3).max(500).describe("Termos de busca (ex: 'dano moral extravio bagagem STJ')."),
    courts: z
      .array(CourtEnum)
      .optional()
      .describe("Restringe a tribunais específicos. Vazio = todos os suportados."),
    limit: z.number().int().min(1).max(15).optional().describe("Máx. de resultados (padrão 8)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: withAudit("search_jurisprudence", async ({ query, courts, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const denied = await requireCasesCapability(ctx);
    if (denied) return { content: [{ type: "text", text: denied }], isError: true };

    const result = await searchJurisprudence({
      query,
      courts: courts ?? SUPPORTED_COURTS,
      limit,
    });

    if (!result.ok) {
      return {
        content: [{ type: "text", text: formatJurisprudenceText(result) }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: formatJurisprudenceText(result) }],
      structuredContent: {
        query: result.query,
        courts: result.courts,
        consulted_at: result.consulted_at,
        results: result.results,
      },
    };
  }),
});
