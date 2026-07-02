/**
 * Design tokens compartilhados por TODOS os documentos gerados pelo
 * JurisMind (DOCX, PDF, PPTX). Alterações aqui refletem em todos os
 * exports — proposta, petição, resumo de caso, artefatos do chat, etc.
 *
 * Regra: qualquer novo renderer de documento DEVE importar destes tokens
 * em vez de definir constantes próprias.
 */

// ---------------------------------------------------------------------------
// Página — US Letter, margens 1"
// ---------------------------------------------------------------------------

/** DXA (1440 = 1 in) — unidade nativa do OOXML/DOCX. */
export const PAGE_DXA = {
  width: 12240, // 8.5"
  height: 15840, // 11"
  margin: 1440, // 1"
} as const;

/** Points (72 pt = 1 in) — unidade nativa do PDF. */
export const PAGE_PT = {
  width: 612, // 8.5"
  height: 792, // 11"
  marginLeft: 72,
  marginRight: 72,
  marginTop: 72,
  marginBottom: 72,
} as const;

export const CONTENT_WIDTH_DXA = PAGE_DXA.width - PAGE_DXA.margin * 2; // 9360
export const CONTENT_WIDTH_PT = PAGE_PT.width - PAGE_PT.marginLeft - PAGE_PT.marginRight; // 468

// ---------------------------------------------------------------------------
// Tipografia
// ---------------------------------------------------------------------------

/**
 * Famílias tipográficas do documento. Calibri é usada no DOCX (nativo do
 * Word). No PDF, mapeia para Helvetica (fonte Type 1 embutida em todo
 * reader) — metricamente similar, mantendo layout consistente.
 */
export const FONTS = {
  body: "Calibri",
  heading: "Calibri",
  /** Fallback PDF (Type 1 built-in). */
  pdfBody: "Helvetica",
  pdfBodyBold: "Helvetica-Bold",
  pdfBodyItalic: "Helvetica-Oblique",
  pdfBodyBoldItalic: "Helvetica-BoldOblique",
} as const;

/** Tamanhos em pontos (11 pt body é o padrão profissional Word/Calibri). */
export const FONT_SIZES_PT = {
  title: 24,
  h1: 16,
  h2: 13,
  h3: 11,
  body: 11,
  small: 9,
} as const;

/** Mesmos tamanhos em half-points (docx-js usa 2× pontos). */
export const FONT_SIZES_HP = {
  title: FONT_SIZES_PT.title * 2, // 48
  h1: FONT_SIZES_PT.h1 * 2, // 32
  h2: FONT_SIZES_PT.h2 * 2, // 26
  h3: FONT_SIZES_PT.h3 * 2, // 22
  body: FONT_SIZES_PT.body * 2, // 22
  small: FONT_SIZES_PT.small * 2, // 18
} as const;

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------

export const COLORS = {
  ink: "0F172A",
  inkSoft: "334155",
  muted: "64748B",
  accent: "1E3A8A",
  quote: "475569",
  border: "CCCCCC",
  headerBand: "0F172A",
  headerText: "FFFFFF",
} as const;

/** Converte "RRGGBB" hex em [r, g, b] normalizado 0..1 (para PDF). */
export function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, "");
  const n = parseInt(h, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

// ---------------------------------------------------------------------------
// Espaçamento (line-height / spacing after)
// ---------------------------------------------------------------------------

export const SPACING = {
  /** Line height multiplicador (1.35 = confortável para leitura jurídica). */
  lineHeight: 1.35,
  /** Espaço após parágrafo, em pontos. */
  paragraphAfterPt: 6,
  /** Espaço antes de heading, em pontos. */
  headingBeforePt: 12,
  /** Espaço após heading, em pontos. */
  headingAfterPt: 6,
} as const;

// ---------------------------------------------------------------------------
// Branding — descreve identidade do escritório para header/footer
// ---------------------------------------------------------------------------

export interface DocBranding {
  firmName: string;
  taxId?: string;
  address?: string;
  website?: string;
  logo?: {
    bytes: Uint8Array;
    type: "png" | "jpg" | "gif" | "bmp";
    heightPx: number;
    widthPx: number;
  };
}

export const DEFAULT_BRAND_NAME = "B2B | JurisMind AI";
