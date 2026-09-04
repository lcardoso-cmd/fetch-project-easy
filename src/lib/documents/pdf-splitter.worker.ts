/**
 * Web Worker que divide PDFs grandes sem bloquear a interface.
 *
 * O arquivo original é transferido (não clonado) para o worker. Cada parte é
 * produzida e devolvida isoladamente; a seguinte só é criada quando a thread
 * principal confirma que terminou de consumir a atual. Isso limita o pico de
 * memória mesmo para arquivos próximos de 250 MiB.
 */

import {
  DEFAULT_TARGET_PART_BYTES,
  partFilename,
  planSplit,
  type SplitPlanRange,
} from "./pdf-splitter.core";

export interface SplitterWorkerStart {
  type: "start";
  bytes: ArrayBuffer;
  filename: string;
  maxPartPages: number;
  minSplitPages: number;
  targetPartBytes: number;
}

export interface SplitterWorkerContinue {
  type: "continue";
}

export type SplitterWorkerInput = SplitterWorkerStart | SplitterWorkerContinue;

export interface SplitterWorkerPlan {
  ok: true;
  type: "plan";
  originalPageCount: number;
  ranges: SplitPlanRange[];
}

export interface SplitterWorkerPart {
  ok: true;
  type: "part";
  bytes: ArrayBuffer;
  filename: string;
  pageCount: number;
  partIndex: number;
  partCount: number;
  pageOffset: number;
}

export interface SplitterWorkerDone {
  ok: true;
  type: "done";
}

export type SplitterWorkerOutput = SplitterWorkerPlan | SplitterWorkerPart | SplitterWorkerDone;

export interface SplitterWorkerError {
  ok: false;
  type: "error";
  message: string;
}

interface SplitSession {
  filename: string;
  source: Awaited<ReturnType<typeof import("pdf-lib").PDFDocument.load>>;
  ranges: SplitPlanRange[];
  nextRange: number;
  busy: boolean;
}

let session: SplitSession | null = null;

function postWithTransfer(message: unknown, transfer: Transferable[] = []) {
  (
    self as unknown as {
      postMessage: (value: unknown, transfer: Transferable[]) => void;
    }
  ).postMessage(message, transfer);
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  self.postMessage({ ok: false, type: "error", message } satisfies SplitterWorkerError);
  session = null;
}

async function emitNextPart() {
  if (!session || session.busy) return;
  const current = session;
  const range = current.ranges[current.nextRange];
  if (!range) {
    self.postMessage({ ok: true, type: "done" } satisfies SplitterWorkerDone);
    session = null;
    return;
  }

  current.busy = true;
  try {
    const { PDFDocument } = await import("pdf-lib");
    const output = await PDFDocument.create();
    const pageIndices = Array.from(
      { length: range.end - range.start },
      (_, index) => range.start + index,
    );
    const pages = await output.copyPages(current.source, pageIndices);
    for (const page of pages) output.addPage(page);
    const saved = await output.save();
    const bytes = saved.buffer.slice(
      saved.byteOffset,
      saved.byteOffset + saved.byteLength,
    ) as ArrayBuffer;

    current.nextRange += 1;
    current.busy = false;
    const message: SplitterWorkerPart = {
      ok: true,
      type: "part",
      bytes,
      filename: partFilename(current.filename, range.partIndex, range.partCount),
      pageCount: range.end - range.start,
      partIndex: range.partIndex,
      partCount: range.partCount,
      pageOffset: range.start,
    };
    postWithTransfer(message, [bytes]);
  } catch (error) {
    fail(error);
  }
}

async function start(input: SplitterWorkerStart) {
  try {
    const { PDFDocument } = await import("pdf-lib");
    const bytes = new Uint8Array(input.bytes);
    const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const originalPageCount = source.getPageCount();
    const ranges = planSplit(
      originalPageCount,
      input.maxPartPages,
      input.minSplitPages,
      bytes.byteLength,
      input.targetPartBytes || DEFAULT_TARGET_PART_BYTES,
    );

    self.postMessage({
      ok: true,
      type: "plan",
      originalPageCount,
      ranges,
    } satisfies SplitterWorkerPlan);

    // Quando não há divisão, o File original continua disponível na thread
    // principal; não há motivo para serializar e devolver outra cópia dele.
    if (ranges.length <= 1) {
      self.postMessage({ ok: true, type: "done" } satisfies SplitterWorkerDone);
      return;
    }

    session = {
      filename: input.filename,
      source,
      ranges,
      nextRange: 0,
      busy: false,
    };
    await emitNextPart();
  } catch (error) {
    fail(error);
  }
}

self.onmessage = (event: MessageEvent<SplitterWorkerInput>) => {
  if (event.data.type === "start") {
    void start(event.data);
    return;
  }
  void emitNextPart();
};
