import type { NormalizedPublication } from "../normalize";
import { normalizeCnj } from "../normalize";

const DJEN_BASE = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

type DjenRow = {
  id?: number | string;
  numero_processo?: string;
  siglaTribunal?: string;
  nomeOrgao?: string;
  texto?: string;
  data_disponibilizacao?: string; // YYYY-MM-DD
  link?: string;
};

type DjenResponse = {
  status?: string;
  items?: DjenRow[];
  count?: number;
};

export type DjenParams = {
  /** OAB completa, ex 123456/SP. */
  numeroOab?: string;
  /** Nome do advogado. */
  nomeAdvogado?: string;
  /** Nome da parte. */
  nomeParte?: string;
  /** CNJ. */
  numeroProcesso?: string;
  /** ISO date (YYYY-MM-DD). Padrão: 7 dias atrás. */
  dataDisponibilizacaoInicio?: string;
  dataDisponibilizacaoFim?: string;
  /** Máx. 100. */
  itensPorPagina?: number;
};

function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildQuery(p: DjenParams): string {
  const q = new URLSearchParams();
  q.set("dataDisponibilizacaoInicio", p.dataDisponibilizacaoInicio ?? todayISO(-7));
  q.set("dataDisponibilizacaoFim", p.dataDisponibilizacaoFim ?? todayISO(0));
  q.set("itensPorPagina", String(p.itensPorPagina ?? 50));

  if (p.numeroOab) {
    // DJEN aceita "numeroOab=123456&ufOab=SP" separados
    const [num, uf] = p.numeroOab.split("/");
    if (num) q.set("numeroOab", num.replace(/\D/g, ""));
    if (uf) q.set("ufOab", uf.toUpperCase());
  }
  if (p.nomeAdvogado) q.set("nomeAdvogado", p.nomeAdvogado);
  if (p.nomeParte) q.set("nomeParte", p.nomeParte);
  if (p.numeroProcesso) q.set("numeroProcesso", p.numeroProcesso.replace(/\D/g, ""));
  return q.toString();
}

export type DjenFetchResult = {
  ok: boolean;
  httpStatus?: number;
  latencyMs: number;
  error?: string;
  publications: NormalizedPublication[];
};

/**
 * Consulta a API pública do DJEN (CNJ). Sem chave, gratuita.
 * Docs: https://comunicaapi.pje.jus.br/swagger
 */
export async function fetchFromDJEN(params: DjenParams): Promise<DjenFetchResult> {
  const started = Date.now();
  const url = `${DJEN_BASE}?${buildQuery(params)}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const latency = Date.now() - started;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        httpStatus: res.status,
        latencyMs: latency,
        error: `DJEN ${res.status}: ${body.slice(0, 200)}`,
        publications: [],
      };
    }

    const json = (await res.json()) as DjenResponse;
    const items = json.items ?? [];
    const publications: NormalizedPublication[] = items.map((row) => ({
      source: "djen",
      external_id: row.id != null ? String(row.id) : null,
      tribunal: row.siglaTribunal ?? null,
      orgao: row.nomeOrgao ?? null,
      publication_date: row.data_disponibilizacao ?? null,
      cnj: normalizeCnj(row.numero_processo ?? null),
      content: (row.texto ?? "").trim(),
      url_original: row.link ?? null,
    }));

    return {
      ok: true,
      httpStatus: res.status,
      latencyMs: latency,
      publications: publications.filter((p) => p.content.length > 0),
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
      publications: [],
    };
  }
}
