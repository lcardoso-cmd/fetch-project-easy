/**
 * Template DOCX compartilhado — usado por todos os exports .docx do app
 * (proposta, petição, resumo do caso). Centraliza estilos, cabeçalho,
 * rodapé, margens e conversores de HTML/texto para blocos docx-js.
 *
 * IMPORTANTE: este módulo é seguro para importar de handlers server
 * (Cloudflare Worker + nodejs_compat). Não usa fs/sharp/etc.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

export const TEMPLATE_FONTS = {
  body: "Calibri",
  heading: "Calibri",
} as const;

export const TEMPLATE_COLORS = {
  ink: "0F172A",
  inkSoft: "334155",
  muted: "64748B",
  accent: "1E3A8A",
  quote: "475569",
  border: "CCCCCC",
  headerBand: "0F172A",
  headerText: "FFFFFF",
} as const;

// US Letter, 1" margins (DXA: 1440 = 1 in)
const PAGE = {
  width: 12240,
  height: 15840,
  margin: 1440,
} as const;
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2; // 9360

// ---------------------------------------------------------------------------
// Meta / options
// ---------------------------------------------------------------------------

export interface DocMeta {
  /** Texto curto no canto direito do cabeçalho (ex.: "Petição", "Proposta"). */
  header?: string;
  /** Autor no metadata do arquivo. Default: "B2B | JurisMind AI". */
  creator?: string;
  /** Descrição no metadata do arquivo. */
  description?: string;
  /** Se true, oculta cabeçalho e rodapé. */
  bare?: boolean;
  /** Orientação. Default portrait. */
  orientation?: "portrait" | "landscape";
}

export interface CreateStyledDocumentInput {
  title: string;
  subtitle?: string;
  /** Blocos já convertidos (via htmlToDocxChildren/plainTextToDocxChildren). */
  children: (Paragraph | Table)[];
  meta?: DocMeta;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function buildStyles() {
  return {
    default: {
      document: {
        run: { font: TEMPLATE_FONTS.body, size: 22, color: TEMPLATE_COLORS.ink },
        paragraph: { spacing: { line: 324, after: 120 } }, // ~1.35 line-height
      },
    },
    paragraphStyles: [
      {
        id: "Title",
        name: "Title",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: TEMPLATE_FONTS.heading, size: 48, bold: true, color: TEMPLATE_COLORS.ink },
        paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.LEFT },
      },
      {
        id: "Subtitle",
        name: "Subtitle",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: TEMPLATE_FONTS.body, size: 26, italics: true, color: TEMPLATE_COLORS.quote },
        paragraph: { spacing: { after: 240 } },
      },
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: TEMPLATE_FONTS.heading, size: 32, bold: true, color: TEMPLATE_COLORS.ink },
        paragraph: {
          spacing: { before: 320, after: 160 },
          outlineLevel: 0,
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: TEMPLATE_COLORS.ink, space: 4 },
          },
        },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: TEMPLATE_FONTS.heading, size: 26, bold: true, color: TEMPLATE_COLORS.accent },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
      {
        id: "Heading3",
        name: "Heading 3",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: {
          font: TEMPLATE_FONTS.heading,
          size: 22,
          bold: true,
          allCaps: true,
          color: TEMPLATE_COLORS.inkSoft,
        },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
      },
      {
        id: "Quote",
        name: "Quote",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { italics: true, color: TEMPLATE_COLORS.quote },
        paragraph: {
          indent: { left: 360 },
          spacing: { before: 120, after: 120 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 16, color: TEMPLATE_COLORS.ink, space: 8 },
          },
        },
      },
    ],
  } as const;
}

function buildNumbering() {
  return {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "\u2022",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: "\u25E6",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      },
    ],
  } as const;
}

// ---------------------------------------------------------------------------
// Header / footer
// ---------------------------------------------------------------------------

function buildHeader(label?: string) {
  return new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: TEMPLATE_COLORS.border, space: 4 },
        },
        children: [
          new TextRun({
            text: "B2B | JurisMind AI",
            bold: true,
            size: 18,
            color: TEMPLATE_COLORS.ink,
          }),
          new TextRun({
            text: label ? `\t${label}` : "",
            size: 18,
            color: TEMPLATE_COLORS.muted,
          }),
        ],
      }),
    ],
  });
}

function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: TEMPLATE_COLORS.border, space: 4 },
        },
        children: [
          new TextRun({
            text: "Documento gerado por B2B | JurisMind AI",
            size: 16,
            color: TEMPLATE_COLORS.muted,
          }),
          new TextRun({ text: "\tPágina ", size: 16, color: TEMPLATE_COLORS.muted }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: TEMPLATE_COLORS.muted }),
          new TextRun({ text: " de ", size: 16, color: TEMPLATE_COLORS.muted }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 16,
            color: TEMPLATE_COLORS.muted,
          }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Document builder
// ---------------------------------------------------------------------------

export function createStyledDocument(input: CreateStyledDocumentInput): Document {
  const { title, subtitle, children, meta = {} } = input;
  const creator = meta.creator ?? "B2B | JurisMind AI";
  const landscape = meta.orientation === "landscape";

  const headChildren: Paragraph[] = [
    new Paragraph({ style: "Title", children: [new TextRun(title)] }),
  ];
  if (subtitle) {
    headChildren.push(new Paragraph({ style: "Subtitle", children: [new TextRun(subtitle)] }));
  }

  const section: ISectionOptions = {
    properties: {
      page: {
        size: {
          width: PAGE.width,
          height: PAGE.height,
          orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
        },
        margin: {
          top: PAGE.margin,
          right: PAGE.margin,
          bottom: PAGE.margin,
          left: PAGE.margin,
        },
      },
    },
    headers: meta.bare ? undefined : { default: buildHeader(meta.header) },
    footers: meta.bare ? undefined : { default: buildFooter() },
    children: [...headChildren, ...children],
  };

  return new Document({
    creator,
    title,
    description: meta.description,
    styles: buildStyles(),
    numbering: buildNumbering(),
    sections: [section],
  });
}

// ---------------------------------------------------------------------------
// Tabelas com estilo
// ---------------------------------------------------------------------------

export interface StyledTableOptions {
  /** Se a primeira linha deve ser tratada como header. Default true. */
  header?: boolean;
  /** Larguras relativas das colunas (soma qualquer). Se omitido, colunas iguais. */
  columnRatios?: number[];
  /** Largura total em DXA. Default: content width (US Letter, 1" margens). */
  totalWidth?: number;
}

export function styledTable(rows: string[][], options: StyledTableOptions = {}): Table {
  const header = options.header ?? true;
  const totalWidth = options.totalWidth ?? CONTENT_WIDTH;
  const colCount = rows[0]?.length ?? 0;
  if (!colCount) {
    return new Table({
      width: { size: totalWidth, type: WidthType.DXA },
      columnWidths: [totalWidth],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: totalWidth, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun("")] })],
            }),
          ],
        }),
      ],
    });
  }
  const ratios = options.columnRatios?.length === colCount
    ? options.columnRatios
    : Array(colCount).fill(1);
  const ratioSum = ratios.reduce((a, b) => a + b, 0);
  const columnWidths = ratios.map((r) => Math.floor((r / ratioSum) * totalWidth));
  // ajusta para bater exatamente com totalWidth
  const drift = totalWidth - columnWidths.reduce((a, b) => a + b, 0);
  columnWidths[columnWidths.length - 1] += drift;

  const border = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: TEMPLATE_COLORS.border,
  } as const;
  const cellBorders = { top: border, bottom: border, left: border, right: border };

  const tableRows = rows.map((row, rowIdx) => {
    const isHeader = header && rowIdx === 0;
    return new TableRow({
      tableHeader: isHeader,
      children: row.map((text, colIdx) => {
        return new TableCell({
          borders: cellBorders,
          width: { size: columnWidths[colIdx], type: WidthType.DXA },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          shading: isHeader
            ? { fill: TEMPLATE_COLORS.headerBand, type: ShadingType.CLEAR, color: "auto" }
            : undefined,
          children: [
            new Paragraph({
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text,
                  bold: isHeader,
                  color: isHeader ? TEMPLATE_COLORS.headerText : TEMPLATE_COLORS.ink,
                }),
              ],
            }),
          ],
        });
      }),
    });
  });

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: tableRows,
  });
}

// ---------------------------------------------------------------------------
// Conversores
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

type InlineRun = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
};

/**
 * Extrai runs inline preservando <strong>/<b>, <em>/<i>, <u>.
 * Ignora demais tags (mantém texto).
 */
function parseInline(html: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const stack: { bold?: boolean; italics?: boolean; underline?: boolean }[] = [{}];
  const tagRegex = /<\/?([a-zA-Z0-9]+)[^>]*>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(html)) !== null) {
    const [full, tag, text] = m;
    if (text) {
      const decoded = decodeEntities(text);
      if (decoded) runs.push({ ...stack[stack.length - 1], text: decoded });
      continue;
    }
    const isClose = full.startsWith("</");
    const t = (tag ?? "").toLowerCase();
    const current = stack[stack.length - 1];
    if (t === "strong" || t === "b") {
      if (isClose) stack.pop();
      else stack.push({ ...current, bold: true });
    } else if (t === "em" || t === "i") {
      if (isClose) stack.pop();
      else stack.push({ ...current, italics: true });
    } else if (t === "u") {
      if (isClose) stack.pop();
      else stack.push({ ...current, underline: true });
    }
    // demais tags: ignora (texto interno já cai no ramo `text`)
  }
  return runs.filter((r) => r.text.length > 0);
}

function inlineToTextRuns(html: string): TextRun[] {
  const runs = parseInline(html);
  if (runs.length === 0) return [new TextRun("")];
  return runs.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italics,
        underline: r.underline ? {} : undefined,
      }),
  );
}

type BlockAlign = "left" | "center" | "right";
function alignMap(a?: BlockAlign): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  if (a === "left") return AlignmentType.LEFT;
  return undefined;
}

/**
 * Converte HTML do editor (h1/h2/h3, p, ul/ol, li, br, strong/em/u,
 * alinhamento inline via style="text-align:...") em Paragraph[] usando
 * os estilos nomeados do template.
 */
export function htmlToDocxChildren(html: string): Paragraph[] {
  const normalized = String(html || "")
    .replace(/\r/g, "")
    .replace(/<br\s*\/?>/gi, "\n");
  const out: Paragraph[] = [];
  const blockRegex = /<(h1|h2|h3|p|li|div|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;

  let m: RegExpExecArray | null;
  let lastIndex = 0;
  let hasMatch = false;
  // Rastreia se o LI está dentro de <ol> ou <ul>
  let inOrdered = false;
  const olOpen = /<ol[\s>]/gi;
  const olClose = /<\/ol>/gi;
  const olMarks: { idx: number; open: boolean }[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = olOpen.exec(normalized)) !== null) olMarks.push({ idx: mm.index, open: true });
  while ((mm = olClose.exec(normalized)) !== null) olMarks.push({ idx: mm.index, open: false });
  olMarks.sort((a, b) => a.idx - b.idx);
  function isOrderedAt(idx: number): boolean {
    let depth = 0;
    for (const mark of olMarks) {
      if (mark.idx > idx) break;
      depth += mark.open ? 1 : -1;
    }
    return depth > 0;
  }

  while ((m = blockRegex.exec(normalized)) !== null) {
    hasMatch = true;
    if (m.index > lastIndex) {
      const between = normalized.slice(lastIndex, m.index);
      const stripped = between.replace(/<[^>]+>/g, "").trim();
      if (stripped) {
        out.push(new Paragraph({ children: inlineToTextRuns(between) }));
      }
    }
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const inner = m[3];
    const alignMatch = attrs.match(/text-align:\s*(left|center|right)/i);
    const align = alignMap(alignMatch?.[1] as BlockAlign | undefined);
    inOrdered = tag === "li" ? isOrderedAt(m.index) : inOrdered;

    if (tag === "h1") {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: align, children: inlineToTextRuns(inner) }));
    } else if (tag === "h2") {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, alignment: align, children: inlineToTextRuns(inner) }));
    } else if (tag === "h3") {
      out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, alignment: align, children: inlineToTextRuns(inner) }));
    } else if (tag === "li") {
      out.push(
        new Paragraph({
          numbering: { reference: inOrdered ? "numbers" : "bullets", level: 0 },
          alignment: align,
          children: inlineToTextRuns(inner),
        }),
      );
    } else if (tag === "blockquote") {
      out.push(new Paragraph({ style: "Quote", alignment: align, children: inlineToTextRuns(inner) }));
    } else {
      // p, div
      const stripped = inner.replace(/<[^>]+>/g, "").trim();
      if (!stripped) {
        out.push(new Paragraph({ children: [new TextRun("")] }));
      } else {
        out.push(new Paragraph({ alignment: align, children: inlineToTextRuns(inner) }));
      }
    }
    lastIndex = blockRegex.lastIndex;
  }

  if (!hasMatch) {
    // texto puro (respeitando quebras de linha)
    const lines = normalized.split(/\n+/);
    for (const line of lines) {
      const stripped = line.replace(/<[^>]+>/g, "").trim();
      if (stripped) out.push(new Paragraph({ children: inlineToTextRuns(line) }));
    }
  } else if (lastIndex < normalized.length) {
    const tail = normalized.slice(lastIndex);
    const stripped = tail.replace(/<[^>]+>/g, "").trim();
    if (stripped) out.push(new Paragraph({ children: inlineToTextRuns(tail) }));
  }

  if (out.length === 0) out.push(new Paragraph({ children: [new TextRun("")] }));
  return out;
}

/**
 * Converte texto puro segmentado por "TÍTULO:" em Paragraph[] com estilos.
 * Cabeçalhos totalmente em maiúsculas viram Heading2; blocos separados por
 * linha em branco viram parágrafos.
 */
export function plainTextToDocxChildren(text: string): Paragraph[] {
  const out: Paragraph[] = [];
  const lines = String(text || "").split(/\r?\n/);
  let buffer: string[] = [];

  const flushParagraph = () => {
    const joined = buffer.join(" ").trim();
    buffer = [];
    if (joined) out.push(new Paragraph({ children: [new TextRun(joined)] }));
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const m = line.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ,\-]{3,}?):\s*(.*)$/);
    if (m && m[1] === m[1].toUpperCase()) {
      flushParagraph();
      out.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(m[1].trim())] }),
      );
      if (m[2]) buffer.push(m[2]);
    } else {
      buffer.push(line);
    }
  }
  flushParagraph();

  if (out.length === 0) out.push(new Paragraph({ children: [new TextRun("")] }));
  return out;
}
