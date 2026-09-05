import { describe, expect, it } from "vitest";
import {
  describeReadingStage,
  estimateRemainingSeconds,
  formatDuration,
  readingProgressPercent,
  stepKeyFor,
  type ReadingJobLike,
} from "@/lib/documents/reading-eta";

const base: ReadingJobLike = {
  status: "running",
  stage: "extracting_text",
  pages: 120,
  percent: 35,
  queue_position: null,
  stalled: false,
  started_at: null,
};

describe("reading-eta", () => {
  it("mapeia estágios internos para as cinco etapas visíveis", () => {
    expect(stepKeyFor({ ...base, status: "queued" }, "queued")).toBe("fila");
    expect(stepKeyFor(base, "processing")).toBe("leitura");
    expect(stepKeyFor({ ...base, stage: "ocr_processing" }, "x")).toBe("ocr");
    expect(stepKeyFor({ ...base, stage: "chunking" }, "x")).toBe("trechos");
    expect(stepKeyFor({ ...base, stage: "embedding" }, "x")).toBe("busca");
  });

  it("formata durações em português", () => {
    expect(formatDuration(10)).toBe("menos de 1 min");
    expect(formatDuration(180)).toBe("cerca de 3 min");
    expect(formatDuration(3600)).toBe("cerca de 1 h");
    expect(formatDuration(5400)).toBe("cerca de 1 h 30 min");
  });

  it("estima o tempo restante pelo ritmo observado", () => {
    const now = Date.now();
    const job = { ...base, percent: 50, started_at: new Date(now - 120_000).toISOString() };
    expect(Math.round(estimateRemainingSeconds(job, now)!)).toBe(120);
  });

  it("não estima sem dados suficientes ou quando travado", () => {
    const now = Date.now();
    expect(estimateRemainingSeconds(base, now)).toBeNull();
    expect(
      estimateRemainingSeconds(
        { ...base, stalled: true, started_at: new Date(now - 120_000).toISOString() },
        now,
      ),
    ).toBeNull();
    expect(
      estimateRemainingSeconds(
        { ...base, percent: 2, started_at: new Date(now - 120_000).toISOString() },
        now,
      ),
    ).toBeNull();
  });

  it("descreve a etapa da fila com a posição", () => {
    const info = describeReadingStage({ ...base, status: "queued", queue_position: 3 }, "queued")!;
    expect(info.title).toBe("Etapa 1 de 5 — Fila");
    expect(info.description).toContain("2 documento(s) na frente");
    expect(info.eta).toBeNull();
  });

  it("descreve OCR com páginas e tempo estimado", () => {
    const now = Date.now();
    const info = describeReadingStage(
      {
        ...base,
        stage: "ocr_processing",
        pages: 40,
        percent: 50,
        started_at: new Date(now - 300_000).toISOString(),
      },
      "ocr_processing",
      now,
    )!;
    expect(info.title).toBe("Etapa 3 de 5 — OCR");
    expect(info.description).toContain("40 página(s)");
    expect(info.eta).toBe("Restam cerca de 5 min");
  });

  it("calcula o avanço pela quantidade real de páginas de texto", () => {
    expect(
      readingProgressPercent(
        {
          ...base,
          status: "queued",
          percent: 81,
          pages_done: 4,
          pages_total: 143,
        },
        "extracting_text",
      ),
    ).toBe(31);
  });

  it("preserva o estágio OCR ao retomar um checkpoint", () => {
    const job: ReadingJobLike = {
      ...base,
      status: "queued",
      stage: "ocr_processing",
      pages_done: 10,
      pages_total: 100,
    };
    expect(stepKeyFor(job, "queued")).toBe("ocr");
    expect(readingProgressPercent(job, "queued")).toBe(82);
  });
});
