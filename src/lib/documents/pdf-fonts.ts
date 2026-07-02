/**
 * Tabelas de largura para as fontes Type1 padrão (Helvetica família).
 * Valores em unidades de 1/1000 em — multiplique por (fontSizePt / 1000)
 * para obter a largura de um caractere em pontos.
 *
 * Fonte: Adobe AFM files (subset ASCII imprimível 32..126). Caracteres
 * fora dessa faixa recebem largura média (500).
 */

// Helvetica regular
const HELV: Record<number, number> = {
  32: 278, 33: 278, 34: 355, 35: 556, 36: 556, 37: 889, 38: 667, 39: 191,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 278, 59: 278, 60: 584, 61: 584, 62: 584, 63: 556,
  64: 1015, 65: 667, 66: 667, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 500, 75: 667, 76: 556, 77: 833, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
  88: 667, 89: 667, 90: 611, 91: 278, 92: 278, 93: 278, 94: 469, 95: 556,
  96: 222, 97: 556, 98: 556, 99: 500, 100: 556, 101: 556, 102: 278, 103: 556,
  104: 556, 105: 222, 106: 222, 107: 500, 108: 222, 109: 833, 110: 556, 111: 556,
  112: 556, 113: 556, 114: 333, 115: 500, 116: 278, 117: 556, 118: 500, 119: 722,
  120: 500, 121: 500, 122: 500, 123: 334, 124: 260, 125: 334, 126: 584,
};

// Helvetica-Bold
const HELV_B: Record<number, number> = {
  32: 278, 33: 333, 34: 474, 35: 556, 36: 556, 37: 889, 38: 722, 39: 238,
  40: 333, 41: 333, 42: 389, 43: 584, 44: 278, 45: 333, 46: 278, 47: 278,
  48: 556, 49: 556, 50: 556, 51: 556, 52: 556, 53: 556, 54: 556, 55: 556,
  56: 556, 57: 556, 58: 333, 59: 333, 60: 584, 61: 584, 62: 584, 63: 611,
  64: 975, 65: 722, 66: 722, 67: 722, 68: 722, 69: 667, 70: 611, 71: 778,
  72: 722, 73: 278, 74: 556, 75: 722, 76: 611, 77: 833, 78: 722, 79: 778,
  80: 667, 81: 778, 82: 722, 83: 667, 84: 611, 85: 722, 86: 667, 87: 944,
  88: 667, 89: 667, 90: 611, 91: 333, 92: 278, 93: 333, 94: 584, 95: 556,
  96: 278, 97: 556, 98: 611, 99: 556, 100: 611, 101: 556, 102: 333, 103: 611,
  104: 611, 105: 278, 106: 278, 107: 556, 108: 278, 109: 889, 110: 611, 111: 611,
  112: 611, 113: 611, 114: 389, 115: 556, 116: 333, 117: 611, 118: 556, 119: 778,
  120: 556, 121: 556, 122: 500, 123: 389, 124: 280, 125: 389, 126: 584,
};

// Helvetica-Oblique compartilha widths com Helvetica
// Helvetica-BoldOblique compartilha widths com Helvetica-Bold

export type PdfFontFace =
  | "Helvetica"
  | "Helvetica-Bold"
  | "Helvetica-Oblique"
  | "Helvetica-BoldOblique";

function tableFor(face: PdfFontFace): Record<number, number> {
  if (face === "Helvetica-Bold" || face === "Helvetica-BoldOblique") return HELV_B;
  return HELV;
}

/** Largura de um caractere unicode em pontos, para dada fonte/tamanho. */
export function charWidthPt(ch: string, face: PdfFontFace, sizePt: number): number {
  const code = ch.charCodeAt(0);
  const table = tableFor(face);
  const w = table[code] ?? 500;
  return (w * sizePt) / 1000;
}

/** Largura de uma string em pontos. */
export function textWidthPt(s: string, face: PdfFontFace, sizePt: number): number {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += charWidthPt(s[i], face, sizePt);
  return w;
}
