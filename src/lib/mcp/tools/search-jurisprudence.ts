import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { withAudit } from "../with-audit";

/**
 * search_jurisprudence — busca decisões judiciais em sites oficiais
 * (STF, STJ, TST, TSE e TJs estaduais) usando o Firecrawl como camada
 * de busca. Requer a capacidade `cases` (ou `super_admin`) e um bearer
 * OAuth Supabase válido — a checagem passa pela RPC has_capability
 * como o próprio usuário.
 */

const COURT_DOMAINS: Record<string, string[]> = {
  STF: ["portal.stf.jus.br", "jurisprudencia.stf.jus.br"],
  STJ: ["scon.stj.jus.br", "processo.stj.jus.br"],
  TST: ["jurisprudencia.tst.jus.br", "tst.jus.br"],
  TSE: ["tse.jus.br"],
  TJSP: ["esaj.tjsp.jus.br", "tjsp.jus.br"],
  TJRJ: ["www4.tjrj.jus.br", "tjrj.jus.br"],
  TJMG: ["tjmg.jus.br"],
  TJRS: ["tjrs.jus.br"],
  TJPR: ["tjpr.jus.br"],
  TJDFT: ["tjdft.jus.br"],
};

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

type SearchHit = {
  url: string;
  court: string;
  title: string;
  date: string | null;
  snippet: string;
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT_URL = "https://api.firecrawl.dev/v2";

async function firecrawlSearch(query: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) throw new Error("Firecrawl não configurado (FIRECRAWL_API_KEY ausente).");

  const isGateway = fcKey.startsWith("lovc_");
  const url = `${isGateway ? GATEWAY_URL : DIRECT_URL}/search`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (isGateway) {
    const lovKey = process.env.LOVABLE_API_KEY;
    if (!lovKey) throw new Error("LOVABLE_API_KEY ausente para chamada gateway.");
    headers["Authorization"] = `Bearer ${lovKey}`;
    headers["X-Connection-Api-Key"] = fcKey;
  } else {
    headers["Authorization"] = `Bearer ${fcKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      limit,
      lang: "pt",
      country: "br",
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { data?: unknown[] };
  return (json.data ?? []) as Array<Record<string, unknown>>;
}

function inferCourt(url: string): string {
  for (const [court, domains] of Object.entries(COURT_DOMAINS)) {
    if (domains.some((d) => url.includes(d))) return court;
  }
  return "Outro";
}

function extractDate(text: string): string | null {
  // dd/mm/yyyy ou dd.mm.yyyy ou ISO
  const br = text.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

function buildSnippet(markdown: string | undefined, description: string | undefined): string {
  const source = (markdown ?? "").trim() || (description ?? "").trim();
  if (!source) return "";
  const clean = source.replace(/\s+/g, " ").slice(0, 480);
  return clean.length < source.length ? `${clean}…` : clean;
}

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
    "Pesquisa decisões judiciais em tribunais brasileiros (STF, STJ, TST, TSE, TJs). Retorna URL, tribunal, data e trechos relevantes. Requer capacidade 'cases' do usuário autenticado.",
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

    const targetCourts = courts && courts.length ? courts : (Object.keys(COURT_DOMAINS) as string[]);
    const siteFilter = targetCourts
      .flatMap((c) => COURT_DOMAINS[c] ?? [])
      .map((d) => `site:${d}`)
      .join(" OR ");
    const fullQuery = `${query} (${siteFilter})`;

    let raw: Array<Record<string, unknown>>;
    try {
      raw = await firecrawlSearch(fullQuery, limit ?? 8);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [
          {
            type: "text",
            text: `Falha na busca: ${msg}. Verifique se o conector Firecrawl está ativo no workspace.`,
          },
        ],
        isError: true,
      };
    }

    const hits: SearchHit[] = raw.map((r) => {
      const url = String(r.url ?? "");
      const title = String(r.title ?? url);
      const md = typeof r.markdown === "string" ? (r.markdown as string) : undefined;
      const desc = typeof r.description === "string" ? (r.description as string) : undefined;
      return {
        url,
        court: inferCourt(url),
        title,
        date: extractDate(`${title} ${md ?? ""} ${desc ?? ""}`),
        snippet: buildSnippet(md, desc),
      };
    });

    const text = hits.length
      ? hits
          .map(
            (h, i) =>
              `${i + 1}. [${h.court}] ${h.title}\n   ${h.url}\n   ${h.date ?? "data não identificada"}\n   ${h.snippet}`,
          )
          .join("\n\n")
      : "Nenhum resultado encontrado.";

    return {
      content: [{ type: "text", text }],
      structuredContent: { query, courts: targetCourts, results: hits },
    };
  }),
});
