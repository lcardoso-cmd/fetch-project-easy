import { describe, expect, it } from "vitest";
import {
  CHUNK_PROFILES,
  DEFAULT_CHUNK_PROFILE,
  contentHash,
  locationLabel,
  splitRespectingBoundaries,
  structuredChunk,
  type DocBlock,
} from "./chunking";
import {
  parseCitedRefs,
  splitSources,
  stripInvalidRefs,
  type RetrievedSource,
} from "./citations";
import {
  assessSufficiency,
  dedupeOverlapping,
  diversifyByDocument,
  neighborTargets,
  rrfFuse,
  type Candidate,
} from "./retrieval";
import { meanReciprocalRank, recallAtK, sourceCoverage, sourcePrecision, summarize } from "./metrics";

function block(content: string, extra: Partial<DocBlock> = {}): DocBlock {
  return { content, kind: "text", ...extra };
}

function candidate(id: string, docId: string, extra: Partial<Candidate> = {}): Candidate {
  return {
    id,
    document_id: docId,
    filename: `${docId}.pdf`,
    content: `conteúdo ${id}`,
    chunk_index: 0,
    page_start: null,
    page_end: null,
    section_title: null,
    sheet_name: null,
    row_start: null,
    row_end: null,
    source_kind: "text",
    chunking_version: "structural-md",
    vector_similarity: 0.3,
    fts_rank: null,
    ...extra,
  } as Candidate;
}

function source(ref: string, extra: Partial<RetrievedSource> = {}): RetrievedSource {
  return {
    ref,
    chunk_id: `chunk-${ref}`,
    document_id: "doc-1",
    filename: "contrato.pdf",
    snippet: "trecho",
    location: "p. 3",
    source_kind: "text",
    score: 0.5,
    vector_similarity: 0.4,
    fts_rank: null,
    is_context: false,
    ...extra,
  };
}

describe("chunking estrutural", () => {
  it("respeita fronteiras de parágrafo e sentença ao dividir", () => {
    const text = `${"Primeira sentença sobre o contrato. ".repeat(20)}\n\n${"Segunda parte do documento. ".repeat(20)}`;
    const parts = splitRespectingBoundaries(text, 400);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(560);
    // nenhuma parte começa cortando uma palavra no meio
    for (const p of parts) expect(p.trim()).toBe(p.trim());
  });

  it("preserva página e seção nos metadados do chunk", () => {
    const chunks = structuredChunk([
      block("CLÁUSULA 5 - DO PRAZO", { page: 3, sectionTitle: "CLÁUSULA 5", isHeading: true }),
      block("O prazo de vigência é de 24 meses. ".repeat(40), {
        page: 3,
        sectionTitle: "CLÁUSULA 5",
      }),
    ]);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]!.page_start).toBe(3);
    expect(chunks[0]!.section_title).toBe("CLÁUSULA 5");
    expect(chunks[0]!.chunking_version).toBe(DEFAULT_CHUNK_PROFILE.name);
    expect(chunks[0]!.token_count).toBeGreaterThan(0);
  });

  it("mantém planilhas separadas por aba e faixa de linhas", () => {
    const chunks = structuredChunk([
      block("valor total 10000", { kind: "table", sheetName: "Valores", rowStart: 2, rowEnd: 41 }),
      block("outra aba", { kind: "table", sheetName: "Resumo", rowStart: 1, rowEnd: 9 }),
    ]);
    const sheets = chunks.map((c) => c.sheet_name);
    expect(new Set(sheets)).toEqual(new Set(["Valores", "Resumo"]));
    const valores = chunks.find((c) => c.sheet_name === "Valores")!;
    expect(valores.row_start).toBe(2);
    expect(valores.row_end).toBe(41);
    expect(locationLabel(valores)).toContain("Valores");
  });

  it("descarta chunks duplicados pelo hash de conteúdo", () => {
    const repeated = "Texto idêntico repetido no documento. ".repeat(30);
    const chunks = structuredChunk([
      block(repeated, { page: 1 }),
      block(repeated, { page: 1 }),
    ]);
    const hashes = chunks.map((c) => c.content_hash);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });

  it("expõe perfis comparáveis para benchmark", () => {
    const blocks = [block("Cláusula relevante do contrato. ".repeat(200), { page: 1 })];
    const small = structuredChunk(blocks, CHUNK_PROFILES["structural-sm"]!);
    const large = structuredChunk(blocks, CHUNK_PROFILES["structural-lg"]!);
    const avg = (cs: { content: string }[]) =>
      cs.reduce((a, c) => a + c.content.length, 0) / cs.length;
    expect(small.length).toBeGreaterThanOrEqual(large.length);
    expect(avg(small)).toBeLessThan(avg(large));
    expect(small[0]!.chunking_version).toBe("structural-sm");
  });
});

describe("fusão e diversidade na recuperação", () => {
  it("RRF favorece o item bem posicionado nas duas listas", () => {
    const a = candidate("a", "doc-1");
    const b = candidate("b", "doc-2");
    const c = candidate("c", "doc-3");
    const fused = rrfFuse([
      [a, b, c],
      [b, c],
    ]);
    expect(fused[0]!.id).toBe("b");
    expect(fused[0]!.hits).toBe(2);
    expect(fused.map((f) => f.id)).toContain("c");
  });

  it("limita quantos trechos vêm do mesmo documento", () => {
    const rows = [
      candidate("1", "doc-1"),
      candidate("2", "doc-1"),
      candidate("3", "doc-1"),
      candidate("4", "doc-1"),
      candidate("5", "doc-2"),
    ];
    const out = diversifyByDocument(rows, 2);
    // os excedentes do mesmo documento são empurrados para o fim, não descartados
    const top = out.slice(0, 3);
    expect(top.filter((r) => r.document_id === "doc-1").length).toBeLessThanOrEqual(2);
    expect(top.some((r) => r.document_id === "doc-2")).toBe(true);
    expect(out.length).toBe(rows.length);
  });

  it("remove trechos sobrepostos quase idênticos", () => {
    const long = "A obrigação de pagamento vence em trinta dias após a entrega. ".repeat(6);
    const out = dedupeOverlapping([{ content: long }, { content: long }, { content: "outro texto" }]);
    expect(out.length).toBe(2);
  });

  it("calcula vizinhos sem repetir os já recuperados", () => {
    const targets = neighborTargets([
      { document_id: "doc-1", chunk_index: 5 },
      { document_id: "doc-1", chunk_index: 6 },
    ]);
    const keys = targets.map((t) => `${t.document_id}:${t.chunk_index}`);
    expect(keys).toContain("doc-1:4");
    expect(keys).toContain("doc-1:7");
    expect(keys).not.toContain("doc-1:5");
    expect(keys).not.toContain("doc-1:6");
  });
});

describe("suficiência documental", () => {
  it("declara ausência de evidência quando nada é relevante", () => {
    const r = assessSufficiency([{ vector_similarity: 0.05, fts_rank: null }]);
    expect(r.state).toBe("no_evidence");
  });

  it("declara suficiente com múltiplos trechos corroborantes", () => {
    const r = assessSufficiency([
      { vector_similarity: 0.42, fts_rank: null },
      { vector_similarity: 0.31, fts_rank: null },
    ]);
    expect(r.state).toBe("sufficient");
    expect(r.top_similarity).toBeCloseTo(0.42);
  });

  it("declara parcial com um único trecho forte", () => {
    const r = assessSufficiency([
      { vector_similarity: 0.4, fts_rank: null },
      { vector_similarity: 0.02, fts_rank: null },
    ]);
    expect(r.state).toBe("partial");
  });

  it("não descarta acerto puramente lexical", () => {
    const r = assessSufficiency([{ vector_similarity: 0.05, fts_rank: 0.9 }]);
    expect(r.state).not.toBe("no_evidence");
  });

  it("acervo vazio nunca vira evidência", () => {
    expect(assessSufficiency([]).state).toBe("no_evidence");
  });
});

describe("rastreabilidade de citações", () => {
  it("separa trechos citados dos de apoio", () => {
    const retrieved = [source("F1"), source("F2", { chunk_id: "chunk-F2" })];
    const sets = splitSources("A vigência é de 24 meses [F1].", retrieved);
    expect(sets.cited_sources.map((c) => c.ref)).toEqual(["F1"]);
    expect(sets.supporting_sources.map((c) => c.ref)).toEqual(["F2"]);
    expect(sets.invalid_refs).toEqual([]);
  });

  it("detecta e remove refs inexistentes", () => {
    const retrieved = [source("F1")];
    const answer = "Há multa contratual [F9] e prazo de 24 meses [F1].";
    expect(splitSources(answer, retrieved).invalid_refs).toEqual(["F9"]);
    const cleaned = stripInvalidRefs(answer, retrieved);
    expect(cleaned).not.toContain("[F9]");
    expect(cleaned).toContain("[F1]");
  });

  it("não repete refs citadas várias vezes", () => {
    expect(parseCitedRefs("[F1] ... [F1] ... [F2]")).toEqual(["F1", "F2"]);
  });
});

describe("métricas de benchmark", () => {
  it("mede recall@k e MRR", () => {
    expect(recallAtK(["a", "b", "c"], ["b"], 5)).toBe(1);
    expect(recallAtK(["x", "y"], ["b"], 5)).toBe(0);
    expect(meanReciprocalRank([{ retrieved: ["x", "b"], relevant: ["b"] }])).toBeCloseTo(0.5);
  });

  it("mede precisão e cobertura das fontes citadas", () => {
    expect(sourcePrecision(["a", "z"], ["a", "b"])).toBeCloseTo(0.5);
    expect(sourceCoverage(["a"], ["a", "b"])).toBeCloseTo(0.5);
  });

  it("consolida a corrida de benchmark com refs inválidas e abstenção", () => {
    const s = summarize([
      {
        case_id: "1",
        retrieved: ["a", "b"],
        relevant: ["a"],
        cited: ["a"],
        invalid_refs: [],
        latency_ms: 1000,
      },
      {
        case_id: "2",
        retrieved: ["x"],
        relevant: ["y"],
        cited: ["x"],
        invalid_refs: ["F7"],
        expects_no_evidence: true,
        reported_no_evidence: true,
        latency_ms: 2000,
      },
    ]);
    expect(s.cases).toBe(2);
    expect(s.recall_at_5).toBeCloseTo(0.5);
    expect(s.invalid_ref_rate).toBeCloseTo(0.5);
    expect(s.no_evidence_accuracy).toBe(1);
    expect(s.avg_latency_ms).toBe(1500);
  });
});
