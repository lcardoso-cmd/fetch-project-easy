/**
 * AST comum para documentos gerados pelo JurisMind. Todos os renderers
 * (DOCX e PDF) consomem esta representação, garantindo que o mesmo
 * conteúdo (HTML do editor, markdown do chat, texto puro) gere layout
 * equivalente em qualquer formato.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Quebra de linha dura dentro do parágrafo. */
  lineBreak?: boolean;
};

export type BlockAlign = "left" | "center" | "right" | "justify";

export type DocBlock =
  | {
      kind: "heading";
      level: 1 | 2 | 3;
      align?: BlockAlign;
      runs: InlineRun[];
    }
  | {
      kind: "paragraph";
      align?: BlockAlign;
      runs: InlineRun[];
    }
  | {
      kind: "list-item";
      ordered: boolean;
      align?: BlockAlign;
      runs: InlineRun[];
    }
  | {
      kind: "quote";
      align?: BlockAlign;
      runs: InlineRun[];
    }
  | {
      kind: "empty";
    };

// ---------------------------------------------------------------------------
// HTML entities
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

// ---------------------------------------------------------------------------
// Inline parser (compartilhado com DOCX)
// ---------------------------------------------------------------------------

type InlineStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

function styleFlagsFromAttrs(attrs: string): InlineStyle {
  const style = /style\s*=\s*"([^"]*)"|style\s*=\s*'([^']*)'/i.exec(attrs);
  const s = ((style?.[1] ?? style?.[2]) ?? "").toLowerCase();
  const out: InlineStyle = {};
  if (/font-weight\s*:\s*(bold|[6-9]00)/.test(s)) out.bold = true;
  if (/font-style\s*:\s*italic/.test(s)) out.italic = true;
  if (/text-decoration[^;]*underline/.test(s)) out.underline = true;
  if (/text-decoration[^;]*line-through/.test(s)) out.strike = true;
  return out;
}

export function parseInlineHtml(html: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const stack: InlineStyle[] = [{}];
  const tagRegex = /<\/?([a-zA-Z0-9]+)([^>]*)\/?>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRegex.exec(html)) !== null) {
    const [full, tag, attrs, text] = m;
    if (text) {
      const decoded = decodeEntities(text);
      if (decoded) runs.push({ ...stack[stack.length - 1], text: decoded });
      continue;
    }
    const isClose = full.startsWith("</");
    const t = (tag ?? "").toLowerCase();
    const current = stack[stack.length - 1];
    if (t === "br") {
      runs.push({ text: "", lineBreak: true });
      continue;
    }
    if (t === "strong" || t === "b") {
      if (isClose) stack.pop();
      else stack.push({ ...current, bold: true });
    } else if (t === "em" || t === "i") {
      if (isClose) stack.pop();
      else stack.push({ ...current, italic: true });
    } else if (t === "u") {
      if (isClose) stack.pop();
      else stack.push({ ...current, underline: true });
    } else if (t === "s" || t === "strike" || t === "del") {
      if (isClose) stack.pop();
      else stack.push({ ...current, strike: true });
    } else if (t === "span" || t === "font") {
      if (isClose) stack.pop();
      else stack.push({ ...current, ...styleFlagsFromAttrs(attrs ?? "") });
    }
  }
  return runs.filter((r) => r.text.length > 0 || r.lineBreak);
}

// ---------------------------------------------------------------------------
// Bloco parser — HTML
// ---------------------------------------------------------------------------

function alignFrom(attrs: string): BlockAlign | undefined {
  const m = /text-align\s*:\s*(left|center|right|justify)/i.exec(attrs);
  return (m?.[1] as BlockAlign | undefined) ?? undefined;
}

export function htmlToBlocks(html: string): DocBlock[] {
  const normalized = String(html || "").replace(/\r/g, "");
  const out: DocBlock[] = [];
  const blockRegex = /<(h1|h2|h3|p|li|div|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;

  // Rastreia se um <li> está dentro de <ol>
  const olOpen = /<ol[\s>]/gi;
  const olClose = /<\/ol>/gi;
  const olMarks: { idx: number; open: boolean }[] = [];
  let mm: RegExpExecArray | null;
  while ((mm = olOpen.exec(normalized)) !== null)
    olMarks.push({ idx: mm.index, open: true });
  while ((mm = olClose.exec(normalized)) !== null)
    olMarks.push({ idx: mm.index, open: false });
  olMarks.sort((a, b) => a.idx - b.idx);
  const isOrderedAt = (idx: number) => {
    let depth = 0;
    for (const mark of olMarks) {
      if (mark.idx > idx) break;
      depth += mark.open ? 1 : -1;
    }
    return depth > 0;
  };

  let m: RegExpExecArray | null;
  let lastIndex = 0;
  let hasMatch = false;
  while ((m = blockRegex.exec(normalized)) !== null) {
    hasMatch = true;
    if (m.index > lastIndex) {
      const between = normalized.slice(lastIndex, m.index);
      const stripped = between.replace(/<[^>]+>/g, "").trim();
      if (stripped) {
        out.push({ kind: "paragraph", runs: parseInlineHtml(between) });
      }
    }
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const inner = m[3];
    const align = alignFrom(attrs);
    const runs = parseInlineHtml(inner);
    if (tag === "h1") out.push({ kind: "heading", level: 1, align, runs });
    else if (tag === "h2") out.push({ kind: "heading", level: 2, align, runs });
    else if (tag === "h3") out.push({ kind: "heading", level: 3, align, runs });
    else if (tag === "li") {
      out.push({
        kind: "list-item",
        ordered: isOrderedAt(m.index),
        align,
        runs,
      });
    } else if (tag === "blockquote") {
      out.push({ kind: "quote", align, runs });
    } else {
      const stripped = inner.replace(/<[^>]+>/g, "").trim();
      if (!stripped) out.push({ kind: "empty" });
      else out.push({ kind: "paragraph", align, runs });
    }
    lastIndex = blockRegex.lastIndex;
  }

  if (!hasMatch) {
    const lines = normalized.split(/\n+/);
    for (const line of lines) {
      const stripped = line.replace(/<[^>]+>/g, "").trim();
      if (stripped) out.push({ kind: "paragraph", runs: parseInlineHtml(line) });
    }
  } else if (lastIndex < normalized.length) {
    const tail = normalized.slice(lastIndex);
    const stripped = tail.replace(/<[^>]+>/g, "").trim();
    if (stripped) out.push({ kind: "paragraph", runs: parseInlineHtml(tail) });
  }

  if (out.length === 0) out.push({ kind: "empty" });
  return out;
}

// ---------------------------------------------------------------------------
// Bloco parser — Markdown (versão simples)
// ---------------------------------------------------------------------------

function markdownInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const regex = /(\*\*(.+?)\*\*)|(__(.+?)__)|(\*(.+?)\*)|(_(.+?)_)|(`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      runs.push({ text: text.slice(last, m.index) });
    }
    if (m[2] !== undefined || m[4] !== undefined) {
      runs.push({ text: (m[2] ?? m[4])!, bold: true });
    } else if (m[6] !== undefined || m[8] !== undefined) {
      runs.push({ text: (m[6] ?? m[8])!, italic: true });
    } else if (m[10] !== undefined) {
      runs.push({ text: m[10] });
    }
    last = regex.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  if (runs.length === 0) runs.push({ text });
  return runs;
}

export function markdownToBlocks(md: string): DocBlock[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const blocks: DocBlock[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ kind: "empty" });
      continue;
    }
    let h: RegExpMatchArray | null;
    if ((h = line.match(/^(#{1,3})\s+(.*)$/))) {
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({ kind: "heading", level, runs: markdownInline(h[2]) });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      blocks.push({
        kind: "list-item",
        ordered: false,
        runs: markdownInline(line.replace(/^[-*]\s+/, "")),
      });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      blocks.push({
        kind: "list-item",
        ordered: true,
        runs: markdownInline(line.replace(/^\d+\.\s+/, "")),
      });
      continue;
    }
    if (/^>\s+/.test(line)) {
      blocks.push({ kind: "quote", runs: markdownInline(line.replace(/^>\s+/, "")) });
      continue;
    }
    blocks.push({ kind: "paragraph", runs: markdownInline(line) });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Detecção automática
// ---------------------------------------------------------------------------

export function contentToBlocks(input: string): DocBlock[] {
  if (/<\w+/.test(input)) return htmlToBlocks(input);
  if (/^#{1,6}\s|^\*\s|^-\s|\*\*/m.test(input)) return markdownToBlocks(input);
  // texto puro com quebras UPPERCASE:
  return input
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map<DocBlock>((text) => {
      const m = text.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ,\-]{3,}?):\s*([\s\S]*)$/);
      if (m && m[1] === m[1].toUpperCase()) {
        return {
          kind: "heading",
          level: 2,
          runs: [{ text: m[1].trim() }],
        };
      }
      return { kind: "paragraph", runs: [{ text }] };
    });
}
