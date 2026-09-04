/**
 * Cliente do divisor de PDFs.
 *
 * Usa um Web Worker para não travar a thread principal enquanto abre e
 * fatia PDFs grandes. As partes geradas são reais: cada uma é um PDF
 * válido com suas próprias páginas, e o servidor as processa como
 * documentos independentes, depois agrupando visualmente pelo
 * parent_document_id.
 */

import type {
  SplitterWorkerError,
  SplitterWorkerInput,
  SplitterWorkerOutput,
} from "./pdf-splitter.worker";

export interface SplitPdfOptions {
  file: File;
  maxPartPages?: number;
  minSplitPages?: number;
}

export interface SplitPdfResult {
  originalPageCount: number;
  parts: {
    blob: Blob;
    filename: string;
    pageCount: number;
    partIndex: number;
    partCount: number;
    pageOffset: number;
  }[];
}

export const DEFAULT_MAX_PART_PAGES = 200;
export const DEFAULT_MIN_SPLIT_PAGES = 60;

/** Opções de tamanho de parte oferecidas no envio. */
export const PART_SIZE_OPTIONS = [
  { value: 100, label: "100 páginas por parte (mais rápido por parte)" },
  { value: 200, label: "200 páginas por parte (recomendado)" },
  { value: 500, label: "500 páginas por parte (menos arquivos)" },
  { value: 0, label: "Não dividir" },
] as const;

function createWorker(): Worker {
  return new Worker(new URL("./pdf-splitter.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function splitPdf({
  file,
  maxPartPages = DEFAULT_MAX_PART_PAGES,
  minSplitPages = DEFAULT_MIN_SPLIT_PAGES,
}: SplitPdfOptions): Promise<SplitPdfResult> {
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      worker.terminate();
    };


    worker.onmessage = (event: MessageEvent<SplitterWorkerOutput | SplitterWorkerError>) => {
      const data = event.data;
      if (!data.ok) {
        cleanup();
        reject(new Error(data.message));
        return;
      }
      cleanup();
      resolve({
        originalPageCount: data.originalPageCount,
        parts: data.parts.map((p) => ({
          blob: new Blob([p.bytes], { type: "application/pdf" }),
          filename: p.filename,
          pageCount: p.pageCount,
          partIndex: p.partIndex,
          partCount: p.partCount,
          pageOffset: p.pageOffset,
        })),
      });
    };

    worker.onerror = (err) => {
      cleanup();
      reject(err);
    };

    file
      .arrayBuffer()
      .then((buffer) => {
        const input: SplitterWorkerInput = {
          bytes: new Uint8Array(buffer),
          filename: file.name,
          fileType: file.type,
          maxPartPages,
          minSplitPages,
        };
        worker.postMessage(input);
      })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}

export function shouldSplitPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
