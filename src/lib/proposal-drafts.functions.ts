import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const optionalUuid = z.string().uuid().nullable().optional();

export interface ProposalDraft {
  id: string;
  case_id: string | null;
  form: Record<string, string>;
  output: string;
  updated_at: string;
}

export interface ProposalVersion {
  id: string;
  case_id: string | null;
  label: string;
  description: string | null;
  origin: "manual" | "auto-generate" | "auto-restore";
  pinned: boolean;
  form: Record<string, string>;
  output: string;
  created_at: string;
}

// ------------- Rascunhos -------------

export const getProposalDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ case_id: optionalUuid }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const caseId = data.case_id ?? null;
    let query = context.supabase
      .from("proposal_drafts")
      .select("id, case_id, form, output, updated_at")
      .eq("user_id", context.userId);
    query = caseId === null ? query.is("case_id", null) : query.eq("case_id", caseId);
    const { data: row, error } = await query.maybeSingle();
    if (error) throw error;
    return (row as ProposalDraft | null) ?? null;
  });

export const upsertProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        case_id: optionalUuid,
        form: z.record(z.string(), z.string()),
        output: z.string().max(500_000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const caseId = data.case_id ?? null;

    // Manual upsert: unique index uses COALESCE(case_id, sentinel) which onConflict
    // can't reference directly. Try update, fall back to insert.
    let existingQuery = context.supabase
      .from("proposal_drafts")
      .select("id")
      .eq("user_id", context.userId);
    existingQuery =
      caseId === null ? existingQuery.is("case_id", null) : existingQuery.eq("case_id", caseId);
    const { data: existing, error: selErr } = await existingQuery.maybeSingle();
    if (selErr) throw selErr;

    if (existing?.id) {
      const { error } = await context.supabase
        .from("proposal_drafts")
        .update({ form: data.form, output: data.output })
        .eq("id", existing.id)
        .eq("user_id", context.userId);
      if (error) throw error;
      return { ok: true, id: existing.id };
    }

    const { data: inserted, error } = await context.supabase
      .from("proposal_drafts")
      .insert({
        user_id: context.userId,
        case_id: caseId,
        form: data.form,
        output: data.output,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: inserted.id };
  });

export const deleteProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ case_id: optionalUuid }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const caseId = data.case_id ?? null;
    let q = context.supabase
      .from("proposal_drafts")
      .delete()
      .eq("user_id", context.userId);
    q = caseId === null ? q.is("case_id", null) : q.eq("case_id", caseId);
    const { error } = await q;
    if (error) throw error;
    return { ok: true };
  });

// ------------- Versões -------------

export const listProposalVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ case_id: optionalUuid }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const caseId = data.case_id ?? null;
    let q = context.supabase
      .from("proposal_versions")
      .select("id, case_id, label, description, origin, pinned, form, output, created_at")
      .eq("user_id", context.userId);
    q = caseId === null ? q.is("case_id", null) : q.eq("case_id", caseId);
    const { data: rows, error } = await q
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as ProposalVersion[];
  });

export const createProposalVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        case_id: optionalUuid,
        label: z.string().trim().min(1).max(200),
        description: z.string().max(2000).nullable().optional(),
        origin: z.enum(["manual", "auto-generate", "auto-restore"]),
        pinned: z.boolean().optional(),
        form: z.record(z.string(), z.string()),
        output: z.string().max(500_000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("proposal_versions")
      .insert({
        user_id: context.userId,
        case_id: data.case_id ?? null,
        label: data.label,
        description: data.description ?? null,
        origin: data.origin,
        pinned: data.pinned ?? false,
        form: data.form,
        output: data.output,
      })
      .select("id, case_id, label, description, origin, pinned, form, output, created_at")
      .single();
    if (error) throw error;
    return row as ProposalVersion;
  });

export const updateProposalVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(200).optional(),
        description: z.string().max(2000).nullable().optional(),
        pinned: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const patch: { label?: string; description?: string | null; pinned?: boolean } = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.description !== undefined) patch.description = data.description;
    if (data.pinned !== undefined) patch.pinned = data.pinned;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("proposal_versions")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteProposalVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("proposal_versions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
