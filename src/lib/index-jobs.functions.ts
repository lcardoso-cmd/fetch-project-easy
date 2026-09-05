import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";

export interface IndexJobView {
  document_id: string;
  status: "queued" | "running" | "done" | "error" | "paused";
  stage: string | null;
  pages: number | null;
  attempt_count: number;
  max_attempts: number;
  last_error_message: string | null;
  heartbeat_at: string | null;
  /** Início real do processamento, usado para estimar o tempo restante. */
  started_at: string | null;
  /** 1 = próximo a ser processado. Null quando não está na fila. */
  queue_position: number | null;
  /** Verdadeiro quando o processador parou de dar sinal de vida. */
  stalled: boolean;
  /** Progresso salvo no servidor (sobrevive a recarregar a página). */
  percent: number | null;
  /** Motivo da última falha de etapa, já em linguagem do usuário. */
  step_warning: string | null;
  step_attempt: number | null;
  step_attempts: number | null;
  /** Páginas já lidas e total, quando o arquivo é lido em partes. */
  pages_done: number | null;
  pages_total: number | null;
}

const STALE_MS = 5 * 60 * 1000;

/**
 * Estado real da fila de leitura dos documentos de um caso.
 *
 * Mostra o que está de fato acontecendo no servidor: quem está sendo lido
 * agora, quantos estão na frente na fila e se algum travou.
 */
export const listIndexJobs = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("document_index_jobs")
      .select(
        "id, document_id, case_id, status, progress, attempt_count, max_attempts, last_error_message, heartbeat_at, started_at, created_at",
      )
      .eq("organization_id", context.organizationId)
      .in("status", ["queued", "running", "error", "paused"])
      .order("created_at", { ascending: true });

    const all = rows ?? [];
    const queuedOrder = all
      .filter((r) => r.status === "queued")
      .map((r) => r.document_id as string);

    const now = Date.now();
    const jobs: IndexJobView[] = all
      .filter((r) => r.case_id === data.case_id)
      .map((r) => {
        const progress = (r.progress ?? {}) as {
          stage?: string;
          pages?: number;
          percent?: number | null;
          step_warning?: string;
          step_attempt?: number;
          step_attempts?: number;
          pages_done?: number | null;
          pages_total?: number | null;
        };
        const beat = r.heartbeat_at ? new Date(r.heartbeat_at as string).getTime() : 0;
        const position = queuedOrder.indexOf(r.document_id as string);
        return {
          document_id: r.document_id as string,
          status: r.status as IndexJobView["status"],
          stage: progress.stage ?? null,
          pages: progress.pages ?? null,
          attempt_count: (r.attempt_count as number) ?? 0,
          max_attempts: (r.max_attempts as number) ?? 3,
          last_error_message: (r.last_error_message as string | null) ?? null,
          heartbeat_at: (r.heartbeat_at as string | null) ?? null,
          started_at: ((r as { started_at?: string | null }).started_at as string | null) ?? null,
          queue_position: position >= 0 ? position + 1 : null,
          stalled: r.status === "running" && beat > 0 && now - beat > STALE_MS,
          percent: typeof progress.percent === "number" ? progress.percent : null,
          step_warning: progress.step_warning ?? null,
          step_attempt: progress.step_attempt ?? null,
          step_attempts: progress.step_attempts ?? null,
          pages_done: progress.pages_done ?? null,
          pages_total: progress.pages_total ?? null,
        };
      });

    // A tela apenas relata o estado real. Acordar a fila durante polling cria
    // processadores concorrentes; enqueue e a tarefa de recuperação cuidam disso.
    const runningNow = all.filter((r) => r.status === "running").length;
    return {
      jobs,
      running_total: runningNow,
      queued_total: queuedOrder.length,
    };
  });

/**
 * Recoloca a leitura de um documento na fila e acorda o processador na hora.
 *
 * Serve para o caso em que o trabalho ficou preso: limpa o bloqueio, zera as
 * tentativas e força uma rodada imediata.
 */
export const forceIndexNow = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z.object({ document_id: z.string().uuid(), force_vision: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, case_id")
      .eq("id", data.document_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado");

    const { data: existing } = await context.supabase
      .from("document_index_jobs")
      .select("id, status")
      .eq("document_id", data.document_id)
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("document_index_jobs")
        .update({
          status: "queued",
          attempt_count: 0,
          locked_by: null,
          locked_at: null,
          heartbeat_at: null,
          finished_at: null,
          last_error_code: null,
          last_error_message: null,
          // “Processar agora” sempre volta ao modo automático. Sem este reset,
          // um OCR forçado anteriormente ficava gravado no job para sempre.
          force_vision: data.force_vision ?? false,
        })
        .eq("id", existing.id);
      if (error) throw new Error(`Não foi possível liberar a leitura: ${error.message}`);
    } else {
      const { error } = await context.supabase.from("document_index_jobs").insert({
        organization_id: context.organizationId,
        document_id: data.document_id,
        case_id: doc.case_id,
        requested_by_user_id: context.userId,
        force_vision: data.force_vision ?? false,
      });
      if (error) throw new Error(`Não foi possível criar a leitura: ${error.message}`);
    }

    const { error: documentError } = await context.supabase
      .from("documents")
      .update({ processing_status: "queued" })
      .eq("id", data.document_id);
    if (documentError) {
      throw new Error(`Não foi possível atualizar o documento: ${documentError.message}`);
    }

    const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
    await kickDocumentWorker({ preferredDocumentId: data.document_id });

    return { ok: true as const };
  });

/** Retoma, em uma única ação, todos os jobs sem heartbeat recente de um caso. */
export const resumeStalledCaseJobs = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error: selectError } = await context.supabase
      .from("document_index_jobs")
      .select("id, document_id, heartbeat_at, locked_at, started_at")
      .eq("organization_id", context.organizationId)
      .eq("case_id", data.case_id)
      .eq("status", "running");
    if (selectError) throw new Error(`Não foi possível consultar a fila: ${selectError.message}`);

    const cutoff = Date.now() - STALE_MS;
    const stalled = (rows ?? []).filter((row) => {
      const signal = row.heartbeat_at ?? row.locked_at ?? row.started_at;
      return Boolean(signal && new Date(signal).getTime() < cutoff);
    });
    if (stalled.length === 0) return { ok: true as const, resumed: 0 };

    const jobIds = stalled.map((row) => row.id);
    const documentIds = stalled.map((row) => row.document_id);
    const { error: updateError } = await context.supabase
      .from("document_index_jobs")
      .update({
        status: "queued",
        attempt_count: 0,
        locked_by: null,
        locked_at: null,
        heartbeat_at: null,
        finished_at: null,
        last_error_code: null,
        last_error_message: null,
      })
      .in("id", jobIds)
      .eq("status", "running");
    if (updateError) throw new Error(`Não foi possível liberar a fila: ${updateError.message}`);

    const { error: documentError } = await context.supabase
      .from("documents")
      .update({ processing_status: "queued" })
      .eq("organization_id", context.organizationId)
      .in("id", documentIds)
      .neq("processing_status", "ready");
    if (documentError) {
      throw new Error(`Não foi possível atualizar os documentos: ${documentError.message}`);
    }

    const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
    await kickDocumentWorker({ preferredDocumentId: documentIds[0] });
    return { ok: true as const, resumed: stalled.length };
  });

/**
 * Cancela a leitura de UM documento, sem tocar nos outros da fila.
 *
 * Marca o trabalho como cancelado; o processador respeita esse sinal na
 * próxima etapa e para apenas esse documento. O arquivo continua no caso e
 * pode ser reprocessado depois com "Processar agora".
 */
export const cancelIndexJob = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ document_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id")
      .eq("id", data.document_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado");

    await context.supabase
      .from("document_index_jobs")
      .update({
        status: "cancelled",
        locked_by: null,
        locked_at: null,
        finished_at: new Date().toISOString(),
        last_error_code: "cancelled_by_user",
        last_error_message: "Leitura cancelada pelo usuário.",
      })
      .eq("document_id", data.document_id)
      .eq("organization_id", context.organizationId)
      .in("status", ["queued", "running", "error", "paused"]);

    await context.supabase
      .from("documents")
      .update({ processing_status: "cancelled" })
      .eq("id", data.document_id)
      .eq("organization_id", context.organizationId)
      .neq("processing_status", "ready");

    return { ok: true as const };
  });
