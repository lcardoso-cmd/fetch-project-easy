import { createFileRoute } from "@tanstack/react-router";
import { Packer } from "docx";
import {
  createStyledDocument,
  htmlToDocxChildren,
  plainTextToDocxChildren,
} from "@/lib/docx/template";

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
          const { titulo, conteudo, html } = (await request.json()) as {
            titulo?: string;
            conteudo?: string;
            html?: string;
          };
          if (!titulo || (!conteudo && !html)) {
            return new Response("titulo e conteudo obrigatórios", { status: 400 });
          }

          const children = html
            ? htmlToDocxChildren(html)
            : plainTextToDocxChildren(String(conteudo));

          const headerLabel = /proposta/i.test(titulo)
            ? "Proposta comercial"
            : "Petição";

          const doc = createStyledDocument({
            title: String(titulo),
            children,
            meta: {
              header: headerLabel,
              creator: "B2B | JurisMind AI",
              description: String(titulo),
            },
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
