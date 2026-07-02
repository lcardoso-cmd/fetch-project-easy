/**
 * Faces tipográficas usadas pelo renderer PDF. Mapeadas para as
 * variantes de Carlito (metricamente compatível com Calibri, usada no
 * DOCX). O renderer resolve as métricas de largura via pdf-lib
 * (`font.widthOfTextAtSize`) — não há mais tabela AFM local.
 */

export type PdfFontFace = "body" | "bold" | "italic" | "boldItalic";

export function pickFace(bold?: boolean, italic?: boolean): PdfFontFace {
  if (bold && italic) return "boldItalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "body";
}
