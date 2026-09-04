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
  /** 1 = próximo a ser processado. Null quando não está na fila. */
  queue_position: number | null;
  /** Verdadeiro quando o processador parou de dar sinal de vida. */
  stalled: boolean;
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
        "id, document_id, case_id, status, progress, attempt_count, max_attempts, last_error_message, heartbeat_at, created_at",
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
        const progress = (r.progress ?? {}) as { stage?: string; pages?: number };
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
          queue_position: position >= 0 ? position + 1 : null,
          stalled: r.status === "running" && beat > 0 && now - beat > STALE_MS,
        };
      });

    return {
      jobs,
      running_total: all.filter((r) => r.status === "running").length,
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
    z
      .object({ document_id: z.string().uuid(), force_vision: z.boolean().optional() })
      .parse(i),
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
      await context.supabase
        .from("document_index_jobs")
        .update({
          status: "queued",
          attempt_count: 0,
          locked_by: null,
          locked_at: null,
          finished_at: null,
          last_error_code: null,
          last_error_message: null,
          ...(data.force_vision ? { force_vision: true } : {}),
        })
        .eq("id", existing.id);
    } else {
      await context.supabase.from("document_index_jobs").insert({
        organization_id: context.organizationId,
        document_id: data.document_id,
        case_id: doc.case_id,
        requested_by_user_id: context.userId,
        force_vision: data.force_vision ?? false,
      });
    }

    await context.supabase
      .from("documents")
      .update({ processing_status: "queued" })
      .eq("id", data.document_id);

    const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
    await kickDocumentWorker();

    return { ok: true as const };
  });
