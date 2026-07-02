/**
 * Renderer PDF unificado do JurisMind. Consome DocBlock[] + branding e
 * produz um PDF workerd-safe (JS puro) com:
 *  - US Letter, margens 1" (idêntico ao DOCX)
 *  - Tipografia Carlito (metricamente compatível com Calibri do DOCX)
 *  - Header/Footer com borda e paginação
 *  - Wrap por largura real usando métricas da fonte embutida
 *  - Inline bold/italic/underline/strike
 *  - Alinhamento left/center/right/justify por parágrafo
 *  - Bullets e listas numeradas
 *
 * Este módulo é o único caminho de geração de PDF do app.
 */

import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DocBlock, InlineRun } from "./blocks";
import {
  COLORS,
  DEFAULT_BRAND_NAME,
  FONT_SIZES_PT,
  PAGE_PT,
  SPACING,
  hexToRgb01,
  type DocBranding,
} from "./tokens";
import { pickFace, type PdfFontFace } from "./pdf-fonts";
import { CARLITO_BYTES } from "./fonts/carlito";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface RenderPdfInput {
  title: string;
  blocks: DocBlock[];
  branding?: DocBranding | null;
  /** Rótulo curto no canto direito do header (ex.: "Petição", "Proposta"). */
  headerLabel?: string;
  /** Se true, oculta cabeçalho e rodapé. */
  bare?: boolean;
}

type Fonts = Record<PdfFontFace, PDFFont>;

type StyledRun = InlineRun & { face: PdfFontFace; sizePt: number };

interface LineSegment {
  text: string;
  face: PdfFontFace;
  sizePt: number;
  underline?: boolean;
  strike?: boolean;
}

interface LayoutLine {
  segments: LineSegment[];
  /** Largura em pt (sem prefixo). */
  width: number;
  align: "left" | "center" | "right" | "justify";
  sizePt: number;
  indent: number;
  spacingAfter: number;
  prefix?: string;
  prefixWidth?: number;
  lastOfParagraph: boolean;
  color?: string;
  bold?: boolean;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Substitui caracteres não cobertos pelas fontes embutidas por
 * equivalentes ASCII. Nosso subset de Carlito cobre Latin-1, Latin
 * Extended básico e pontuação comum, então isso quase nunca dispara.
 */
const FALLBACK: Record<string, string> = {
  "\u00A0": " ",
  "\u25E6": "o",
  "\u2192": "->",
};
function sanitize(s: string): string {
  let out = "";
  for (const ch of s) {
    const rep = FALLBACK[ch];
    out += rep !== undefined ? rep : ch;
  }
  return out;
}

function widthOf(font: PDFFont, text: string, size: number): number {
  if (!text) return 0;
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    // caractere não codificável — substitui por espaço e tenta de novo
    const cleaned = text.replace(/[^\x00-\xFF\u0100-\u017F\u2000-\u206F\u20AC]/g, " ");
    return font.widthOfTextAtSize(cleaned, size);
  }
}

// ---------------------------------------------------------------------------
// Layout — quebra runs em linhas físicas
// ---------------------------------------------------------------------------

function layoutRuns(
  runs: StyledRun[],
  maxWidth: number,
  fonts: Fonts,
): { lines: { segments: LineSegment[]; width: number }[] } {
  const lines: { segments: LineSegment[]; width: number }[] = [];
  let current: LineSegment[] = [];
  let currentWidth = 0;

  const pushLine = () => {
    lines.push({ segments: current, width: currentWidth });
    current = [];
    currentWidth = 0;
  };

  for (const run of runs) {
    if (run.lineBreak) {
      pushLine();
      continue;
    }
    if (!run.text) continue;
    const tokens = sanitize(run.text).match(/\s+|\S+/g) ?? [];
    for (const tok of tokens) {
      const font = fonts[run.face];
      const w = widthOf(font, tok, run.sizePt);
      const isSpace = /^\s+$/.test(tok);
      if (currentWidth + w > maxWidth && current.length > 0 && !isSpace) {
        // remove trailing spaces
        while (current.length > 0) {
          const last = current[current.length - 1];
          if (/^\s+$/.test(last.text)) {
            currentWidth -= widthOf(fonts[last.face], last.text, last.sizePt);
            current.pop();
          } else break;
        }
        pushLine();
        if (isSpace) continue;
      }
      // Token maior que a linha: quebra por caractere
      if (w > maxWidth && !isSpace) {
        let buf = "";
        let bufW = 0;
        for (const ch of tok) {
          const cw = widthOf(font, ch, run.sizePt);
          if (bufW + cw > maxWidth && buf) {
            current.push({ text: buf, face: run.face, sizePt: run.sizePt, underline: run.underline, strike: run.strike });
            currentWidth += bufW;
            pushLine();
            buf = ch;
            bufW = cw;
          } else {
            buf += ch;
            bufW += cw;
          }
        }
        if (buf) {
          current.push({ text: buf, face: run.face, sizePt: run.sizePt, underline: run.underline, strike: run.strike });
          currentWidth += bufW;
        }
        continue;
      }
      current.push({ text: tok, face: run.face, sizePt: run.sizePt, underline: run.underline, strike: run.strike });
      currentWidth += w;
    }
  }
  if (current.length > 0 || lines.length === 0) pushLine();
  return { lines };
}

// ---------------------------------------------------------------------------
// Blocos → linhas
// ---------------------------------------------------------------------------

function styleForBlock(
  block: Extract<DocBlock, { runs: InlineRun[] }>,
): { sizePt: number; bold: boolean; color: string } {
  let sizePt: number = FONT_SIZES_PT.body;
  let bold = false;
  let color: string = COLORS.ink;
  if (block.kind === "heading") {
    if (block.level === 1) {
      sizePt = FONT_SIZES_PT.h1;
      bold = true;
    } else if (block.level === 2) {
      sizePt = FONT_SIZES_PT.h2;
      bold = true;
      color = COLORS.accent;
    } else {
      sizePt = FONT_SIZES_PT.h3;
      bold = true;
      color = COLORS.inkSoft;
    }
  } else if (block.kind === "quote") {
    color = COLORS.quote;
  }
  return { sizePt, bold, color };
}

function layoutBlocks(
  blocks: DocBlock[],
  contentWidth: number,
  title: string,
  fonts: Fonts,
): LayoutLine[] {
  const lines: LayoutLine[] = [];

  // Título centralizado
  const titleRuns: StyledRun[] = [
    { text: title, face: "bold", sizePt: FONT_SIZES_PT.title },
  ];
  const titleLayout = layoutRuns(titleRuns, contentWidth, fonts);
  for (let i = 0; i < titleLayout.lines.length; i++) {
    const l = titleLayout.lines[i];
    lines.push({
      segments: l.segments,
      width: l.width,
      align: "center",
      sizePt: FONT_SIZES_PT.title,
      indent: 0,
      spacingAfter: i === titleLayout.lines.length - 1 ? 14 : 2,
      lastOfParagraph: i === titleLayout.lines.length - 1,
      color: COLORS.ink,
      bold: true,
    });
  }

  let orderedIndex = 0;

  for (const block of blocks) {
    if (block.kind === "empty") {
      lines.push({
        segments: [],
        width: 0,
        align: "left",
        sizePt: FONT_SIZES_PT.body,
        indent: 0,
        spacingAfter: FONT_SIZES_PT.body * 0.6,
        lastOfParagraph: true,
      });
      orderedIndex = 0;
      continue;
    }

    let indent = 0;
    let prefix: string | undefined;
    let prefixWidth: number | undefined;

    if (block.kind === "list-item") {
      indent = 18;
      if (block.ordered) {
        orderedIndex += 1;
        prefix = `${orderedIndex}.  `;
      } else {
        prefix = "•  ";
        orderedIndex = 0;
      }
      prefixWidth = widthOf(fonts.body, prefix, FONT_SIZES_PT.body);
    } else {
      orderedIndex = 0;
    }

    const { sizePt, bold, color } = styleForBlock(block);
    const runs: StyledRun[] = block.runs.map((r) => ({
      ...r,
      face: pickFace(bold || r.bold, r.italic),
      sizePt,
    }));
    const usable = contentWidth - indent - (prefixWidth ?? 0);
    const laid = layoutRuns(runs, usable, fonts);

    const align: LayoutLine["align"] =
      block.align === "center"
        ? "center"
        : block.align === "right"
          ? "right"
          : block.align === "justify"
            ? "justify"
            : "left";

    const spacingAfterBlock =
      block.kind === "heading"
        ? SPACING.headingAfterPt
        : block.kind === "list-item"
          ? 2
          : SPACING.paragraphAfterPt;
    const spacingBeforeBlock =
      block.kind === "heading" ? SPACING.headingBeforePt : 0;
    if (spacingBeforeBlock > 0 && lines.length > 0) {
      const last = lines[lines.length - 1];
      last.spacingAfter += spacingBeforeBlock;
    }

    for (let i = 0; i < laid.lines.length; i++) {
      const l = laid.lines[i];
      lines.push({
        segments: l.segments,
        width: l.width,
        align,
        sizePt,
        indent,
        spacingAfter:
          i === laid.lines.length - 1 ? spacingAfterBlock : sizePt * 0.15,
        prefix: i === 0 ? prefix : undefined,
        prefixWidth: i === 0 ? prefixWidth : undefined,
        lastOfParagraph: i === laid.lines.length - 1,
        color,
        bold,
      });
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Paginação
// ---------------------------------------------------------------------------

function paginate(lines: LayoutLine[], usableHeight: number): LayoutLine[][] {
  const pages: LayoutLine[][] = [];
  let current: LayoutLine[] = [];
  let y = 0;
  for (const line of lines) {
    const advance = line.sizePt * SPACING.lineHeight + line.spacingAfter;
    if (y + advance > usableHeight && current.length > 0) {
      pages.push(current);
      current = [];
      y = 0;
    }
    current.push(line);
    y += advance;
  }
  if (current.length > 0) pages.push(current);
  if (pages.length === 0) pages.push([]);
  return pages;
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function drawTextSafe(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  color: [number, number, number],
) {
  if (!text) return;
  try {
    page.drawText(text, { x, y, size, font, color: rgb(color[0], color[1], color[2]) });
  } catch {
    const cleaned = text.replace(/[^\x00-\xFF\u0100-\u017F\u2000-\u206F\u20AC]/g, " ");
    page.drawText(cleaned, { x, y, size, font, color: rgb(color[0], color[1], color[2]) });
  }
}

function drawLine(
  page: PDFPage,
  line: LayoutLine,
  cursorY: number,
  contentX: number,
  contentWidth: number,
  defaultColor: string,
  fonts: Fonts,
) {
  const color = hexToRgb01(line.color ?? defaultColor);

  const totalWidth = (line.prefixWidth ?? 0) + line.width;
  let x0 = contentX + line.indent;
  if (line.align === "center") {
    x0 = contentX + (contentWidth - totalWidth) / 2;
  } else if (line.align === "right") {
    x0 = contentX + contentWidth - totalWidth;
  }

  // Justify — distribui espaço extra em spaces internos (exceto última linha)
  let spaceExtra = 0;
  if (line.align === "justify" && !line.lastOfParagraph) {
    let spaces = 0;
    for (const seg of line.segments) {
      for (const ch of seg.text) if (ch === " ") spaces += 1;
    }
    if (spaces > 0) {
      const remaining = contentWidth - line.indent - totalWidth;
      if (remaining > 0) spaceExtra = remaining / spaces;
    }
  }

  // Prefixo (bullet / número)
  if (line.prefix) {
    const font = fonts[line.bold ? "bold" : "body"];
    drawTextSafe(page, line.prefix, x0, cursorY, font, line.sizePt, color);
    x0 += line.prefixWidth ?? 0;
  }

  // Segmentos
  let currentX = x0;
  for (const seg of line.segments) {
    const font = fonts[seg.face];
    if (spaceExtra > 0 && seg.text.includes(" ")) {
      // Desenha pedaço a pedaço para inserir spaceExtra por espaço
      let chunk = "";
      for (const ch of seg.text) {
        if (ch === " ") {
          if (chunk) {
            const cw = widthOf(font, chunk, seg.sizePt);
            drawTextSafe(page, chunk, currentX, cursorY, font, seg.sizePt, color);
            currentX += cw;
            chunk = "";
          }
          currentX += widthOf(font, " ", seg.sizePt) + spaceExtra;
        } else {
          chunk += ch;
        }
      }
      if (chunk) {
        const cw = widthOf(font, chunk, seg.sizePt);
        drawTextSafe(page, chunk, currentX, cursorY, font, seg.sizePt, color);
        currentX += cw;
      }
    } else {
      const w = widthOf(font, seg.text, seg.sizePt);
      drawTextSafe(page, seg.text, currentX, cursorY, font, seg.sizePt, color);
      if (seg.underline || seg.strike) {
        const yLine = seg.underline
          ? cursorY - seg.sizePt * 0.15
          : cursorY + seg.sizePt * 0.28;
        page.drawLine({
          start: { x: currentX, y: yLine },
          end: { x: currentX + w, y: yLine },
          thickness: seg.sizePt * 0.05,
          color: rgb(color[0], color[1], color[2]),
        });
      }
      currentX += w;
    }
  }
}

function drawHeaderFooter(
  page: PDFPage,
  branding: DocBranding | null | undefined,
  headerLabel: string | undefined,
  pageIndex: number,
  totalPages: number,
  fonts: Fonts,
) {
  const firmName = sanitize(branding?.firmName?.trim() || DEFAULT_BRAND_NAME);
  const muted = hexToRgb01(COLORS.muted);
  const ink = hexToRgb01(COLORS.ink);
  const border = hexToRgb01(COLORS.border);

  // Header
  const headerY = PAGE_PT.height - 48;
  drawTextSafe(page, firmName, PAGE_PT.marginLeft, headerY, fonts.bold, 10, ink);
  if (headerLabel) {
    const label = sanitize(headerLabel);
    const w = widthOf(fonts.body, label, 10);
    const x = PAGE_PT.width - PAGE_PT.marginRight - w;
    drawTextSafe(page, label, x, headerY, fonts.body, 10, muted);
  }
  const headerBorderY = headerY - 6;
  page.drawLine({
    start: { x: PAGE_PT.marginLeft, y: headerBorderY },
    end: { x: PAGE_PT.width - PAGE_PT.marginRight, y: headerBorderY },
    thickness: 0.5,
    color: rgb(border[0], border[1], border[2]),
  });

  // Footer
  const footerY = 40;
  const footerBorderY = footerY + 14;
  page.drawLine({
    start: { x: PAGE_PT.marginLeft, y: footerBorderY },
    end: { x: PAGE_PT.width - PAGE_PT.marginRight, y: footerBorderY },
    thickness: 0.5,
    color: rgb(border[0], border[1], border[2]),
  });
  const footerLeft = sanitize(
    [firmName, branding?.taxId, branding?.website].filter(Boolean).join(" · "),
  );
  drawTextSafe(page, footerLeft, PAGE_PT.marginLeft, footerY, fonts.body, 9, muted);
  const pageText = `Página ${pageIndex} de ${totalPages}`;
  const pw = widthOf(fonts.body, pageText, 9);
  const px = PAGE_PT.width - PAGE_PT.marginRight - pw;
  drawTextSafe(page, pageText, px, footerY, fonts.body, 9, muted);
  void degrees; // silence unused import guard
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Renderiza um PDF a partir do AST unificado. Retorna Promise<Uint8Array>
 * — a API é assíncrona porque o pdf-lib embute fontes de forma async.
 */
export async function renderPdf(input: RenderPdfInput): Promise<Uint8Array> {
  const { title, blocks, branding, headerLabel, bare } = input;
  const contentWidth = PAGE_PT.width - PAGE_PT.marginLeft - PAGE_PT.marginRight;
  const contentX = PAGE_PT.marginLeft;

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  let fonts: Fonts;
  try {
    fonts = {
      body: await doc.embedFont(CARLITO_BYTES.body(), { subset: true }),
      bold: await doc.embedFont(CARLITO_BYTES.bold(), { subset: true }),
      italic: await doc.embedFont(CARLITO_BYTES.italic(), { subset: true }),
      boldItalic: await doc.embedFont(CARLITO_BYTES.boldItalic(), { subset: true }),
    };
  } catch {
    // Fallback improvável: fontes built-in
    fonts = {
      body: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
      italic: await doc.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    };
  }

  const headerReserved = bare ? 0 : 72;
  const footerReserved = bare ? 0 : 60;
  const usableHeight =
    PAGE_PT.height - PAGE_PT.marginTop - PAGE_PT.marginBottom - headerReserved - footerReserved;
  const topY = PAGE_PT.height - PAGE_PT.marginTop - headerReserved;

  const lines = layoutBlocks(blocks, contentWidth, title, fonts);
  const pages = paginate(lines, usableHeight);
  const totalPages = pages.length;

  for (let i = 0; i < pages.length; i++) {
    const page = doc.addPage([PAGE_PT.width, PAGE_PT.height]);
    if (!bare) {
      drawHeaderFooter(page, branding, headerLabel, i + 1, totalPages, fonts);
    }
    let cursorY = topY;
    for (const line of pages[i]) {
      cursorY -= line.sizePt * SPACING.lineHeight;
      drawLine(page, line, cursorY, contentX, contentWidth, COLORS.ink, fonts);
      cursorY -= line.spacingAfter;
    }
  }

  doc.setTitle(title);
  const bytes = await doc.save({ useObjectStreams: true });
  return bytes;
}

/** @deprecated compat — chamadores devem migrar para `await renderPdf(...)`. */
export function renderPdfSync(): never {
  throw new Error("renderPdf agora é assíncrono — use `await renderPdf(...)`.");
}

// Silencia lint por import não usado no fallback
void StandardFonts;
