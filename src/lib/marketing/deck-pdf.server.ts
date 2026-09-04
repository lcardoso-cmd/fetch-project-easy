/**
 * Apresentação comercial do JurisMind em PDF widescreen (16:9).
 *
 * O conteúdo vem exclusivamente de `PITCH` (src/lib/marketing/pitch-content.ts),
 * o mesmo módulo consumido pela homepage — atualizar a homepage atualiza o deck.
 *
 * Renderizador: pdf-lib puro (workerd-safe), fontes Carlito embutidas.
 */

import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { CARLITO_BYTES } from "@/lib/documents/fonts/carlito";
import { PITCH } from "./pitch-content";

// ---------------------------------------------------------------------------
// Geometria e paleta
// ---------------------------------------------------------------------------

/** 16:9 — 960 × 540 pt (33,87 × 19,05 cm). */
export const SLIDE = { width: 960, height: 540 } as const;
const MARGIN = 56;
const CONTENT_W = SLIDE.width - MARGIN * 2;

const NAVY = rgb(0, 0, 0x38 / 255);
const NAVY_SOFT = rgb(0.07, 0.08, 0.26);
const CYAN = rgb(0, 1, 1);
const WHITE = rgb(1, 1, 1);
const INK = rgb(0.09, 0.1, 0.15);
const INK_SOFT = rgb(0.36, 0.39, 0.45);
const PAPER = rgb(0.98, 0.985, 0.995);
const CARD = rgb(1, 1, 1);
const CARD_LINE = rgb(0.85, 0.88, 0.92);
const NEGATIVE = rgb(0.62, 0.16, 0.16);

interface Fonts {
  body: PDFFont;
  bold: PDFFont;
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

interface TextOpts {
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  color?: ReturnType<typeof rgb>;
  maxWidth: number;
  lineHeight?: number;
  maxLines?: number;
}

/** Desenha texto com quebra por largura real. Retorna o y final (baseline da última linha). */
function drawText(page: PDFPage, text: string, o: TextOpts): number {
  const lh = o.lineHeight ?? o.size * 1.32;
  let lines = wrapText(text, o.font, o.size, o.maxWidth);
  if (o.maxLines && lines.length > o.maxLines) lines = lines.slice(0, o.maxLines);
  let y = o.y;
  for (const line of lines) {
    page.drawText(line, { x: o.x, y, size: o.size, font: o.font, color: o.color ?? INK });
    y -= lh;
  }
  return y + lh;
}

function textHeight(text: string, font: PDFFont, size: number, maxWidth: number, lh?: number) {
  return wrapText(text, font, size, maxWidth).length * (lh ?? size * 1.32);
}

// ---------------------------------------------------------------------------
// Chrome dos slides
// ---------------------------------------------------------------------------

/** Marca simbólica do JurisMind: contorno de cérebro estilizado em linhas. */
function drawMark(page: PDFPage, cx: number, cy: number, size: number, color = CYAN) {
  const r = size / 2;
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: color, borderWidth: size * 0.07 });
  page.drawLine({
    start: { x: cx, y: cy - r * 0.72 },
    end: { x: cx, y: cy + r * 0.72 },
    thickness: size * 0.06,
    color,
  });
  page.drawLine({
    start: { x: cx - r * 0.55, y: cy + r * 0.28 },
    end: { x: cx + r * 0.55, y: cy + r * 0.28 },
    thickness: size * 0.055,
    color,
  });
  page.drawLine({
    start: { x: cx - r * 0.55, y: cy - r * 0.28 },
    end: { x: cx + r * 0.55, y: cy - r * 0.28 },
    thickness: size * 0.055,
    color,
  });
}

interface SlideCtx {
  page: PDFPage;
  /** y do topo disponível para conteúdo. */
  top: number;
}

function addSlide(
  doc: PDFDocument,
  f: Fonts,
  opts: { kicker?: string; title: string; subtitle?: string; index: number; total: number },
): SlideCtx {
  const page = doc.addPage([SLIDE.width, SLIDE.height]);
  page.drawRectangle({ x: 0, y: 0, width: SLIDE.width, height: SLIDE.height, color: PAPER });
  // Faixa superior navy
  page.drawRectangle({ x: 0, y: SLIDE.height - 8, width: SLIDE.width, height: 8, color: NAVY });
  page.drawRectangle({ x: 0, y: SLIDE.height - 8, width: 168, height: 8, color: CYAN });

  let y = SLIDE.height - 52;

  if (opts.kicker) {
    page.drawText(opts.kicker.toUpperCase(), {
      x: MARGIN,
      y,
      size: 10.5,
      font: f.bold,
      color: NAVY_SOFT,
    });
    y -= 22;
  }

  const titleSize = opts.title.length > 74 ? 25 : 29;
  y = drawText(page, opts.title, {
    x: MARGIN,
    y: y - titleSize * 0.75,
    size: titleSize,
    font: f.bold,
    color: NAVY,
    maxWidth: CONTENT_W - 40,
    lineHeight: titleSize * 1.2,
  });
  y -= 16;

  page.drawRectangle({ x: MARGIN, y, width: 54, height: 3.5, color: CYAN });
  y -= 22;

  if (opts.subtitle) {
    y = drawText(page, opts.subtitle, {
      x: MARGIN,
      y: y - 12,
      size: 13,
      font: f.body,
      color: INK_SOFT,
      maxWidth: CONTENT_W - 120,
      lineHeight: 19,
    });
    y -= 26;
  }

  // Rodapé
  drawFooter(page, f, opts.index, opts.total);
  return { page, top: y };
}

function drawFooter(page: PDFPage, f: Fonts, index: number, total: number) {
  const y = 24;
  page.drawLine({
    start: { x: MARGIN, y: y + 18 },
    end: { x: SLIDE.width - MARGIN, y: y + 18 },
    thickness: 0.7,
    color: CARD_LINE,
  });
  drawMark(page, MARGIN + 7, y + 5, 14, NAVY);
  page.drawText(`${PITCH.brand.name} · ${PITCH.brand.company}`, {
    x: MARGIN + 22,
    y: y + 1,
    size: 9,
    font: f.bold,
    color: NAVY_SOFT,
  });
  const label = `${index} / ${total}`;
  page.drawText(label, {
    x: SLIDE.width - MARGIN - f.bold.widthOfTextAtSize(label, 9),
    y: y + 1,
    size: 9,
    font: f.bold,
    color: INK_SOFT,
  });
}

// ---------------------------------------------------------------------------
// Blocos reutilizáveis
// ---------------------------------------------------------------------------

interface CardItem {
  label?: string;
  title: string;
  body?: string;
}

function drawCardGrid(
  page: PDFPage,
  f: Fonts,
  items: CardItem[],
  o: { top: number; columns: number; gap?: number; bottom?: number },
) {
  const gap = o.gap ?? 16;
  const cols = o.columns;
  const rows = Math.ceil(items.length / cols);
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const available = o.top - (o.bottom ?? 62);
  const padX = 16;

  // Altura pelo conteúdo mais alto (evita cartões esticados com vazio enorme).
  const innerW = cardW - padX * 2;
  let contentH = 0;
  for (const item of items) {
    let h = 26 + textHeight(item.title, f.bold, 14, innerW, 18);
    if (item.label) h += 18;
    if (item.body) h += 8 + textHeight(item.body, f.body, 11.5, innerW, 16);
    contentH = Math.max(contentH, h + 18);
  }
  const maxH = (available - gap * (rows - 1)) / rows;
  const cardH = Math.min(Math.max(contentH, 92), maxH);
  const gridH = cardH * rows + gap * (rows - 1);
  // Centraliza verticalmente a grade na área livre.
  const gridTop = o.top - Math.max(0, (available - gridH) / 2);

  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (cardW + gap);
    const yTop = gridTop - row * (cardH + gap);
    page.drawRectangle({
      x,
      y: yTop - cardH,
      width: cardW,
      height: cardH,
      color: CARD,
      borderColor: CARD_LINE,
      borderWidth: 0.8,
    });
    page.drawRectangle({ x, y: yTop - cardH, width: 3.5, height: cardH, color: CYAN });

    let y = yTop - 26;
    if (item.label) {
      page.drawText(item.label, {
        x: x + padX,
        y,
        size: 10,
        font: f.bold,
        color: INK_SOFT,
      });
      y -= 18;
    }
    y = drawText(page, item.title, {
      x: x + padX,
      y,
      size: 14,
      font: f.bold,
      color: NAVY,
      maxWidth: cardW - padX * 2,
      lineHeight: 18,
    });
    if (item.body) {
      y -= 22;
      const maxLines = Math.max(1, Math.floor((y - (yTop - cardH) - 12) / 16));
      drawText(page, item.body, {
        x: x + padX,
        y,
        size: 11.5,
        font: f.body,
        color: INK_SOFT,
        maxWidth: cardW - padX * 2,
        lineHeight: 16,
        maxLines,
      });
    }
  });
}

function drawBulletList(
  page: PDFPage,
  f: Fonts,
  items: readonly string[],
  o: {
    x: number;
    y: number;
    width: number;
    size?: number;
    positive?: boolean;
    color?: ReturnType<typeof rgb>;
  },
) {
  const size = o.size ?? 12;
  let y = o.y;
  for (const item of items) {
    const markColor = o.positive === false ? NEGATIVE : CYAN;
    page.drawCircle({ x: o.x + 4, y: y + size * 0.3, size: 3.6, color: markColor });
    const end = drawText(page, item, {
      x: o.x + 18,
      y,
      size,
      font: f.body,
      color: o.color ?? INK,
      maxWidth: o.width - 18,
      lineHeight: size * 1.4,
    });
    y = end - size * 1.9;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------

function coverSlide(doc: PDFDocument, f: Fonts, total: number) {
  const page = doc.addPage([SLIDE.width, SLIDE.height]);
  page.drawRectangle({ x: 0, y: 0, width: SLIDE.width, height: SLIDE.height, color: NAVY });
  // Detalhes geométricos discretos
  page.drawCircle({ x: 860, y: 470, size: 150, color: NAVY_SOFT });
  page.drawCircle({ x: 900, y: 90, size: 110, color: NAVY_SOFT });
  page.drawRectangle({ x: 0, y: 0, width: SLIDE.width, height: 6, color: CYAN });

  drawMark(page, MARGIN + 17, SLIDE.height - 74, 34, CYAN);
  page.drawText(PITCH.brand.name, {
    x: MARGIN + 46,
    y: SLIDE.height - 82,
    size: 20,
    font: f.bold,
    color: WHITE,
  });

  let y = SLIDE.height - 170;
  y = drawText(page, PITCH.hero.eyebrow.toUpperCase(), {
    x: MARGIN,
    y,
    size: 11,
    font: f.bold,
    color: CYAN,
    maxWidth: CONTENT_W,
  });

  y -= 46;
  y = drawText(page, PITCH.hero.title, {
    x: MARGIN,
    y,
    size: 38,
    font: f.bold,
    color: WHITE,
    maxWidth: 700,
    lineHeight: 46,
  });

  y -= 40;
  y = drawText(page, PITCH.hero.subtitle, {
    x: MARGIN,
    y,
    size: 13.5,
    font: f.body,
    color: rgb(0.85, 0.88, 0.95),
    maxWidth: 660,
    lineHeight: 20,
  });

  y -= 40;
  page.drawRectangle({ x: MARGIN, y: y - 8, width: 4, height: 24, color: CYAN });
  page.drawText(PITCH.hero.highlight, {
    x: MARGIN + 16,
    y,
    size: 13,
    font: f.bold,
    color: CYAN,
  });

  page.drawText(`${PITCH.brand.company} · ${PITCH.brand.site}`, {
    x: MARGIN,
    y: 30,
    size: 10,
    font: f.body,
    color: rgb(0.78, 0.82, 0.9),
  });
  const label = `1 / ${total}`;
  page.drawText(label, {
    x: SLIDE.width - MARGIN - f.bold.widthOfTextAtSize(label, 10),
    y: 30,
    size: 10,
    font: f.bold,
    color: rgb(0.78, 0.82, 0.9),
  });
}

function differentiationSlide(doc: PDFDocument, f: Fonts, index: number, total: number) {
  const d = PITCH.differentiation;
  const { page, top } = addSlide(doc, f, {
    kicker: "Posicionamento",
    title: d.title,
    subtitle: d.subtitle,
    index,
    total,
  });

  const gap = 20;
  const colW = (CONTENT_W - gap) / 2;
  const boxTop = top - 4;
  const boxH = boxTop - 70;

  const columns = [
    { title: d.genericTitle, items: d.generic, positive: false },
    { title: d.jurismindTitle, items: d.jurismind, positive: true },
  ];

  columns.forEach((col, i) => {
    const x = MARGIN + i * (colW + gap);
    page.drawRectangle({
      x,
      y: boxTop - boxH,
      width: colW,
      height: boxH,
      color: CARD,
      borderColor: col.positive ? CYAN : CARD_LINE,
      borderWidth: col.positive ? 1.4 : 0.8,
    });
    page.drawText(col.title, {
      x: x + 18,
      y: boxTop - 30,
      size: 15,
      font: f.bold,
      color: col.positive ? NAVY : INK,
    });
    drawBulletList(page, f, col.items, {
      x: x + 18,
      y: boxTop - 62,
      width: colW - 36,
      size: 11.5,
      positive: col.positive,
      color: col.positive ? INK : INK_SOFT,
    });
  });
}

function ragSlide(doc: PDFDocument, f: Fonts, index: number, total: number) {
  const i = PITCH.intelligence;
  const { page, top } = addSlide(doc, f, {
    kicker: "Tecnologia",
    title: i.ragTitle,
    index,
    total,
  });

  let y = top - 6;
  y = drawText(page, i.ragBody, {
    x: MARGIN,
    y,
    size: 14,
    font: f.body,
    color: INK,
    maxWidth: CONTENT_W - 60,
    lineHeight: 22,
  });

  y -= 44;
  const noteH = textHeight(i.ragNote, f.bold, 14, CONTENT_W - 100, 21) + 36;
  page.drawRectangle({
    x: MARGIN,
    y: y - noteH + 24,
    width: CONTENT_W,
    height: noteH,
    color: CARD,
    borderColor: CYAN,
    borderWidth: 1.4,
  });
  drawText(page, i.ragNote, {
    x: MARGIN + 22,
    y,
    size: 14,
    font: f.bold,
    color: NAVY,
    maxWidth: CONTENT_W - 100,
    lineHeight: 21,
  });

  y = y - noteH - 6;
  drawCardGrid(
    page,
    f,
    i.glossary.map((g) => ({ title: g.t, body: g.d })),
    { top: y, columns: 3 },
  );
}

function jurisprudenceSlide(doc: PDFDocument, f: Fonts, index: number, total: number) {
  const j = PITCH.jurisprudence;
  const { page, top } = addSlide(doc, f, {
    kicker: j.badge,
    title: j.title,
    index,
    total,
  });

  const gap = 22;
  const colW = (CONTENT_W - gap) / 2;

  let y = drawText(page, j.subtitle, {
    x: MARGIN,
    y: top - 6,
    size: 12,
    font: f.body,
    color: INK_SOFT,
    maxWidth: colW,
    lineHeight: 18,
  });
  y -= 30;
  drawBulletList(page, f, j.bullets, { x: MARGIN, y, width: colW, size: 11.5 });

  // Coluna direita — exemplo
  const x = MARGIN + colW + gap;
  const boxTop = top - 2;
  const boxH = boxTop - 70;
  page.drawRectangle({
    x,
    y: boxTop - boxH,
    width: colW,
    height: boxH,
    color: CARD,
    borderColor: CARD_LINE,
    borderWidth: 0.8,
  });
  page.drawText(j.exampleLabel.toUpperCase(), {
    x: x + 16,
    y: boxTop - 26,
    size: 9.5,
    font: f.bold,
    color: INK_SOFT,
  });

  let ey = boxTop - 50;
  for (const ex of j.examples) {
    const h = 62;
    page.drawRectangle({
      x: x + 16,
      y: ey - h + 18,
      width: colW - 32,
      height: h,
      color: PAPER,
      borderColor: CARD_LINE,
      borderWidth: 0.7,
    });
    page.drawText(`[${ex.ref}] ${ex.court}`, {
      x: x + 28,
      y: ey,
      size: 12,
      font: f.bold,
      color: NAVY,
    });
    page.drawText(`· ${ex.panel} · ${ex.date}`, {
      x: x + 28 + f.bold.widthOfTextAtSize(`[${ex.ref}] ${ex.court}`, 12) + 6,
      y: ey,
      size: 10.5,
      font: f.body,
      color: INK_SOFT,
    });
    drawText(page, ex.title, {
      x: x + 28,
      y: ey - 18,
      size: 11,
      font: f.body,
      color: INK,
      maxWidth: colW - 56,
      lineHeight: 15,
      maxLines: 2,
    });
    ey -= h + 12;
  }

  drawText(page, j.disclaimer, {
    x: x + 16,
    y: boxTop - boxH + 40,
    size: 9.5,
    font: f.body,
    color: INK_SOFT,
    maxWidth: colW - 32,
    lineHeight: 13,
  });
}

function governanceSlide(doc: PDFDocument, f: Fonts, index: number, total: number) {
  const g = PITCH.governance;
  const { page, top } = addSlide(doc, f, {
    kicker: "Governança",
    title: g.title,
    subtitle: g.subtitle,
    index,
    total,
  });

  const gap = 16;
  const cardW = (CONTENT_W - gap * 3) / 4;
  const cardH = 96;
  const yTop = top - Math.max(0, (top - 62 - cardH) / 2);
  g.items.forEach((item, i) => {
    const x = MARGIN + i * (cardW + gap);
    page.drawRectangle({
      x,
      y: yTop - cardH,
      width: cardW,
      height: cardH,
      color: CARD,
      borderColor: CARD_LINE,
      borderWidth: 0.8,
    });
    page.drawRectangle({ x, y: yTop - cardH, width: cardW, height: 3.5, color: CYAN });
    drawText(page, item.t, {
      x: x + 16,
      y: yTop - 34,
      size: 13,
      font: f.bold,
      color: NAVY,
      maxWidth: cardW - 32,
      lineHeight: 18,
    });
  });
}

function ctaSlide(doc: PDFDocument, f: Fonts, index: number, total: number) {
  const page = doc.addPage([SLIDE.width, SLIDE.height]);
  page.drawRectangle({ x: 0, y: 0, width: SLIDE.width, height: SLIDE.height, color: NAVY });
  page.drawCircle({ x: 90, y: 60, size: 130, color: NAVY_SOFT });
  page.drawRectangle({ x: 0, y: 0, width: SLIDE.width, height: 6, color: CYAN });

  drawMark(page, SLIDE.width / 2, SLIDE.height - 96, 36, CYAN);

  const c = PITCH.cta;
  let y = SLIDE.height - 190;
  const titleLines = wrapText(c.title, f.bold, 32, 700);
  for (const line of titleLines) {
    const w = f.bold.widthOfTextAtSize(line, 32);
    page.drawText(line, { x: (SLIDE.width - w) / 2, y, size: 32, font: f.bold, color: WHITE });
    y -= 42;
  }

  y -= 18;
  for (const line of wrapText(c.subtitle, f.body, 14, 640)) {
    const w = f.body.widthOfTextAtSize(line, 14);
    page.drawText(line, {
      x: (SLIDE.width - w) / 2,
      y,
      size: 14,
      font: f.body,
      color: rgb(0.86, 0.89, 0.95),
    });
    y -= 22;
  }

  y -= 26;
  const btnLabel = c.button;
  const btnW = f.bold.widthOfTextAtSize(btnLabel, 14) + 56;
  page.drawRectangle({
    x: (SLIDE.width - btnW) / 2,
    y: y - 12,
    width: btnW,
    height: 42,
    color: CYAN,
  });
  page.drawText(btnLabel, {
    x: (SLIDE.width - f.bold.widthOfTextAtSize(btnLabel, 14)) / 2,
    y: y + 3,
    size: 14,
    font: f.bold,
    color: NAVY,
  });

  y -= 46;
  const note = `${c.note} · ${PITCH.brand.site}`;
  page.drawText(note, {
    x: (SLIDE.width - f.body.widthOfTextAtSize(note, 11.5)) / 2,
    y,
    size: 11.5,
    font: f.body,
    color: rgb(0.82, 0.86, 0.93),
  });

  const contact = PITCH.brand.contact;
  page.drawText(contact, {
    x: (SLIDE.width - f.bold.widthOfTextAtSize(contact, 11.5)) / 2,
    y: y - 22,
    size: 11.5,
    font: f.bold,
    color: CYAN,
  });

  const label = `${index} / ${total}`;
  page.drawText(label, {
    x: SLIDE.width - MARGIN - f.bold.widthOfTextAtSize(label, 10),
    y: 30,
    size: 10,
    font: f.bold,
    color: rgb(0.78, 0.82, 0.9),
  });
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/** Número total de slides do deck (capa + conteúdo + encerramento). */
export const DECK_SLIDE_COUNT = 10;

export async function buildPitchDeckPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f: Fonts = {
    body: await doc.embedFont(CARLITO_BYTES.regular(), { subset: true }),
    bold: await doc.embedFont(CARLITO_BYTES.bold(), { subset: true }),
  };

  doc.setTitle(`${PITCH.brand.name} — Apresentação comercial`);
  doc.setAuthor(PITCH.brand.company);
  doc.setSubject(PITCH.brand.tagline);
  doc.setCreator(PITCH.brand.name);

  const total = DECK_SLIDE_COUNT;

  // 1 · Capa
  coverSlide(doc, f, total);

  // 2 · Posicionamento / diferenciação
  differentiationSlide(doc, f, 2, total);

  // 3 · Fluxo do caso
  {
    const { page, top } = addSlide(doc, f, {
      kicker: "Fluxo do caso",
      title: PITCH.flow.title,
      subtitle: PITCH.flow.subtitle,
      index: 3,
      total,
    });
    const items = PITCH.flow.items.map((i) => ({ label: i.n, title: i.t, body: i.d }));
    drawCardGrid(page, f, items.slice(0, 3), { top, columns: 3, bottom: top - 130 });
    drawCardGrid(page, f, items.slice(3), { top: top - 146, columns: 3, bottom: top - 276 });
  }

  // 4 · Entregáveis
  {
    const { page, top } = addSlide(doc, f, {
      kicker: "Entregas",
      title: PITCH.deliverables.title,
      subtitle: PITCH.deliverables.subtitle,
      index: 4,
      total,
    });
    drawCardGrid(
      page,
      f,
      PITCH.deliverables.items.map((i) => ({ title: i.t, body: i.d })),
      { top, columns: 3 },
    );
  }

  // 5 · Inteligência
  {
    const { page, top } = addSlide(doc, f, {
      kicker: "Inteligência",
      title: PITCH.intelligence.title,
      subtitle: PITCH.intelligence.subtitle,
      index: 5,
      total,
    });
    drawCardGrid(
      page,
      f,
      PITCH.intelligence.items.map((i) => ({ title: i.t, body: i.d })),
      { top, columns: 2 },
    );
  }

  // 6 · RAG
  ragSlide(doc, f, 6, total);

  // 7 · Jurisprudência
  jurisprudenceSlide(doc, f, 7, total);

  // 8 · Plataforma
  {
    const { page, top } = addSlide(doc, f, {
      kicker: "Plataforma",
      title: PITCH.platform.title,
      index: 8,
      total,
    });
    drawCardGrid(
      page,
      f,
      PITCH.platform.items.map((i) => ({ title: i.t, body: i.d })),
      { top: top - 10, columns: 3 },
    );
  }

  // 9 · Governança
  governanceSlide(doc, f, 9, total);

  // 10 · Encerramento
  ctaSlide(doc, f, 10, total);

  return await doc.save();
}
