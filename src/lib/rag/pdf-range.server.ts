/**
 * Leitura de PDF por faixas de bytes (HTTP Range) a partir de uma URL assinada.
 *
 * Motivo: baixar um PDF de centenas de MB inteiro para memória estoura o
 * runtime. Com Range, o leitor pede só os pedaços necessários para abrir o
 * documento e ler as primeiras páginas.
 */

import type { PdfPageTextSignals } from "./pdf-text-quality";
import { compactAlphanumericLength } from "./pdf-text-quality";

const INITIAL_CHUNK = 128 * 1024;
const RANGE_CHUNK = 256 * 1024;
const RANGE_REQUEST_TIMEOUT_MS = 12_000;
const STRONG_TEXT_WITHOUT_IMAGE_INSPECTION = 120;

export interface PdfPageInfo extends PdfPageTextSignals {
  page: number;
}

export interface RangePdfDoc {
  numPages: number;
  /** Total de bytes efetivamente transferidos até agora. */
  bytesFetched(): number;
  pageInfo(page: number): Promise<PdfPageInfo>;
  pageText(page: number): Promise<string>;
  destroy(): Promise<void>;
}

export class RangeNotSupportedError extends Error {
  constructor() {
    super("range_not_supported");
    this.name = "RangeNotSupportedError";
  }
}

async function fetchRange(url: string, begin: number, endInclusive: number): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RANGE_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=${begin}-${endInclusive}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 404) throw new Error("file_missing");
      throw new Error(`range_fetch_failed_${res.status}`);
    }
    // Um servidor que ignora Range responde 200 e pode começar a transmitir o
    // arquivo inteiro. Interrompemos antes de materializar o corpo na memória —
    // inclusive na primeira faixa, quando `begin` é zero.
    if (res.status !== 206) {
      await res.body?.cancel().catch(() => {});
      throw new RangeNotSupportedError();
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    if (controller.signal.aborted) throw new Error("range_fetch_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

interface RangeFailureGate {
  fail(error: unknown): void;
  run<T>(work: () => Promise<T>): Promise<T>;
}

/** Faz o erro de uma requisição Range chegar à operação do PDF.js que a aguarda. */
function createRangeFailureGate(): RangeFailureGate {
  let failure: Error | null = null;
  const listeners = new Set<(error: Error) => void>();
  return {
    fail(error) {
      if (failure) return;
      failure = error instanceof Error ? error : new Error(String(error));
      listeners.forEach((listener) => listener(failure!));
      listeners.clear();
    },
    async run<T>(work: () => Promise<T>): Promise<T> {
      if (failure) throw failure;
      return await new Promise<T>((resolve, reject) => {
        const onFailure = (error: Error) => reject(error);
        listeners.add(onFailure);
        void work()
          .then(resolve, reject)
          .finally(() => listeners.delete(onFailure));
      });
    },
  };
}

/** Tamanho do objeto, via HEAD com fallback para Range 0-0. */
export async function remoteFileSize(url: string): Promise<number> {
  const head = await fetch(url, { method: "HEAD" });
  const len = Number(head.headers.get("content-length") ?? 0);
  if (Number.isFinite(len) && len > 0) return len;
  const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
  const cr = probe.headers.get("content-range");
  const total = cr ? Number(cr.split("/")[1]) : 0;
  return Number.isFinite(total) ? total : 0;
}

/**
 * Abre o PDF remoto por Range. Se o servidor não suportar Range, o chamador
 * recebe `RangeNotSupportedError` e pode decidir o fallback.
 */
export async function openRemotePdf(url: string, knownLength?: number): Promise<RangePdfDoc> {
  const { getResolvedPDFJS } = await import("unpdf");
  const pdfjs = (await getResolvedPDFJS()) as unknown as PdfJsLibrary;

  const length = knownLength && knownLength > 0 ? knownLength : await remoteFileSize(url);
  if (!length) throw new Error("file_missing");

  let fetched = 0;
  const rangeGate = createRangeFailureGate();
  const initial = await fetchRange(url, 0, Math.min(INITIAL_CHUNK, length) - 1);
  fetched += initial.byteLength;

  const Base = pdfjs.PDFDataRangeTransport;
  const transport = new Base(length, initial, false, null);
  transport.requestDataRange = (begin: number, end: number) => {
    void fetchRange(url, begin, Math.min(end, length) - 1)
      .then((chunk) => {
        fetched += chunk.byteLength;
        transport.onDataRange(begin, chunk);
      })
      .catch((error) => rangeGate.fail(error));
  };
  transport.abort = () => {};

  const loadingTask = pdfjs.getDocument({
    range: transport,
    length,
    rangeChunkSize: RANGE_CHUNK,
    disableAutoFetch: true,
    disableStream: true,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const doc = await rangeGate.run(() => loadingTask.promise);

  return pdfHandle(
    doc,
    pdfjs.OPS,
    () => fetched,
    (work) => rangeGate.run(work),
  );
}

/**
 * Segunda via de leitura nativa para partes que cabem com segurança em
 * memória. É usada antes do OCR para confirmar que o leitor por faixas não
 * confundiu uma falha transitória com ausência de camada textual.
 */
export async function openPdfBytes(bytes: Uint8Array): Promise<RangePdfDoc> {
  const { getResolvedPDFJS } = await import("unpdf");
  const pdfjs = (await getResolvedPDFJS()) as unknown as PdfJsLibrary;
  const doc = await pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  return pdfHandle(doc, pdfjs.OPS, () => bytes.byteLength);
}

/** Retenta apenas a leitura local da página, sem acionar OCR. */
export async function readPdfPageInfoWithRetry(
  doc: RangePdfDoc,
  page: number,
  attempts = 2,
): Promise<PdfPageInfo> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
    try {
      return await doc.pageInfo(page);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function pdfHandle(
  doc: PdfJsDocument,
  ops: PdfJsOps,
  bytesFetched: () => number,
  runPage: <T>(work: () => Promise<T>) => Promise<T> = (work) => work(),
): RangePdfDoc {
  return {
    numPages: doc.numPages,
    bytesFetched,
    async pageInfo(page: number) {
      return runPage(async () => {
        const p = await doc.getPage(page);
        try {
          const content = await p.getTextContent();
          const textItems = content.items.filter(
            (item): item is { str: string } => "str" in item && typeof item.str === "string",
          );
          const text = textItems.map((item) => item.str).join(" ");

          // Texto substancial já prova a existência da camada pesquisável. A
          // lista gráfica só é consultada em páginas curtas/vazias.
          if (compactAlphanumericLength(text) >= STRONG_TEXT_WITHOUT_IMAGE_INSPECTION) {
            return {
              page,
              text,
              textItemCount: textItems.length,
              rasterImageCount: 0,
              maxRasterCoverage: 0,
            };
          }

          const operatorList = await p.getOperatorList();
          const raster = rasterSignals(operatorList, ops, p.view);
          return {
            page,
            text,
            textItemCount: textItems.length,
            ...raster,
          };
        } finally {
          p.cleanup?.();
        }
      });
    },
    async pageText(page: number) {
      return (await this.pageInfo(page)).text;
    },
    async destroy() {
      if (typeof doc.destroy === "function") await doc.destroy();
    },
  };
}

function rasterSignals(
  operatorList: { fnArray: number[]; argsArray: unknown[][] },
  ops: PdfJsOps,
  view: number[],
): { rasterImageCount: number; maxRasterCoverage: number } {
  const pageWidth = Math.abs((view[2] ?? 0) - (view[0] ?? 0));
  const pageHeight = Math.abs((view[3] ?? 0) - (view[1] ?? 0));
  const pageArea = Math.max(1, pageWidth * pageHeight);
  const imageOps = new Set(
    [
      ops.paintImageMaskXObject,
      ops.paintImageXObject,
      ops.paintInlineImageXObject,
      ops.paintSolidColorImageMask,
    ].filter((value): value is number => typeof value === "number"),
  );

  let areaScale = 1;
  const stack: number[] = [];
  let rasterImageCount = 0;
  let maxRasterCoverage = 0;

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i] ?? [];
    if (fn === ops.save) {
      stack.push(areaScale);
      continue;
    }
    if (fn === ops.restore) {
      areaScale = stack.pop() ?? 1;
      continue;
    }
    if (fn === ops.transform) {
      const [a, b, c, d] = args.map((value) => Number(value));
      const determinant = Math.abs((a || 0) * (d || 0) - (b || 0) * (c || 0));
      if (Number.isFinite(determinant)) areaScale *= determinant;
      continue;
    }
    if (typeof fn === "number" && imageOps.has(fn)) {
      rasterImageCount++;
      maxRasterCoverage = Math.max(maxRasterCoverage, Math.min(1, areaScale / pageArea));
    }
  }

  return { rasterImageCount, maxRasterCoverage };
}

interface PdfJsDocument {
  numPages: number;
  getPage(n: number): Promise<PdfJsPage>;
  destroy?: () => Promise<void>;
}

interface PdfJsPage {
  view: number[];
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  cleanup?: () => void;
}

interface PdfJsOps {
  save?: number;
  restore?: number;
  transform?: number;
  paintImageMaskXObject?: number;
  paintImageXObject?: number;
  paintInlineImageXObject?: number;
  paintSolidColorImageMask?: number;
}

interface PdfJsLibrary {
  OPS: PdfJsOps;
  PDFDataRangeTransport: new (
    length: number,
    initialData: Uint8Array,
    progressiveDone?: boolean,
    contentDispositionFilename?: string | null,
  ) => {
    onDataRange(begin: number, chunk: Uint8Array): void;
    onDataProgress(loaded: number, total: number): void;
    requestDataRange(begin: number, end: number): void;
    abort(): void;
  };
  getDocument(opts: Record<string, unknown>): { promise: Promise<PdfJsDocument> };
}

/**
 * Lê o texto das primeiras `pageLimit` páginas de um PDF remoto sem baixá-lo
 * por inteiro. Erros por página não interrompem a leitura.
 */
export async function readRemotePdfPages(opts: {
  url: string;
  pageLimit: number;
  knownLength?: number;
  onPage?: (page: number, total: number) => void | Promise<void>;
}): Promise<{
  pageTexts: string[];
  pageSignals: PdfPageInfo[];
  pageCount: number;
  pagesRead: number;
  failedPages: number[];
  bytesFetched: number;
}> {
  const doc = await openRemotePdf(opts.url, opts.knownLength);
  try {
    const pagesRead = Math.min(doc.numPages, Math.max(1, opts.pageLimit));
    const pageTexts: string[] = [];
    const pageSignals: PdfPageInfo[] = [];
    const failedPages: number[] = [];
    for (let i = 1; i <= pagesRead; i++) {
      try {
        const info = await readPdfPageInfoWithRetry(doc, i);
        pageTexts.push(info.text);
        pageSignals.push(info);
      } catch {
        pageTexts.push("");
        pageSignals.push({
          page: i,
          text: "",
          textItemCount: 0,
          rasterImageCount: 0,
          maxRasterCoverage: 0,
        });
        failedPages.push(i);
      }
      await opts.onPage?.(i, pagesRead);
    }
    return {
      pageTexts,
      pageSignals,
      pageCount: doc.numPages,
      pagesRead,
      failedPages,
      bytesFetched: doc.bytesFetched(),
    };
  } finally {
    await doc.destroy().catch(() => {});
  }
}
