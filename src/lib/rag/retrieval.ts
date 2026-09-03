// Fusão, diversidade e suficiência documental — puro, testável e versionado.

export const RETRIEVAL_VERSION_LEGACY = "retrieval-v1";
export const RETRIEVAL_VERSION = "retrieval-v2";

export interface Candidate {
  id: string;
  document_id: string;
  content: string;
  source_kind: string;
  vector_similarity: number | null;
  fts_rank: number | null;
  chunk_index?: number | null;
  page_start?: number | null;
  page_end?: number | null;
  section_title?: string | null;
  sheet_name?: string | null;
  row_start?: number | null;
  row_end?: number | null;
}

export interface Fused extends Candidate {
  score: number;
  best_rank: number;
  hits: number;
}

/** Reciprocal Rank Fusion sobre listas ordenadas de candidatos. */
export function rrfFuse(lists: Candidate[][], k = 60): Fused[] {
  const acc = new Map<string, Fused>();
  for (const list of lists) {
    list.forEach((row, idx) => {
      const rank = idx + 1;
      const contribution = 1 / (k + rank);
      const cur = acc.get(row.id);
      if (cur) {
        cur.score += contribution;
        cur.hits += 1;
        cur.best_rank = Math.min(cur.best_rank, rank);
      } else {
        acc.set(row.id, { ...row, score: contribution, best_rank: rank, hits: 1 });
      }
    });
  }
  return Array.from(acc.values()).sort(
    (a, b) => b.score - a.score || a.best_rank - b.best_rank || a.id.localeCompare(b.id),
  );
}

/**
 * Limita quantos trechos do mesmo documento entram no topo, mantendo a ordem
 * relativa. Os excedentes vão para o fim da lista (não são descartados).
 */
export function diversifyByDocument<T extends { document_id: string }>(
  rows: T[],
  maxPerDoc: number,
): T[] {
  if (maxPerDoc <= 0) return rows;
  const count = new Map<string, number>();
  const primary: T[] = [];
  const overflow: T[] = [];
  for (const r of rows) {
    const n = count.get(r.document_id) ?? 0;
    if (n < maxPerDoc) {
      primary.push(r);
      count.set(r.document_id, n + 1);
    } else {
      overflow.push(r);
    }
  }
  return [...primary, ...overflow];
}

/** Remove trechos cujo conteúdo já está praticamente contido em outro melhor colocado. */
export function dedupeOverlapping<T extends { content: string }>(rows: T[]): T[] {
  const kept: T[] = [];
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  for (const r of rows) {
    const a = norm(r.content);
    if (!a) continue;
    const dup = kept.some((k) => {
      const b = norm(k.content);
      if (a === b) return true;
      const [short, long] = a.length <= b.length ? [a, b] : [b, a];
      return short.length >= 80 && long.includes(short);
    });
    if (!dup) kept.push(r);
  }
  return kept;
}

export type Sufficiency = "sufficient" | "partial" | "no_evidence";

export interface SufficiencyThresholds {
  version: string;
  /** Similaridade vetorial mínima do melhor trecho para considerar evidência. */
  minTopSimilarity: number;
  /** Similaridade mínima para um trecho contar como corroborante. */
  minSupportSimilarity: number;
  /** Nº de trechos corroborantes para considerar suficiente. */
  minSupportingChunks: number;
}

/**
 * Limites iniciais conservadores: servem apenas para distinguir "sem evidência"
 * de "evidência parcial". Devem ser recalibrados com o benchmark antes de
 * qualquer afirmação de ganho de precisão.
 */
export const DEFAULT_SUFFICIENCY: SufficiencyThresholds = {
  version: "sufficiency-v1",
  minTopSimilarity: 0.18,
  minSupportSimilarity: 0.14,
  minSupportingChunks: 2,
};

export function assessSufficiency(
  rows: Array<{ vector_similarity: number | null; fts_rank: number | null }>,
  t: SufficiencyThresholds = DEFAULT_SUFFICIENCY,
): { state: Sufficiency; top_similarity: number; supporting: number } {
  if (rows.length === 0) return { state: "no_evidence", top_similarity: 0, supporting: 0 };
  const sims = rows.map((r) => r.vector_similarity ?? 0);
  const top = Math.max(...sims);
  const lexical = rows.some((r) => (r.fts_rank ?? 0) > 0);
  const supporting = sims.filter((s) => s >= t.minSupportSimilarity).length;

  if (top < t.minTopSimilarity && !lexical) {
    return { state: "no_evidence", top_similarity: top, supporting };
  }
  if (supporting >= t.minSupportingChunks) {
    return { state: "sufficient", top_similarity: top, supporting };
  }
  return { state: "partial", top_similarity: top, supporting };
}

/** Vizinhos a buscar (chunk anterior/seguinte) para dar contexto às evidências. */
export function neighborTargets(
  rows: Array<{ document_id: string; chunk_index?: number | null }>,
  window = 1,
): Array<{ document_id: string; chunk_index: number }> {
  const out = new Map<string, { document_id: string; chunk_index: number }>();
  const present = new Set(rows.map((r) => `${r.document_id}:${r.chunk_index ?? -1}`));
  for (const r of rows) {
    if (r.chunk_index == null) continue;
    for (let d = -window; d <= window; d++) {
      if (d === 0) continue;
      const idx = r.chunk_index + d;
      if (idx < 0) continue;
      const key = `${r.document_id}:${idx}`;
      if (present.has(key) || out.has(key)) continue;
      out.set(key, { document_id: r.document_id, chunk_index: idx });
    }
  }
  return Array.from(out.values());
}
