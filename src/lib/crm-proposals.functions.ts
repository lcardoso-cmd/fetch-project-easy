/**
 * Propostas comerciais como entidade principal (`public.proposals`).
 *
 * A proposta nasce de uma oportunidade (ou de um potencial cliente),
 * usa o mesmo editor/rascunhos/versões/anexos já existentes e mantém
 * rastreabilidade completa em `proposal_events`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg, requireOrgPermission } from "@/lib/org-middleware";
import { PROPOSAL_STATUSES } from "@/lib/crm-schema";
import type { OrgPermission } from "@/lib/org-permissions";

type Ctx = { supabase: any; userId: string; organizationId: string };

const PROPOSAL_COLUMNS =
  "id, number, title, status, opportunity_id, lead_id, case_id, converted_case_id, content_html, form, fixed_value_cents, recurring_value_cents, success_fee_percent, currency, payment_terms, commercial_notes, valid_until, owner_user_id, approved_at, approved_by_user_id, sent_at, first_viewed_at, last_viewed_at, view_count, responded_at, response_name, response_email, response_comment, decline_reason, created_by_user_id, created_at, updated_at";

async function hasPerm(ctx: Ctx, permission: OrgPermission): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_org_permission", {
    _organization_id: ctx.organizationId,
    _user_id: ctx.userId,
    _permission: permission,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

async function logEvent(
  ctx: Ctx,
  proposalId: string,
  kind: string,
  metadata: Record<string, unknown> = {},
  actorLabel?: string,
): Promise<void> {
  await ctx.supabase.from("proposal_events").insert({
    organization_id: ctx.organizationId,
    proposal_id: proposalId,
    kind,
    actor_user_id: ctx.userId,
    actor_label: actorLabel ?? null,
    metadata,
  });
  await ctx.supabase.from("organization_audit_log").insert({
    organization_id: ctx.organizationId,
    actor_user_id: ctx.userId,
    action: `crm.proposal.${kind}`,
    metadata: { proposal_id: proposalId, ...metadata },
  });
}

async function loadOwn(ctx: Ctx, id: string) {
  const { data, error } = await ctx.supabase
    .from("proposals")
    .select("id, owner_user_id, status, opportunity_id, converted_case_id, title, number")
    .eq("organization_id", ctx.organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Proposta não encontrada.");
  if (!(await hasPerm(ctx, "crm.manage_all"))) {
    const own = data.owner_user_id === null || data.owner_user_id === ctx.userId;
    if (!own) throw new Error("Forbidden: você não pode alterar esta proposta.");
  }
  return data;
}

const ValuesInput = {
  fixed_value_cents: z.number().int().min(0).max(10_000_000_000).default(0),
  recurring_value_cents: z.number().int().min(0).max(10_000_000_000).default(0),
  success_fee_percent: z.number().min(0).max(100).optional().nullable(),
  currency: z.string().trim().length(3).default("BRL"),
  payment_terms: z.string().trim().max(2000).optional().nullable(),
  commercial_notes: z.string().trim().max(5000).optional().nullable(),
  valid_until: z.string().trim().max(20).optional().nullable(),
};

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        status: z.enum([...PROPOSAL_STATUSES, "all"]).default("all"),
        opportunity_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    let q = ctx.supabase
      .from("proposals")
      .select(PROPOSAL_COLUMNS, { count: "exact" })
      .eq("organization_id", ctx.organizationId);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.opportunity_id) q = q.eq("opportunity_id", data.opportunity_id);
    if (data.search) {
      const term = data.search.replace(/[%,]/g, " ").trim();
      q = q.ilike("title", `%${term}%`);
    }
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const getProposal = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("crm.view")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const [proposal, events, versions, shares, attachments] = await Promise.all([
      ctx.supabase
        .from("proposals")
        .select(PROPOSAL_COLUMNS)
        .eq("organization_id", ctx.organizationId)
        .eq("id", data.id)
        .maybeSingle(),
      ctx.supabase
        .from("proposal_events")
        .select("id, kind, actor_user_id, actor_label, metadata, created_at")
        .eq("organization_id", ctx.organizationId)
        .eq("proposal_id", data.id)
        .order("created_at", { ascending: false })
        .limit(200),
      ctx.supabase
        .from("proposal_versions")
        .select("id, label, description, origin, pinned, created_at, created_by_user_id")
        .eq("organization_id", ctx.organizationId)
        .eq("proposal_id", data.id)
        .order("created_at", { ascending: false }),
      ctx.supabase
        .from("proposal_shares")
        .select(
          "id, token, title, client_name, download_count, max_downloads, expires_at, revoked_at, last_accessed_at, created_at",
        )
        .eq("organization_id", ctx.organizationId)
        .eq("proposal_id", data.id)
        .order("created_at", { ascending: false }),
      ctx.supabase
        .from("proposal_attachments")
        .select("id, filename, file_type, file_size, created_at")
        .eq("organization_id", ctx.organizationId)
        .eq("proposal_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (proposal.error) throw new Error(proposal.error.message);
    if (!proposal.data) throw new Error("Proposta não encontrada.");
    for (const r of [events, versions, shares, attachments]) {
      if ((r as any).error) throw new Error((r as any).error.message);
    }
    return {
      proposal: proposal.data,
      events: events.data ?? [],
      versions: versions.data ?? [],
      shares: shares.data ?? [],
      attachments: attachments.data ?? [],
    };
  });

export const createProposal = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.proposals_create")])
  .inputValidator((i: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(240),
        opportunity_id: z.string().uuid().optional().nullable(),
        lead_id: z.string().uuid().optional().nullable(),
        case_id: z.string().uuid().optional().nullable(),
        content_html: z.string().max(500_000).default(""),
        form: z.record(z.string(), z.unknown()).default({}),
        ...ValuesInput,
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: row, error } = await ctx.supabase
      .from("proposals")
      .insert({
        ...data,
        organization_id: ctx.organizationId,
        created_by_user_id: ctx.userId,
        owner_user_id: ctx.userId,
        status: "draft",
      })
      .select(PROPOSAL_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    await logEvent(ctx, row.id, "created", { number: row.number });
    if (data.opportunity_id) {
      await ctx.supabase
        .from("crm_opportunities")
        .update({ proposal_id: row.id })
        .eq("organization_id", ctx.organizationId)
        .eq("id", data.opportunity_id)
        .is("proposal_id", null);
    }
    return row;
  });

/** Autosave do editor: grava conteúdo/valores sem criar novas versões. */
export const updateProposal = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.proposals_create")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(3).max(240).optional(),
        content_html: z.string().max(500_000).optional(),
        form: z.record(z.string(), z.unknown()).optional(),
        fixed_value_cents: z.number().int().min(0).max(10_000_000_000).optional(),
        recurring_value_cents: z.number().int().min(0).max(10_000_000_000).optional(),
        success_fee_percent: z.number().min(0).max(100).optional().nullable(),
        payment_terms: z.string().trim().max(2000).optional().nullable(),
        commercial_notes: z.string().trim().max(5000).optional().nullable(),
        valid_until: z.string().trim().max(20).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const current = await loadOwn(ctx, data.id);
    if (["accepted", "declined", "canceled"].includes(current.status)) {
      throw new Error("Esta proposta já foi encerrada e não pode ser editada.");
    }
    const { id, ...patch } = data;
    const { data: row, error } = await ctx.supabase
      .from("proposals")
      .update(patch)
      .eq("organization_id", ctx.organizationId)
      .eq("id", id)
      .select(PROPOSAL_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setProposalStatus = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.proposals_create")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "in_review", "negotiating", "canceled"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await loadOwn(ctx, data.id);
    const { error } = await ctx.supabase
      .from("proposals")
      .update({ status: data.status })
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logEvent(ctx, data.id, "status_changed", { status: data.status });
    return { ok: true };
  });

export const approveProposal = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.proposals_approve")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: row, error } = await ctx.supabase
      .from("proposals")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_user_id: ctx.userId,
      })
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id)
      .in("status", ["draft", "in_review"])
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Apenas propostas em rascunho ou revisão podem ser aprovadas.");
    await logEvent(ctx, data.id, "approved", {});
    return row;
  });

/** Registro manual de aceite/recusa quando a resposta chega fora do link. */
export const recordProposalOutcome = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.record_outcome")])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        outcome: z.enum(["accepted", "declined"]),
        comment: z.string().trim().max(2000).optional().nullable(),
        decline_reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const current = await loadOwn(ctx, data.id);
    if (["accepted", "declined", "canceled"].includes(current.status)) {
      return { ok: true, already: true, status: current.status };
    }
    if (data.outcome === "declined" && !(data.decline_reason ?? "").trim()) {
      throw new Error("Informe o motivo da recusa.");
    }
    const { error } = await ctx.supabase
      .from("proposals")
      .update({
        status: data.outcome,
        responded_at: new Date().toISOString(),
        response_comment: data.comment ?? null,
        decline_reason: data.outcome === "declined" ? data.decline_reason : null,
      })
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (current.opportunity_id) {
      const stage = data.outcome === "accepted" ? "won" : "lost";
      await ctx.supabase
        .from("crm_opportunities")
        .update({
          stage,
          stage_changed_at: new Date().toISOString(),
          stage_changed_by_user_id: ctx.userId,
          lost_reason: data.outcome === "declined" ? (data.decline_reason ?? null) : null,
        })
        .eq("organization_id", ctx.organizationId)
        .eq("id", current.opportunity_id);
      await ctx.supabase.from("crm_stage_history").insert({
        organization_id: ctx.organizationId,
        opportunity_id: current.opportunity_id,
        from_stage: null,
        to_stage: stage,
        note:
          data.outcome === "accepted"
            ? "Proposta aceita pelo cliente"
            : `Proposta recusada: ${data.decline_reason ?? ""}`.trim(),
        created_by_user_id: ctx.userId,
      });
    }
    await logEvent(ctx, data.id, data.outcome, { manual: true });
    return { ok: true, already: false, status: data.outcome };
  });

/** Converte a oportunidade/proposta ganha em caso — uma única vez. */
export const convertProposalToCase = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("crm.convert")])
  .inputValidator((i: unknown) =>
    z
      .object({
        proposal_id: z.string().uuid(),
        case_title: z.string().trim().min(3).max(240).optional(),
        client_name: z.string().trim().max(200).optional().nullable(),
        opposing_party: z.string().trim().max(200).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: proposal, error: pErr } = await ctx.supabase
      .from("proposals")
      .select("id, title, status, opportunity_id, lead_id, converted_case_id, owner_user_id")
      .eq("organization_id", ctx.organizationId)
      .eq("id", data.proposal_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!proposal) throw new Error("Proposta não encontrada.");
    if (proposal.converted_case_id) {
      return { case_id: proposal.converted_case_id as string, already: true };
    }
    if (proposal.status !== "accepted") {
      throw new Error("Somente propostas aceitas podem ser convertidas em caso.");
    }

    if (proposal.opportunity_id) {
      const { data: opp, error: oppErr } = await ctx.supabase
        .from("crm_opportunities")
        .select("converted_case_id")
        .eq("organization_id", ctx.organizationId)
        .eq("id", proposal.opportunity_id)
        .maybeSingle();
      if (oppErr) throw new Error(oppErr.message);
      if (opp?.converted_case_id) {
        await ctx.supabase
          .from("proposals")
          .update({ converted_case_id: opp.converted_case_id })
          .eq("organization_id", ctx.organizationId)
          .eq("id", proposal.id);
        return { case_id: opp.converted_case_id as string, already: true };
      }
    }

    let clientName = data.client_name ?? null;
    if (!clientName && proposal.lead_id) {
      const { data: lead } = await ctx.supabase
        .from("crm_leads")
        .select("name")
        .eq("organization_id", ctx.organizationId)
        .eq("id", proposal.lead_id)
        .maybeSingle();
      clientName = lead?.name ?? null;
    }

    const { data: newCase, error: caseErr } = await ctx.supabase
      .from("cases")
      .insert({
        organization_id: ctx.organizationId,
        created_by_user_id: ctx.userId,
        title: data.case_title ?? proposal.title,
        client_name: clientName,
        parties: data.opposing_party ? { opposing_party: data.opposing_party } : null,
        opportunity_id: proposal.opportunity_id ?? null,
        proposal_id: proposal.id,
        lead_id: proposal.lead_id ?? null,
      })
      .select("id, title")
      .single();
    if (caseErr) throw new Error(caseErr.message);

    await ctx.supabase
      .from("proposals")
      .update({ converted_case_id: newCase.id, case_id: newCase.id })
      .eq("organization_id", ctx.organizationId)
      .eq("id", proposal.id);

    if (proposal.opportunity_id) {
      await ctx.supabase
        .from("crm_opportunities")
        .update({ converted_case_id: newCase.id })
        .eq("organization_id", ctx.organizationId)
        .eq("id", proposal.opportunity_id);
      await ctx.supabase
        .from("crm_leads")
        .update({ status: "client" })
        .eq("organization_id", ctx.organizationId)
        .eq("id", proposal.lead_id ?? "00000000-0000-0000-0000-000000000000");
    }

    await logEvent(ctx, proposal.id, "converted", { case_id: newCase.id });
    return { case_id: newCase.id as string, already: false };
  });

export const listProposalEvents = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ proposal_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    const { data: rows, error } = await ctx.supabase
      .from("proposal_events")
      .select("id, kind, actor_user_id, actor_label, metadata, created_at")
      .eq("organization_id", ctx.organizationId)
      .eq("proposal_id", data.proposal_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
