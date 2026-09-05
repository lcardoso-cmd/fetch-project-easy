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

import { getWorkerExecutionContext } from "@/lib/request-context.server";

const WORKER_MAX_JOBS = 4;
/** Sinal interno de que o usuário cancelou a leitura deste documento. */
const CANCELLED_MARKER = "__job_cancelled__";
const WORKER_TIME_BUDGET_MS = 50_000;

export interface WorkerRunResult {
  processed: number;
  intake: number;
  index: number;
  remaining: boolean;
  halted?: "ai_blocked";
}

interface WorkerRunOptions {
  maxJobs?: number;
  timeBudgetMs?: number;
  /** Documento solicitado explicitamente pelo usuário. É reservado antes da fila comum. */
  preferredDocumentId?: string;
}

function workerId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isAiBlocked(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return m.includes("402") || m.includes("403") || m.includes("créditos");
}

/** Traduz falhas técnicas de leitura para linguagem do usuário. */
export function friendlyIndexError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("memory limit") || m.includes("exceeded before eof")) {
    return "O arquivo é grande demais para ser lido de uma vez. Divida-o em partes menores e envie novamente.";
  }
  if (m.includes("grande demais") || m.includes("too large")) return raw;
  if (m.includes("file_missing")) return "O arquivo não foi encontrado no armazenamento.";
  if (m.includes("nenhum conteúdo indexável")) {
    return "Não foi encontrado texto legível neste documento.";
  }
  return raw;
}

/** Executa um lote limitado das duas filas. Nunca lança. */
export async function runDocumentQueues(opts: WorkerRunOptions = {}): Promise<WorkerRunResult> {
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

  /**
   * Reserva de forma otimista o documento escolhido em "Processar agora".
   * A condição status=queued + locked_by IS NULL impede duas execuções do
   * mesmo job. Se outro worker ganhar a corrida, seguimos para a fila comum.
   */
  const claimPreferredIndexJob = async (documentId: string) => {
    const { data: candidate } = await supabaseAdmin
      .from("document_index_jobs")
      .select("*")
      .eq("document_id", documentId)
      .eq("status", "queued")
      .is("locked_by", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!candidate) return null;

    const now = new Date().toISOString();
    const { data: claimed } = await supabaseAdmin
      .from("document_index_jobs")
      .update({
        status: "running",
        locked_by: worker,
        locked_at: now,
        heartbeat_at: now,
        started_at: candidate.started_at ?? now,
        attempt_count: Number(candidate.attempt_count ?? 0) + 1,
        last_error_code: null,
        last_error_message: null,
      })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .is("locked_by", null)
      .select("*")
      .maybeSingle();

    return claimed ?? null;
  };

  for (let i = 0; i < maxJobs && Date.now() < deadline && !halted; i++) {
    // Uma solicitação explícita em "Processar agora" precede a fila comum.
    // Fora disso, a análise do "Novo caso" mantém a prioridade normal.
    let intake = null;
    if (!(i === 0 && opts.preferredDocumentId)) {
      const { data: intakeRows } = await supabaseAdmin.rpc("claim_intake_jobs", {
        _worker: worker,
        _limit: 1,
      });
      intake = (intakeRows ?? [])[0] ?? null;
    }
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
    let job =
      i === 0 && opts.preferredDocumentId
        ? await claimPreferredIndexJob(opts.preferredDocumentId)
        : null;
    if (!job) {
      const { data: indexRows } = await supabaseAdmin.rpc("claim_index_jobs", {
        _worker: worker,
        _limit: 1,
      });
      job = (indexRows ?? [])[0];
    }
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
            resumeProgress: (job.progress ?? null) as
              import("@/lib/rag/index-document.server").IndexResumeProgress | null,
            // Um documento pesado não consome o orçamento inteiro do lote:
            // devolve o progresso e volta para a fila para continuar depois.
            deadlineAt: Math.min(deadline, Date.now() + 40_000),
            onProgress: async (stage, detail) => {
              // Cancelamento cooperativo: o usuário pode parar a leitura de um
              // documento sem afetar os demais da fila.
              const { data: current } = await supabaseAdmin
                .from("document_index_jobs")
                .select("status")
                .eq("id", job.id)
                .maybeSingle();
              if (current?.status === "cancelled") throw new Error(CANCELLED_MARKER);
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
      if (result.incomplete) {
        const ocrProgress = result.resume_progress?.phase === "ocr_processing";
        const resumePagesDone = ocrProgress
          ? (result.resume_progress?.ocr_pages_done?.length ?? 0)
          : (result.pages_done ?? null);
        const resumePagesTotal = ocrProgress
          ? (result.resume_progress?.ocr_pages_total ?? null)
          : (result.pages_total ?? null);
        // Progresso real gravado: volta para a fila para continuar da próxima
        // página, sem gastar tentativas.
        await supabaseAdmin
          .from("document_index_jobs")
          .update({
            status: "queued",
            attempt_count: 0,
            progress: {
              stage: result.resume_progress?.phase ?? "extracting_text",
              ...(result.resume_progress ?? {}),
              pages_done: resumePagesDone,
              pages_total: resumePagesTotal,
              percent:
                resumePagesTotal && resumePagesDone !== null
                  ? ocrProgress
                    ? 20 + Math.round((resumePagesDone / resumePagesTotal) * 78)
                    : 5 + Math.round((resumePagesDone / resumePagesTotal) * 15)
                  : null,
            },
            heartbeat_at: new Date().toISOString(),
            locked_by: null,
            locked_at: null,
            finished_at: null,
          })
          .eq("id", job.id)
          .neq("status", "cancelled");
        indexDone++;
        continue;
      }
      await supabaseAdmin
        .from("document_index_jobs")
        .update({
          status: "done",
          progress: {
            stage: "done",
            chunks: result.chunks,
            failed_pages: result.failed_pages,
            ocr_skipped_pages: result.ocr_skipped_pages ?? [],
            percent: 100,
          },
          finished_at: new Date().toISOString(),
          heartbeat_at: new Date().toISOString(),
          locked_by: null,
        })
        .eq("id", job.id)
        .neq("status", "cancelled");
      indexDone++;
    } catch (err) {
      if (err instanceof Error && err.message === CANCELLED_MARKER) {
        await supabaseAdmin
          .from("document_index_jobs")
          .update({ locked_by: null, locked_at: null, heartbeat_at: new Date().toISOString() })
          .eq("id", job.id);
        continue;
      }
      const blocked = isAiBlocked(err);
      const raw = err instanceof Error ? err.message : String(err);
      const msg = friendlyIndexError(raw);
      const memory = /memory limit|exceeded before eof|grande demais|too large/i.test(raw);
      const exhausted = blocked || memory || job.attempt_count >= job.max_attempts;
      await supabaseAdmin
        .from("document_index_jobs")
        .update({
          status: blocked ? "paused" : exhausted ? "error" : "queued",
          last_error_code: blocked ? "ai_blocked" : memory ? "file_too_large" : "index_failed",
          last_error_message: msg.slice(0, 400),
          heartbeat_at: new Date().toISOString(),
          locked_by: null,
          finished_at: exhausted ? new Date().toISOString() : null,
        })
        .eq("id", job.id)
        .neq("status", "cancelled");
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
  return {
    processed: intakeDone + indexDone,
    intake: intakeDone,
    index: indexDone,
    remaining,
    halted,
  };
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

/**
 * Acorda um lote limitado no contexto da requisição. Em produção, waitUntil
 * mantém o trabalho vivo mesmo depois de a resposta chegar ao usuário.
 */
export async function kickDocumentWorker(
  opts: Pick<WorkerRunOptions, "preferredDocumentId"> = {},
): Promise<void> {
  const task = runDocumentQueues({
    maxJobs: 2,
    timeBudgetMs: 20_000,
    preferredDocumentId: opts.preferredDocumentId,
  }).catch((error) => {
    console.error("[jobs] falha ao acordar processador", error);
  });
  const executionContext = getWorkerExecutionContext();
  if (executionContext) {
    executionContext.waitUntil(task);
    return;
  }

  // Desenvolvimento e runtimes sem waitUntil mantêm a requisição viva até o
  // lote limitado terminar. Assim o trabalho nunca depende de um fetch solto.
  await task;
}
