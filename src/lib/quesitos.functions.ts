import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/org-middleware";

const SourceEnum = z.enum(["juizo", "autor", "reu", "assistido", "outro"]);

export const listQuesitos = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("ai.use")])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("case_quesitos")
      .select("*")
      .eq("case_id", data.case_id)
      .eq("organization_id", context.organizationId)
      .order("source", { ascending: true })
      .order("number", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });

export const createQuesito = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("ai.use")])
  .inputValidator((i: unknown) =>
    z
      .object({
        case_id: z.string().uuid(),
        source: SourceEnum,
        number: z.number().int().positive().nullable().optional(),
        question: z.string().trim().min(1).max(4000),
        answer: z.string().max(8000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("case_quesitos")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        case_id: data.case_id,
        source: data.source,
        number: data.number ?? null,
        question: data.question,
        answer: data.answer ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateQuesito = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("ai.use")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        source: SourceEnum.optional(),
        number: z.number().int().positive().nullable().optional(),
        question: z.string().trim().min(1).max(4000).optional(),
        answer: z.string().max(8000).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("case_quesitos")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", context.organizationId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteQuesito = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("ai.use")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("case_quesitos")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    return { ok: true };
  });
