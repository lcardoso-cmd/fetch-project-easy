import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  openPdfBytes,
  openRemotePdf,
  readPdfPageInfoWithRetry,
  RangeNotSupportedError,
} from "./pdf-range.server";
import { decidePdfPageReadMode } from "./pdf-text-quality";

describe("leitura remota de PDF por faixa", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recusa resposta 200 antes de materializar o arquivo inteiro", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-length": String(250 * 1024 * 1024) },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      openRemotePdf("https://storage.example/processo.pdf", 250 * 1024 * 1024),
    ).rejects.toBeInstanceOf(RangeNotSupportedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propaga falha de uma faixa posterior em vez de deixar a leitura pendurada", async () => {
    const source = await PDFDocument.create();
    const font = await source.embedFont(StandardFonts.Helvetica);
    for (let page = 1; page <= 500; page++) {
      const pdfPage = source.addPage([595, 842]);
      pdfPage.drawText(`Página ${page}: ${"conteúdo jurídico ".repeat(10)}`, {
        x: 30,
        y: 790,
        size: 10,
        font,
      });
    }
    const bytes = Uint8Array.from(await source.save({ useObjectStreams: false }));
    expect(bytes.byteLength).toBeGreaterThan(128 * 1024);

    let requests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        requests++;
        if (requests > 1) return new Response(null, { status: 503 });
        const range = String((init?.headers as Record<string, string> | undefined)?.Range ?? "");
        const match = /bytes=(\d+)-(\d+)/.exec(range);
        const begin = Number(match?.[1] ?? 0);
        const end = Number(match?.[2] ?? bytes.byteLength - 1);
        return new Response(bytes.slice(begin, end + 1), { status: 206 });
      }),
    );

    await expect(
      openRemotePdf("https://storage.example/processo-grande.pdf", bytes.byteLength),
    ).rejects.toThrow("range_fetch_failed_503");
    expect(requests).toBeGreaterThan(1);
  });

  it("reconhece texto nativo curto sem encaminhá-lo para OCR", async () => {
    const source = await PDFDocument.create();
    const font = await source.embedFont(StandardFonts.Helvetica);
    const page = source.addPage([595, 842]);
    page.drawText("Decisão: pedido procedente.", { x: 40, y: 790, size: 12, font });

    const pdf = await openPdfBytes(Uint8Array.from(await source.save()));
    try {
      const info = await pdf.pageInfo(1);
      expect(info.text).toContain("pedido procedente");
      expect(info.rasterImageCount).toBe(0);
      expect(decidePdfPageReadMode(info)).toBe("native");
    } finally {
      await pdf.destroy();
    }
  });

  it("reconhece imagem de página inteira sem texto como candidata a OCR", async () => {
    const source = await PDFDocument.create();
    const page = source.addPage([595, 842]);
    const pixel = await source.embedPng(
      Uint8Array.from(
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      ),
    );
    page.drawImage(pixel, { x: 0, y: 0, width: 595, height: 842 });

    const pdf = await openPdfBytes(Uint8Array.from(await source.save()));
    try {
      const info = await pdf.pageInfo(1);
      expect(info.text.trim()).toBe("");
      expect(info.rasterImageCount).toBeGreaterThan(0);
      expect(info.maxRasterCoverage).toBeGreaterThan(0.9);
      expect(decidePdfPageReadMode(info)).toBe("ocr");
    } finally {
      await pdf.destroy();
    }
  });

  it("retenta a leitura nativa sem converter falha técnica em OCR", async () => {
    const pageInfo = vi
      .fn()
      .mockRejectedValueOnce(new Error("range temporariamente indisponível"))
      .mockResolvedValue({
        page: 1,
        text: "texto recuperado",
        textItemCount: 1,
        rasterImageCount: 0,
        maxRasterCoverage: 0,
      });
    const result = await readPdfPageInfoWithRetry(
      { numPages: 1, bytesFetched: () => 0, pageInfo, pageText: vi.fn(), destroy: vi.fn() },
      1,
    );
    expect(result.text).toBe("texto recuperado");
    expect(pageInfo).toHaveBeenCalledTimes(2);
  });
});
