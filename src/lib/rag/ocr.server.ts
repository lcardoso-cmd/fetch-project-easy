// OCR / transcrição multimodal por lote de páginas, com retentativa apenas das
// páginas que falharam. Substitui o envio do PDF inteiro em uma única chamada.

import type { DocBlock } from "./chunking";

export const OCR_VERSION = "ocr-v2";

export interface OcrPageResult {
  page: number;
  text: string;
  error?: string;
}

export interface OcrBatchOutcome {
  blocks: DocBlock[];
  pages: OcrPageResult[];
  failedPages: number[];
}

/** Extrai um subconjunto de páginas do PDF como um novo PDF (pdf-lib). */
async function slicePdf(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const total = src.getPageCount();
  const indices = pages.map((p) => p - 1).filter((i) => i >= 0 && i < total);
  const copied = await out.copyPages(src, indices);
  for (const p of copied) out.addPage(p);
  return new Uint8Array(await out.save());
}

function parsePageMarkers(text: string, pages: number[]): OcrPageResult[] {
  const parts = text.split(/---\s*P[áa]gina\s+\d+\s*---/i).map((s) => s.trim());
  const body = parts[0] === "" ? parts.slice(1) : parts;
  if (body.length === pages.length) {
    return pages.map((page, i) => ({ page, text: body[i] ?? "" }));
  }
  // Sem marcadores confiáveis: atribui todo o texto ao primeiro página do lote.
  return pages.map((page, i) => ({ page, text: i === 0 ? text.trim() : "" }));
}

/**
 * Transcreve as páginas informadas em lotes. Um lote que falhar é reprocessado
 * página por página; somente as páginas que falharem duas vezes ficam em
 * `failedPages` (indexação parcial em vez de falha total).
 */
export async function ocrPdfPages(opts: {
  bytes: Uint8Array;
  filename: string;
  pages: number[];
  batchSize?: number;
}): Promise<OcrBatchOutcome> {
  const { visionExtractPdfSlice } = await import("../ai.server");
  const batchSize = opts.batchSize ?? 4;
  const results: OcrPageResult[] = [];
  const failed: number[] = [];

  const batches: number[][] = [];
  for (let i = 0; i < opts.pages.length; i += batchSize) {
    batches.push(opts.pages.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      const slice = await slicePdf(opts.bytes, batch);
      const text = await visionExtractPdfSlice(slice, opts.filename, batch);
      results.push(...parsePageMarkers(text, batch));
    } catch {
      for (const page of batch) {
        try {
          const slice = await slicePdf(opts.bytes, [page]);
          const text = await visionExtractPdfSlice(slice, opts.filename, [page]);
          results.push({ page, text: text.trim() });
        } catch (e2) {
          const msg = e2 instanceof Error ? e2.message : String(e2);
          results.push({ page, text: "", error: msg });
          failed.push(page);
        }
      }
    }
  }

  const blocks: DocBlock[] = results
    .filter((r) => r.text.trim().length > 0)
    .sort((a, b) => a.page - b.page)
    .map((r) => ({ content: r.text, kind: "vision" as const, page: r.page }));

  return { blocks, pages: results, failedPages: failed };
}

/** OCR de uma imagem isolada (PNG/JPG) enviada como documento. */
export async function ocrImage(opts: {
  blob: Blob;
  filename: string;
  fileType: string;
}): Promise<DocBlock[]> {
  const { visionExtractImage } = await import("../ai.server");
  const bytes = new Uint8Array(await opts.blob.arrayBuffer());
  const text = await visionExtractImage(bytes, opts.fileType || "image/png", opts.filename);
  const clean = text.trim();
  return clean ? [{ content: clean, kind: "vision", page: 1 }] : [];
}
