import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

const UploadSchema = z.object({
  case_id: z.string().uuid(),
  filename: z.string().min(1).max(300),
  file_type: z.string().max(120),
  file_size: z.number().int().nonnegative(),
  storage_path: z.string().min(1),
  extracted_text: z.string().optional(),
  content_hash: z.string().max(128).optional(),
  replaces_document_id: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
});

type AuditAction =
  | "uploaded"
  | "imported"
  | "replaced"
  | "duplicate_ignored"
  | "discarded"
  | "deleted";

async function logAudit(
  supabase: SupabaseClient,
  userId: string,
  entry: {
    case_id: string;
    action: AuditAction;
    document_id?: string | null;
    filename?: string | null;
    content_hash?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase
    .from("document_audit_events")
    .insert({
      case_id: entry.case_id,
      user_id: userId,
      action: entry.action,
      document_id: entry.document_id ?? null,
      filename: entry.filename ?? null,
      content_hash: entry.content_hash ?? null,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? {},
    })
    // Auditoria não deve falhar a operação principal se algo der errado.
    .then((r) => {
      if (r.error) console.warn("[audit] falha ao registrar", r.error.message);
    });
}

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: docs, error } = await context.supabase
      .from("documents")
      .select("id, filename, file_type, file_size, processing_status, created_at")
      .eq("case_id", data.case_id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return docs ?? [];
  });

export const listAllDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("id, filename, file_type, file_size, processing_status, created_at, case_id, storage_path")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

/**
 * Lista os documentos do usuário disponíveis para importar em outro caso.
 * Retorna também o título do caso de origem para facilitar a busca.
 */
export const listImportableDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ exclude_case_id: z.string().uuid().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: docs, error } = await context.supabase
      .from("documents")
      .select(
        "id, filename, file_type, file_size, processing_status, created_at, case_id, storage_path, content_hash, cases:case_id(title)",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (docs ?? []).map((d) => ({
      id: d.id as string,
      filename: d.filename as string,
      file_type: d.file_type as string,
      file_size: (d.file_size as number | null) ?? 0,
      processing_status: d.processing_status as string,
      created_at: d.created_at as string | null,
      case_id: d.case_id as string | null,
      storage_path: d.storage_path as string,
      content_hash: (d.content_hash as string | null) ?? null,
      case_title:
        (d.cases as { title?: string | null } | null)?.title ?? null,
    }));
    if (data.exclude_case_id) {
      return rows.filter((r) => r.case_id !== data.exclude_case_id);
    }
    return rows;
  });

export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("documents")
      .select("storage_path")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (!doc) throw new Error("Documento não encontrado");
    const { data: signed, error } = await context.supabase.storage
      .from("documents")
      .createSignedUrl(doc.storage_path, 300);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

/**
 * Cria uma URL assinada para upload direto ao Storage.
 * Usada para permitir progresso real de upload via XHR.
 */
export const createUploadSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        case_id: z.string().uuid().optional(),
        filename: z.string().min(1).max(300),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const safeName = data.filename.replace(/[^\w.\-]+/g, "_");
    const folder = data.case_id ?? "_intake";
    const path = `${context.userId}/${folder}/${Date.now()}-${safeName}`;
    const { data: signed, error } = await context.supabase.storage
      .from("documents")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return {
      path,
      token: signed.token,
      signedUrl: signed.signedUrl,
    };
  });

/**
 * Remove um objeto órfão do Storage — usado quando o cliente cancela o upload
 * após o PUT ter sido concluído mas antes de registrar o documento no banco.
 * Restringido ao prefixo do próprio usuário para evitar acesso cruzado.
 */
export const discardUploadedObject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        storage_path: z.string().min(1),
        case_id: z.string().uuid().optional(),
        filename: z.string().max(300).optional(),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.storage_path.startsWith(`${context.userId}/`)) {
      throw new Error("Caminho inválido");
    }
    await context.supabase.storage
      .from("documents")
      .remove([data.storage_path])
      .catch(() => {});
    if (data.case_id) {
      await logAudit(context.supabase, context.userId, {
        case_id: data.case_id,
        action: "discarded",
        filename: data.filename ?? null,
        reason: data.reason ?? "Envio cancelado pelo usuário",
        metadata: { storage_path: data.storage_path },
      });
    }
    return { ok: true as const };
  });

export type RegisterDuplicate = {
  duplicate: true;
  reason: "filename" | "content_hash";
  existing_id: string;
  existing_filename: string;
};

export const registerDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UploadSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Duplicata por content_hash
    if (data.content_hash) {
      const { data: byHash } = await context.supabase
        .from("documents")
        .select("id, filename")
        .eq("user_id", context.userId)
        .eq("case_id", data.case_id)
        .eq("content_hash", data.content_hash)
        .maybeSingle();
      if (byHash) {
        // limpa o arquivo recém enviado, já temos um igual
        await context.supabase.storage
          .from("documents")
          .remove([data.storage_path])
          .catch(() => {});
        await logAudit(context.supabase, context.userId, {
          case_id: data.case_id,
          action: "duplicate_ignored",
          document_id: byHash.id as string,
          filename: data.filename,
          content_hash: data.content_hash,
          reason: "Hash idêntico ao arquivo já existente",
          metadata: { existing_filename: byHash.filename },
        });
        return {
          duplicate: true as const,
          reason: "content_hash" as const,
          existing_id: byHash.id as string,
          existing_filename: byHash.filename as string,
        };
      }
    }
    // Duplicata por nome
    const { data: byName } = await context.supabase
      .from("documents")
      .select("id, filename")
      .eq("user_id", context.userId)
      .eq("case_id", data.case_id)
      .eq("filename", data.filename)
      .maybeSingle();
    if (byName) {
      await context.supabase.storage
        .from("documents")
        .remove([data.storage_path])
        .catch(() => {});
      await logAudit(context.supabase, context.userId, {
        case_id: data.case_id,
        action: "duplicate_ignored",
        document_id: byName.id as string,
        filename: data.filename,
        content_hash: data.content_hash,
        reason: "Já existe um arquivo com esse nome",
        metadata: { existing_filename: byName.filename },
      });
      return {
        duplicate: true as const,
        reason: "filename" as const,
        existing_id: byName.id as string,
        existing_filename: byName.filename as string,
      };
    }

    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        case_id: data.case_id,
        user_id: context.userId,
        filename: data.filename,
        file_type: data.file_type,
        file_size: data.file_size,
        storage_path: data.storage_path,
        extracted_text: data.extracted_text,
        content_hash: data.content_hash,
        processing_status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    await logAudit(context.supabase, context.userId, {
      case_id: data.case_id,
      action: data.replaces_document_id ? "replaced" : "uploaded",
      document_id: (row as { id: string }).id,
      filename: data.filename,
      content_hash: data.content_hash,
      reason:
        data.reason ??
        (data.replaces_document_id
          ? "Substituição de arquivo existente"
          : null),
      metadata: {
        file_size: data.file_size,
        file_type: data.file_type,
        replaces_document_id: data.replaces_document_id ?? null,
      },
    });
    return { duplicate: false as const, document: row };
  });

/**
 * Anexa um documento já existente (de outro caso) ao caso alvo.
 * Reaproveita o mesmo `storage_path` para evitar duplicar bytes.
 * Rejeita se um documento com o mesmo hash/nome já existir no caso alvo.
 */
export const attachExistingDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        source_document_id: z.string().uuid(),
        case_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: src, error: srcErr } = await context.supabase
      .from("documents")
      .select(
        "id, filename, file_type, file_size, storage_path, extracted_text, content_hash",
      )
      .eq("id", data.source_document_id)
      .eq("user_id", context.userId)
      .single();
    if (srcErr || !src) throw new Error("Documento de origem não encontrado");

    // duplicata por hash
    if (src.content_hash) {
      const { data: byHash } = await context.supabase
        .from("documents")
        .select("id, filename")
        .eq("user_id", context.userId)
        .eq("case_id", data.case_id)
        .eq("content_hash", src.content_hash)
        .maybeSingle();
      if (byHash) {
        await logAudit(context.supabase, context.userId, {
          case_id: data.case_id,
          action: "duplicate_ignored",
          document_id: byHash.id as string,
          filename: src.filename as string,
          content_hash: src.content_hash,
          reason: "Importação ignorada — hash idêntico",
          metadata: { existing_filename: byHash.filename },
        });
        return {
          duplicate: true as const,
          reason: "content_hash" as const,
          existing_id: byHash.id as string,
          existing_filename: byHash.filename as string,
        };
      }
    }
    // duplicata por nome
    const { data: byName } = await context.supabase
      .from("documents")
      .select("id, filename")
      .eq("user_id", context.userId)
      .eq("case_id", data.case_id)
      .eq("filename", src.filename as string)
      .maybeSingle();
    if (byName) {
      await logAudit(context.supabase, context.userId, {
        case_id: data.case_id,
        action: "duplicate_ignored",
        document_id: byName.id as string,
        filename: src.filename as string,
        reason: "Importação ignorada — nome já existente",
        metadata: { existing_filename: byName.filename },
      });
      return {
        duplicate: true as const,
        reason: "filename" as const,
        existing_id: byName.id as string,
        existing_filename: byName.filename as string,
      };
    }

    const { data: row, error } = await context.supabase
      .from("documents")
      .insert({
        case_id: data.case_id,
        user_id: context.userId,
        filename: src.filename,
        file_type: src.file_type,
        file_size: src.file_size,
        storage_path: src.storage_path,
        extracted_text: src.extracted_text,
        content_hash: src.content_hash,
        processing_status: "pending",
      })
      .select()
      .single();
    if (error) throw error;
    await logAudit(context.supabase, context.userId, {
      case_id: data.case_id,
      action: "imported",
      document_id: (row as { id: string }).id,
      filename: src.filename as string,
      content_hash: src.content_hash as string | null,
      reason: "Importado de outro caso",
      metadata: { source_document_id: data.source_document_id },
    });
    return { duplicate: false as const, document: row };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Buscar para apagar do storage — mas só se nenhum outro documento reusar o mesmo path
    const { data: doc } = await context.supabase
      .from("documents")
      .select("storage_path, case_id, filename, content_hash")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (doc?.storage_path) {
      const { count } = await context.supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("storage_path", doc.storage_path)
        .neq("id", data.id);
      if (!count || count === 0) {
        await context.supabase.storage.from("documents").remove([doc.storage_path]);
      }
    }
    // Chunks são apagados em cascata pela FK quando configurada; senão delete explícito:
    await context.supabase.from("document_chunks").delete().eq("document_id", data.id);
    const { error } = await context.supabase
      .from("documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    if (doc?.case_id) {
      await logAudit(context.supabase, context.userId, {
        case_id: doc.case_id as string,
        action: "deleted",
        document_id: data.id,
        filename: (doc.filename as string) ?? null,
        content_hash: (doc.content_hash as string) ?? null,
        reason: data.reason ?? null,
      });
    }
    return { ok: true };
  });

/**
 * Retorna os eventos de auditoria (importações, substituições, cancelamentos,
 * exclusões) de documentos vinculados ao caso, do mais recente para o mais
 * antigo, com o nome do usuário responsável quando disponível.
 */
export const listDocumentAuditEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ case_id: z.string().uuid(), limit: z.number().int().min(1).max(200).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("document_audit_events")
      .select(
        "id, action, reason, filename, content_hash, metadata, created_at, user_id, document_id, profiles:user_id(full_name)",
      )
      .eq("case_id", data.case_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw error;
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      action: r.action as AuditAction,
      reason: (r.reason as string | null) ?? null,
      filename: (r.filename as string | null) ?? null,
      content_hash: (r.content_hash as string | null) ?? null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      created_at: r.created_at as string,
      user_id: r.user_id as string,
      document_id: (r.document_id as string | null) ?? null,
      user_name:
        (r.profiles as { full_name?: string | null } | null)?.full_name ??
        null,
    }));
  });
