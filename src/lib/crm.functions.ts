/**
 * Server Functions do módulo Comercial (CRM).
 *
 * Regras invioláveis:
 * - toda leitura/escrita é escopada pela organização ativa resolvida no
 *   servidor (`requireOrg*`); o cliente nunca envia `organization_id`;
 * - permissões são checadas por `requireOrgPermission` + RLS no banco;
 * - nada de dados simulados: tudo vem de tabelas reais.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg, requireOrgPermission } from "@/lib/org-middleware";
import {
  ACTIVITY_KINDS,
  ACTIVITY_STATUSES,
  CONFLICT_STATUSES,
  CRM_PRIORITIES,
  CRM_STAGES,
  LEAD_KINDS,
  LEAD_STATUSES,
  findDuplicateLeads,
  moveWithinOrder,
  summarizePipeline,
  validateStageChange,
  type CrmStage,
} from "@/lib/crm-schema";
import type { OrgPermission } from "@/lib/org-permissions";

type Ctx = {
  supabase: any;
  userId: string;
  organizationId: string;
};

async function hasPerm(ctx: Ctx, permission: OrgPermission): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_org_permission", {
    _organization_id: ctx.organizationId,
    _user_id: ctx.userId,
    _permission: permission,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

async function assertPerm(ctx: Ctx, permission: OrgPermission): Promise<void> {
  if (!(await hasPerm(ctx, permission))) {
    throw new Error(`Forbidden: permissão "${permission}" necessária`);
  }
}

async function audit(
  ctx: Ctx,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await ctx.supabase.from("organization_audit_log").insert({
    organization_id: ctx.organizationId,
    actor_user_id: ctx.userId,
    action,
    metadata,
  });
}

/** Confere se o usuário pode escrever no registro (próprio x todos). */
async function assertCanWrite(ctx: Ctx, ownerUserId: string | null): Promise<void> {
  if (await hasPerm(ctx, "crm.manage_all")) return;
  if (
    (await hasPerm(ctx, "crm.manage_own")) &&
    (ownerUserId === null || ownerUserId === ctx.userId)
  ) {
    return;
  }
  throw new Error("Forbidden: você não pode alterar este registro comercial.");
}

// ------------------------------------------------------------- acesso/UI

export type CrmAccess = {
  view: boolean;
  manageOwn: boolean;
  manageAll: boolean;
  viewAll: boolean;
  viewValues: boolean;
  proposalsCreate: boolean;
  proposalsApprove: boolean;
  proposalsShare: boolean;
  recordOutcome: boolean;
  convert: boolean;
  admin: boolean;
};

export const getCrmAccess = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .handler(async ({ context }): Promise<CrmAccess> => {
    const ctx = context as unknown as Ctx;
    const { data, error } = await ctx.supabase.rpc("org_effective_permissions", {
      _organization_id: ctx.organizationId,
      _user_id: ctx.userId,
    });
    if (error) throw new Error(error.message);
    const set = new Set<string>((data ?? []) as string[]);
    return {
      view: set.has("crm.view"),
      manageOwn: set.has("crm.manage_own"),
      manageAll: set.has("crm.manage_all"),
      viewAll: set.has("crm.view_all"),
      viewValues: set.has("crm.view_values"),
      proposalsCreate: set.has("crm.proposals_create"),
      proposalsApprove: set.has("crm.proposals_approve"),
      proposalsShare: set.has("crm.proposals_share"),
      recordOutcome: set.has("crm.record_outcome"),
      convert: set.has("crm.convert"),
      admin: set.has("crm.admin"),
    };
  });

// ------------------------------------------------------------ potenciais

const LEAD_COLUMNS =
  "id, kind, name, trade_name, document, document_digits, email, email_normalized, phone, phone_digits, whatsapp, city, state, address, source, status, owner_user_id, notes, last_interaction_at, created_at, updated_at";

const LeadInput = z.object({
  kind: z.enum(LEAD_KINDS),
  name: z.string().trim().min(2).max(200),
  trade_name: z.string().trim().max(200).optional().nullable(),
  document: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(60).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  source: z.string().trim().max(80).optional().nullable(),
  status: z.enum(LEAD_STATUSES).default("lead"),
  owner_user_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && v.trim() === "") out[k] = null;
  }
  return out as T;
}

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        status: z.enum([...LEAD_STATUSES, "all"]).optional(),
        kind: z.enum([...LEAD_KINDS, "all"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    let q = ctx.supabase
      .from("crm_leads")
      .select(LEAD_COLUMNS, { count: "exact" })
      .eq("organization_id", ctx.organizationId);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.search) {
      const term = data.search.replace(/[%,]/g, " ").trim();
      const digits = term.replace(/\D/g, "");
      const parts = [
        `name.ilike.%${term}%`,
        `trade_name.ilike.%${term}%`,
        `email_normalized.ilike.%${term.toLowerCase()}%`,
      ];
      if (digits) {
        parts.push(`document_digits.ilike.%${digits}%`, `phone_digits.ilike.%${digits}%`);
      }
      q = q.or(parts.join(","));
    }
    const { data: rows, error, count } = await q
      .order("updated_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getLead = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const [lead, contacts, opportunities] = await Promise.all([
      ctx.supabase
        .from("crm_leads")
        .select(LEAD_COLUMNS)
        .eq("organization_id", ctx.organizationId)
        .eq("id", data.id)
        .maybeSingle(),
      ctx.supabase
        .from("crm_contacts")
        .select(
          "id, lead_id, name, role_title, email, phone, whatsapp, is_primary, notes, created_at",
        )
        .eq("organization_id", ctx.organizationId)
        .eq("lead_id", data.id)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true }),
      ctx.supabase
        .from("crm_opportunities")
        .select(
          "id, title, stage, estimated_value_cents, currency, owner_user_id, expected_close_date, updated_at",
        )
        .eq("organization_id", ctx.organizationId)
        .eq("lead_id", data.id)
        .order("updated_at", { ascending: false }),
    ]);
    if (lead.error) throw new Error(lead.error.message);
    if (!lead.data) throw new Error("Potencial cliente não encontrado.");
    if (contacts.error) throw new Error(contacts.error.message);
    if (opportunities.error) throw new Error(opportunities.error.message);
    return {
      lead: lead.data,
      contacts: contacts.data ?? [],
      opportunities: opportunities.data ?? [],
    };
  });

/** Duplicidade por CPF/CNPJ, e-mail ou telefone — informativo, não bloqueia. */
export const checkLeadDuplicates = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        document: z.string().max(40).optional().nullable(),
        email: z.string().max(200).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        ignore_id: z.string().uuid().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const doc = (data.document ?? "").replace(/\D/g, "");
    const email = (data.email ?? "").trim().toLowerCase();
    const phone = (data.phone ?? "").replace(/\D/g, "");
    if (!doc && !email && !phone) return [];
    const filters: string[] = [];
    if (doc) filters.push(`document_digits.eq.${doc}`);
    if (email) filters.push(`email_normalized.eq.${email}`);
    if (phone) filters.push(`phone_digits.eq.${phone}`);
    const { data: rows, error } = await ctx.supabase
      .from("crm_leads")
      .select("id, name, document_digits, email_normalized, phone_digits")
      .eq("organization_id", ctx.organizationId)
      .or(filters.join(","))
      .limit(20);
    if (error) throw new Error(error.message);
    return findDuplicateLeads(
      { document: data.document, email: data.email, phone: data.phone },
      rows ?? [],
      data.ignore_id ?? undefined,
    );
  });

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => LeadInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertCanWrite(ctx, data.owner_user_id ?? ctx.userId);
    const { data: row, error } = await ctx.supabase
      .from("crm_leads")
      .insert({
        ...emptyToNull(data),
        organization_id: ctx.organizationId,
        created_by_user_id: ctx.userId,
        owner_user_id: data.owner_user_id ?? ctx.userId,
      })
      .select(LEAD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.lead.created", { lead_id: row.id, name: row.name });
    return row;
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    LeadInput.partial().extend({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { id, ...patch } = data;
    const { data: current, error: curErr } = await ctx.supabase
      .from("crm_leads")
      .select("id, owner_user_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    if (!current) throw new Error("Potencial cliente não encontrado.");
    await assertCanWrite(ctx, current.owner_user_id);
    const { data: row, error } = await ctx.supabase
      .from("crm_leads")
      .update(emptyToNull(patch))
      .eq("organization_id", ctx.organizationId)
      .eq("id", id)
      .select(LEAD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.lead.updated", { lead_id: id });
    return row;
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: current, error: curErr } = await ctx.supabase
      .from("crm_leads")
      .select("id, owner_user_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    if (!current) throw new Error("Potencial cliente não encontrado.");
    await assertCanWrite(ctx, current.owner_user_id);
    const { count, error: oppErr } = await ctx.supabase
      .from("crm_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("lead_id", data.id);
    if (oppErr) throw new Error(oppErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        "Existem oportunidades vinculadas. Marque o cadastro como inativo em vez de excluir.",
      );
    }
    const { error } = await ctx.supabase
      .from("crm_leads")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.lead.deleted", { lead_id: data.id });
    return { ok: true };
  });

// -------------------------------------------------------------- contatos

const ContactInput = z.object({
  lead_id: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  role_title: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  is_primary: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const upsertContact = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    ContactInput.extend({ id: z.string().uuid().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: lead, error: leadErr } = await ctx.supabase
      .from("crm_leads")
      .select("id, owner_user_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.lead_id)
      .maybeSingle();
    if (leadErr) throw new Error(leadErr.message);
    if (!lead) throw new Error("Potencial cliente não encontrado.");
    await assertCanWrite(ctx, lead.owner_user_id);

    const { id, ...rest } = data;
    const payload = {
      ...emptyToNull(rest),
      organization_id: ctx.organizationId,
      created_by_user_id: ctx.userId,
    };
    const query = id
      ? ctx.supabase
          .from("crm_contacts")
          .update(emptyToNull(rest))
          .eq("organization_id", ctx.organizationId)
          .eq("id", id)
      : ctx.supabase.from("crm_contacts").insert(payload);
    const { data: row, error } = await query
      .select("id, lead_id, name, role_title, email, phone, whatsapp, is_primary, notes")
      .single();
    if (error) throw new Error(error.message);
    if (data.is_primary) {
      await ctx.supabase
        .from("crm_contacts")
        .update({ is_primary: false })
        .eq("organization_id", ctx.organizationId)
        .eq("lead_id", data.lead_id)
        .neq("id", row.id);
    }
    await audit(ctx, id ? "crm.contact.updated" : "crm.contact.created", {
      contact_id: row.id,
      lead_id: data.lead_id,
    });
    return row;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { error } = await ctx.supabase
      .from("crm_contacts")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.contact.deleted", { contact_id: data.id });
    return { ok: true };
  });

// --------------------------------------------------------- oportunidades

const OPP_COLUMNS =
  "id, title, description, lead_id, contact_id, stage, stage_changed_at, priority, probability, estimated_value_cents, currency, expected_close_date, practice_area, source, owner_user_id, position, lost_reason, next_activity_at, archived_at, converted_case_id, proposal_id, created_by_user_id, created_at, updated_at";

const OpportunityInput = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(5000).optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  stage: z.enum(CRM_STAGES).default("new_contact"),
  priority: z.enum(CRM_PRIORITIES).default("medium"),
  probability: z.number().int().min(0).max(100).default(20),
  estimated_value_cents: z.number().int().min(0).max(10_000_000_000).default(0),
  currency: z.string().trim().length(3).default("BRL"),
  expected_close_date: z.string().trim().max(20).optional().nullable(),
  practice_area: z.string().trim().max(120).optional().nullable(),
  source: z.string().trim().max(80).optional().nullable(),
  owner_user_id: z.string().uuid().optional().nullable(),
  next_activity_at: z.string().trim().max(40).optional().nullable(),
});

export const listOpportunities = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        stage: z.enum([...CRM_STAGES, "all", "open"]).optional(),
        owner_user_id: z.string().uuid().optional(),
        practice_area: z.string().trim().max(120).optional(),
        source: z.string().trim().max(80).optional(),
        include_archived: z.boolean().default(false),
        limit: z.number().int().min(1).max(300).default(100),
        offset: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    let q = ctx.supabase
      .from("crm_opportunities")
      .select(OPP_COLUMNS, { count: "exact" })
      .eq("organization_id", ctx.organizationId);
    if (!data.include_archived) q = q.is("archived_at", null);
    if (data.stage === "open") q = q.not("stage", "in", "(won,lost)");
    else if (data.stage && data.stage !== "all") q = q.eq("stage", data.stage);
    if (data.owner_user_id) q = q.eq("owner_user_id", data.owner_user_id);
    if (data.practice_area) q = q.eq("practice_area", data.practice_area);
    if (data.source) q = q.eq("source", data.source);
    if (data.search) {
      const term = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
    }
    const { data: rows, error, count } = await q
      .order("stage", { ascending: true })
      .order("position", { ascending: true })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);

    const leadIds = [...new Set((rows ?? []).map((r: any) => r.lead_id).filter(Boolean))];
    let leads: any[] = [];
    if (leadIds.length > 0) {
      const res = await ctx.supabase
        .from("crm_leads")
        .select("id, name, kind, status")
        .eq("organization_id", ctx.organizationId)
        .in("id", leadIds);
      if (res.error) throw new Error(res.error.message);
      leads = res.data ?? [];
    }
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    return {
      rows: (rows ?? []).map((r: any) => ({ ...r, lead: leadMap.get(r.lead_id) ?? null })),
      total: count ?? 0,
    };
  });

export const getOpportunity = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const opp = await ctx.supabase
      .from("crm_opportunities")
      .select(OPP_COLUMNS)
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id)
      .maybeSingle();
    if (opp.error) throw new Error(opp.error.message);
    if (!opp.data) throw new Error("Oportunidade não encontrada.");

    const [lead, contacts, history, activities, conflict, proposals, tasks, events] =
      await Promise.all([
        opp.data.lead_id
          ? ctx.supabase
              .from("crm_leads")
              .select(LEAD_COLUMNS)
              .eq("organization_id", ctx.organizationId)
              .eq("id", opp.data.lead_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        opp.data.lead_id
          ? ctx.supabase
              .from("crm_contacts")
              .select("id, name, role_title, email, phone, is_primary")
              .eq("organization_id", ctx.organizationId)
              .eq("lead_id", opp.data.lead_id)
              .order("is_primary", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        ctx.supabase
          .from("crm_stage_history")
          .select("id, from_stage, to_stage, note, created_by_user_id, created_at")
          .eq("organization_id", ctx.organizationId)
          .eq("opportunity_id", data.id)
          .order("created_at", { ascending: false }),
        ctx.supabase
          .from("crm_activities")
          .select(
            "id, kind, title, description, activity_at, due_at, status, outcome, next_step, owner_user_id, task_id, event_id, created_at",
          )
          .eq("organization_id", ctx.organizationId)
          .eq("opportunity_id", data.id)
          .order("activity_at", { ascending: false }),
        ctx.supabase
          .from("crm_conflict_checks")
          .select(
            "id, status, terms, results, notes, decided_by_user_id, decided_at, created_at, updated_at",
          )
          .eq("organization_id", ctx.organizationId)
          .eq("opportunity_id", data.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        ctx.supabase
          .from("proposals")
          .select(
            "id, number, title, status, fixed_value_cents, recurring_value_cents, success_fee_percent, currency, valid_until, sent_at, first_viewed_at, view_count, responded_at, response_name, decline_reason, converted_case_id, created_at, updated_at",
          )
          .eq("organization_id", ctx.organizationId)
          .eq("opportunity_id", data.id)
          .order("created_at", { ascending: false }),
        ctx.supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, assigned_to_user_id")
          .eq("organization_id", ctx.organizationId)
          .eq("opportunity_id", data.id)
          .order("created_at", { ascending: false }),
        ctx.supabase
          .from("events")
          .select("id, title, event_type, starts_at, ends_at")
          .eq("organization_id", ctx.organizationId)
          .eq("opportunity_id", data.id)
          .order("starts_at", { ascending: true }),
      ]);

    for (const res of [lead, contacts, history, activities, conflict, proposals, tasks, events]) {
      if (res && (res as any).error) throw new Error((res as any).error.message);
    }
    return {
      opportunity: opp.data,
      lead: (lead as any).data ?? null,
      contacts: (contacts as any).data ?? [],
      history: (history as any).data ?? [],
      activities: (activities as any).data ?? [],
      conflict: (conflict as any).data ?? null,
      proposals: (proposals as any).data ?? [],
      tasks: (tasks as any).data ?? [],
      events: (events as any).data ?? [],
    };
  });

async function nextPosition(ctx: Ctx, stage: string): Promise<number> {
  const { data, error } = await ctx.supabase
    .from("crm_opportunities")
    .select("position")
    .eq("organization_id", ctx.organizationId)
    .eq("stage", stage)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.position ?? 0) + 1;
}

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => OpportunityInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const owner = data.owner_user_id ?? ctx.userId;
    await assertCanWrite(ctx, owner);
    if (data.estimated_value_cents > 0) await assertPerm(ctx, "crm.view_values");
    const position = await nextPosition(ctx, data.stage);
    const { data: row, error } = await ctx.supabase
      .from("crm_opportunities")
      .insert({
        ...emptyToNull(data),
        owner_user_id: owner,
        position,
        organization_id: ctx.organizationId,
        created_by_user_id: ctx.userId,
        stage_changed_by_user_id: ctx.userId,
      })
      .select(OPP_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    await ctx.supabase.from("crm_stage_history").insert({
      organization_id: ctx.organizationId,
      opportunity_id: row.id,
      from_stage: null,
      to_stage: row.stage,
      note: "Oportunidade criada",
      created_by_user_id: ctx.userId,
    });
    if (data.lead_id) {
      await ctx.supabase
        .from("crm_leads")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("organization_id", ctx.organizationId)
        .eq("id", data.lead_id);
    }
    await audit(ctx, "crm.opportunity.created", { opportunity_id: row.id });
    return row;
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    OpportunityInput.partial().omit({ stage: true }).extend({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { id, ...patch } = data;
    const { data: current, error: curErr } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, owner_user_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    if (!current) throw new Error("Oportunidade não encontrada.");
    await assertCanWrite(ctx, current.owner_user_id);
    if (patch.estimated_value_cents !== undefined) await assertPerm(ctx, "crm.view_values");
    const { data: row, error } = await ctx.supabase
      .from("crm_opportunities")
      .update(emptyToNull(patch))
      .eq("organization_id", ctx.organizationId)
      .eq("id", id)
      .select(OPP_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.opportunity.updated", { opportunity_id: id });
    return row;
  });

export const archiveOpportunity = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: current, error: curErr } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, owner_user_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    if (!current) throw new Error("Oportunidade não encontrada.");
    await assertCanWrite(ctx, current.owner_user_id);
    const { error } = await ctx.supabase
      .from("crm_opportunities")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, data.archived ? "crm.opportunity.archived" : "crm.opportunity.restored", {
      opportunity_id: data.id,
    });
    return { ok: true };
  });

/** Move a oportunidade de etapa aplicando as regras do pipeline. */
export const moveOpportunityStage = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        to_stage: z.enum(CRM_STAGES),
        note: z.string().trim().max(1000).optional().nullable(),
        lost_reason: z.string().trim().max(500).optional().nullable(),
        override_conflict: z.boolean().default(false),
        target_index: z.number().int().min(0).max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: current, error: curErr } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, stage, owner_user_id, lost_reason")
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id)
      .maybeSingle();
    if (curErr) throw new Error(curErr.message);
    if (!current) throw new Error("Oportunidade não encontrada.");
    await assertCanWrite(ctx, current.owner_user_id);

    if (data.to_stage === "won" || data.to_stage === "lost") {
      await assertPerm(ctx, "crm.record_outcome");
    }

    const conflict = await ctx.supabase
      .from("crm_conflict_checks")
      .select("status")
      .eq("organization_id", ctx.organizationId)
      .eq("opportunity_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conflict.error) throw new Error(conflict.error.message);

    const canOverride = await hasPerm(ctx, "crm.admin");
    const check = validateStageChange({
      toStage: data.to_stage,
      lostReason: data.lost_reason ?? current.lost_reason,
      conflictStatus: conflict.data?.status ?? null,
      overrideConflict: data.override_conflict,
      canOverride,
    });
    if (!check.ok) throw new Error(check.message);

    const position =
      data.target_index !== undefined
        ? data.target_index
        : await nextPosition(ctx, data.to_stage);

    const { error } = await ctx.supabase
      .from("crm_opportunities")
      .update({
        stage: data.to_stage,
        stage_changed_at: new Date().toISOString(),
        stage_changed_by_user_id: ctx.userId,
        position,
        lost_reason: data.to_stage === "lost" ? (data.lost_reason ?? current.lost_reason) : null,
      })
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await ctx.supabase.from("crm_stage_history").insert({
      organization_id: ctx.organizationId,
      opportunity_id: data.id,
      from_stage: current.stage,
      to_stage: data.to_stage,
      note: data.note ?? (data.to_stage === "lost" ? data.lost_reason : null) ?? null,
      created_by_user_id: ctx.userId,
    });
    await audit(ctx, "crm.opportunity.stage_changed", {
      opportunity_id: data.id,
      from: current.stage,
      to: data.to_stage,
      conflict_override: check.requiresAudit,
    });
    return { ok: true, conflict_override: check.requiresAudit };
  });

/** Reordena as oportunidades de uma etapa (Kanban comercial). */
export const reorderOpportunities = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        stage: z.enum(CRM_STAGES),
        id: z.string().uuid(),
        target_index: z.number().int().min(0).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: rows, error } = await ctx.supabase
      .from("crm_opportunities")
      .select("id, owner_user_id")
      .eq("organization_id", ctx.organizationId)
      .eq("stage", data.stage)
      .is("archived_at", null)
      .order("position", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.id as string);
    if (!ids.includes(data.id)) ids.push(data.id);
    const ordered = moveWithinOrder(ids, data.id, data.target_index);
    for (let i = 0; i < ordered.length; i++) {
      const { error: upErr } = await ctx.supabase
        .from("crm_opportunities")
        .update({ position: i + 1 })
        .eq("organization_id", ctx.organizationId)
        .eq("id", ordered[i]);
      if (upErr) throw new Error(upErr.message);
    }
    return { ok: true, order: ordered };
  });

// ---------------------------------------------------- verificação conflito

export const runConflictCheck = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        opportunity_id: z.string().uuid(),
        terms: z.array(z.string().trim().min(2).max(200)).min(1).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const results: {
      term: string;
      cases: { id: string; title: string; client_name: string | null }[];
      leads: { id: string; name: string }[];
    }[] = [];

    for (const term of data.terms) {
      const safe = term.replace(/[%,]/g, " ").trim();
      const [cases, leads] = await Promise.all([
        ctx.supabase
          .from("cases")
          .select("id, title, client_name, assisted_party_name, parties")
          .eq("organization_id", ctx.organizationId)
          .or(
            `title.ilike.%${safe}%,client_name.ilike.%${safe}%,assisted_party_name.ilike.%${safe}%`,
          )
          .limit(20),
        ctx.supabase
          .from("crm_leads")
          .select("id, name")
          .eq("organization_id", ctx.organizationId)
          .ilike("name", `%${safe}%`)
          .limit(20),
      ]);
      if (cases.error) throw new Error(cases.error.message);
      if (leads.error) throw new Error(leads.error.message);
      results.push({
        term,
        cases: cases.data ?? [],
        leads: leads.data ?? [],
      });
    }

    const { data: row, error } = await ctx.supabase
      .from("crm_conflict_checks")
      .insert({
        organization_id: ctx.organizationId,
        opportunity_id: data.opportunity_id,
        status: "in_review",
        terms: data.terms,
        results,
        created_by_user_id: ctx.userId,
      })
      .select("id, status, terms, results, notes, decided_by_user_id, decided_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.conflict.searched", {
      opportunity_id: data.opportunity_id,
      terms: data.terms,
    });
    return row;
  });

/** A decisão é sempre humana e fica registrada com autor e data. */
export const decideConflictCheck = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(CONFLICT_STATUSES),
        notes: z.string().trim().max(3000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    if (data.status === "cleared_with_note" && !(data.notes ?? "").trim()) {
      throw new Error("Descreva a ressalva para liberar com observação.");
    }
    const decided = ["cleared", "conflict", "cleared_with_note"].includes(data.status);
    const { data: row, error } = await ctx.supabase
      .from("crm_conflict_checks")
      .update({
        status: data.status,
        notes: data.notes ?? null,
        decided_by_user_id: decided ? ctx.userId : null,
        decided_at: decided ? new Date().toISOString() : null,
      })
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id)
      .select("id, opportunity_id, status, notes, decided_by_user_id, decided_at")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.conflict.decided", {
      conflict_check_id: row.id,
      opportunity_id: row.opportunity_id,
      status: row.status,
    });
    return row;
  });

// -------------------------------------------------------------- atividades

const ActivityInput = z.object({
  opportunity_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  kind: z.enum(ACTIVITY_KINDS),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(5000).optional().nullable(),
  activity_at: z.string().trim().max(40).optional().nullable(),
  due_at: z.string().trim().max(40).optional().nullable(),
  status: z.enum(ACTIVITY_STATUSES).default("open"),
  outcome: z.string().trim().max(2000).optional().nullable(),
  next_step: z.string().trim().max(500).optional().nullable(),
  owner_user_id: z.string().uuid().optional().nullable(),
  /** Cria também uma tarefa em Meu Trabalho vinculada à oportunidade. */
  create_task: z.boolean().default(false),
  /** Cria também um compromisso na agenda. */
  create_event: z.boolean().default(false),
});

export const listActivities = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        opportunity_id: z.string().uuid().optional(),
        lead_id: z.string().uuid().optional(),
        status: z.enum([...ACTIVITY_STATUSES, "all"]).default("all"),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    let q = ctx.supabase
      .from("crm_activities")
      .select(
        "id, opportunity_id, lead_id, kind, title, description, activity_at, due_at, status, outcome, next_step, owner_user_id, task_id, event_id, created_at",
        { count: "exact" },
      )
      .eq("organization_id", ctx.organizationId);
    if (data.opportunity_id) q = q.eq("opportunity_id", data.opportunity_id);
    if (data.lead_id) q = q.eq("lead_id", data.lead_id);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error, count } = await q
      .order("activity_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => ActivityInput.parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const owner = data.owner_user_id ?? ctx.userId;
    await assertCanWrite(ctx, owner);

    let taskId: string | null = null;
    let eventId: string | null = null;

    if (data.create_task) {
      const { data: task, error: taskErr } = await ctx.supabase
        .from("tasks")
        .insert({
          organization_id: ctx.organizationId,
          created_by_user_id: ctx.userId,
          opportunity_id: data.opportunity_id ?? null,
          title: data.title,
          description: data.description ?? null,
          status: "pending",
          priority: "medium",
          due_date: data.due_at ? data.due_at.slice(0, 10) : null,
          assigned_to_user_id: owner,
        })
        .select("id")
        .single();
      if (taskErr) throw new Error(taskErr.message);
      taskId = task.id;
    }

    if (data.create_event) {
      const startsAt = data.due_at ?? data.activity_at ?? new Date().toISOString();
      const { data: event, error: eventErr } = await ctx.supabase
        .from("events")
        .insert({
          organization_id: ctx.organizationId,
          created_by_user_id: ctx.userId,
          opportunity_id: data.opportunity_id ?? null,
          title: data.title,
          description: data.description ?? null,
          event_type: data.kind === "meeting" ? "meeting" : "other",
          starts_at: startsAt,
          ends_at: new Date(new Date(startsAt).getTime() + 3_600_000).toISOString(),
        })
        .select("id")
        .single();
      if (eventErr) throw new Error(eventErr.message);
      eventId = event.id;
    }

    const { create_task: _t, create_event: _e, ...rest } = data;
    const { data: row, error } = await ctx.supabase
      .from("crm_activities")
      .insert({
        ...emptyToNull(rest),
        activity_at: data.activity_at ?? new Date().toISOString(),
        owner_user_id: owner,
        organization_id: ctx.organizationId,
        created_by_user_id: ctx.userId,
        task_id: taskId,
        event_id: eventId,
      })
      .select(
        "id, opportunity_id, lead_id, kind, title, description, activity_at, due_at, status, outcome, next_step, owner_user_id, task_id, event_id, created_at",
      )
      .single();
    if (error) throw new Error(error.message);

    if (data.opportunity_id) {
      await ctx.supabase
        .from("crm_opportunities")
        .update({
          next_activity_at:
            data.status === "open" ? (data.due_at ?? data.activity_at ?? null) : null,
        })
        .eq("organization_id", ctx.organizationId)
        .eq("id", data.opportunity_id);
    }
    if (data.lead_id) {
      await ctx.supabase
        .from("crm_leads")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("organization_id", ctx.organizationId)
        .eq("id", data.lead_id);
    }
    await audit(ctx, "crm.activity.created", { activity_id: row.id, kind: row.kind });
    return row;
  });

export const updateActivity = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(ACTIVITY_STATUSES).optional(),
        outcome: z.string().trim().max(2000).optional().nullable(),
        next_step: z.string().trim().max(500).optional().nullable(),
        due_at: z.string().trim().max(40).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { id, ...patch } = data;
    const { data: row, error } = await ctx.supabase
      .from("crm_activities")
      .update(emptyToNull(patch))
      .eq("organization_id", ctx.organizationId)
      .eq("id", id)
      .select("id, opportunity_id, status, task_id")
      .single();
    if (error) throw new Error(error.message);
    if (patch.status === "done" && row.task_id) {
      await ctx.supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("organization_id", ctx.organizationId)
        .eq("id", row.task_id);
    }
    await audit(ctx, "crm.activity.updated", { activity_id: id, status: patch.status });
    return row;
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { error } = await ctx.supabase
      .from("crm_activities")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.activity.deleted", { activity_id: data.id });
    return { ok: true };
  });

// -------------------------------------------------- painel e relatórios

export const getCrmOverview = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: z.string().trim().max(40).optional(),
        to: z.string().trim().max(40).optional(),
        owner_user_id: z.string().uuid().optional(),
        practice_area: z.string().trim().max(120).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    let q = ctx.supabase
      .from("crm_opportunities")
      .select(
        "id, stage, estimated_value_cents, owner_user_id, source, practice_area, next_activity_at, created_at, expected_close_date",
      )
      .eq("organization_id", ctx.organizationId)
      .is("archived_at", null);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.owner_user_id) q = q.eq("owner_user_id", data.owner_user_id);
    if (data.practice_area) q = q.eq("practice_area", data.practice_area);
    const { data: opps, error } = await q.limit(2000);
    if (error) throw new Error(error.message);

    const [leads, proposals, activities] = await Promise.all([
      ctx.supabase
        .from("crm_leads")
        .select("id, status, created_at")
        .eq("organization_id", ctx.organizationId)
        .limit(2000),
      ctx.supabase
        .from("proposals")
        .select(
          "id, status, fixed_value_cents, recurring_value_cents, sent_at, responded_at, created_at",
        )
        .eq("organization_id", ctx.organizationId)
        .limit(2000),
      ctx.supabase
        .from("crm_activities")
        .select("id, status, due_at")
        .eq("organization_id", ctx.organizationId)
        .eq("status", "open")
        .limit(2000),
    ]);
    if (leads.error) throw new Error(leads.error.message);
    if (proposals.error) throw new Error(proposals.error.message);
    if (activities.error) throw new Error(activities.error.message);

    const now = Date.now();
    const overdueActivities = (activities.data ?? []).filter(
      (a: any) => a.due_at && new Date(a.due_at).getTime() < now,
    ).length;

    const proposalRows = proposals.data ?? [];
    const summary = summarizePipeline((opps ?? []) as any);
    return {
      pipeline: summary,
      leads: {
        total: (leads.data ?? []).length,
        clients: (leads.data ?? []).filter((l: any) => l.status === "client").length,
      },
      proposals: {
        total: proposalRows.length,
        sent: proposalRows.filter((p: any) => !!p.sent_at).length,
        accepted: proposalRows.filter((p: any) => p.status === "accepted").length,
        declined: proposalRows.filter((p: any) => p.status === "declined").length,
        openValueCents: proposalRows
          .filter((p: any) => ["shared", "viewed", "negotiating"].includes(p.status))
          .reduce((acc: number, p: any) => acc + (p.fixed_value_cents ?? 0), 0),
      },
      activities: {
        open: (activities.data ?? []).length,
        overdue: overdueActivities,
      },
    };
  });

export const getCrmReport = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: z.string().trim().max(40).optional(),
        to: z.string().trim().max(40).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    let q = ctx.supabase
      .from("crm_opportunities")
      .select(
        "id, stage, estimated_value_cents, owner_user_id, source, practice_area, next_activity_at, stage_changed_at, created_at, lost_reason",
      )
      .eq("organization_id", ctx.organizationId)
      .is("archived_at", null);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q.limit(2000);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];

    const lossReasons = new Map<string, number>();
    for (const row of list) {
      if (row.stage !== "lost") continue;
      const reason = (row.lost_reason ?? "Não informado").trim() || "Não informado";
      lossReasons.set(reason, (lossReasons.get(reason) ?? 0) + 1);
    }

    return {
      pipeline: summarizePipeline(list as any),
      byOwner: groupRows(list, "owner_user_id"),
      bySource: groupRows(list, "source"),
      byPracticeArea: groupRows(list, "practice_area"),
      lossReasons: [...lossReasons.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

function groupRows(
  rows: any[],
  key: "owner_user_id" | "source" | "practice_area",
): { value: string; count: number; valueCents: number }[] {
  const map = new Map<string, { count: number; valueCents: number }>();
  for (const row of rows) {
    const value = row[key] && String(row[key]).trim() ? String(row[key]) : "__none__";
    const acc = map.get(value) ?? { count: 0, valueCents: 0 };
    acc.count += 1;
    acc.valueCents += row.estimated_value_cents ?? 0;
    map.set(value, acc);
  }
  return [...map.entries()]
    .map(([value, acc]) => ({ value, ...acc }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------- configurações

export const getCrmSettings = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    const { data, error } = await ctx.supabase
      .from("crm_settings")
      .select(
        "organization_id, sources, practice_areas, loss_reasons, default_currency, default_validity_days, proposal_prefix, required_fields, updated_at",
      )
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        organization_id: ctx.organizationId,
        sources: [] as string[],
        practice_areas: [] as string[],
        loss_reasons: [] as string[],
        default_currency: "BRL",
        default_validity_days: 15,
        proposal_prefix: "PROP",
        required_fields: {},
        updated_at: null,
      }
    );
  });

export const updateCrmSettings = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.admin")])
  .inputValidator((i: unknown) =>
    z
      .object({
        sources: z.array(z.string().trim().min(1).max(80)).max(50),
        practice_areas: z.array(z.string().trim().min(1).max(120)).max(50),
        loss_reasons: z.array(z.string().trim().min(1).max(120)).max(50),
        default_currency: z.string().trim().length(3).default("BRL"),
        default_validity_days: z.number().int().min(1).max(365),
        proposal_prefix: z.string().trim().min(1).max(12),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: row, error } = await ctx.supabase
      .from("crm_settings")
      .upsert(
        {
          ...data,
          organization_id: ctx.organizationId,
          updated_by_user_id: ctx.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      )
      .select(
        "organization_id, sources, practice_areas, loss_reasons, default_currency, default_validity_days, proposal_prefix, required_fields, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "crm.settings.updated", {});
    return row;
  });

export type CrmStageColumn = {
  stage: CrmStage;
  rows: any[];
};
