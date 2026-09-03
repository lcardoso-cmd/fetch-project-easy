// Chunking estrutural versionado do RAG.
// Módulo puro (sem I/O) para poder ser testado e comparado em benchmark.
//
// Diferença em relação ao `chunkText` legado (`ai.server.ts`):
//  - não colapsa o documento inteiro em uma linha só;
//  - respeita fronteiras de bloco (página, seção, planilha, parágrafo, sentença);
//  - nunca corta no meio de uma palavra;
//  - carrega metadados de procedência (página, seção, planilha, linhas).

export const CHUNKING_VERSION_LEGACY = "flat-v0";
export const CHUNKING_VERSION = "structural-v1";

export type BlockKind = "text" | "vision" | "table";

/** Unidade extraída por um parser, antes do agrupamento em chunks. */
export interface DocBlock {
  content: string;
  kind: BlockKind;
  page?: number | null;
  sectionTitle?: string | null;
  sheetName?: string | null;
  rowStart?: number | null;
  rowEnd?: number | null;
  /** true quando o bloco é um título/cabeçalho estrutural. */
  isHeading?: boolean;
}

export interface ChunkMeta {
  page_start: number | null;
  page_end: number | null;
  section_title: string | null;
  sheet_name: string | null;
  row_start: number | null;
  row_end: number | null;
}

export interface StructuredChunk extends ChunkMeta {
  content: string;
  source_kind: BlockKind;
  chunking_version: string;
  token_count: number;
  content_hash: string;
}

export interface ChunkProfile {
  name: string;
  targetChars: number;
  overlapChars: number;
  minChars: number;
}

/** Perfis comparáveis em benchmark. `structural-md` é o padrão. */
export const CHUNK_PROFILES: Record<string, ChunkProfile> = {
  "structural-sm": { name: "structural-sm", targetChars: 1100, overlapChars: 150, minChars: 120 },
  "structural-md": { name: "structural-md", targetChars: 1800, overlapChars: 220, minChars: 140 },
  "structural-lg": { name: "structural-lg", targetChars: 2800, overlapChars: 300, minChars: 160 },
};

export const DEFAULT_CHUNK_PROFILE = CHUNK_PROFILES["structural-md"]!;

/** Hash FNV-1a 64 bits em JS puro (isomórfico, sem `node:crypto`). */
export function contentHash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = (h1 * 0x01000193) >>> 0;
    h2 = (h2 ^ ((c << 3) | (c >>> 5))) >>> 0;
    h2 = (h2 * 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** Estimativa conservadora de tokens (pt-BR ~4 chars/token). */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

function normalizeInline(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

/** Quebra um texto em pedaços <= max sem cortar palavras, preferindo parágrafo > sentença. */
export function splitRespectingBoundaries(text: string, max: number): string[] {
  const clean = normalizeInline(text);
  if (!clean) return [];
  if (clean.length <= max) return [clean];

  const out: string[] = [];
  const paragraphs = clean.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  let buffer = "";
  const flush = () => {
    const t = buffer.trim();
    if (t) out.push(t);
    buffer = "";
  };

  for (const para of paragraphs) {
    if (para.length > max) {
      flush();
      for (const piece of splitLongParagraph(para, max)) out.push(piece);
      continue;
    }
    if (!buffer) buffer = para;
    else if (buffer.length + 2 + para.length <= max) buffer += "\n\n" + para;
    else {
      flush();
      buffer = para;
    }
  }
  flush();
  return out;
}

function splitLongParagraph(para: string, max: number): string[] {
  const sentences = para.match(/[^.!?;\n]+[.!?;]*\s*/g) ?? [para];
  const out: string[] = [];
  let buf = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > max) {
      if (buf) {
        out.push(buf.trim());
        buf = "";
      }
      for (const w of splitByWords(s, max)) out.push(w);
      continue;
    }
    if (!buf) buf = s;
    else if (buf.length + 1 + s.length <= max) buf += " " + s;
    else {
      out.push(buf.trim());
      buf = s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function splitByWords(s: string, max: number): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let buf = "";
  for (const w of words) {
    if (w.length > max) {
      // palavra patológica (hash, base64): corta por tamanho, é o único caso.
      if (buf) {
        out.push(buf.trim());
        buf = "";
      }
      for (let i = 0; i < w.length; i += max) out.push(w.slice(i, i + max));
      continue;
    }
    if (!buf) buf = w;
    else if (buf.length + 1 + w.length <= max) buf += " " + w;
    else {
      out.push(buf.trim());
      buf = w;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function sameGroup(a: DocBlock, b: DocBlock): boolean {
  return (
    a.kind === b.kind &&
    (a.sectionTitle ?? null) === (b.sectionTitle ?? null) &&
    (a.sheetName ?? null) === (b.sheetName ?? null)
  );
}

function tailOverlap(prev: string, overlap: number): string {
  if (overlap <= 0 || prev.length <= overlap) return "";
  const tail = prev.slice(-overlap);
  const cut = tail.search(/[\s]/);
  return (cut >= 0 ? tail.slice(cut + 1) : tail).trim();
}

/**
 * Agrupa blocos em chunks respeitando estrutura, aplicando sobreposição textual
 * apenas entre chunks do mesmo grupo (mesma seção/planilha/tipo).
 */
export function structuredChunk(
  blocks: DocBlock[],
  profile: ChunkProfile = DEFAULT_CHUNK_PROFILE,
): StructuredChunk[] {
  const usable = blocks.filter((b) => normalizeInline(b.content).length > 0);
  if (usable.length === 0) return [];

  const groups: DocBlock[][] = [];
  for (const b of usable) {
    const last = groups[groups.length - 1];
    if (last && sameGroup(last[0]!, b)) last.push(b);
    else groups.push([b]);
  }

  const chunks: StructuredChunk[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    type Pending = { text: string; meta: ChunkMeta };
    let pending: Pending | null = null;
    let prevContent = "";

    const emit = () => {
      if (!pending) return;
      const content = pending.text.trim();
      pending = null;
      if (!content) return;
      const hash = contentHash(content);
      if (seen.has(hash)) return;
      seen.add(hash);
      chunks.push({
        content,
        source_kind: group[0]!.kind,
        chunking_version: profile.name,
        token_count: estimateTokens(content),
        content_hash: hash,
        ...pendingMetaSnapshot,
      });
      prevContent = content;
    };

    // metadados do chunk em construção (capturados no momento do emit)
    let pendingMetaSnapshot: ChunkMeta = emptyMeta();

    const startPending = (text: string, block: DocBlock) => {
      const overlap = tailOverlap(prevContent, profile.overlapChars);
      pending = { text: overlap ? `${overlap}\n\n${text}` : text, meta: emptyMeta() };
      pendingMetaSnapshot = metaFromBlock(block);
    };

    for (const block of group) {
      const heading = block.isHeading ? normalizeInline(block.content) : null;
      const pieces = splitRespectingBoundaries(block.content, profile.targetChars);

      for (const piece of pieces) {
        const prefixed = heading && piece !== heading ? `${heading}\n${piece}` : piece;

        if (!pending) {
          startPending(prefixed, block);
          continue;
        }
        if (pending.text.length + 2 + prefixed.length <= profile.targetChars) {
          pending.text += "\n\n" + prefixed;
          pendingMetaSnapshot = mergeMeta(pendingMetaSnapshot, metaFromBlock(block));
          continue;
        }
        if (pending.text.trim().length < profile.minChars) {
          // chunk minúsculo: prefere juntar mesmo passando um pouco do alvo
          pending.text += "\n\n" + prefixed;
          pendingMetaSnapshot = mergeMeta(pendingMetaSnapshot, metaFromBlock(block));
          emit();
          continue;
        }
        emit();
        startPending(prefixed, block);
      }
    }
    emit();
  }

  return chunks;
}

function emptyMeta(): ChunkMeta {
  return {
    page_start: null,
    page_end: null,
    section_title: null,
    sheet_name: null,
    row_start: null,
    row_end: null,
  };
}

function metaFromBlock(b: DocBlock): ChunkMeta {
  return {
    page_start: b.page ?? null,
    page_end: b.page ?? null,
    section_title: b.sectionTitle ?? null,
    sheet_name: b.sheetName ?? null,
    row_start: b.rowStart ?? null,
    row_end: b.rowEnd ?? null,
  };
}

function mergeMeta(a: ChunkMeta, b: ChunkMeta): ChunkMeta {
  const min = (x: number | null, y: number | null) =>
    x == null ? y : y == null ? x : Math.min(x, y);
  const max = (x: number | null, y: number | null) =>
    x == null ? y : y == null ? x : Math.max(x, y);
  return {
    page_start: min(a.page_start, b.page_start),
    page_end: max(a.page_end, b.page_end),
    section_title: a.section_title ?? b.section_title,
    sheet_name: a.sheet_name ?? b.sheet_name,
    row_start: min(a.row_start, b.row_start),
    row_end: max(a.row_end, b.row_end),
  };
}

/** Rótulo curto de procedência usado em contexto e citações. */
export function locationLabel(meta: Partial<ChunkMeta>): string | null {
  const bits: string[] = [];
  if (meta.sheet_name) bits.push(`planilha ${meta.sheet_name}`);
  if (meta.row_start != null) {
    bits.push(
      meta.row_end != null && meta.row_end !== meta.row_start
        ? `linhas ${meta.row_start}-${meta.row_end}`
        : `linha ${meta.row_start}`,
    );
  }
  if (meta.page_start != null) {
    bits.push(
      meta.page_end != null && meta.page_end !== meta.page_start
        ? `p. ${meta.page_start}-${meta.page_end}`
        : `p. ${meta.page_start}`,
    );
  }
  if (meta.section_title) bits.push(meta.section_title);
  return bits.length ? bits.join(" · ") : null;
}
