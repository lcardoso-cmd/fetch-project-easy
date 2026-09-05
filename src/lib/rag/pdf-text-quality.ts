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
/**
 * Abaixo disso a camada textual é irrelevante (um número de página, um selo).
 * Só nesse caso vale gastar leitura de imagem.
 */
const MINIMAL_NATIVE_ALNUM_CHARS = 16;

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
 * - qualquer camada textual real prevalece, mesmo com imagem grande ao fundo
 *   (peça com carimbo do tribunal, logotipo do escritório ou digitalização
 *   sobreposta continua sendo lida como texto);
 * - página sem texto e sem imagem não consome leitura de imagem;
 * - leitura por imagem é reservada à página praticamente sem texto próprio.
 */
export function decidePdfPageReadMode(signals: PdfPageTextSignals): PdfPageReadMode {
  const alnum = compactAlphanumericLength(signals.text);
  const words = wordCount(signals.text);
  const strongText = alnum >= STRONG_NATIVE_ALNUM_CHARS || words >= STRONG_NATIVE_WORDS;

  if (strongText) return "native";
  if (alnum >= MINIMAL_NATIVE_ALNUM_CHARS) return "native";

  const hasRaster = signals.rasterImageCount > 0;
  return hasRaster ? "ocr" : "blank";
}


/** Página rasterizada que merece segunda leitura nativa antes do OCR. */
export function needsNativeVerification(signals: PdfPageTextSignals): boolean {
  return decidePdfPageReadMode(signals) === "ocr";
}
