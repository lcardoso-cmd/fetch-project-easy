import { createFileRoute } from "@tanstack/react-router";
import { Packer } from "docx";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  createStyledDocument,
  htmlToDocxChildren,
  plainTextToDocxChildren,
} from "@/lib/docx/template";
import { loadBrandingForUser } from "@/lib/docx/branding.server";

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

export const Route = createFileRoute("/api/tools/petition")({
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

          const headerLabel = /proposta/i.test(titulo) ? "Proposta comercial" : "Petição";

          const userId = await resolveUserId(request.headers.get("authorization"));
          const branding = userId ? await loadBrandingForUser(userId) : null;

          const doc = createStyledDocument({
            title: String(titulo),
            children,
            meta: {
              header: headerLabel,
              creator: branding?.firmName || "B2B | JurisMind AI",
              description: String(titulo),
              branding,
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
