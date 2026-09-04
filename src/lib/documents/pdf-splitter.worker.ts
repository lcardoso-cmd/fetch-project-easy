/**
 * Web Worker que divide PDFs grandes em partes menores usando pdf-lib.
 *
 * Por que no navegador: o servidor que processa documentos tem teto rígido de
 * memória (~128 MB). Abrir um PDF de 156 MB inteiro lá é a causa dos documentos
 * que ficam presos em "Lendo imagens (OCR)". No navegador há memória de sobra
 * para abrir o arquivo original, cortá-lo em partes e enviar cada parte.
 */

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

self.onmessage = async (event: MessageEvent<SplitterWorkerInput>) => {
  try {
    const { bytes, filename, maxPartPages, minSplitPages } = event.data;
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const total = src.getPageCount();

    if (total <= minSplitPages) {
      // Não vale a pena dividir: devolve o arquivo inteiro como parte única.
      self.postMessage({
        ok: true,
        originalPageCount: total,
      parts: [
          {
            bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
            filename,
            pageCount: total,
            partIndex: 1,
            partCount: 1,
            pageOffset: 0,
          },
        ],
      } satisfies SplitterWorkerOutput);
      return;
    }

    const partCount = Math.ceil(total / maxPartPages);
    const partSize = Math.ceil(total / partCount);
    const parts: SplitterWorkerOutput["parts"] = [];

    for (let i = 0; i < partCount; i++) {
      const start = i * partSize + 1;
      const end = Math.min((i + 1) * partSize, total);
      const pageIndices: number[] = [];
      for (let p = start; p <= end; p++) pageIndices.push(p - 1);

      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pageIndices);
      for (const p of copied) out.addPage(p);
      const partBytes = await out.save();

      const baseName = filename.replace(/\.pdf$/i, "");
      const partFilename = `${baseName} — parte ${i + 1} de ${partCount}.pdf`;
      const sliced = partBytes.buffer.slice(
        partBytes.byteOffset,
        partBytes.byteOffset + partBytes.byteLength,
      ) as ArrayBuffer;

      parts.push({
        bytes: sliced,
        filename: partFilename,
        pageCount: end - start + 1,
        partIndex: i + 1,
        partCount,
        pageOffset: start - 1,
      });
    }

    self.postMessage({
      ok: true,
      originalPageCount: total,
      parts,
    } satisfies SplitterWorkerOutput);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ ok: false, message } satisfies SplitterWorkerError);
  }
};
