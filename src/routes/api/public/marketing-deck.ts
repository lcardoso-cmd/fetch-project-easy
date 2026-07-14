/**
 * Public endpoint that redirects to the latest marketing deck stored in the
 * private `marketing-deck` bucket. Anyone can trigger the download from the
 * landing page; only super_admins can replace the file (RLS on storage).
 *
 * GET /api/public/marketing-deck → 302 to a fresh signed URL for `deck.pdf`
 */
import { createFileRoute } from "@tanstack/react-router";

const BUCKET = "marketing-deck";
const OBJECT = "deck.pdf";

export const Route = createFileRoute("/api/public/marketing-deck")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const admin = supabaseAdmin as unknown as {
          storage: {
            from: (b: string) => {
              createSignedUrl: (
                p: string,
                expiresIn: number,
                opts?: { download?: string | boolean },
              ) => Promise<{
                data: { signedUrl: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
        const { data, error } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(OBJECT, 60 * 5, { download: "jurismind-deck.pdf" });
        if (error || !data) {
          return new Response("Deck ainda não disponível.", {
            status: 404,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
        return new Response(null, {
          status: 302,
          headers: {
            Location: data.signedUrl,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
