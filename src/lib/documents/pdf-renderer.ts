/**
 * Renderer PDF unificado do JurisMind. Consome DocBlock[] + branding e
 * produz um PDF workerd-safe (sem dependências nativas) com:
 *  - US Letter, margens 1" (idêntico ao DOCX)
 *  - Header: nome do escritório à esquerda + label à direita, com borda inferior
 *  - Footer: firma + "Página X de Y", com borda superior
 *  - Wrap por largura real via métricas Helvetica (AFM embutidas)
 *  - Suporte inline a bold/italic/underline/strike
 *  - Alinhamento left/center/right/justify por parágrafo
 *  - Bullets e listas numeradas
 *
 * Este módulo é o único caminho de geração de PDF do app. Qualquer nova
 * superfície que precise exportar PDF deve chamar `renderPdf(...)`.
 */

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
import { charWidthPt, textWidthPt, type PdfFontFace } from "./pdf-fonts";

// ---------------------------------------------------------------------------
// Tipos internos
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

type StyledRun = InlineRun & { face: PdfFontFace; sizePt: number };

interface LayoutLine {
  /** Runs já quebrados para caber na linha; posição x preservada por run. */
  segments: { text: string; face: PdfFontFace; sizePt: number; xOffset: number; underline?: boolean; strike?: boolean }[];
  width: number;
  align: "left" | "center" | "right" | "justify";
  sizePt: number;
  indent: number;
  /** Espaço extra abaixo desta linha (em pontos). */
  spacingAfter: number;
  /** Prefixo (ex.: "• ", "1. ") — desenhado antes do primeiro segmento. */
  prefix?: string;
  prefixWidth?: number;
  /** Se true, é a última linha do parágrafo (não distribui espaços em justify). */
  lastOfParagraph: boolean;
  /** Cor override. Default: ink. */
  color?: string;
  /** Se true, mantém peso bold no prefixo/todos os runs. */
  bold?: boolean;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Escape para strings PDF (parênteses e barras). */
function pdfEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Converte string unicode arbitrária em WinAnsi (latin1 aproximado).
 * Caracteres fora do intervalo viram "?" para não quebrar o PDF.
 * As fontes Type1 built-in usam WinAnsiEncoding.
 */
const WIN_ANSI_MAP: Record<string, string> = {
  "\u2013": "-", "\u2014": "-",
  "\u2018": "'", "\u2019": "'", "\u201A": ",",
  "\u201C": '"', "\u201D": '"', "\u201E": '"',
  "\u2022": "\x95", // bullet
  "\u2026": "...",
  "\u00A0": " ",
  "\u25E6": "o",
  "\u2192": "->",
};

function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code < 128) {
      out += ch;
      continue;
    }
    const mapped = WIN_ANSI_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    if (code <= 255) {
      out += ch; // WinAnsi cobre 128..255 (com pequenas divergências)
      continue;
    }
    out += "?";
  }
  return out;
}

function pickFace(bold?: boolean, italic?: boolean): PdfFontFace {
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

// ---------------------------------------------------------------------------
// Layout — quebra runs em linhas físicas
// ---------------------------------------------------------------------------

function layoutRuns(
  runs: StyledRun[],
  maxWidth: number,
): { lines: { segments: LayoutLine["segments"]; width: number }[] } {
  const lines: { segments: LayoutLine["segments"]; width: number }[] = [];
  let current: LayoutLine["segments"] = [];
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
    // Tokeniza mantendo espaços como tokens
    const tokens = run.text.match(/\s+|\S+/g) ?? [];
    for (const tok of tokens) {
      const ansi = toWinAnsi(tok);
      const w = textWidthPt(ansi, run.face, run.sizePt);
      const isSpace = /^\s+$/.test(tok);
      if (currentWidth + w > maxWidth && current.length > 0 && !isSpace) {
        // quebra
        // remove espaço trailing da linha atual
        while (current.length > 0) {
          const last = current[current.length - 1];
          if (/^\s+$/.test(last.text)) {
            currentWidth -= textWidthPt(last.text, last.face, last.sizePt);
            current.pop();
          } else break;
        }
        pushLine();
        if (isSpace) continue;
      }
      // token único maior que a linha inteira: quebra por caractere
      if (w > maxWidth && !isSpace) {
        let buf = "";
        let bufW = 0;
        for (const ch of ansi) {
          const cw = charWidthPt(ch, run.face, run.sizePt);
          if (bufW + cw > maxWidth && buf) {
            current.push({
              text: buf,
              face: run.face,
              sizePt: run.sizePt,
              xOffset: currentWidth,
              underline: run.underline,
              strike: run.strike,
            });
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
          current.push({
            text: buf,
            face: run.face,
            sizePt: run.sizePt,
            xOffset: currentWidth,
            underline: run.underline,
            strike: run.strike,
          });
          currentWidth += bufW;
        }
        continue;
      }
      current.push({
        text: ansi,
        face: run.face,
        sizePt: run.sizePt,
        xOffset: currentWidth,
        underline: run.underline,
        strike: run.strike,
      });
      currentWidth += w;
    }
  }
  if (current.length > 0 || lines.length === 0) pushLine();
  return { lines };
}

// ---------------------------------------------------------------------------
// Bloco → Layout Lines
// ---------------------------------------------------------------------------

function styleRunsForBlock(
  block: Extract<DocBlock, { runs: InlineRun[] }>,
): { runs: StyledRun[]; sizePt: number; bold: boolean; color: string } {
  let sizePt: number = FONT_SIZES_PT.body;
  let baseBold = false;
  let color: string = COLORS.ink;
  if (block.kind === "heading") {
    if (block.level === 1) {
      sizePt = FONT_SIZES_PT.h1;
      baseBold = true;
    } else if (block.level === 2) {
      sizePt = FONT_SIZES_PT.h2;
      baseBold = true;
      color = COLORS.accent;
    } else {
      sizePt = FONT_SIZES_PT.h3;
      baseBold = true;
      color = COLORS.inkSoft;
    }
  } else if (block.kind === "quote") {
    color = COLORS.quote;
  }
  const runs: StyledRun[] = block.runs.map((r) => ({
    ...r,
    face: pickFace(baseBold || r.bold, r.italic),
    sizePt,
  }));
  return { runs, sizePt, bold: baseBold, color };
}

function layoutBlocks(
  blocks: DocBlock[],
  contentWidth: number,
  title: string,
): LayoutLine[] {
  const lines: LayoutLine[] = [];

  // Título (uma vez, centralizado)
  const titleRuns: StyledRun[] = [
    { text: title, face: "Helvetica-Bold", sizePt: FONT_SIZES_PT.title },
  ];
  const titleLayout = layoutRuns(titleRuns, contentWidth);
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

  // Contagem para numeração
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
        prefix = `${orderedIndex}. `;
      } else {
        prefix = "\x95  "; // WinAnsi bullet
        orderedIndex = 0;
      }
      prefixWidth = textWidthPt(prefix, "Helvetica", FONT_SIZES_PT.body);
    } else {
      orderedIndex = 0;
    }

    const { runs, sizePt, bold, color } = styleRunsForBlock(block);
    const usable = contentWidth - indent - (prefixWidth ?? 0);
    const laid = layoutRuns(runs, usable);

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

interface Page {
  lines: LayoutLine[];
}

function paginate(lines: LayoutLine[], usableHeight: number): Page[] {
  const pages: Page[] = [];
  let current: LayoutLine[] = [];
  let y = 0;
  for (const line of lines) {
    const advance = line.sizePt * SPACING.lineHeight + line.spacingAfter;
    if (y + advance > usableHeight && current.length > 0) {
      pages.push({ lines: current });
      current = [];
      y = 0;
    }
    current.push(line);
    y += advance;
  }
  if (current.length > 0) pages.push({ lines: current });
  if (pages.length === 0) pages.push({ lines: [] });
  return pages;
}

// ---------------------------------------------------------------------------
// PDF writer — objetos e streams
// ---------------------------------------------------------------------------

/**
 * Codifica string em latin1/WinAnsi byte-a-byte. Necessário porque as
 * fontes Type1 built-in com WinAnsiEncoding esperam bytes latin1 nos
 * literais de string PDF (`(...)`). UTF-8 quebraria acentos e bullet.
 * Chars > 255 devem ter sido substituídos por `toWinAnsi` antes.
 */
function encodeLatin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

class PdfBuilder {
  private objects: string[] = [];

  addObject(body: string): number {
    this.objects.push(body);
    return this.objects.length; // 1-indexed
  }

  setObject(id: number, body: string) {
    this.objects[id - 1] = body;
  }

  serialize(catalogId: number): Uint8Array {
    const header = "%PDF-1.4\n%\xC3\xA9\xC3\xA9\xC3\xA9\n";
    const parts: Uint8Array[] = [encodeLatin1(header)];
    let bytePos = parts[0].length;
    const offsets: number[] = [];
    for (let i = 0; i < this.objects.length; i++) {
      offsets.push(bytePos);
      const entry = `${i + 1} 0 obj\n${this.objects[i]}\nendobj\n`;
      const bytes = encodeLatin1(entry);
      parts.push(bytes);
      bytePos += bytes.length;
    }
    const xrefPos = bytePos;
    let xref = `xref\n0 ${this.objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
    }
    xref += `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    parts.push(encodeLatin1(xref));
    const total = parts.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// Desenho de linhas em content stream
// ---------------------------------------------------------------------------

function fontId(face: PdfFontFace): string {
  switch (face) {
    case "Helvetica":
      return "F1";
    case "Helvetica-Bold":
      return "F2";
    case "Helvetica-Oblique":
      return "F3";
    case "Helvetica-BoldOblique":
      return "F4";
  }
}

function drawLine(
  line: LayoutLine,
  cursorY: number,
  contentX: number,
  contentWidth: number,
  color: string,
): string {
  const [r, g, b] = hexToRgb01(line.color ?? color);
  let stream = "";
  stream += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n`;

  // Calcula largura total (com prefixo)
  const totalWidth = (line.prefixWidth ?? 0) + line.width;
  let x0 = contentX + line.indent;
  if (line.align === "center") {
    x0 = contentX + (contentWidth - totalWidth) / 2;
  } else if (line.align === "right") {
    x0 = contentX + contentWidth - totalWidth;
  }

  // Justify: distribui espaço extra em spaces internos (exceto última linha)
  let spaceExtra = 0;
  if (line.align === "justify" && !line.lastOfParagraph) {
    // Conta espaços em segmentos (não no prefixo)
    let spaces = 0;
    for (const seg of line.segments) {
      for (const ch of seg.text) if (ch === " ") spaces += 1;
    }
    if (spaces > 0) {
      const remaining = contentWidth - line.indent - totalWidth;
      if (remaining > 0) spaceExtra = remaining / spaces;
    }
  }

  // Prefixo
  if (line.prefix) {
    stream += `BT\n/${fontId(line.bold ? "Helvetica-Bold" : "Helvetica")} ${line.sizePt} Tf\n`;
    stream += `1 0 0 1 ${x0.toFixed(2)} ${cursorY.toFixed(2)} Tm\n`;
    stream += `(${pdfEscape(line.prefix)}) Tj\nET\n`;
    x0 += line.prefixWidth ?? 0;
  }

  // Segmentos
  let currentX = x0;
  for (const seg of line.segments) {
    // Divide o texto em pedaços entre espaços para aplicar spaceExtra
    if (spaceExtra > 0 && seg.text.includes(" ")) {
      let chunk = "";
      for (const ch of seg.text) {
        if (ch === " ") {
          if (chunk) {
            const cw = textWidthPt(chunk, seg.face, seg.sizePt);
            stream += `BT\n/${fontId(seg.face)} ${seg.sizePt} Tf\n1 0 0 1 ${currentX.toFixed(2)} ${cursorY.toFixed(2)} Tm\n(${pdfEscape(chunk)}) Tj\nET\n`;
            currentX += cw;
            chunk = "";
          }
          currentX += charWidthPt(" ", seg.face, seg.sizePt) + spaceExtra;
        } else {
          chunk += ch;
        }
      }
      if (chunk) {
        stream += `BT\n/${fontId(seg.face)} ${seg.sizePt} Tf\n1 0 0 1 ${currentX.toFixed(2)} ${cursorY.toFixed(2)} Tm\n(${pdfEscape(chunk)}) Tj\nET\n`;
        currentX += textWidthPt(chunk, seg.face, seg.sizePt);
      }
    } else {
      const w = textWidthPt(seg.text, seg.face, seg.sizePt);
      stream += `BT\n/${fontId(seg.face)} ${seg.sizePt} Tf\n1 0 0 1 ${currentX.toFixed(2)} ${cursorY.toFixed(2)} Tm\n(${pdfEscape(seg.text)}) Tj\nET\n`;
      // Underline / strike (linha via retângulo)
      if (seg.underline || seg.strike) {
        const yLine = seg.underline
          ? cursorY - seg.sizePt * 0.15
          : cursorY + seg.sizePt * 0.28;
        stream += `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG\n`;
        stream += `${(seg.sizePt * 0.05).toFixed(2)} w\n`;
        stream += `${currentX.toFixed(2)} ${yLine.toFixed(2)} m ${(currentX + w).toFixed(2)} ${yLine.toFixed(2)} l S\n`;
      }
      currentX += w;
    }
  }
  return stream;
}

function drawHeaderFooter(
  branding: DocBranding | null | undefined,
  headerLabel: string | undefined,
  pageIndex: number,
  totalPages: number,
): string {
  const firmName = branding?.firmName?.trim() || DEFAULT_BRAND_NAME;
  const [mr, mg, mb] = hexToRgb01(COLORS.muted);
  const [ir, ig, ib] = hexToRgb01(COLORS.ink);
  const [br, bg, bb] = hexToRgb01(COLORS.border);
  let stream = "";

  // ------- Header -------
  const headerY = PAGE_PT.height - 48; // 48 pt do topo
  // firm à esquerda (ink, bold)
  stream += `${ir.toFixed(3)} ${ig.toFixed(3)} ${ib.toFixed(3)} rg\n`;
  stream += `BT\n/F2 10 Tf\n1 0 0 1 ${PAGE_PT.marginLeft.toFixed(2)} ${headerY.toFixed(2)} Tm\n(${pdfEscape(toWinAnsi(firmName))}) Tj\nET\n`;
  // label à direita (muted)
  if (headerLabel) {
    const ansi = toWinAnsi(headerLabel);
    const w = textWidthPt(ansi, "Helvetica", 10);
    const x = PAGE_PT.width - PAGE_PT.marginRight - w;
    stream += `${mr.toFixed(3)} ${mg.toFixed(3)} ${mb.toFixed(3)} rg\n`;
    stream += `BT\n/F1 10 Tf\n1 0 0 1 ${x.toFixed(2)} ${headerY.toFixed(2)} Tm\n(${pdfEscape(ansi)}) Tj\nET\n`;
  }
  // borda inferior
  const headerBorderY = headerY - 6;
  stream += `${br.toFixed(3)} ${bg.toFixed(3)} ${bb.toFixed(3)} RG\n0.5 w\n`;
  stream += `${PAGE_PT.marginLeft} ${headerBorderY.toFixed(2)} m ${(PAGE_PT.width - PAGE_PT.marginRight).toFixed(2)} ${headerBorderY.toFixed(2)} l S\n`;

  // ------- Footer -------
  const footerY = 40;
  const footerBorderY = footerY + 14;
  stream += `${br.toFixed(3)} ${bg.toFixed(3)} ${bb.toFixed(3)} RG\n0.5 w\n`;
  stream += `${PAGE_PT.marginLeft} ${footerBorderY.toFixed(2)} m ${(PAGE_PT.width - PAGE_PT.marginRight).toFixed(2)} ${footerBorderY.toFixed(2)} l S\n`;
  const footerLeft = [firmName, branding?.taxId, branding?.website]
    .filter(Boolean)
    .join(" · ");
  stream += `${mr.toFixed(3)} ${mg.toFixed(3)} ${mb.toFixed(3)} rg\n`;
  stream += `BT\n/F1 9 Tf\n1 0 0 1 ${PAGE_PT.marginLeft.toFixed(2)} ${footerY.toFixed(2)} Tm\n(${pdfEscape(toWinAnsi(footerLeft))}) Tj\nET\n`;
  const pageText = `Página ${pageIndex} de ${totalPages}`;
  const pw = textWidthPt(pageText, "Helvetica", 9);
  const px = PAGE_PT.width - PAGE_PT.marginRight - pw;
  stream += `BT\n/F1 9 Tf\n1 0 0 1 ${px.toFixed(2)} ${footerY.toFixed(2)} Tm\n(${pdfEscape(pageText)}) Tj\nET\n`;

  return stream;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function renderPdf(input: RenderPdfInput): Uint8Array {
  const { title, blocks, branding, headerLabel, bare } = input;
  const contentWidth = PAGE_PT.width - PAGE_PT.marginLeft - PAGE_PT.marginRight;
  const contentX = PAGE_PT.marginLeft;

  // Area vertical útil para o corpo (descontando header/footer)
  const headerReserved = bare ? 0 : 72; // 1"
  const footerReserved = bare ? 0 : 60;
  const usableHeight =
    PAGE_PT.height - PAGE_PT.marginTop - PAGE_PT.marginBottom - headerReserved - footerReserved;
  const topY = PAGE_PT.height - PAGE_PT.marginTop - headerReserved;

  const lines = layoutBlocks(blocks, contentWidth, title);
  const pages = paginate(lines, usableHeight);

  const builder = new PdfBuilder();
  const catalogId = builder.addObject(""); // preencher depois
  const pagesId = builder.addObject(""); // preencher depois

  // Fontes
  const fontF1 = builder.addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const fontF2 = builder.addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  const fontF3 = builder.addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>",
  );
  const fontF4 = builder.addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>",
  );

  const resources = `<< /Font << /F1 ${fontF1} 0 R /F2 ${fontF2} 0 R /F3 ${fontF3} 0 R /F4 ${fontF4} 0 R >> >>`;

  const pageIds: number[] = [];
  const totalPages = pages.length;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let stream = "";
    if (!bare) {
      stream += drawHeaderFooter(branding, headerLabel, i + 1, totalPages);
    }
    let cursorY = topY;
    for (const line of page.lines) {
      cursorY -= line.sizePt * SPACING.lineHeight;
      stream += drawLine(line, cursorY, contentX, contentWidth, COLORS.ink);
      cursorY -= line.spacingAfter;
    }
    const bytes = encodeLatin1(stream);
    const contentId = builder.addObject(
      `<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = builder.addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_PT.width} ${PAGE_PT.height}] /Resources ${resources} /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  builder.setObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  builder.setObject(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  );

  return builder.serialize(catalogId);
}
