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

const DEFAULT_MAX_PART_PAGES = 200;
const DEFAULT_MIN_SPLIT_PAGES = 60;

function createWorker(): { worker: Worker; url: string } {
  // Inline worker: evita problemas de bundler com workers dedicados.
  const code = [
    `import "${new URL("./pdf-splitter.worker.ts", import.meta.url).href}";`,
  ];
  const blob = new Blob(code, { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url, { type: "module" });
  return { worker, url };
}

export function splitPdf({
  file,
  maxPartPages = DEFAULT_MAX_PART_PAGES,
  minSplitPages = DEFAULT_MIN_SPLIT_PAGES,
}: SplitPdfOptions): Promise<SplitPdfResult> {
  return new Promise((resolve, reject) => {
    const { worker, url } = createWorker();
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      worker.terminate();
      URL.revokeObjectURL(url);
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
