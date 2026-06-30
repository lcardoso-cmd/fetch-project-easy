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
      .replace(/_{2,}/g, "_") || "peticao"
  );
}

interface Block {
  text: string;
  heading?: 1 | 2;
  bullet?: boolean;
  ordered?: boolean;
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
  // Normalize <br> as paragraph breaks
  const normalized = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "");
  const blocks: Block[] = [];
  const blockRegex =
    /<(h1|h2|h3|p|li|div)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  let lastIndex = 0;
  let hasMatch = false;
  while ((m = blockRegex.exec(normalized)) !== null) {
    hasMatch = true;
    if (m.index > lastIndex) {
      const between = stripInline(normalized.slice(lastIndex, m.index));
      if (between) blocks.push({ text: between });
    }
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const inner = m[3];
    const alignMatch = attrs.match(/text-align:\s*(left|center|right)/i);
    const align = (alignMatch?.[1] as Block["align"]) ?? undefined;
    // Expand nested lists by splitting on </li><li>
    const text = stripInline(inner);
    if (!text) {
      blocks.push({ text: "" });
    } else if (tag === "h1") blocks.push({ text, heading: 1, align });
    else if (tag === "h2" || tag === "h3") blocks.push({ text, heading: 2, align });
    else if (tag === "li") blocks.push({ text, bullet: true, align });
    else blocks.push({ text, align });
    lastIndex = blockRegex.lastIndex;
  }
  if (!hasMatch) {
    // plain text fallback (also handles \n)
    normalized.split(/\n+/).forEach((line) => {
      const t = stripInline(line);
      if (t) blocks.push({ text: t });
    });
  } else if (lastIndex < normalized.length) {
    const tail = stripInline(normalized.slice(lastIndex));
    if (tail) blocks.push({ text: tail });
  }
  return blocks;
}

function alignMap(a?: Block["align"]) {
  if (a === "center") return AlignmentType.CENTER;
  if (a === "right") return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

export const Route = createFileRoute("/api/tools/petition")({
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
          const blocks: Block[] = html
            ? htmlToBlocks(html)
            : String(conteudo)
                .split(/\n/)
                .map((p) => ({ text: p }));

          const children = [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({ text: String(titulo), bold: true, size: 32 }),
              ],
            }),
            ...blocks.map((b) => {
              if (b.heading === 1)
                return new Paragraph({
                  heading: HeadingLevel.HEADING_1,
                  alignment: alignMap(b.align),
                  spacing: { after: 160 },
                  children: [new TextRun({ text: b.text, bold: true, size: 28 })],
                });
              if (b.heading === 2)
                return new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  alignment: alignMap(b.align),
                  spacing: { after: 140 },
                  children: [new TextRun({ text: b.text, bold: true, size: 26 })],
                });
              if (b.bullet)
                return new Paragraph({
                  bullet: { level: 0 },
                  alignment: alignMap(b.align),
                  spacing: { after: 80 },
                  children: [new TextRun(b.text)],
                });
              return new Paragraph({
                alignment: alignMap(b.align),
                spacing: { after: 120 },
                children: [new TextRun(b.text)],
              });
            }),
          ];

          const doc = new Document({ sections: [{ children }] });
          const buffer = await Packer.toBuffer(doc);
          const body = new Uint8Array(buffer);
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "Content-Disposition": `attachment; filename="${sanitize(titulo)}.docx"`,
            },
          });
        } catch (e) {
          return new Response(`Erro: ${e instanceof Error ? e.message : String(e)}`, {
            status: 500,
          });
        }
      },
    },
  },
});
