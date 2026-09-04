import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { planSplit, partFilename, splitPdfBytes } from "../pdf-splitter.core";

describe("planSplit", () => {
  it("não divide documentos curtos", () => {
    expect(planSplit(40, 200, 60)).toEqual([
      { start: 0, end: 40, partIndex: 1, partCount: 1 },
    ]);
  });

  it("não divide quando o limite está desativado", () => {
    expect(planSplit(4000, 0, 60)).toHaveLength(1);
  });

  it("divide em partes equilibradas", () => {
    const ranges = planSplit(500, 200, 60);
    expect(ranges).toHaveLength(3);
    expect(ranges.map((r) => r.end - r.start)).toEqual([167, 167, 166]);
    expect(ranges[0].start).toBe(0);
    expect(ranges[2].end).toBe(500);
  });

  it("cobre todas as páginas sem sobreposição", () => {
    const ranges = planSplit(4137, 200, 60);
    let cursor = 0;
    for (const r of ranges) {
      expect(r.start).toBe(cursor);
      cursor = r.end;
    }
    expect(cursor).toBe(4137);
    expect(ranges.every((r) => r.end - r.start <= 200)).toBe(true);
  });
});

describe("partFilename", () => {
  it("nomeia as partes de forma legível", () => {
    expect(partFilename("Processo.pdf", 2, 5)).toBe("Processo — parte 2 de 5.pdf");
    expect(partFilename("Processo.pdf", 1, 1)).toBe("Processo.pdf");
  });
});

async function makePdf(pages: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

describe("splitPdfBytes", () => {
  it("gera PDFs válidos com as páginas corretas", async () => {
    const bytes = await makePdf(250);
    const result = await splitPdfBytes(bytes, "Autos.pdf", 100, 60, PDFDocument);
    expect(result.originalPageCount).toBe(250);
    expect(result.parts).toHaveLength(3);

    let totalPages = 0;
    for (const part of result.parts) {
      const reopened = await PDFDocument.load(part.bytes);
      expect(reopened.getPageCount()).toBe(part.pageCount);
      totalPages += part.pageCount;
    }
    expect(totalPages).toBe(250);
    expect(result.parts.map((p) => p.pageOffset)).toEqual([0, 84, 168]);
  }, 60_000);

  it("devolve o arquivo inteiro quando é pequeno", async () => {
    const bytes = await makePdf(10);
    const result = await splitPdfBytes(bytes, "Peticao.pdf", 200, 60, PDFDocument);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].filename).toBe("Peticao.pdf");
  });
});
