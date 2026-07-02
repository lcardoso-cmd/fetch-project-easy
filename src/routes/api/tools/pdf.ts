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

          const pdfBytes = renderPdf({
            title: String(titulo),
            blocks,
            branding,
            headerLabel,
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
