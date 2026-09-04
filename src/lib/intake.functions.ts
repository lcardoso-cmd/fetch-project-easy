/**
 * Funções de servidor do fluxo "Novo caso": registro do documento enviado,
 * andamento da análise, reprocessamento e conversão em documento do caso.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg, requireOrgPermission } from "@/lib/org-middleware";
import { MAX_DOCUMENT_SIZE_BYTES, validateDocumentUpload } from "@/lib/documents-limits";
import { storagePathBelongsToOrg } from "@/lib/intake/intake-core";

const IntakeRefSchema = z.object({ id: z.string().uuid() });

const IntakePartSchema = z.object({
  storage_path: z.string().min(1).max(600),
  filename: z.string().min(1).max(300),
  file_type: z.string().max(160).default("application/pdf"),
  file_size: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
  split_group_id: z.string().uuid(),
  part_index: z.number().int().positive(),
  part_count: z.number().int().min(2).max(64),
  page_offset: z.number().int().nonnegative(),
  page_count: z.number().int().positive(),
});

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface IntakeDocumentView {
  id: string;
  storage_path: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  attempt_count: number;
  max_attempts: number;
  extraction_mode: string | null;
  pages_total: number | null;
  pages_analyzed: number | null;
  ocr_pages: number[];
  failed_pages: number[];
  extracted_data: { [key: string]: JsonValue } | null;
  missing_fields: string[];
  warnings: Array<{ field: string | null; message: string }>;
  last_error_code: string | null;
  last_error_message: string | null;
  case_id: string | null;
  document_id: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_FIELDS =
  "id, storage_path, filename, file_type, file_size, status, attempt_count, max_attempts, extraction_mode, pages_total, pages_analyzed, ocr_pages, failed_pages, extracted_data, missing_fields, warnings, last_error_code, last_error_message, case_id, document_id, created_at, updated_at";

/**
 * Registra o documento recém-enviado e coloca a análise na fila.
 * O arquivo precisa existir no Storage e pertencer à organização ativa.
 */
export const registerIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((i: unknown) =>
    z
      .object({
        storage_path: z.string().min(1).max(600),
        filename: z.string().min(1).max(300),
        file_type: z.string().max(160).default("application/octet-stream"),
        file_size: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES),
        original_file_size: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES).optional(),
        parts: z.array(IntakePartSchema).min(2).max(64).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!storagePathBelongsToOrg(data.storage_path, context.organizationId)) {
      throw new Error("Caminho de arquivo inválido para esta organização.");
    }
    const check = validateDocumentUpload({
      filename: data.filename,
      file_size: data.file_size,
    });
    if (!check.ok) throw new Error(check.message);

    const parts = data.parts ?? [];
    if (parts.length > 0) {
      const partCount = parts[0].part_count;
      const groupId = parts[0].split_group_id;
      const ordered = [...parts].sort((a, b) => a.part_index - b.part_index);
      const structurallyValid =
        parts.length === partCount &&
        ordered.every(
          (part, index) =>
            part.part_index === index + 1 &&
            part.part_count === partCount &&
            part.split_group_id === groupId &&
            storagePathBelongsToOrg(part.storage_path, context.organizationId),
        ) &&
        ordered[0]?.storage_path === data.storage_path &&
        typeof data.original_file_size === "number" &&
        parts.reduce((total, part) => total + part.file_size, 0) <= data.original_file_size * 3;
      if (!structurallyValid) {
        throw new Error("As partes do PDF não formam um conjunto válido.");
      }
      for (const part of parts) {
        const partCheck = validateDocumentUpload({
          filename: part.filename,
          file_size: part.file_size,
        });
        if (!partCheck.ok) throw new Error(partCheck.message);
      }
    }

    // Confirma que o objeto realmente chegou ao Storage e o tamanho declarado.
    const folder = data.storage_path.slice(0, data.storage_path.lastIndexOf("/"));
    const name = data.storage_path.slice(data.storage_path.lastIndexOf("/") + 1);
    const { data: objects } = await context.supabase.storage
      .from("documents")
      .list(folder, { search: name, limit: 100 });
    const found = (objects ?? []).find((o) => o.name === name);
    if (!found) {
      throw new Error("O arquivo não chegou ao servidor. Envie novamente.");
    }
    const realSize = Number((found.metadata as { size?: number } | null)?.size ?? data.file_size);
    if (realSize > MAX_DOCUMENT_SIZE_BYTES) {
      await context.supabase.storage.from("documents").remove([data.storage_path]);
      throw new Error("O arquivo excede o limite de 250 MB.");
    }

    if (parts.length > 0 && realSize !== parts[0].file_size) {
      throw new Error("O tamanho da primeira parte do PDF não confere.");
    }
    for (const part of parts.slice(1)) {
      const partFolder = part.storage_path.slice(0, part.storage_path.lastIndexOf("/"));
      const partName = part.storage_path.slice(part.storage_path.lastIndexOf("/") + 1);
      const { data: partObjects } = await context.supabase.storage
        .from("documents")
        .list(partFolder, { search: partName, limit: 10 });
      const partObject = (partObjects ?? []).find((object) => object.name === partName);
      const storedPartSize = Number((partObject?.metadata as { size?: number } | null)?.size ?? 0);
      if (!partObject || storedPartSize !== part.file_size) {
        throw new Error(`A parte ${part.part_index} do PDF não chegou completa ao servidor.`);
      }
    }

    const { data: row, error } = await context.supabase
      .from("case_intake_documents")
      .upsert(
        {
          organization_id: context.organizationId,
          created_by_user_id: context.userId,
          storage_path: data.storage_path,
          filename: data.filename,
          file_type: data.file_type || "application/octet-stream",
          file_size: realSize,
          status: "queued",
          attempt_count: 0,
          last_error_code: null,
          last_error_message: null,
        },
        { onConflict: "storage_path" },
      )
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;

    if (parts.length > 0) {
      const { error: partsError } = await context.supabase
        .from("case_intake_document_parts")
        .upsert(
          parts.map((part) => ({
            intake_document_id: row.id,
            organization_id: context.organizationId,
            created_by_user_id: context.userId,
            ...part,
          })),
          { onConflict: "storage_path" },
        );
      if (partsError) {
        await context.supabase.from("case_intake_documents").delete().eq("id", row.id);
        throw partsError;
      }
    }

    const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
    await kickDocumentWorker();

    return row as unknown as IntakeDocumentView;
  });

/** Andamento de um registro; retoma trabalhos travados de forma segura. */
export const getIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => IntakeRefSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("case_intake_documents")
      .select(SELECT_FIELDS)
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;

    const view = row as unknown as IntakeDocumentView;
    const active = ["queued", "extracting_text", "ocr_processing", "analyzing"].includes(
      view.status,
    );
    if (active) {
      const stale =
        Date.now() - new Date(view.updated_at).getTime() > 90_000 || view.status === "queued";
      if (stale) {
        const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
        await kickDocumentWorker();
      }
    }
    return view;
  });

/** Documentos de intake ainda não convertidos, do próprio usuário. */
export const listPendingIntakeDocuments = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("case_intake_documents")
      .select(SELECT_FIELDS)
      .eq("organization_id", context.organizationId)
      .eq("created_by_user_id", context.userId)
      .not("status", "in", "(converted,cancelled)")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    const rows = (data ?? []) as unknown as IntakeDocumentView[];
    if (rows.some((row) => row.status === "queued")) {
      const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
      await kickDocumentWorker();
    }
    return rows;
  });

/** Reprocessa a análise: nova tentativa normal ou forçando leitura por imagem. */
export const reprocessIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), mode: z.enum(["auto", "ocr"]).default("auto") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("case_intake_documents")
      .update({
        status: "queued",
        attempt_count: 0,
        last_error_code: null,
        last_error_message: null,
        finished_at: null,
        locked_by: null,
        heartbeat_at: null,
        warnings: [],
        // O modo forçado é registrado para o processador aplicar OCR direto.
        extraction_mode: data.mode === "ocr" ? "force_ocr" : null,
      })
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .eq("created_by_user_id", context.userId)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw error;

    const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
    await kickDocumentWorker();
    return row as unknown as IntakeDocumentView;
  });

/** Descarta o documento enviado e remove o arquivo. */
export const discardIntakeDocument = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((i: unknown) => IntakeRefSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("case_intake_documents")
      .select("id, storage_path, document_id")
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .eq("created_by_user_id", context.userId)
      .maybeSingle();
    if (!row) return { ok: true as const };

    const { data: parts } = await context.supabase
      .from("case_intake_document_parts")
      .select("storage_path, document_id")
      .eq("intake_document_id", row.id)
      .eq("organization_id", context.organizationId);

    // Só apaga o arquivo se ele ainda não foi anexado a um caso.
    if (!row.document_id) {
      const removablePaths =
        parts && parts.length > 0
          ? parts.filter((part) => !part.document_id).map((part) => part.storage_path as string)
          : [row.storage_path as string];
      if (removablePaths.length > 0) {
        await context.supabase.storage
          .from("documents")
          .remove(removablePaths)
          .catch(() => {});
      }
    }
    await context.supabase
      .from("case_intake_documents")
      .update({ status: "cancelled" })
      .eq("id", row.id);
    return { ok: true as const };
  });

/**
 * Converte o documento de intake em documento do caso, sem baixar o arquivo de
 * novo: o mesmo objeto do Storage é reaproveitado e a indexação completa entra
 * na fila durável. Idempotente por registro de intake.
 */
export const convertIntakeToCaseDocument = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), case_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("case_intake_documents")
      .select("id, storage_path, filename, file_type, file_size, document_id, status")
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .eq("created_by_user_id", context.userId)
      .single();
    if (error || !row) throw new Error("Documento enviado não encontrado.");

    if (row.document_id) {
      return { document_id: row.document_id as string, already: true as const };
    }

    const { data: splitParts, error: splitPartsError } = await context.supabase
      .from("case_intake_document_parts")
      .select(
        "id, storage_path, filename, file_type, file_size, split_group_id, part_index, part_count, page_offset, page_count, document_id",
      )
      .eq("intake_document_id", row.id)
      .eq("organization_id", context.organizationId)
      .order("part_index", { ascending: true });
    if (splitPartsError) throw splitPartsError;

    if (splitParts && splitParts.length > 0) {
      const documentIds: string[] = [];
      for (const part of splitParts) {
        let documentId = part.document_id as string | null;
        let wasCreated = false;
        if (!documentId) {
          const { data: created, error: createError } = await context.supabase
            .from("documents")
            .insert({
              organization_id: context.organizationId,
              created_by_user_id: context.userId,
              case_id: data.case_id,
              filename: part.filename as string,
              file_type: part.file_type as string,
              file_size: part.file_size as number,
              storage_path: part.storage_path as string,
              processing_status: "queued",
              split_group_id: part.split_group_id as string,
              part_index: part.part_index as number,
              part_count: part.part_count as number,
              page_offset: part.page_offset as number,
              page_count: part.page_count as number,
            })
            .select("id")
            .single();
          if (createError) throw createError;
          documentId = created.id as string;
          wasCreated = true;
          await context.supabase
            .from("case_intake_document_parts")
            .update({ document_id: documentId })
            .eq("id", part.id);
        }
        documentIds.push(documentId);

        await context.supabase
          .from("document_index_jobs")
          .insert({
            organization_id: context.organizationId,
            document_id: documentId,
            case_id: data.case_id,
            requested_by_user_id: context.userId,
          })
          .then((result) => {
            if (result.error && !result.error.message.includes("duplicate key")) {
              console.warn("[intake] fila de indexação", result.error.message);
            }
          });

        if (wasCreated) {
          await context.supabase.from("document_audit_events").insert({
            case_id: data.case_id,
            organization_id: context.organizationId,
            actor_user_id: context.userId,
            action: "uploaded",
            document_id: documentId,
            filename: part.filename as string,
            reason: "Parte de PDF enviada no fluxo de novo caso",
            metadata: {
              intake_id: row.id,
              storage_path: part.storage_path,
              split_group_id: part.split_group_id,
              part_index: part.part_index,
              part_count: part.part_count,
            },
          });
        }
      }

      await context.supabase
        .from("case_intake_documents")
        .update({
          status: "converted",
          case_id: data.case_id,
          document_id: documentIds[0],
        })
        .eq("id", row.id);

      const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
      await kickDocumentWorker();
      return {
        document_id: documentIds[0],
        document_ids: documentIds,
        already: false as const,
      };
    }

    const { data: doc, error: insErr } = await context.supabase
      .from("documents")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        case_id: data.case_id,
        filename: row.filename as string,
        file_type: row.file_type as string,
        file_size: row.file_size as number,
        storage_path: row.storage_path as string,
        processing_status: "queued",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    await context.supabase
      .from("case_intake_documents")
      .update({ status: "converted", case_id: data.case_id, document_id: doc.id })
      .eq("id", row.id);

    // Fila durável de indexação (idempotente: um trabalho ativo por documento).
    await context.supabase
      .from("document_index_jobs")
      .insert({
        organization_id: context.organizationId,
        document_id: doc.id,
        case_id: data.case_id,
        requested_by_user_id: context.userId,
      })
      .then((r) => {
        if (r.error && !r.error.message.includes("duplicate key")) {
          console.warn("[intake] fila de indexação", r.error.message);
        }
      });

    await context.supabase.from("document_audit_events").insert({
      case_id: data.case_id,
      organization_id: context.organizationId,
      actor_user_id: context.userId,
      action: "uploaded",
      document_id: doc.id,
      filename: row.filename as string,
      reason: "Documento do fluxo de novo caso",
      metadata: { intake_id: row.id, storage_path: row.storage_path },
    });

    const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
    await kickDocumentWorker();

    return { document_id: doc.id as string, already: false as const };
  });

/** Coloca (ou recoloca) um documento existente na fila de indexação. */
export const enqueueDocumentIndexing = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
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
    if (!doc) throw new Error("Documento não encontrado.");

    const { data: active } = await context.supabase
      .from("document_index_jobs")
      .select("id, status")
      .eq("document_id", data.document_id)
      .in("status", ["queued", "running"])
      .maybeSingle();

    if (active) {
      const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
      await kickDocumentWorker();
      return { job_id: active.id as string, already: true as const };
    }

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

    await context.supabase
      .from("documents")
      .update({ processing_status: "queued" })
      .eq("id", data.document_id);

    const { kickDocumentWorker } = await import("@/lib/jobs/worker.server");
    await kickDocumentWorker();
    return { job_id: job.id as string, already: false as const };
  });

/** Situação da indexação de um documento (para a Biblioteca e o caso). */
export const getDocumentIndexStatus = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ document_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase
      .from("document_index_jobs")
      .select("id, status, progress, attempt_count, max_attempts, last_error_message, updated_at")
      .eq("document_id", data.document_id)
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return job ?? null;
  });
