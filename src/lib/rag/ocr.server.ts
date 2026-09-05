// OCR / transcrição multimodal por lote de páginas, com retentativa apenas das
// páginas que falharam. Substitui o envio do PDF inteiro em uma única chamada.

import type { DocBlock } from "./chunking";

export const OCR_VERSION = "ocr-v4";

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

interface ParsedPageMarkers {
  pages: OcrPageResult[];
  invalidPages: number[];
}

/**
 * Aceita somente pares completos de início/fim com o mesmo número de página.
 * Nunca distribui texto por posição: uma resposta truncada não pode acabar
 * associada à página errada do processo.
 */
function parsePageMarkers(text: string, pages: number[]): ParsedPageMarkers {
  const requested = new Set(pages);
  const found = new Map<number, string>();
  const duplicated = new Set<number>();
  const marker =
    /---\s*P[áa]gina\s+(\d+)\s*---\s*([\s\S]*?)\s*---\s*Fim\s+da\s+P[áa]gina\s+\1\s*---/gi;

  for (const match of text.matchAll(marker)) {
    const page = Number(match[1]);
    if (!requested.has(page)) continue;
    if (found.has(page)) duplicated.add(page);
    else found.set(page, (match[2] ?? "").trim());
  }

  const invalidPages = pages.filter((page) => !found.has(page) || duplicated.has(page));
  return {
    pages: pages.map((page) => ({
      page,
      text: invalidPages.includes(page) ? "" : (found.get(page) ?? ""),
    })),
    invalidPages,
  };
}

function singlePageText(text: string, page: number): string {
  const parsed = parsePageMarkers(text, [page]);
  if (parsed.invalidPages.length === 0) return parsed.pages[0]?.text.trim() ?? "";
  // Em chamada de página única não existe risco de associação à página errada.
  return text.replace(/---\s*(?:Fim\s+da\s+)?P[áa]gina\s+\d+\s*---/gi, "").trim();
}

/**
 * Transcreve as páginas informadas em lotes. Uma página com resposta ausente,
 * truncada ou ambígua é reprocessada isoladamente no modelo de escalonamento;
 * falhas definitivas ficam em `failedPages` sem invalidar as demais páginas.
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
    let pagesToEscalate: number[] = [];
    try {
      const slice = await slicePdf(source, batch);
      const text = await visionExtractPdfSlice(slice, opts.filename, batch);
      const parsed = parsePageMarkers(text, batch);
      batchResults.push(
        ...parsed.pages.filter((result) => !parsed.invalidPages.includes(result.page)),
      );
      pagesToEscalate = parsed.invalidPages;
    } catch {
      pagesToEscalate = batch;
    }

    // Só páginas ausentes, duplicadas, truncadas ou cujo lote falhou sobem
    // para o modelo Pro. O restante permanece no modelo rápido e econômico.
    for (const page of pagesToEscalate) {
      if (opts.deadlineAt && Date.now() >= opts.deadlineAt) {
        incomplete = true;
        break;
      }
      try {
        const slice = await slicePdf(source, [page]);
        const text = await visionExtractPdfSlice(slice, opts.filename, [page], {
          quality: "escalated",
        });
        const clean = singlePageText(text, page);
        if (!clean) throw new Error("OCR retornou a página sem conteúdo verificável.");
        batchResults.push({ page, text: clean });
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : String(e2);
        batchResults.push({ page, text: "", error: msg });
        batchFailed.push(page);
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
    const attemptedPages = new Set(batchResults.map((result) => result.page));
    const completedInBatch = batch.filter((page) => attemptedPages.has(page));
    completed.push(...completedInBatch);
    if (completedInBatch.length > 0) {
      await opts.onBatch?.({
        blocks: batchBlocks,
        pages: batchResults,
        failedPages: batchFailed,
        completedPages: completedInBatch,
      });
    }

    if (incomplete) break;

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
  let clean = "";
  try {
    clean = (await visionExtractImage(bytes, opts.fileType || "image/png", opts.filename)).trim();
  } catch {
    // A segunda tentativa usa o modelo de escalonamento abaixo.
  }
  if (!clean) {
    clean = (
      await visionExtractImage(bytes, opts.fileType || "image/png", opts.filename, {
        quality: "escalated",
      })
    ).trim();
  }
  return clean ? [{ content: clean, kind: "vision", page: 1 }] : [];
}
