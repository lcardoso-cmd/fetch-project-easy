import { createFileRoute } from "@tanstack/react-router";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

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

export const Route = createFileRoute("/api/tools/petition")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { titulo, conteudo } = (await request.json()) as {
            titulo?: string;
            conteudo?: string;
          };
          if (!titulo || !conteudo) {
            return new Response("titulo e conteudo obrigatórios", { status: 400 });
          }
          const paragraphs = String(conteudo)
            .split(/\n/)
            .map(
              (p) =>
                new Paragraph({
                  spacing: { after: 120 },
                  children: [new TextRun(p)],
                }),
            );
          const doc = new Document({
            sections: [
              {
                children: [
                  new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 200 },
                    children: [new TextRun({ text: String(titulo), bold: true, size: 32 })],
                  }),
                  ...paragraphs,
                ],
              },
            ],
          });
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
