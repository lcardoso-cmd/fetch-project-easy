/**
 * Cliente do divisor de PDFs.
 *
 * O Web Worker recebe o ArrayBuffer por transferência e devolve uma parte de
 * cada vez. A próxima parte só é criada depois que `onPart` termina, permitindo
 * que o chamador envie/libere cada Blob antes de continuar.
 */

import { DEFAULT_TARGET_PART_BYTES } from "./pdf-splitter.core";
import type {
  SplitterWorkerError,
  SplitterWorkerInput,
  SplitterWorkerOutput,
  SplitterWorkerPlan,
} from "./pdf-splitter.worker";

export interface SplitPdfOptions {
  file: File;
  maxPartPages?: number;
  minSplitPages?: number;
  targetPartBytes?: number;
  signal?: AbortSignal;
}

export interface SplitPdfPart {
  blob: Blob;
  filename: string;
  pageCount: number;
  partIndex: number;
  partCount: number;
  pageOffset: number;
}

export interface SplitPdfResult {
  originalPageCount: number;
  parts: SplitPdfPart[];
}

export interface SplitPdfStreamOptions extends SplitPdfOptions {
  onPlan?: (plan: SplitterWorkerPlan) => void | Promise<void>;
  onPart: (part: SplitPdfPart) => void | Promise<void>;
}

export interface SplitPdfStreamResult {
  originalPageCount: number;
  partCount: number;
}

export const DEFAULT_MAX_PART_PAGES = 200;
export const DEFAULT_MIN_SPLIT_PAGES = 60;

/** Opções de tamanho de parte oferecidas no envio. */
export const PART_SIZE_OPTIONS = [
  { value: 100, label: "100 páginas por parte (mais rápido por parte)" },
  { value: 200, label: "200 páginas por parte (recomendado)" },
  { value: 500, label: "500 páginas por parte (menos arquivos)" },
  { value: 0, label: "Não dividir por páginas" },
] as const;

function createWorker(): Worker {
  return new Worker(new URL("./pdf-splitter.worker.ts", import.meta.url), {
    type: "module",
  });
}

export function splitPdfStream({
  file,
  maxPartPages = DEFAULT_MAX_PART_PAGES,
  minSplitPages = DEFAULT_MIN_SPLIT_PAGES,
  targetPartBytes = DEFAULT_TARGET_PART_BYTES,
  signal,
  onPlan,
  onPart,
}: SplitPdfStreamOptions): Promise<SplitPdfStreamResult> {
  return new Promise((resolve, reject) => {
    const worker = createWorker();
    let settled = false;
    let plan: SplitterWorkerPlan | null = null;
    let messageChain = Promise.resolve();

    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener("abort", onAbort);
    };
    const finishWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };
    const onAbort = () => finishWithError(new DOMException("Divisão cancelada", "AbortError"));

    const handleMessage = async (data: SplitterWorkerOutput | SplitterWorkerError) => {
      if (settled) return;
      if (!data.ok) {
        finishWithError(new Error(data.message));
        return;
      }

      if (data.type === "plan") {
        plan = data;
        await onPlan?.(data);
        if (data.ranges.length <= 1) {
          // O parse já terminou; libere imediatamente a cópia transferida ao
          // worker antes de começar o upload do File original.
          worker.terminate();
          signal?.removeEventListener("abort", onAbort);
          await onPart({
            blob: file,
            filename: file.name,
            pageCount: data.originalPageCount,
            partIndex: 1,
            partCount: 1,
            pageOffset: 0,
          });
          settled = true;
          resolve({
            originalPageCount: data.originalPageCount,
            partCount: 1,
          });
        }
        return;
      }

      if (data.type === "part") {
        await onPart({
          blob: new Blob([data.bytes], { type: "application/pdf" }),
          filename: data.filename,
          pageCount: data.pageCount,
          partIndex: data.partIndex,
          partCount: data.partCount,
          pageOffset: data.pageOffset,
        });
        const next: SplitterWorkerInput = { type: "continue" };
        worker.postMessage(next);
        return;
      }

      if (!plan) throw new Error("O divisor terminou sem informar o plano do PDF.");
      settled = true;
      cleanup();
      resolve({
        originalPageCount: plan.originalPageCount,
        partCount: plan.ranges.length,
      });
    };

    worker.onmessage = (event: MessageEvent<SplitterWorkerOutput | SplitterWorkerError>) => {
      messageChain = messageChain.then(() => handleMessage(event.data)).catch(finishWithError);
    };
    worker.onerror = (error) => finishWithError(error);

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });

    file
      .arrayBuffer()
      .then((bytes) => {
        if (signal?.aborted) return;
        const input: SplitterWorkerInput = {
          type: "start",
          bytes,
          filename: file.name,
          maxPartPages,
          minSplitPages,
          targetPartBytes,
        };
        worker.postMessage(input, [bytes]);
      })
      .catch(finishWithError);
  });
}

/** Compatibilidade para consumidores que realmente precisam de todas as partes. */
export async function splitPdf(options: SplitPdfOptions): Promise<SplitPdfResult> {
  const parts: SplitPdfPart[] = [];
  const result = await splitPdfStream({
    ...options,
    onPart: (part) => {
      parts.push(part);
    },
  });
  return { originalPageCount: result.originalPageCount, parts };
}

export function shouldSplitPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
