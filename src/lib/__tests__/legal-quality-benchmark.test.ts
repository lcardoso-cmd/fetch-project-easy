import { describe, expect, it } from "vitest";
import { splitSources, stripInvalidRefs } from "../rag/citations";

const sources = [
  { ref: "F1", chunk_id: "chunk-1", document_id: "doc-1", filename: "Contrato.pdf", snippet: "Vencimento em 10/09/2026", location: "p. 3", source_kind: "text", score: 1, vector_similarity: 1, fts_rank: 1, is_context: false },
  { ref: "F2", chunk_id: "chunk-2", document_id: "doc-2", filename: "Aditivo.pdf", snippet: "Prazo prorrogado", location: "p. 1", source_kind: "text", score: 1, vector_similarity: 1, fts_rank: 1, is_context: false },
] as Parameters<typeof stripInvalidRefs>[1];

describe("benchmark de rastreabilidade jurídica", () => {
  it("preserva somente citações existentes no acervo recuperado", () => {
    const answer = stripInvalidRefs("O contrato vence em setembro [F1]. A multa seria automática [F9].", sources);
    expect(answer).toContain("[F1]");
    expect(answer).not.toContain("[F9]");
    const result = splitSources(answer, sources);
    expect(result.cited_sources).toHaveLength(1);
    expect(result.invalid_refs).toEqual([]);
  });

  it("separa fontes citadas das fontes apenas disponíveis", () => {
    const result = splitSources("O aditivo prorrogou o prazo [F2].", sources);
    expect(result.cited_sources.map((source) => source.ref)).toEqual(["F2"]);
    expect(result.supporting_sources.map((source) => source.ref)).toEqual(["F1"]);
  });
});