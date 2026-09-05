import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";
import type { DocBlock } from "./rag/chunking";

const IndexSchema = z.object({
  document_id: z.string().uuid(),
  force_vision: z.boolean().optional(),
  chunk_profile: z.enum(["structural-sm", "structural-md", "structural-lg"]).optional(),
});

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";

/** Acima deste tamanho a leitura vai para a fila durável do servidor. */
const INLINE_INDEX_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Indexação de um documento para consulta pela IA.
 *
 * Arquivos pequenos são processados na hora (resposta imediata na tela).
 * Arquivos grandes entram na fila durável do servidor: a leitura continua
 * mesmo que a página seja fechada e é retomada se for interrompida.
 *
 * Em ambos os casos os novos trechos são gravados ANTES de remover os antigos,
 * então uma falha no meio do caminho preserva o índice anterior.
 */
export const indexDocument = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => IndexSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("id, case_id, file_size, file_type, filename")
      .eq("id", data.document_id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado");

    const size = (doc.file_size as number | null) ?? 0;
    const isPdf =
      doc.file_type === "application/pdf" || /\.pdf$/i.test((doc.filename as string | null) ?? "");

    // PDFs e OCR sempre usam a fila retomável. Mesmo um PDF pequeno pode ser
    // composto por imagens e ultrapassar o tempo de uma requisição comum.
    if (size > INLINE_INDEX_MAX_BYTES || isPdf || data.force_vision) {
      const { data: active } = await context.supabase
        .from("document_index_jobs")
        .select("id")
        .eq("document_id", data.document_id)
        .in("status", ["queued", "running"])
        .maybeSingle();

      let jobId = active?.id as string | undefined;
      if (jobId && data.force_vision) {
        await context.supabase
          .from("document_index_jobs")
          .update({ force_vision: true })
          .eq("id", jobId);
      }
      if (!jobId) {
        const { data: job, error } = await context.supabase
          .from("document_index_jobs")
          .insert({
            organization_id: context.organizationId,
            document_id: data.document_id,
            case_id: doc.case_id,
            requested_by_user_id: context.userId,
            force_vision: data.force_vision ?? false,
          })
          .select("id")
          .single();
        if (error) throw error;
        jobId = job.id as string;
      }

      await context.supabase
        .from("documents")
        .update({ processing_status: "queued" })
        .eq("id", data.document_id);

      const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
      await kickDocumentWorker();

      return { ok: true as const, queued: true as const, job_id: jobId };
    }

    const { indexDocumentCore } = await import("./rag/index-document.server");
    const result = await indexDocumentCore({
      supabase: context.supabase,
      documentId: data.document_id,
      organizationId: context.organizationId,
      userId: context.userId,
      forceVision: data.force_vision,
      chunkProfile: data.chunk_profile,
    });
    return { ...result, queued: false as const };
  });

/** Reindexa documentos de um caso cujo índice está em versão anterior. */
export const reindexCaseDocuments = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({ case_id: z.string().uuid(), limit: z.number().int().min(1).max(20).optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: docs } = await context.supabase
      .from("documents")
      .select("id, filename")
      .eq("case_id", data.case_id)
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: true })
      .limit(data.limit ?? 5);

    const pending: Array<{ id: string; filename: string }> = [];
    for (const d of (docs ?? []) as Array<{ id: string; filename: string }>) {
      const { data: chunk } = await context.supabase
        .from("document_chunks")
        .select("chunking_version")
        .eq("document_id", d.id)
        .limit(1)
        .maybeSingle();
      const version = (chunk?.chunking_version as string | null) ?? null;
      if (!version || !version.startsWith("structural")) pending.push(d);
    }

    return { pending, total: (docs ?? []).length };
  });
