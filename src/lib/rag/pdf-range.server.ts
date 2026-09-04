/**
 * Leitura de PDF por faixas de bytes (HTTP Range) a partir de uma URL assinada.
 *
 * Motivo: baixar um PDF de centenas de MB inteiro para memória estoura o
 * runtime. Com Range, o leitor pede só os pedaços necessários para abrir o
 * documento e ler as primeiras páginas.
 */

const INITIAL_CHUNK = 128 * 1024;
const RANGE_CHUNK = 256 * 1024;

export interface RangePdfDoc {
  numPages: number;
  /** Total de bytes efetivamente transferidos até agora. */
  bytesFetched(): number;
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
  const res = await fetch(url, { headers: { Range: `bytes=${begin}-${endInclusive}` } });
  if (!res.ok) {
    if (res.status === 404) throw new Error("file_missing");
    throw new Error(`range_fetch_failed_${res.status}`);
  }
  if (res.status !== 206 && begin > 0) throw new RangeNotSupportedError();
  return new Uint8Array(await res.arrayBuffer());
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
  const pdfjs = (await getResolvedPDFJS()) as unknown as {
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
  };

  const length = knownLength && knownLength > 0 ? knownLength : await remoteFileSize(url);
  if (!length) throw new Error("file_missing");

  let fetched = 0;
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
      .catch(() => {
        // pdf.js trata a ausência do trecho como falha de leitura da página.
      });
  };
  transport.abort = () => {};

  const doc = await pdfjs.getDocument({
    range: transport,
    length,
    rangeChunkSize: RANGE_CHUNK,
    disableAutoFetch: true,
    disableStream: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  return {
    numPages: doc.numPages,
    bytesFetched: () => fetched,
    async pageText(page: number) {
      const p = await doc.getPage(page);
      const content = await p.getTextContent();
      const text = content.items
        .map((it) => ("str" in it ? (it.str ?? "") : ""))
        .join(" ");
      // Libera recursos da página imediatamente (documentos longos).
      if (typeof (p as { cleanup?: () => void }).cleanup === "function") {
        (p as { cleanup: () => void }).cleanup();
      }
      return text;
    },
    async destroy() {
      await doc.destroy();
    },
  };
}

interface PdfJsDocument {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
    cleanup?: () => void;
  }>;
  destroy(): Promise<void>;
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
  pageCount: number;
  pagesRead: number;
  failedPages: number[];
  bytesFetched: number;
}> {
  const doc = await openRemotePdf(opts.url, opts.knownLength);
  try {
    const pagesRead = Math.min(doc.numPages, Math.max(1, opts.pageLimit));
    const pageTexts: string[] = [];
    const failedPages: number[] = [];
    for (let i = 1; i <= pagesRead; i++) {
      try {
        pageTexts.push(await doc.pageText(i));
      } catch {
        pageTexts.push("");
        failedPages.push(i);
      }
      await opts.onPage?.(i, pagesRead);
    }
    return {
      pageTexts,
      pageCount: doc.numPages,
      pagesRead,
      failedPages,
      bytesFetched: doc.bytesFetched(),
    };
  } finally {
    await doc.destroy().catch(() => {});
  }
}
