/**
 * Web Worker que divide PDFs grandes em partes menores usando pdf-lib.
 *
 * Por que no navegador: o servidor que processa documentos tem teto rígido de
 * memória. Abrir um PDF de centenas de MB inteiro lá é a causa dos documentos
 * que ficam presos em "Lendo imagens (OCR)". No navegador há memória de sobra
 * para abrir o arquivo original, cortá-lo em partes e enviar cada parte.
 */

import { splitPdfBytes } from "./pdf-splitter.core";

export interface SplitterWorkerInput {
  bytes: Uint8Array;
  filename: string;
  fileType: string;
  maxPartPages: number;
  minSplitPages: number;
}

export interface SplitterWorkerOutput {
  ok: true;
  originalPageCount: number;
  parts: {
    bytes: ArrayBuffer;
    filename: string;
    pageCount: number;
    partIndex: number;
    partCount: number;
    pageOffset: number;
  }[];
}

export interface SplitterWorkerError {
  ok: false;
  message: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

self.onmessage = async (event: MessageEvent<SplitterWorkerInput>) => {
  try {
    const { bytes, filename, maxPartPages, minSplitPages } = event.data;
    const { PDFDocument } = await import("pdf-lib");
    const { originalPageCount, parts } = await splitPdfBytes(
      bytes,
      filename,
      maxPartPages,
      minSplitPages,
      PDFDocument,
    );
    const payload: SplitterWorkerOutput = {
      ok: true,
      originalPageCount,
      parts: parts.map((p) => ({ ...p, bytes: toArrayBuffer(p.bytes) })),
    };
    (self as unknown as {
      postMessage: (msg: unknown, transfer: Transferable[]) => void;
    }).postMessage(
      payload,
      payload.parts.map((p) => p.bytes),
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ ok: false, message } satisfies SplitterWorkerError);
  }
};
