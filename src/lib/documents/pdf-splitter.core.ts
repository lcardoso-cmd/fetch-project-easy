/**
 * Lógica pura de divisão de PDFs — usada pelo Web Worker e pelos testes.
 * Mantida separada para poder ser validada fora do navegador.
 */

export interface SplitPart {
  bytes: Uint8Array;
  filename: string;
  pageCount: number;
  partIndex: number;
  partCount: number;
  pageOffset: number;
}

export interface SplitPlanRange {
  start: number; // índice de página (0-based) inclusivo
  end: number; // índice de página (0-based) exclusivo
  partIndex: number;
  partCount: number;
}

/** Calcula as faixas de páginas de cada parte, equilibrando os tamanhos. */
export function planSplit(
  totalPages: number,
  maxPartPages: number,
  minSplitPages: number,
): SplitPlanRange[] {
  if (totalPages <= 0) return [];
  if (maxPartPages <= 0 || totalPages <= minSplitPages || totalPages <= maxPartPages) {
    return [{ start: 0, end: totalPages, partIndex: 1, partCount: 1 }];
  }
  const partCount = Math.ceil(totalPages / maxPartPages);
  const partSize = Math.ceil(totalPages / partCount);
  const ranges: SplitPlanRange[] = [];
  for (let i = 0; i < partCount; i++) {
    const start = i * partSize;
    const end = Math.min(start + partSize, totalPages);
    if (start >= end) break;
    ranges.push({ start, end, partIndex: i + 1, partCount });
  }
  return ranges.map((r) => ({ ...r, partCount: ranges.length }));
}

export function partFilename(original: string, index: number, count: number) {
  const base = original.replace(/\.pdf$/i, "");
  return count <= 1 ? original : `${base} — parte ${index} de ${count}.pdf`;
}

/** Divide um PDF em partes reais. `PDFDocument` vem de pdf-lib. */
export async function splitPdfBytes(
  bytes: Uint8Array,
  filename: string,
  maxPartPages: number,
  minSplitPages: number,
  PDFDocument: typeof import("pdf-lib").PDFDocument,
): Promise<{ originalPageCount: number; parts: SplitPart[] }> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const total = src.getPageCount();
  const ranges = planSplit(total, maxPartPages, minSplitPages);

  if (ranges.length <= 1) {
    return {
      originalPageCount: total,
      parts: [
        {
          bytes,
          filename,
          pageCount: total,
          partIndex: 1,
          partCount: 1,
          pageOffset: 0,
        },
      ],
    };
  }

  const parts: SplitPart[] = [];
  for (const range of ranges) {
    const out = await PDFDocument.create();
    const indices: number[] = [];
    for (let p = range.start; p < range.end; p++) indices.push(p);
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
    parts.push({
      bytes: await out.save(),
      filename: partFilename(filename, range.partIndex, range.partCount),
      pageCount: range.end - range.start,
      partIndex: range.partIndex,
      partCount: range.partCount,
      pageOffset: range.start,
    });
  }
  return { originalPageCount: total, parts };
}
