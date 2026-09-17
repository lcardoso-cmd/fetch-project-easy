import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg, requireOrgPermission } from "@/lib/org-middleware";

const nameSchema = z.string().trim().min(1).max(120).refine(
  (value) => value !== "." && value !== ".." && !/[\\/\0]/.test(value),
  "Nome de pasta inválido",
);

const pathSchema = z.string().max(1200).transform((value) =>
  value
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean),
).pipe(z.array(nameSchema).max(20));

export type DocumentFolder = {
  id: string;
  case_id: string | null;
  parent_folder_id: string | null;
  name: string;
  created_at: string;
};

async function assertFolderScope(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  organizationId: string,
  folderId: string,
  caseId?: string | null,
) {
  const { data: folder, error } = await supabase
    .from("document_folders")
    .select("id, case_id, parent_folder_id, name")
    .eq("id", folderId)
    .eq("organization_id", organizationId)
    .single();
  if (error || !folder) throw new Error("Pasta não encontrada");
  if (caseId !== undefined && folder.case_id !== caseId) {
    throw new Error("A pasta não pertence a este local");
  }
  return folder as { id: string; case_id: string | null; parent_folder_id: string | null; name: string };
}

async function audit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("document_folder_audit_events").insert(values);
  if (error) console.warn("[folder-audit]", error.message);
}

export const listDocumentFolders = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((input: unknown) => z.object({ case_id: z.string().uuid().nullable().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("document_folders")
      .select("id, case_id, parent_folder_id, name, created_at")
      .eq("organization_id", context.organizationId)
      .order("name");
    if (data.case_id === null) query = query.is("case_id", null);
    else if (data.case_id) query = query.eq("case_id", data.case_id);
    const { data: rows, error } = await query;
    if (error) throw error;
    return (rows ?? []) as DocumentFolder[];
  });

export const ensureDocumentFolderPath = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((input: unknown) => z.object({
    case_id: z.string().uuid().nullable(),
    path: pathSchema,
  }).parse(input))
  .handler(async ({ data, context }) => {
    let parentId: string | null = null;
    for (const name of data.path) {
      let query = context.supabase
        .from("document_folders")
        .select("id")
        .eq("organization_id", context.organizationId)
        .ilike("name", name);
      query = data.case_id ? query.eq("case_id", data.case_id) : query.is("case_id", null);
      query = parentId ? query.eq("parent_folder_id", parentId) : query.is("parent_folder_id", null);
      const { data: existing } = await query.maybeSingle();
      if (existing) {
        parentId = existing.id as string;
        continue;
      }
      const { data: created, error } = await context.supabase
        .from("document_folders")
        .insert({
          organization_id: context.organizationId,
          case_id: data.case_id,
          parent_folder_id: parentId,
          name,
          created_by_user_id: context.userId,
        })
        .select("id")
        .single();
      if (error || !created) throw error ?? new Error("Não foi possível criar a pasta");
      parentId = created.id as string;
      await audit(context.supabase, {
        organization_id: context.organizationId,
        case_id: data.case_id,
        folder_id: parentId,
        actor_user_id: context.userId,
        action: "created",
        new_values: { name, parent_folder_id: parentId },
      });
    }
    return { folder_id: parentId };
  });

export const createDocumentFolder = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((input: unknown) => z.object({
    case_id: z.string().uuid().nullable(),
    parent_folder_id: z.string().uuid().nullable().optional(),
    name: nameSchema,
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.parent_folder_id) {
      await assertFolderScope(context.supabase, context.organizationId, data.parent_folder_id, data.case_id);
    }
    const { data: folder, error } = await context.supabase.from("document_folders").insert({
      organization_id: context.organizationId,
      case_id: data.case_id,
      parent_folder_id: data.parent_folder_id ?? null,
      name: data.name,
      created_by_user_id: context.userId,
    }).select("id, case_id, parent_folder_id, name, created_at").single();
    if (error || !folder) throw error ?? new Error("Não foi possível criar a pasta");
    await audit(context.supabase, {
      organization_id: context.organizationId, case_id: data.case_id, folder_id: folder.id,
      actor_user_id: context.userId, action: "created", new_values: { name: data.name },
    });
    return folder as DocumentFolder;
  });

export const renameDocumentFolder = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), name: nameSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const current = await assertFolderScope(context.supabase, context.organizationId, data.id);
    const { error } = await context.supabase.from("document_folders").update({ name: data.name })
      .eq("id", data.id).eq("organization_id", context.organizationId);
    if (error) throw error;
    await audit(context.supabase, {
      organization_id: context.organizationId, case_id: current.case_id, folder_id: data.id,
      actor_user_id: context.userId, action: "renamed",
      previous_values: { name: current.name }, new_values: { name: data.name },
    });
    return { ok: true as const };
  });

export const moveDocument = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((input: unknown) => z.object({ document_id: z.string().uuid(), folder_id: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: doc, error: docError } = await context.supabase.from("documents")
      .select("id, case_id, folder_id, filename").eq("id", data.document_id)
      .eq("organization_id", context.organizationId).single();
    if (docError || !doc) throw new Error("Documento não encontrado");
    if (data.folder_id) {
      const folder = await assertFolderScope(context.supabase, context.organizationId, data.folder_id);
      if (folder.case_id && folder.case_id !== doc.case_id) throw new Error("A pasta pertence a outro caso");
    }
    let update = context.supabase.from("documents").update({ folder_id: data.folder_id })
      .eq("organization_id", context.organizationId);
    update = doc.id ? update.or(`id.eq.${doc.id},split_group_id.eq.${doc.id}`) : update.eq("id", data.document_id);
    const { error } = await update;
    if (error) throw error;
    await audit(context.supabase, {
      organization_id: context.organizationId, case_id: doc.case_id, document_id: doc.id,
      folder_id: data.folder_id, actor_user_id: context.userId, action: "moved",
      previous_values: { folder_id: doc.folder_id }, new_values: { folder_id: data.folder_id },
    });
    return { ok: true as const };
  });

export const moveDocumentFolder = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), parent_folder_id: z.string().uuid().nullable() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.id === data.parent_folder_id) throw new Error("Uma pasta não pode conter a si mesma");
    const current = await assertFolderScope(context.supabase, context.organizationId, data.id);
    if (data.parent_folder_id) {
      await assertFolderScope(context.supabase, context.organizationId, data.parent_folder_id, current.case_id);
      const { data: descendants } = await context.supabase.rpc("document_folder_descendant_ids", { _folder_id: data.id });
      if ((descendants ?? []).some((row: { id: string }) => row.id === data.parent_folder_id)) {
        throw new Error("Não é possível mover uma pasta para dentro de uma subpasta dela");
      }
    }
    const { error } = await context.supabase.from("document_folders")
      .update({ parent_folder_id: data.parent_folder_id }).eq("id", data.id)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    await audit(context.supabase, {
      organization_id: context.organizationId, case_id: current.case_id, folder_id: data.id,
      actor_user_id: context.userId, action: "moved",
      previous_values: { parent_folder_id: current.parent_folder_id },
      new_values: { parent_folder_id: data.parent_folder_id },
    });
    return { ok: true as const };
  });

export const deleteDocumentFolder = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("documents.upload")])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const current = await assertFolderScope(context.supabase, context.organizationId, data.id);
    const { error: docsError } = await context.supabase.from("documents")
      .update({ folder_id: current.parent_folder_id }).eq("folder_id", data.id)
      .eq("organization_id", context.organizationId);
    if (docsError) throw docsError;
    const { error: childError } = await context.supabase.from("document_folders")
      .update({ parent_folder_id: current.parent_folder_id }).eq("parent_folder_id", data.id)
      .eq("organization_id", context.organizationId);
    if (childError) throw childError;
    const { error } = await context.supabase.from("document_folders").delete()
      .eq("id", data.id).eq("organization_id", context.organizationId);
    if (error) throw error;
    await audit(context.supabase, {
      organization_id: context.organizationId, case_id: current.case_id,
      actor_user_id: context.userId, action: "deleted",
      previous_values: { id: current.id, name: current.name, parent_folder_id: current.parent_folder_id },
    });
    return { ok: true as const };
  });