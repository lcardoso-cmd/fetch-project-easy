/**
 * Sinais objetivos usados para decidir se uma página realmente precisa de OCR.
 *
 * Texto curto, por si só, não prova que a página é uma imagem. Capas, folhas de
 * separação e despachos curtos podem ter uma camada textual perfeitamente
 * válida. O OCR automático só é indicado quando há evidência de imagem raster
 * relevante e a camada textual não contém conteúdo suficiente.
 */

export interface PdfPageTextSignals {
  text: string;
  textItemCount: number;
  rasterImageCount: number;
  /** Maior área raster estimada em relação à área da página (0..1). */
  maxRasterCoverage: number;
}

export type PdfPageReadMode = "native" | "ocr" | "blank";

const STRONG_NATIVE_ALNUM_CHARS = 120;
const STRONG_NATIVE_WORDS = 20;
const LARGE_RASTER_COVERAGE = 0.25;

export function compactAlphanumericLength(text: string): number {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
}

function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;
}

/**
 * Decide entre texto nativo, OCR e página vazia.
 *
 * Regras conservadoras:
 * - uma camada textual substancial sempre prevalece, mesmo sobre uma imagem;
 * - texto curto sem imagem grande continua nativo;
 * - página sem texto e sem raster não consome OCR;
 * - OCR é reservado a página rasterizada sem camada textual suficiente.
 */
export function decidePdfPageReadMode(signals: PdfPageTextSignals): PdfPageReadMode {
  const alnum = compactAlphanumericLength(signals.text);
  const words = wordCount(signals.text);
  const strongText = alnum >= STRONG_NATIVE_ALNUM_CHARS || words >= STRONG_NATIVE_WORDS;

  if (strongText) return "native";

  const hasRaster = signals.rasterImageCount > 0;
  const hasLargeRaster = signals.maxRasterCoverage >= LARGE_RASTER_COVERAGE;
  if (alnum === 0) return hasRaster ? "ocr" : "blank";
  if (hasLargeRaster) return "ocr";
  return "native";
}

/** Página rasterizada que merece segunda leitura nativa antes do OCR. */
export function needsNativeVerification(signals: PdfPageTextSignals): boolean {
  return decidePdfPageReadMode(signals) === "ocr";
}
