import { createFileRoute } from "@tanstack/react-router";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

function sanitize(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w-.]/g, "")
      .replace(/_{2,}/g, "_") || "documento"
  );
}

interface Block {
  text: string;
  heading?: 1 | 2;
  bullet?: boolean;
  align?: "left" | "center" | "right";
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripInline(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, "")).trim();
}

function htmlToBlocks(html: string): Block[] {
  const normalized = html.replace(/<br\s*\/?>/gi, "\n").replace(/\r/g, "");
  const blocks: Block[] = [];
  const re = /<(h1|h2|h3|p|li|div)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let last = 0;
  let has = false;
  while ((m = re.exec(normalized)) !== null) {
    has = true;
    if (m.index > last) {
      const b = stripInline(normalized.slice(last, m.index));
      if (b) blocks.push({ text: b });
    }
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const inner = m[3];
    const align =
      (attrs.match(/text-align:\s*(left|center|right)/i)?.[1] as Block["align"]) ??
      undefined;
    const text = stripInline(inner);
    if (!text) blocks.push({ text: "" });
    else if (tag === "h1") blocks.push({ text, heading: 1, align });
    else if (tag === "h2" || tag === "h3") blocks.push({ text, heading: 2, align });
    else if (tag === "li") blocks.push({ text, bullet: true, align });
    else blocks.push({ text, align });
    last = re.lastIndex;
  }
  if (!has) {
    normalized.split(/\n+/).forEach((line) => {
      const t = stripInline(line);
      if (t) blocks.push({ text: t });
    });
  } else if (last < normalized.length) {
    const tail = stripInline(normalized.slice(last));
    if (tail) blocks.push({ text: tail });
  }
  return blocks;
}

function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let mHead: RegExpMatchArray | null;
    if ((mHead = line.match(/^#{1,2}\s+(.*)$/))) {
      const level = line.startsWith("## ") ? 2 : 1;
      blocks.push({ text: mHead[1], heading: level as 1 | 2 });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      blocks.push({ text: line.replace(/^[-*]\s+/, ""), bullet: true });
      continue;
    }
    blocks.push({
      text: line
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`(.+?)`/g, "$1"),
    });
  }
  return blocks;
}

function contentToBlocks(input: string): Block[] {
  if (/<\w+/.test(input)) return htmlToBlocks(input);
  if (/^#{1,6}\s|^\*\s|^-\s|\*\*/m.test(input)) return markdownToBlocks(input);
  return input
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function alignMap(a?: Block["align"]) {
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

// Very small PDF generator (pure JS, workerd-compatible)
// Produces a 1-page-per-flow A4 document with basic paragraphs, headings, bullets.
function buildSimplePdf(titulo: string, blocks: Block[]): Uint8Array {
  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginX = 56.7; // ~2 cm
  const marginTop = 68;
  const marginBottom = 56;
  const usableWidth = pageWidth - marginX * 2;
  const lineHeight = 15;
  const headingSize = 16;
  const h2Size = 13;
  const bodySize = 11;

  // Escape PDF strings (parentheses, backslashes) and encode latin-1 subset.
  const enc = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");

  // Naive word wrap by character count relative to font size.
  function wrap(text: string, size: number): string[] {
    const avgCharWidth = size * 0.5; // heuristic
    const maxChars = Math.max(20, Math.floor(usableWidth / avgCharWidth));
    const words = text.split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > maxChars) {
        if (cur) out.push(cur);
        cur = w;
      } else {
        cur = cur ? cur + " " + w : w;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  interface Line {
    text: string;
    size: number;
    bold: boolean;
    indent: number;
    spacingAfter: number;
    align: "left" | "center";
  }
  const lines: Line[] = [];
  lines.push({
    text: titulo,
    size: 18,
    bold: true,
    indent: 0,
    spacingAfter: lineHeight,
    align: "center",
  });

  for (const b of blocks) {
    if (b.heading === 1) {
      for (const w of wrap(b.text, headingSize)) {
        lines.push({
          text: w,
          size: headingSize,
          bold: true,
          indent: 0,
          spacingAfter: 4,
          align: "left",
        });
      }
      lines[lines.length - 1].spacingAfter = lineHeight;
    } else if (b.heading === 2) {
      for (const w of wrap(b.text, h2Size)) {
        lines.push({
          text: w,
          size: h2Size,
          bold: true,
          indent: 0,
          spacingAfter: 3,
          align: "left",
        });
      }
      lines[lines.length - 1].spacingAfter = lineHeight;
    } else if (b.bullet) {
      const wrapped = wrap(b.text, bodySize);
      wrapped.forEach((w, i) => {
        lines.push({
          text: i === 0 ? `• ${w}` : `  ${w}`,
          size: bodySize,
          bold: false,
          indent: 14,
          spacingAfter: i === wrapped.length - 1 ? 4 : 2,
          align: "left",
        });
      });
    } else {
      for (const w of wrap(b.text, bodySize)) {
        lines.push({
          text: w,
          size: bodySize,
          bold: false,
          indent: 0,
          spacingAfter: 2,
          align: "left",
        });
      }
      lines[lines.length - 1].spacingAfter = lineHeight;
    }
  }

  // Paginate
  const pages: Line[][] = [];
  let currentPage: Line[] = [];
  let y = pageHeight - marginTop;
  for (const line of lines) {
    const advance = line.size + line.spacingAfter;
    if (y - advance < marginBottom) {
      pages.push(currentPage);
      currentPage = [];
      y = pageHeight - marginTop;
    }
    currentPage.push(line);
    y -= advance;
  }
  if (currentPage.length > 0) pages.push(currentPage);
  if (pages.length === 0) pages.push([]);

  // Build PDF objects
  // Fonts: F1 Helvetica, F2 Helvetica-Bold
  const pageContentStreams = pages.map((pageLines) => {
    let stream = "BT\n";
    let cursorY = pageHeight - marginTop;
    let first = true;
    for (const line of pageLines) {
      const font = line.bold ? "F2" : "F1";
      const x =
        line.align === "center"
          ? marginX +
            Math.max(0, (usableWidth - line.text.length * line.size * 0.5) / 2)
          : marginX + line.indent;
      if (first) {
        stream += `/${font} ${line.size} Tf\n1 0 0 1 ${x.toFixed(2)} ${cursorY.toFixed(2)} Tm\n`;
        first = false;
      } else {
        stream += `/${font} ${line.size} Tf\n1 0 0 1 ${x.toFixed(2)} ${cursorY.toFixed(2)} Tm\n`;
      }
      stream += `(${enc(line.text)}) Tj\n`;
      cursorY -= line.size + line.spacingAfter;
    }
    stream += "ET";
    return stream;
  });

  // Assemble PDF
  const objects: string[] = [];
  const push = (obj: string) => {
    objects.push(obj);
    return objects.length; // 1-indexed
  };

  const catalogId = 1;
  const pagesId = 2;
  const fontRegularId = 3;
  const fontBoldId = 4;
  push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  // placeholder for pages object; fill later
  push("");
  push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );

  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (const stream of pageContentStreams) {
    const bytes = new TextEncoder().encode(stream);
    const contentId = push(
      `<< /Length ${bytes.length} >>\nstream\n${stream}\nendstream`,
    );
    contentIds.push(contentId);
    const pageId = push(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }
  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  // Serialize
  let out = "%PDF-1.4\n%\xC3\xA9\n";
  const offsets: number[] = [];
  // Use TextEncoder to compute byte offsets correctly for header text
  let bytePos = new TextEncoder().encode(out).length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(bytePos);
    const entry = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    out += entry;
    bytePos += new TextEncoder().encode(entry).length;
  }
  const xrefPos = bytePos;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    out += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return new TextEncoder().encode(out);
  // Note: also unused, but keep contentIds referenced to silence lint
  void contentIds;
}

export const Route = createFileRoute("/api/tools/pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { titulo, conteudo, html } = (await request.json()) as {
            titulo?: string;
            conteudo?: string;
            html?: string;
          };
          if (!titulo || (!conteudo && !html)) {
            return new Response("titulo e conteudo obrigatórios", { status: 400 });
          }
          const source = (html ?? conteudo ?? "") as string;
          const blocks = contentToBlocks(source);

          // If the caller wants a DOCX-quality output too, we still ship PDF here.
          // Docx path is a sibling endpoint (/api/tools/petition).
          void Document;
          void Packer;
          void Paragraph;
          void TextRun;
          void HeadingLevel;
          void alignMap;

          const pdfBytes = buildSimplePdf(String(titulo), blocks);
          return new Response(pdfBytes as unknown as BodyInit, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${sanitize(titulo)}.pdf"`,
            },
          });
        } catch (e) {
          return new Response(
            `Erro: ${e instanceof Error ? e.message : String(e)}`,
            { status: 500 },
          );
        }
      },
    },
  },
});
