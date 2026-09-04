/**
 * Processador das filas de documentos.
 *
 * Chamado internamente pela própria aplicação quando um trabalho é criado ou
 * quando a tela pede o andamento e há trabalho travado. Exige a chave interna
 * do processador — não é um endpoint de uso público.
 */

import { createFileRoute } from "@tanstack/react-router";

/** Nº máximo de rodadas em uma mesma requisição (limite de trabalho por run). */
const MAX_ROUNDS = 3;

export const Route = createFileRoute("/api/public/jobs/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["JOBS_WORKER_SECRET"];
        const provided = request.headers.get("x-jobs-token");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { runDocumentQueues } = await import("@/lib/jobs/worker.server");

        let processed = 0;
        let intake = 0;
        let index = 0;
        let remaining = false;
        let halted: string | undefined;

        for (let round = 0; round < MAX_ROUNDS; round++) {
          const r = await runDocumentQueues({ maxJobs: 2, timeBudgetMs: 20_000 });
          processed += r.processed;
          intake += r.intake;
          index += r.index;
          remaining = r.remaining;
          halted = r.halted;
          if (r.processed === 0 || !r.remaining || r.halted) break;
        }

        return Response.json({ ok: true, processed, intake, index, remaining, halted });
      },
    },
  },
});
