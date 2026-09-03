import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint — dispara o pipeline de captura para TODOS os termos ativos.
 * Autenticado via header `apikey` = SUPABASE_PUBLISHABLE_KEY (padrão pg_cron).
 * Chamado por pg_cron 1x/dia, ou manualmente para testes.
 */
export const Route = createFileRoute("/api/public/hooks/fetch-publications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runPipelineForTerm } = await import("@/lib/publications/pipeline.server");

        const { data: terms, error } = await supabaseAdmin
          .from("monitoring_terms")
          .select("*")
          .eq("active", true)
          .order("last_run_at", { ascending: true, nullsFirst: true })
          .limit(500);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        let totalCaptured = 0;
        const perUser = new Map<string, number>();
        // Concorrência serial simples para respeitar limites de API pública.
        for (const term of terms ?? []) {
          try {
            const r = await runPipelineForTerm(supabaseAdmin, term);
            totalCaptured += r.captured;
            perUser.set(term.created_by_user_id, (perUser.get(term.created_by_user_id) ?? 0) + r.captured);
          } catch (e) {
            console.error("[fetch-publications] term failed", term.id, e);
          }
        }

        return Response.json({
          ok: true,
          termsProcessed: terms?.length ?? 0,
          totalCaptured,
          affectedUsers: perUser.size,
        });
      },
    },
  },
});
