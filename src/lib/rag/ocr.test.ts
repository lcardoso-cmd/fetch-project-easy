import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { ocrPdfPages } from "./ocr.server";
import { visionExtractPdfSlice } from "../ai.server";

vi.mock("../ai.server", () => ({
  visionExtractPdfSlice: vi.fn(async (_bytes: Uint8Array, _filename: string, pages: number[]) =>
    pages.map((page) => `--- Página ${page} ---\nTexto da página ${page}`).join("\n"),
  ),
}));

async function pdfWithPages(count: number) {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < count; page++) pdf.addPage([200, 200]);
  return new Uint8Array(await pdf.save());
}

describe("OCR de PDF em lotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publica e confirma cada lote separadamente", async () => {
    const batches: number[][] = [];
    const result = await ocrPdfPages({
      bytes: await pdfWithPages(3),
      filename: "processo.pdf",
      pages: [1, 2, 3],
      batchSize: 2,
      onBatch: (batch) => {
        batches.push(batch.completedPages);
      },
    });

    expect(batches).toEqual([[1, 2], [3]]);
    expect(result.completedPages).toEqual([1, 2, 3]);
    expect(result.blocks.map((block) => block.page)).toEqual([1, 2, 3]);
    expect(result.incomplete).toBe(false);
    expect(visionExtractPdfSlice).toHaveBeenCalledTimes(2);
  });

  it("devolve progresso incompleto sem iniciar outro lote após o prazo", async () => {
    const result = await ocrPdfPages({
      bytes: await pdfWithPages(2),
      filename: "processo.pdf",
      pages: [1, 2],
      deadlineAt: Date.now() - 1,
    });

    expect(result.incomplete).toBe(true);
    expect(result.completedPages).toEqual([]);
    expect(visionExtractPdfSlice).not.toHaveBeenCalled();
  });
});
