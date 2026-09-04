/**
 * Serviço compartilhado de pesquisa jurisprudencial.
 *
 * Usado pelo chat do caso (ferramenta `search_jurisprudence`) e pelo servidor
 * MCP. Pesquisa apenas em domínios oficiais de tribunais brasileiros e devolve
 * resultados normalizados com procedência (tribunal, número, data, URL oficial
 * e data da consulta). Nunca inventa precedentes: se o provedor falhar, o
 * retorno indica indisponibilidade.
 *
 * A chave do provedor permanece exclusivamente no servidor.
 */

export const COURT_DOMAINS: Record<string, string[]> = {
  STF: ["portal.stf.jus.br", "jurisprudencia.stf.jus.br", "stf.jus.br"],
  STJ: ["scon.stj.jus.br", "processo.stj.jus.br", "stj.jus.br"],
  TST: ["jurisprudencia.tst.jus.br", "tst.jus.br"],
  TSE: ["tse.jus.br"],
  TJSP: ["esaj.tjsp.jus.br", "tjsp.jus.br"],
  TJRJ: ["www4.tjrj.jus.br", "tjrj.jus.br"],
  TJMG: ["tjmg.jus.br"],
  TJRS: ["tjrs.jus.br"],
  TJPR: ["tjpr.jus.br"],
  TJDFT: ["tjdft.jus.br"],
};

export const SUPPORTED_COURTS = Object.keys(COURT_DOMAINS);

export interface JurisprudenceHit {
  /** Rótulo de referência externa exibido na resposta: J1, J2, ... */
  ref: string;
  court: string;
  /** Órgão julgador (turma/câmara/seção), quando identificável. */
  panel: string | null;
  process_number: string | null;
  /** ISO (YYYY-MM-DD) quando identificável. */
  date: string | null;
  title: string;
  snippet: string;
  url: string;
  /** Data/hora em que a consulta foi feita (ISO). */
  consulted_at: string;
}

export interface JurisprudenceSearchResult {
  ok: boolean;
  query: string;
  courts: string[];
  results: JurisprudenceHit[];
  consulted_at: string;
  /** Mensagem para o usuário quando a pesquisa está indisponível. */
  error?: string;
}

export type ProviderHit = {
  url?: unknown;
  title?: unknown;
  description?: unknown;
  markdown?: unknown;
};

/** Provedor de busca injetável — os testes passam respostas simuladas. */
export type SearchProvider = (query: string, limit: number) => Promise<ProviderHit[]>;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT_URL = "https://api.firecrawl.dev/v2";

export function buildSiteQuery(query: string, courts: string[]): string {
  const domains = courts.flatMap((c) => COURT_DOMAINS[c] ?? []);
  const unique = Array.from(new Set(domains));
  if (unique.length === 0) return query;
  return `${query} (${unique.map((d) => `site:${d}`).join(" OR ")})`;
}

export function isOfficialUrl(url: string): boolean {
  const all = Object.values(COURT_DOMAINS).flat();
  try {
    const host = new URL(url).hostname.toLowerCase();
    return all.some((d) => host === d || host.endsWith(`.${d}`) || d.endsWith(host));
  } catch {
    return false;
  }
}

export function inferCourt(url: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [court, domains] of Object.entries(COURT_DOMAINS)) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return court;
  }
  return null;
}

export function extractDate(text: string): string | null {
  const br = text.match(/(\d{2})[/.](\d{2})[/.](\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

/** Número CNJ (0000000-00.0000.0.00.0000) ou formatos clássicos de recurso. */
export function extractProcessNumber(text: string): string | null {
  const cnj = text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
  if (cnj) return cnj[0];
  const classic = text.match(/\b(?:REsp|AREsp|RE|ARE|AI|RR|AIRR|HC|MS|ADI|ADPF)\s?n?º?\s?[\d.]{3,}/i);
  return classic ? classic[0].replace(/\s+/g, " ").trim() : null;
}

/** Órgão julgador, quando o texto do resultado oficial o menciona. */
export function extractPanel(text: string): string | null {
  const m = text.match(
    /\b((?:Primeira|Segunda|Terceira|Quarta|Quinta|Sexta|Sétima|Oitava|Nona|Décima|1ª|2ª|3ª|4ª|5ª|6ª|7ª|8ª|9ª)\s+(?:Turma|Câmara|Seção|Turma Recursal)|Tribunal Pleno|Plenário|Corte Especial|Órgão Especial|Subseção I|Subseção II)\b/i,
  );
  return m ? m[1] : null;
}

export function buildSnippet(hit: ProviderHit, max = 480): string {
  const md = typeof hit.markdown === "string" ? hit.markdown : "";
  const desc = typeof hit.description === "string" ? hit.description : "";
  const source = (md.trim() || desc.trim()).replace(/\s+/g, " ").trim();
  if (!source) return "";
  return source.length > max ? `${source.slice(0, max)}…` : source;
}

/**
 * Converte a resposta bruta do provedor em resultados verificáveis.
 * Descarta qualquer URL que não seja de domínio oficial autorizado.
 */
export function normalizeHits(
  raw: ProviderHit[],
  consultedAt: string,
  allowedCourts?: string[],
): JurisprudenceHit[] {
  const allowed = allowedCourts && allowedCourts.length ? new Set(allowedCourts) : null;
  const seen = new Set<string>();
  const out: JurisprudenceHit[] = [];

  for (const hit of raw) {
    const url = typeof hit.url === "string" ? hit.url.trim() : "";
    if (!url || !isOfficialUrl(url) || seen.has(url)) continue;
    const court = inferCourt(url);
    if (!court) continue;
    if (allowed && !allowed.has(court)) continue;
    seen.add(url);

    const title = (typeof hit.title === "string" && hit.title.trim()) || url;
    const snippet = buildSnippet(hit);
    const haystack = `${title} ${snippet}`;

    out.push({
      ref: `J${out.length + 1}`,
      court,
      panel: extractPanel(haystack),
      process_number: extractProcessNumber(haystack),
      date: extractDate(haystack),
      title: title.replace(/\s+/g, " ").slice(0, 220),
      snippet,
      url,
      consulted_at: consultedAt,
    });
  }

  return out;
}

async function firecrawlProvider(query: string, limit: number): Promise<ProviderHit[]> {
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) {
    throw new Error("Pesquisa jurisprudencial indisponível: provedor de busca não configurado.");
  }

  const isGateway = fcKey.startsWith("lovc_");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isGateway) {
    const lovKey = process.env.LOVABLE_API_KEY;
    if (!lovKey) throw new Error("Pesquisa jurisprudencial indisponível: credencial ausente.");
    headers["Authorization"] = `Bearer ${lovKey}`;
    headers["X-Connection-Api-Key"] = fcKey;
  } else {
    headers["Authorization"] = `Bearer ${fcKey}`;
  }

  const res = await fetch(`${isGateway ? GATEWAY_URL : DIRECT_URL}/search`, {
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
    throw new Error(`Provedor de busca respondeu ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data?: unknown[] };
  return (json.data ?? []) as ProviderHit[];
}

export async function searchJurisprudence(params: {
  query: string;
  courts?: string[];
  limit?: number;
  /** Injetado nos testes; em produção usa o provedor real. */
  provider?: SearchProvider;
}): Promise<JurisprudenceSearchResult> {
  const consultedAt = new Date().toISOString();
  const courts =
    params.courts && params.courts.length
      ? params.courts.filter((c) => SUPPORTED_COURTS.includes(c))
      : SUPPORTED_COURTS;
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 15);
  const provider = params.provider ?? firecrawlProvider;

  try {
    const raw = await provider(buildSiteQuery(params.query, courts), limit);
    return {
      ok: true,
      query: params.query,
      courts,
      results: normalizeHits(raw, consultedAt, courts).slice(0, limit),
      consulted_at: consultedAt,
    };
  } catch (err) {
    return {
      ok: false,
      query: params.query,
      courts,
      results: [],
      consulted_at: consultedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Texto plano para o MCP e para o histórico do chat. */
export function formatJurisprudenceText(result: JurisprudenceSearchResult): string {
  if (!result.ok) return `Pesquisa jurisprudencial indisponível: ${result.error}`;
  if (result.results.length === 0) {
    return "Nenhum resultado encontrado nas fontes oficiais consultadas.";
  }
  return result.results
    .map((h) =>
      [
        `[${h.ref}] ${h.court}${h.panel ? ` · ${h.panel}` : ""}${
          h.process_number ? ` · ${h.process_number}` : ""
        }${h.date ? ` · ${h.date}` : ""}`,
        h.title,
        h.snippet,
        `Fonte oficial: ${h.url} (consulta em ${h.consulted_at})`,
      ].join("\n"),
    )
    .join("\n\n");
}
