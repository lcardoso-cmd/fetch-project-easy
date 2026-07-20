import type { NormalizedPublication } from "../normalize";
import { normalizeCnj } from "../normalize";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT_URL = "https://api.firecrawl.dev/v2";

type FirecrawlHit = {
  url?: string;
  title?: string;
  description?: string;
  markdown?: string;
};

/** Domínios de DJE por UF que ficam de fora do DJEN nacional. */
const FALLBACK_DOMAINS = [
  "dje.tjsp.jus.br",
  "www.tjrj.jus.br",
  "www.tjmg.jus.br",
  "tjmg.jus.br",
  "tjrs.jus.br",
  "www.tjpr.jus.br",
];

export type FirecrawlSourceResult = {
  ok: boolean;
  httpStatus?: number;
  latencyMs: number;
  error?: string;
  publications: NormalizedPublication[];
};

async function firecrawlSearch(query: string, limit: number): Promise<{ status: number; hits: FirecrawlHit[] }> {
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) throw new Error("FIRECRAWL_API_KEY ausente");
  const isGateway = fcKey.startsWith("lovc_");
  const url = `${isGateway ? GATEWAY_URL : DIRECT_URL}/search`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isGateway) {
    const lov = process.env.LOVABLE_API_KEY;
    if (!lov) throw new Error("LOVABLE_API_KEY ausente");
    headers.Authorization = `Bearer ${lov}`;
    headers["X-Connection-Api-Key"] = fcKey;
  } else {
    headers.Authorization = `Bearer ${fcKey}`;
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
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Firecrawl ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: FirecrawlHit[] };
  return { status: res.status, hits: json.data ?? [] };
}

export async function fetchFromFirecrawl(params: {
  query: string;
  limit?: number;
  domains?: string[];
}): Promise<FirecrawlSourceResult> {
  const started = Date.now();
  const domains = params.domains ?? FALLBACK_DOMAINS;
  const siteFilter = domains.map((d) => `site:${d}`).join(" OR ");
  const q = `"${params.query}" (${siteFilter})`;
  try {
    const { status, hits } = await firecrawlSearch(q, Math.min(params.limit ?? 10, 15));
    const latency = Date.now() - started;
    const publications: NormalizedPublication[] = hits
      .filter((h) => (h.markdown ?? h.description ?? "").trim().length > 20)
      .map((h) => {
        const content = (h.markdown ?? h.description ?? "").trim();
        const cnjMatch = content.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}|\d{20}/);
        return {
          source: "firecrawl" as const,
          external_id: null,
          tribunal: guessTribunal(h.url ?? ""),
          orgao: null,
          publication_date: null,
          cnj: cnjMatch ? normalizeCnj(cnjMatch[0]) : null,
          content,
          url_original: h.url ?? null,
        };
      });
    return { ok: true, httpStatus: status, latencyMs: latency, publications };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      publications: [],
    };
  }
}

function guessTribunal(url: string): string | null {
  const m = url.match(/tj([a-z]{2})\.jus\.br/i);
  if (m) return `TJ${m[1].toUpperCase()}`;
  if (url.includes("stj.jus.br")) return "STJ";
  if (url.includes("stf.jus.br")) return "STF";
  if (url.includes("tst.jus.br")) return "TST";
  if (url.includes("trf")) {
    const t = url.match(/trf(\d)/i);
    return t ? `TRF${t[1]}` : "TRF";
  }
  return null;
}
