import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { contentToBlocks } from "@/lib/documents/blocks";
import { renderPdf } from "@/lib/documents/pdf-renderer";

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

async function resolveUserId(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const client = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    return data.claims.sub as string;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/tools/pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { authenticateRequest } = await import("@/lib/route-auth.server");
          try {
            await authenticateRequest(request);
          } catch (r) {
            if (r instanceof Response) return r;
            return new Response("Unauthorized", { status: 401 });
          }

          const body = (await request.json()) as {
            titulo?: string;
            conteudo?: string;
            html?: string;
            page?: {
              format?: "A4" | "Letter";
              orientation?: "portrait" | "landscape";
              margins?: {
                top?: number;
                right?: number;
                bottom?: number;
                left?: number;
              };
            };
            cover?: {
              clientName?: string;
              clientDocument?: string;
              clientAddress?: string;
              matter?: string;
              reference?: string;
              date?: string;
            } | null;
            watermark?: { text?: string; opacity?: number } | null;
          };
          const { titulo, conteudo, html, page: pageCfg, cover, watermark } = body;
          if (!titulo || (!conteudo && !html)) {
            return new Response("titulo e conteudo obrigatórios", { status: 400 });
          }
          const source = (html ?? conteudo ?? "") as string;
          const blocks = contentToBlocks(source);
          const headerLabel = /proposta/i.test(titulo)
            ? "Proposta comercial"
            : /peti|inicial|contesta/i.test(titulo)
              ? "Petição"
              : "Documento";

          const userId = await resolveUserId(request.headers.get("authorization"));
          let branding = null;
          if (userId) {
            const { loadBrandingForUser } = await import("@/lib/docx/branding.server");
            branding = await loadBrandingForUser(userId);
          }

          const clip = (s: string | undefined) =>
            typeof s === "string" ? s.slice(0, 300) : undefined;
          const coverClean = cover
            ? {
                clientName: clip(cover.clientName),
                clientDocument: clip(cover.clientDocument),
                clientAddress: clip(cover.clientAddress),
                matter: clip(cover.matter),
                reference: clip(cover.reference),
                date: clip(cover.date),
              }
            : null;
          const wmClean =
            watermark && typeof watermark.text === "string" && watermark.text.trim()
              ? { text: watermark.text.slice(0, 60), opacity: watermark.opacity }
              : null;

          const pdfBytes = await renderPdf({
            title: String(titulo),
            blocks,
            branding,
            headerLabel,
            page: pageCfg,
            cover: coverClean,
            watermark: wmClean,
          });
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
