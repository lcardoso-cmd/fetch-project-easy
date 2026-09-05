/**
 * Processador das filas de documentos.
 *
 * Chamado internamente pela própria aplicação quando um trabalho é criado ou
 * quando a tela pede o andamento e há trabalho travado. Exige a chave interna
 * do processador — não é um endpoint de uso público.
 */

import { createFileRoute } from "@tanstack/react-router";
import { getWorkerExecutionContext } from "@/lib/request-context.server";

/** Nº máximo de rodadas em uma mesma requisição (limite de trabalho por run). */
const MAX_ROUNDS = 2;
const MAX_CHAIN_DEPTH = 12;
const NEXT_HOP_COOLDOWN_MS = 1_000;

function scheduleNextHop(request: Request, depth: number, token: string): void {
  if (depth >= MAX_CHAIN_DEPTH) return;
  const executionContext = getWorkerExecutionContext();
  if (!executionContext) return;

  const nextUrl = new URL("/api/public/jobs/run", request.url);
  executionContext.waitUntil(
    new Promise((resolve) => setTimeout(resolve, NEXT_HOP_COOLDOWN_MS))
      .then(() =>
        fetch(nextUrl, {
          method: "POST",
          headers: {
            "x-jobs-token": token,
            "x-jobs-depth": String(depth + 1),
          },
        }),
      )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Continuação da fila falhou (${response.status}): ${await response.text()}`);
        }
      }),
  );
}

export const Route = createFileRoute("/api/public/jobs/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["JOBS_WORKER_SECRET"];
        const provided = request.headers.get("x-jobs-token");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const rawDepth = Number.parseInt(request.headers.get("x-jobs-depth") ?? "0", 10);
        const depth = Number.isFinite(rawDepth) ? Math.max(0, rawDepth) : 0;

        const { runDocumentQueues } = await import("@/lib/jobs/worker.server");

        let processed = 0;
        let intake = 0;
        let index = 0;
        let remaining = false;
        let halted: string | undefined;

        for (let round = 0; round < MAX_ROUNDS; round++) {
          const r = await runDocumentQueues({ maxJobs: 10, timeBudgetMs: 50_000 });
          processed += r.processed;
          intake += r.intake;
          index += r.index;
          remaining = r.remaining;
          halted = r.halted;
          if (r.processed === 0 || !r.remaining || r.halted) break;
        }

        if (remaining && !halted) scheduleNextHop(request, depth, provided);

        return Response.json({ ok: true, processed, intake, index, remaining, halted, depth });
      },
    },
  },
});
