import { defineTask } from "nitro/task";

import { runDocumentQueues } from "../../../src/lib/jobs/worker.server";

const TASK_TIME_BUDGET_MS = 50_000;
const RUN_TIME_BUDGET_MS = 20_000;
const MAX_ROUNDS = 3;

export default defineTask({
  meta: {
    name: "documents:process-queues",
    description: "Continua a leitura e a indexação dos documentos pendentes.",
  },
  async run() {
    const startedAt = Date.now();
    let processed = 0;
    let intake = 0;
    let index = 0;
    let rounds = 0;
    let remaining = false;
    let halted: "ai_blocked" | undefined;

    while (rounds < MAX_ROUNDS && Date.now() - startedAt < TASK_TIME_BUDGET_MS) {
      const available = TASK_TIME_BUDGET_MS - (Date.now() - startedAt);
      if (available < 5_000) break;

      const result = await runDocumentQueues({
        maxJobs: 2,
        timeBudgetMs: Math.min(RUN_TIME_BUDGET_MS, available - 2_000),
      });
      rounds++;
      processed += result.processed;
      intake += result.intake;
      index += result.index;
      remaining = result.remaining;
      halted = result.halted;

      if (result.processed === 0 || !result.remaining || result.halted) break;
    }

    return {
      result: {
        ok: true,
        rounds,
        processed,
        intake,
        index,
        remaining,
        halted,
      },
    };
  },
});
