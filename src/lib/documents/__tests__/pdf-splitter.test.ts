import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { planSplit, partFilename, splitPdfBytes } from "../pdf-splitter.core";

describe("planSplit", () => {
  it("não divide documentos curtos", () => {
    expect(planSplit(40, 200, 60)).toEqual([{ start: 0, end: 40, partIndex: 1, partCount: 1 }]);
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

  it("divide por tamanho mesmo com poucas páginas", () => {
    const mib = 1024 * 1024;
    const ranges = planSplit(50, 200, 60, 250 * mib, 24 * mib);
    expect(ranges).toHaveLength(11);
    expect(ranges[0]).toMatchObject({ start: 0, partIndex: 1, partCount: 11 });
    expect(ranges.at(-1)).toMatchObject({ end: 50, partIndex: 11, partCount: 11 });
  });

  it("mantém arquivo pequeno inteiro quando divisão por páginas está desligada", () => {
    const mib = 1024 * 1024;
    expect(planSplit(500, 0, 60, 10 * mib, 24 * mib)).toHaveLength(1);
  });

  it("a proteção por tamanho prevalece sobre a divisão por páginas desligada", () => {
    const mib = 1024 * 1024;
    expect(planSplit(100, 0, 60, 100 * mib, 24 * mib)).toHaveLength(5);
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
    expect(result.parts.map((p) => p.pageOffset)).toEqual([0, 84, 167]);
  }, 60_000);

  it("devolve o arquivo inteiro quando é pequeno", async () => {
    const bytes = await makePdf(10);
    const result = await splitPdfBytes(bytes, "Peticao.pdf", 200, 60, PDFDocument);
    expect(result.parts).toHaveLength(1);
    expect(result.parts[0].filename).toBe("Peticao.pdf");
  });

  it("preserva a camada textual pesquisável nas partes", async () => {
    const source = await PDFDocument.create();
    const font = await source.embedFont(StandardFonts.Helvetica);
    for (let page = 1; page <= 6; page++) {
      const pdfPage = source.addPage([595, 842]);
      pdfPage.drawText(`Conteudo nativo pesquisavel da pagina ${page}`, {
        x: 40,
        y: 790,
        size: 12,
        font,
      });
    }

    const result = await splitPdfBytes(await source.save(), "Processo.pdf", 2, 1, PDFDocument);
    expect(result.parts).toHaveLength(3);

    const texts: string[] = [];
    for (const part of result.parts) {
      const proxy = await getDocumentProxy(Uint8Array.from(part.bytes));
      const extracted = await extractText(proxy, { mergePages: false });
      texts.push(...(Array.isArray(extracted.text) ? extracted.text : [extracted.text]));
    }
    expect(texts.join(" ")).toContain("Conteudo nativo pesquisavel da pagina 1");
    expect(texts.join(" ")).toContain("Conteudo nativo pesquisavel da pagina 6");
  });
});
