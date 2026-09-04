/**
 * Processador das filas de documentos.
 *
 * Desenho: o trabalho é acordado no momento em que é criado (nenhuma
 * verificação periódica do banco). Cada execução:
 *  - reserva um trabalho por vez com bloqueio no banco (um único processador
 *    por trabalho, mesmo com vários pedidos simultâneos);
 *  - respeita um teto de trabalhos e de tempo por execução;
 *  - registra o progresso em cada etapa, então repetir nunca refaz o que já
 *    terminou;
 *  - recupera trabalhos interrompidos (bloqueio vencido) na execução seguinte;
 *  - para tudo quando a IA responde falta de créditos ou bloqueio da conta.
 */

import { getRequest } from "@tanstack/react-start/server";

const WORKER_MAX_JOBS = 4;
const WORKER_TIME_BUDGET_MS = 50_000;

export interface WorkerRunResult {
  processed: number;
  intake: number;
  index: number;
  remaining: boolean;
  halted?: "ai_blocked";
}

function workerId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isAiBlocked(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return m.includes("402") || m.includes("403") || m.includes("créditos");
}

/** Executa um lote limitado das duas filas. Nunca lança. */
export async function runDocumentQueues(
  opts: { maxJobs?: number; timeBudgetMs?: number } = {},
): Promise<WorkerRunResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { processIntakeDocument } = await import("@/lib/intake/intake.server");
  const { indexDocumentCore } = await import("@/lib/rag/index-document.server");
  const { runWithUsageContext } = await import("@/lib/ai-usage.server");

  const maxJobs = Math.max(1, Math.min(opts.maxJobs ?? WORKER_MAX_JOBS, 10));
  const deadline = Date.now() + Math.min(opts.timeBudgetMs ?? WORKER_TIME_BUDGET_MS, 55_000);
  const worker = workerId();

  let intakeDone = 0;
  let indexDone = 0;
  let halted: "ai_blocked" | undefined;

  for (let i = 0; i < maxJobs && Date.now() < deadline && !halted; i++) {
    // 1) Análise de documentos do "Novo caso" tem prioridade (usuário esperando).
    const { data: intakeRows } = await supabaseAdmin.rpc("claim_intake_jobs", {
      _worker: worker,
      _limit: 1,
    });
    const intake = (intakeRows ?? [])[0];
    if (intake) {
      const outcome = await runWithUsageContext(
        {
          userId: intake.created_by_user_id,
          organizationId: intake.organization_id,
          feature: "case_intake_extraction",
        },
        () =>
          processIntakeDocument(supabaseAdmin, intake, {
            forceOcr: intake.extraction_mode === "force_ocr",
          }),
      );
      intakeDone++;
      if (
        outcome.status === "error" &&
        (outcome.error_code === "model_quota" || outcome.error_code === "model_unavailable")
      ) {
        halted = "ai_blocked";
      }
      continue;
    }

    // 2) Indexação completa para consulta pela IA.
    const { data: indexRows } = await supabaseAdmin.rpc("claim_index_jobs", {
      _worker: worker,
      _limit: 1,
    });
    const job = (indexRows ?? [])[0];
    if (!job) break;

    try {
      const result = await runWithUsageContext(
        {
          userId: job.requested_by_user_id,
          organizationId: job.organization_id,
          caseId: job.case_id,
          feature: "document_indexing",
        },
        () =>
          indexDocumentCore({
            supabase: supabaseAdmin,
            documentId: job.document_id,
            organizationId: job.organization_id,
            userId: job.requested_by_user_id,
            forceVision: job.force_vision,
            onProgress: async (stage, detail) => {
              await supabaseAdmin
                .from("document_index_jobs")
                .update({
                  heartbeat_at: new Date().toISOString(),
                  progress: { stage, ...(detail ?? {}) },
                })
                .eq("id", job.id);
            },
          }),
      );
      await supabaseAdmin
        .from("document_index_jobs")
        .update({
          status: "done",
          progress: { stage: "done", chunks: result.chunks, failed_pages: result.failed_pages },
          finished_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          locked_by: null,
        })
        .eq("id", job.id);
      indexDone++;
    } catch (err) {
      const blocked = isAiBlocked(err);
      const msg = err instanceof Error ? err.message : String(err);
      const exhausted = blocked || job.attempt_count >= job.max_attempts;
      await supabaseAdmin
        .from("document_index_jobs")
        .update({
          status: blocked ? "paused" : exhausted ? "error" : "queued",
          last_error_code: blocked ? "ai_blocked" : "index_failed",
          last_error_message: msg.slice(0, 400),
          heartbeat_at: new Date().toISOString(),
          locked_by: null,
          finished_at: exhausted ? new Date().toISOString() : null,
        })
        .eq("id", job.id);
      indexDone++;
      if (blocked) halted = "ai_blocked";
      console.error("[jobs] indexação falhou", {
        job_id: job.id,
        organization_id: job.organization_id,
        blocked,
      });
    }
  }

  const remaining = halted ? false : await hasPendingWork();
  return { processed: intakeDone + indexDone, intake: intakeDone, index: indexDone, remaining, halted };
}

/** Existe trabalho pendente em alguma das filas? */
export async function hasPendingWork(): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ count: a }, { count: b }] = await Promise.all([
    supabaseAdmin
      .from("case_intake_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
    supabaseAdmin
      .from("document_index_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
  ]);
  return (a ?? 0) > 0 || (b ?? 0) > 0;
}

function siteOrigin(): string | null {
  try {
    const req = getRequest();
    if (req?.url) return new URL(req.url).origin;
  } catch {
    // fora de um request
  }
  const fromEnv = process.env["SITE_URL"] ?? process.env["VITE_SITE_URL"];
  return fromEnv ? fromEnv.replace(/\/$/, "") : null;
}

/**
 * Acorda o processador em uma requisição separada, para que o trabalho continue
 * mesmo que o usuário feche a página. Nunca lança e nunca bloqueia o chamador.
 */
export function kickDocumentWorker(): void {
  const origin = siteOrigin();
  const token = process.env["JOBS_WORKER_SECRET"];
  if (!origin || !token) return;
  void fetch(`${origin}/api/public/jobs/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-jobs-token": token },
    body: JSON.stringify({ source: "enqueue" }),
  }).catch(() => {
    // O trabalho continua na fila e é retomado no próximo pedido de status.
  });
}
