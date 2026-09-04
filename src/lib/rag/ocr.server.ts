// OCR / transcrição multimodal por lote de páginas, com retentativa apenas das
// páginas que falharam. Substitui o envio do PDF inteiro em uma única chamada.

import type { DocBlock } from "./chunking";

export const OCR_VERSION = "ocr-v3";

export interface OcrPageResult {
  page: number;
  text: string;
  error?: string;
}

export interface OcrBatchOutcome {
  blocks: DocBlock[];
  pages: OcrPageResult[];
  failedPages: number[];
  completedPages: number[];
  incomplete: boolean;
}

/** Extrai um subconjunto de páginas do PDF como um novo PDF (pdf-lib). */
async function slicePdf(
  source: Awaited<ReturnType<typeof import("pdf-lib").PDFDocument.load>>,
  pages: number[],
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const total = source.getPageCount();
  const indices = pages.map((p) => p - 1).filter((i) => i >= 0 && i < total);
  const copied = await out.copyPages(source, indices);
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
  deadlineAt?: number;
  /** Persiste cada lote antes de o próximo começar. */
  onBatch?: (outcome: Omit<OcrBatchOutcome, "incomplete">) => void | Promise<void>;
}): Promise<OcrBatchOutcome> {
  const { visionExtractPdfSlice } = await import("../ai.server");
  const { PDFDocument } = await import("pdf-lib");
  const batchSize = opts.batchSize ?? 4;
  const results: OcrPageResult[] = [];
  const failed: number[] = [];
  const completed: number[] = [];
  let incomplete = false;
  // Carrega a estrutura do PDF uma única vez. Antes, cada lote e cada
  // retentativa reabria o documento inteiro, multiplicando memória e CPU.
  const source = await PDFDocument.load(opts.bytes, { ignoreEncryption: true });

  const batches: number[][] = [];
  for (let i = 0; i < opts.pages.length; i += batchSize) {
    batches.push(opts.pages.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    if (opts.deadlineAt && Date.now() >= opts.deadlineAt) {
      incomplete = true;
      break;
    }
    const batch = batches[batchIndex];
    const batchResults: OcrPageResult[] = [];
    const batchFailed: number[] = [];
    try {
      const slice = await slicePdf(source, batch);
      const text = await visionExtractPdfSlice(slice, opts.filename, batch);
      batchResults.push(...parsePageMarkers(text, batch));
    } catch {
      for (const page of batch) {
        try {
          const slice = await slicePdf(source, [page]);
          const text = await visionExtractPdfSlice(slice, opts.filename, [page]);
          batchResults.push({ page, text: text.trim() });
        } catch (e2) {
          const msg = e2 instanceof Error ? e2.message : String(e2);
          batchResults.push({ page, text: "", error: msg });
          batchFailed.push(page);
        }
      }
    }

    const batchBlocks: DocBlock[] = batchResults
      .filter((result) => result.text.trim().length > 0)
      .sort((a, b) => a.page - b.page)
      .map((result) => ({
        content: result.text,
        kind: "vision" as const,
        page: result.page,
      }));
    results.push(...batchResults);
    failed.push(...batchFailed);
    completed.push(...batch);
    await opts.onBatch?.({
      blocks: batchBlocks,
      pages: batchResults,
      failedPages: batchFailed,
      completedPages: batch,
    });

    if (opts.deadlineAt && Date.now() >= opts.deadlineAt && batchIndex < batches.length - 1) {
      incomplete = true;
      break;
    }
  }

  const blocks: DocBlock[] = results
    .filter((r) => r.text.trim().length > 0)
    .sort((a, b) => a.page - b.page)
    .map((r) => ({ content: r.text, kind: "vision" as const, page: r.page }));

  return {
    blocks,
    pages: results,
    failedPages: failed,
    completedPages: completed,
    incomplete,
  };
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
