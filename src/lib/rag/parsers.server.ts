// Parsers explícitos por formato. Server-only (usa unpdf/mammoth/xlsx e visão).
// Cada parser devolve blocos com procedência (página, seção, planilha, linhas)
// para que o chunking estrutural preserve a origem do texto.

import type { DocBlock } from "./chunking";

export const PARSER_VERSION = "parsers-v1";

export type SupportedFormat = "pdf" | "docx" | "spreadsheet" | "csv" | "text" | "image";

export interface ParseResult {
  blocks: DocBlock[];
  pageCount: number;
  format: SupportedFormat;
  parser_version: string;
  /** Páginas com texto insuficiente — candidatas a OCR. */
  ocrPages: number[];
  /** Texto plano concatenado (compatibilidade com `documents.extracted_text`). */
  plainText: string;
}

export class UnsupportedFormatError extends Error {
  constructor(public readonly detail: string) {
    super(detail);
    this.name = "UnsupportedFormatError";
  }
}

export function detectFormat(filename: string, fileType: string): SupportedFormat {
  const n = filename.toLowerCase();
  const t = (fileType || "").toLowerCase();
  if (n.endsWith(".pdf") || t === "application/pdf") return "pdf";
  if (n.endsWith(".docx") || t.includes("wordprocessingml")) return "docx";
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || t.includes("spreadsheetml") || t.includes("ms-excel"))
    return "spreadsheet";
  if (n.endsWith(".csv") || t === "text/csv") return "csv";
  if (n.endsWith(".txt") || n.endsWith(".md") || t.startsWith("text/")) return "text";
  if (/\.(png|jpe?g|webp)$/.test(n) || t.startsWith("image/")) return "image";
  throw new UnsupportedFormatError(
    `Formato não suportado para indexação: ${filename} (${fileType || "sem mime"}). Suportados: PDF, DOCX, XLSX/XLS, CSV, TXT/MD, PNG/JPG.`,
  );
}

const MIN_CHARS_PER_PAGE = 120;

/** PDF: extrai página a página (sem mergePages) e marca páginas fracas para OCR. */
async function parsePdf(bytes: Uint8Array): Promise<ParseResult> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const pageCount = pdf.numPages;
  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (Array.isArray(text) ? text : [String(text)]).map((p) => String(p ?? ""));

  const blocks: DocBlock[] = [];
  const ocrPages: number[] = [];
  pages.forEach((raw, i) => {
    const page = i + 1;
    const clean = raw.replace(/\r\n?/g, "\n").trim();
    if (clean.replace(/\s+/g, "").length < MIN_CHARS_PER_PAGE) ocrPages.push(page);
    if (!clean) return;
    for (const b of splitByHeadings(clean)) {
      blocks.push({ ...b, page, kind: "text" });
    }
  });

  return {
    blocks,
    pageCount,
    format: "pdf",
    parser_version: PARSER_VERSION,
    ocrPages,
    plainText: pages.join("\n\n"),
  };
}

/** DOCX: converte para HTML e preserva títulos, listas e tabelas. */
async function parseDocx(buffer: ArrayBuffer): Promise<ParseResult> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });

  const blocks: DocBlock[] = [];
  let section: string | null = null;
  const tagRe = /<(h[1-6]|p|li|table)[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const m of html.matchAll(tagRe)) {
    const tag = m[1]!.toLowerCase();
    const inner = stripTags(m[2] ?? "");
    if (!inner) continue;
    if (/^h[1-6]$/.test(tag)) {
      section = inner;
      blocks.push({ content: inner, kind: "text", sectionTitle: section, isHeading: true });
      continue;
    }
    if (tag === "table") {
      blocks.push({ content: htmlTableToText(m[0]!), kind: "table", sectionTitle: section });
      continue;
    }
    blocks.push({ content: tag === "li" ? `- ${inner}` : inner, kind: "text", sectionTitle: section });
  }

  if (blocks.length === 0) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    for (const b of splitByHeadings(value)) blocks.push({ ...b, kind: "text" });
  }

  return {
    blocks,
    pageCount: 0,
    format: "docx",
    parser_version: PARSER_VERSION,
    ocrPages: [],
    plainText: blocks.map((b) => b.content).join("\n\n"),
  };
}

/** XLSX/XLS: por planilha, com cabeçalho repetido e intervalo de linhas. */
async function parseSpreadsheet(bytes: Uint8Array): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(bytes, { type: "array" });
  const blocks: DocBlock[] = [];
  const ROWS_PER_BLOCK = 40;

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
    if (rows.length === 0) continue;
    const header = (rows[0] ?? []).map((c) => String(c ?? "").trim());
    const body = rows.slice(1);
    const headerLine = header.filter(Boolean).join(" | ");

    for (let i = 0; i < body.length; i += ROWS_PER_BLOCK) {
      const slice = body.slice(i, i + ROWS_PER_BLOCK);
      const lines = slice
        .map((r) => (r ?? []).map((c) => String(c ?? "").trim()).join(" | "))
        .filter((l) => l.replace(/\|/g, "").trim().length > 0);
      if (lines.length === 0) continue;
      blocks.push({
        content: [headerLine, ...lines].filter(Boolean).join("\n"),
        kind: "table",
        sheetName,
        sectionTitle: `Planilha ${sheetName}`,
        rowStart: i + 2,
        rowEnd: i + 1 + slice.length,
      });
    }
  }

  return {
    blocks,
    pageCount: 0,
    format: "spreadsheet",
    parser_version: PARSER_VERSION,
    ocrPages: [],
    plainText: blocks.map((b) => b.content).join("\n\n"),
  };
}

/** CSV: usa o mesmo caminho tabular, com detecção simples de separador. */
async function parseCsv(text: string): Promise<ParseResult> {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    return {
      blocks: [],
      pageCount: 0,
      format: "csv",
      parser_version: PARSER_VERSION,
      ocrPages: [],
      plainText: "",
    };
  }
  const sep = guessSeparator(lines[0]!);
  const header = lines[0]!.split(sep).map((c) => c.trim()).join(" | ");
  const body = lines.slice(1);
  const blocks: DocBlock[] = [];
  const ROWS = 40;
  for (let i = 0; i < body.length; i += ROWS) {
    const slice = body.slice(i, i + ROWS);
    blocks.push({
      content: [header, ...slice.map((l) => l.split(sep).map((c) => c.trim()).join(" | "))].join("\n"),
      kind: "table",
      rowStart: i + 2,
      rowEnd: i + 1 + slice.length,
    });
  }
  return {
    blocks,
    pageCount: 0,
    format: "csv",
    parser_version: PARSER_VERSION,
    ocrPages: [],
    plainText: text,
  };
}

function parseTextFile(text: string): ParseResult {
  const blocks = splitByHeadings(text).map((b) => ({ ...b, kind: "text" as const }));
  return {
    blocks,
    pageCount: 0,
    format: "text",
    parser_version: PARSER_VERSION,
    ocrPages: [],
    plainText: text,
  };
}

/**
 * Ponto único de extração. Para imagens, `blocks` vem vazio e `ocrPages=[1]`:
 * quem chama decide se roda a visão (que é uma chamada de modelo).
 */
export async function parseDocument(opts: {
  blob: Blob;
  filename: string;
  fileType: string;
}): Promise<ParseResult> {
  const format = detectFormat(opts.filename, opts.fileType);
  switch (format) {
    case "pdf":
      return parsePdf(new Uint8Array(await opts.blob.arrayBuffer()));
    case "docx":
      return parseDocx(await opts.blob.arrayBuffer());
    case "spreadsheet":
      return parseSpreadsheet(new Uint8Array(await opts.blob.arrayBuffer()));
    case "csv":
      return parseCsv(await opts.blob.text());
    case "text":
      return parseTextFile(await opts.blob.text());
    case "image":
      return {
        blocks: [],
        pageCount: 1,
        format: "image",
        parser_version: PARSER_VERSION,
        ocrPages: [1],
        plainText: "",
      };
  }
}

// ---------- utilidades ----------

function guessSeparator(line: string): string {
  const counts: Array<[string, number]> = [
    [";", (line.match(/;/g) ?? []).length],
    [",", (line.match(/,/g) ?? []).length],
    ["\t", (line.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ",";
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function htmlTableToText(tableHtml: string): string {
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  return rows
    .map((tr) =>
      (tr.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) ?? [])
        .map((cell) => stripTags(cell))
        .join(" | "),
    )
    .filter((l) => l.replace(/\|/g, "").trim().length > 0)
    .join("\n");
}

const HEADING_RE =
  /^(?:(?:CAPÍTULO|CAP[IÍ]TULO|SEÇÃO|SECAO|CLÁUSULA|CLAUSULA|ARTIGO|ART\.?|ANEXO|T[IÍ]TULO)\s+[\wÀ-ÿº°IVXLCDM.\-]+.*|[A-ZÀ-Ÿ0-9][A-ZÀ-Ÿ0-9 ,ºª°\-.()/]{4,80}|\d+(?:\.\d+)*\s+[^\n]{3,80})$/;

/** Divide texto plano em blocos por parágrafo, marcando títulos prováveis. */
export function splitByHeadings(text: string): DocBlock[] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}|\n(?=\s*(?:CLÁUSULA|CLAUSULA|Art\.|ARTIGO|CAPÍTULO|SEÇÃO)\b)/i);

  const out: DocBlock[] = [];
  let section: string | null = null;
  for (const raw of paragraphs) {
    const p = raw.trim();
    if (!p) continue;
    const firstLine = p.split("\n")[0]!.trim();
    const isHeading = p.length <= 120 && HEADING_RE.test(firstLine) && !/[.!?]$/.test(firstLine);
    if (isHeading) {
      section = firstLine;
      out.push({ content: firstLine, kind: "text", sectionTitle: section, isHeading: true });
      const rest = p.slice(firstLine.length).trim();
      if (rest) out.push({ content: rest, kind: "text", sectionTitle: section });
      continue;
    }
    out.push({ content: p, kind: "text", sectionTitle: section });
  }
  return out;
}
