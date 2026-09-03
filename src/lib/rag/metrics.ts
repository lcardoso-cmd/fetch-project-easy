// Métricas objetivas de qualidade do RAG usadas pelo harness de benchmark.
// Puro: recebe ids/refs já recuperados e o gabarito do conjunto sintético.

export interface RetrievalCase {
  id: string;
  question: string;
  /** ids de chunk (ou de documento) que contêm a resposta. */
  relevant: string[];
}

export function recallAtK(retrieved: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 1;
  const top = new Set(retrieved.slice(0, k));
  const found = relevant.filter((r) => top.has(r)).length;
  return found / relevant.length;
}

export function reciprocalRank(retrieved: string[], relevant: string[]): number {
  const rel = new Set(relevant);
  for (let i = 0; i < retrieved.length; i++) {
    if (rel.has(retrieved[i]!)) return 1 / (i + 1);
  }
  return 0;
}

export function meanReciprocalRank(
  runs: Array<{ retrieved: string[]; relevant: string[] }>,
): number {
  if (runs.length === 0) return 0;
  return runs.reduce((n, r) => n + reciprocalRank(r.retrieved, r.relevant), 0) / runs.length;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Proporção das fontes citadas que realmente são relevantes. */
export function sourcePrecision(cited: string[], relevant: string[]): number {
  if (cited.length === 0) return 0;
  const rel = new Set(relevant);
  return cited.filter((c) => rel.has(c)).length / cited.length;
}

/** Proporção dos trechos relevantes que foram citados na resposta. */
export function sourceCoverage(cited: string[], relevant: string[]): number {
  if (relevant.length === 0) return 1;
  const set = new Set(cited);
  return relevant.filter((r) => set.has(r)).length / relevant.length;
}

export interface BenchmarkSummary {
  cases: number;
  recall_at_5: number;
  recall_at_10: number;
  mrr: number;
  source_precision: number;
  source_coverage: number;
  invalid_ref_rate: number;
  no_evidence_accuracy: number;
  avg_latency_ms: number;
  avg_total_tokens: number;
  total_cost_usd: number;
}

export interface BenchmarkRun {
  case_id: string;
  retrieved: string[];
  relevant: string[];
  cited?: string[];
  invalid_refs?: string[];
  /** Caso desenhado para não ter evidência no acervo. */
  expects_no_evidence?: boolean;
  reported_no_evidence?: boolean;
  latency_ms?: number;
  total_tokens?: number;
  cost_usd?: number;
}

export function summarize(runs: BenchmarkRun[]): BenchmarkSummary {
  const noEvidenceCases = runs.filter((r) => r.expects_no_evidence);
  return {
    cases: runs.length,
    recall_at_5: mean(runs.map((r) => recallAtK(r.retrieved, r.relevant, 5))),
    recall_at_10: mean(runs.map((r) => recallAtK(r.retrieved, r.relevant, 10))),
    mrr: meanReciprocalRank(runs),
    source_precision: mean(
      runs.filter((r) => (r.cited?.length ?? 0) > 0).map((r) => sourcePrecision(r.cited!, r.relevant)),
    ),
    source_coverage: mean(runs.map((r) => sourceCoverage(r.cited ?? [], r.relevant))),
    invalid_ref_rate: mean(runs.map((r) => ((r.invalid_refs?.length ?? 0) > 0 ? 1 : 0))),
    no_evidence_accuracy:
      noEvidenceCases.length === 0
        ? 1
        : mean(noEvidenceCases.map((r) => (r.reported_no_evidence ? 1 : 0))),
    avg_latency_ms: mean(runs.map((r) => r.latency_ms ?? 0)),
    avg_total_tokens: mean(runs.map((r) => r.total_tokens ?? 0)),
    total_cost_usd: runs.reduce((n, r) => n + (r.cost_usd ?? 0), 0),
  };
}
