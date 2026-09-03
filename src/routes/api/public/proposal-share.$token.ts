/**
 * Public endpoint for shared proposals.
 *
 * GET  /api/public/proposal-share/:token       → JSON metadata (no PDF)
 * POST /api/public/proposal-share/:token       → PDF stream
 *      body: { password?: string }
 *
 * Uses supabaseAdmin because anon must be able to look up the row by an
 * unguessable 32-byte token; the token itself is the authorization.
 * All validation (revoked / expired / max_downloads / password) runs
 * server-side before any content is returned.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { RenderPdfInput } from "@/lib/documents/pdf-renderer";
import { hashSharePassword, safeEqualHex } from "@/lib/proposal-shares-crypto";

type ShareRow = {
  id: string;
  created_by_user_id: string;
  title: string;
  client_name: string | null;
  html: string;
  page_config: Record<string, unknown> | null;
  cover: Record<string, unknown> | null;
  watermark: { text?: string; opacity?: number } | null;
  password_salt: string | null;
  password_hash: string | null;
  max_downloads: number | null;
  download_count: number;
  expires_at: string | null;
  revoked_at: string | null;
};

function sanitize(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^\w-.]/g, "")
      .replace(/_{2,}/g, "_") || "proposta"
  );
}

async function loadShare(
  token: string,
): Promise<
  | { row: ShareRow; admin: Awaited<ReturnType<typeof getAdmin>> }
  | { error: Response }
> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("proposal_shares")
    .select(
      "id, created_by_user_id, title, client_name, html, page_config, cover, watermark, password_salt, password_hash, max_downloads, download_count, expires_at, revoked_at",
    )
    .eq("token", token)
    .maybeSingle();
  if (error) {
    return {
      error: new Response("Erro interno", { status: 500 }),
    };
  }
  if (!data) {
    return { error: new Response("Link não encontrado", { status: 404 }) };
  }
  return { row: data as ShareRow, admin };
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function shareStatus(row: ShareRow): {
  revoked: boolean;
  expired: boolean;
  exhausted: boolean;
} {
  const revoked = !!row.revoked_at;
  const expired = !!row.expires_at && new Date(row.expires_at).getTime() < Date.now();
  const exhausted =
    typeof row.max_downloads === "number" && row.download_count >= row.max_downloads;
  return { revoked, expired, exhausted };
}

export const Route = createFileRoute("/api/public/proposal-share/$token")({
  server: {
    handlers: {
      // Metadata for the landing page. Never leaks HTML/PDF.
      GET: async ({ params }) => {
        const token = String(params.token ?? "");
        if (!token || token.length < 20) {
          return new Response("Token inválido", { status: 400 });
        }
        const res = await loadShare(token);
        if ("error" in res) return res.error;
        const { row } = res;
        const status = shareStatus(row);
        return Response.json({
          title: row.title,
          client_name: row.client_name,
          expires_at: row.expires_at,
          max_downloads: row.max_downloads,
          download_count: row.download_count,
          requires_password: !!row.password_hash,
          revoked: status.revoked,
          expired: status.expired,
          exhausted: status.exhausted,
        });
      },

      // PDF stream — only when the caller passes any required password.
      POST: async ({ params, request }) => {
        const token = String(params.token ?? "");
        if (!token || token.length < 20) {
          return new Response("Token inválido", { status: 400 });
        }

        let body: { password?: string } = {};
        try {
          const text = await request.text();
          body = text ? (JSON.parse(text) as { password?: string }) : {};
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        const res = await loadShare(token);
        if ("error" in res) return res.error;
        const { row, admin } = res;
        const status = shareStatus(row);
        if (status.revoked) return new Response("Link revogado", { status: 410 });
        if (status.expired) return new Response("Link expirado", { status: 410 });
        if (status.exhausted) {
          return new Response("Limite de downloads atingido", { status: 429 });
        }

        if (row.password_hash && row.password_salt) {
          const supplied = (body.password ?? "").trim();
          if (!supplied) {
            return new Response("Senha obrigatória", { status: 401 });
          }
          const hash = await hashSharePassword(supplied, row.password_salt);
          if (!safeEqualHex(hash, row.password_hash)) {
            return new Response("Senha incorreta", { status: 401 });
          }
        }

        try {
          const [{ contentToBlocks }, { renderPdf }] = await Promise.all([
            import("@/lib/documents/blocks"),
            import("@/lib/documents/pdf-renderer"),
          ]);
          const blocks = contentToBlocks(row.html);
          const headerLabel = "Proposta comercial";
          const { loadBrandingForUser } = await import("@/lib/docx/branding.server");
          const branding = await loadBrandingForUser(row.created_by_user_id).catch(() => null);
          const pdfBytes = await renderPdf({
            title: row.title,
            blocks,
            branding,
            headerLabel,
            page: (row.page_config ?? {}) as RenderPdfInput["page"],
            cover: (row.cover ?? null) as RenderPdfInput["cover"],
            watermark:
              row.watermark && typeof row.watermark.text === "string" && row.watermark.text
                ? { text: row.watermark.text, opacity: row.watermark.opacity }
                : null,
          });

          // Fire-and-forget increment; never block delivery on it.
          void admin
            .from("proposal_shares")
            .update({
              download_count: row.download_count + 1,
              last_accessed_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          return new Response(pdfBytes as unknown as BodyInit, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${sanitize(row.title)}.pdf"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          return new Response(
            `Erro ao gerar PDF: ${e instanceof Error ? e.message : String(e)}`,
            { status: 500 },
          );
        }
      },
    },
  },
});
