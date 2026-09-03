// Rastreabilidade: separação entre trechos recuperados, citados e de apoio.
// Módulo puro para poder ser testado sem chamadas de modelo.

export interface RetrievedSource {
  /** Identificador estável exposto ao modelo: F1, F2, ... */
  ref: string;
  chunk_id: string;
  document_id: string;
  filename: string;
  snippet: string;
  location: string | null;
  source_kind: string;
  /** Score interno (diagnóstico); não é percentual de confiança. */
  score: number;
  vector_similarity: number | null;
  fts_rank: number | null;
  /** true quando o trecho entrou só como contexto vizinho, não como evidência. */
  is_context: boolean;
}

export interface SourceSets {
  retrieved_sources: RetrievedSource[];
  cited_sources: RetrievedSource[];
  supporting_sources: RetrievedSource[];
  /** Refs citadas pelo modelo que não existem entre os trechos entregues. */
  invalid_refs: string[];
}

const REF_RE = /\[\s*(F\d{1,3})\s*\]/gi;

/** Extrai refs [F1], [F2] citadas no texto, na ordem de aparição, sem repetir. */
export function parseCitedRefs(answer: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of answer.matchAll(REF_RE)) {
    const ref = m[1]!.toUpperCase();
    if (!seen.has(ref)) {
      seen.add(ref);
      out.push(ref);
    }
  }
  return out;
}

/** Classifica os trechos entregues em citados / de apoio, e aponta refs inválidas. */
export function splitSources(answer: string, retrieved: RetrievedSource[]): SourceSets {
  const byRef = new Map(retrieved.map((s) => [s.ref.toUpperCase(), s]));
  const cited: RetrievedSource[] = [];
  const invalid: string[] = [];

  for (const ref of parseCitedRefs(answer)) {
    const src = byRef.get(ref);
    if (src) cited.push(src);
    else invalid.push(ref);
  }

  const citedIds = new Set(cited.map((c) => c.chunk_id));
  const supporting = retrieved.filter((s) => !citedIds.has(s.chunk_id));

  return {
    retrieved_sources: retrieved,
    cited_sources: cited,
    supporting_sources: supporting,
    invalid_refs: invalid,
  };
}

/**
 * Remove do texto refs que não correspondem a nenhum trecho entregue,
 * evitando que a resposta exiba uma fonte inexistente.
 */
export function stripInvalidRefs(answer: string, retrieved: RetrievedSource[]): string {
  const valid = new Set(retrieved.map((s) => s.ref.toUpperCase()));
  return answer
    .replace(REF_RE, (full, ref: string) => (valid.has(ref.toUpperCase()) ? full : ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1");
}
