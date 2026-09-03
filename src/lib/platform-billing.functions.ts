/**
 * Backoffice comercial e administrativo B2B (visão JurisMind).
 *
 * - Fonte da verdade de clientes: `organizations` (nunca `customer_accounts`).
 * - MRR/ARR sempre calculados a partir das assinaturas reais.
 * - Toda escrita exige equipe B2B e grava auditoria.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  billingEnvironmentSchema,
  billingIntervalSchema,
  commercialSettingsSchema,
  entitlementKeySchema,
  monthlyEquivalentCents,
} from "@/lib/billing-shared";
import { getStripeErrorMessage } from "@/lib/stripe.server";

async function lib() {
  return await import("@/lib/billing.server");
}

type Admin = Awaited<ReturnType<Awaited<ReturnType<typeof lib>>["getAdmin"]>>;

async function assertStaff(userId: string): Promise<Admin> {
  const B = await lib();
  const admin = await B.getAdmin();
  const { data, error } = await admin.rpc("is_platform_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito à equipe da plataforma B2B");
  return admin;
}

async function assertSuperAdmin(userId: string): Promise<Admin> {
  const B = await lib();
  const admin = await B.getAdmin();
  const { data, error } = await admin.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito ao super administrador");
  return admin;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

// ─────────────────────── KPIs comerciais ───────────────────────

export const getCommercialKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const now = Date.now();
    const cutoff30 = new Date(now - MONTH_MS).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [orgsRes, subsRes, invoicesRes, usageRes, activeUsersRes] = await Promise.all([
      admin
        .from("organizations")
        .select("id, status, created_at, trial_ends_at, trial_extension_days, cancelled_at, converted_at"),
      admin
        .from("organization_subscriptions")
        .select("organization_id, status, amount_cents, billing_interval, plan_id, currency"),
      admin
        .from("organization_invoices")
        .select("id, status, total_cents, due_date, organization_id"),
      admin.from("ai_usage_events").select("cost_usd").gte("created_at", monthStart),
      admin.from("ai_chat_messages").select("user_id").gte("created_at", cutoff30),
    ]);

    const orgs = (orgsRes.data ?? []) as Array<{
      id: string;
      status: string;
      created_at: string;
      trial_ends_at: string | null;
      trial_extension_days: number;
      cancelled_at: string | null;
      converted_at: string | null;
    }>;
    const subs = (subsRes.data ?? []) as Array<{
      organization_id: string;
      status: string;
      amount_cents: number;
      billing_interval: string;
    }>;
    const invoices = (invoicesRes.data ?? []) as Array<{
      status: string;
      total_cents: number;
      due_date: string | null;
    }>;

    const byStatus: Record<string, number> = {};
    let trialsEndingIn7 = 0;
    let newLast30 = 0;
    let churnedLast30 = 0;
    let convertedLast30 = 0;
    for (const o of orgs) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      if (new Date(o.created_at).getTime() >= now - MONTH_MS) newLast30 += 1;
      if (o.cancelled_at && new Date(o.cancelled_at).getTime() >= now - MONTH_MS) churnedLast30 += 1;
      if (o.converted_at && new Date(o.converted_at).getTime() >= now - MONTH_MS) convertedLast30 += 1;
      if (o.status === "trial" && o.trial_ends_at) {
        const end =
          new Date(o.trial_ends_at).getTime() + (o.trial_extension_days ?? 0) * 24 * 60 * 60 * 1000;
        if (end >= now && end <= now + 7 * 24 * 60 * 60 * 1000) trialsEndingIn7 += 1;
      }
    }

    let mrrCents = 0;
    let payingCustomers = 0;
    let delinquentCustomers = 0;
    for (const s of subs) {
      if (s.status === "active" || s.status === "past_due") {
        mrrCents += monthlyEquivalentCents(s.amount_cents, s.billing_interval);
        payingCustomers += 1;
        if (s.status === "past_due") delinquentCustomers += 1;
      }
    }

    let openInvoiceCents = 0;
    let overdueInvoiceCents = 0;
    for (const i of invoices) {
      if (i.status === "open" || i.status === "overdue") {
        openInvoiceCents += i.total_cents ?? 0;
        const overdue =
          i.status === "overdue" || (i.due_date && new Date(i.due_date).getTime() < now);
        if (overdue) overdueInvoiceCents += i.total_cents ?? 0;
      }
    }

    const aiCostMonthUsd = ((usageRes.data ?? []) as Array<{ cost_usd: number }>).reduce(
      (sum, r) => sum + Number(r.cost_usd ?? 0),
      0,
    );
    const activeUsersLast30 = new Set(
      ((activeUsersRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
    ).size;

    const settings = await B.getCommercialSettings(admin);

    return {
      customers: orgs.length,
      byStatus,
      newLast30,
      churnedLast30,
      convertedLast30,
      trialsEndingIn7,
      payingCustomers,
      delinquentCustomers,
      mrrCents,
      arrCents: mrrCents * 12,
      openInvoiceCents,
      overdueInvoiceCents,
      aiCostMonthUsd,
      activeUsersLast30,
      settings,
    };
  });

// ─────────────────────── Clientes (organizações) ───────────────────────

export type OrgListRow = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  status: string;
  billing_email: string | null;
  trial_ends_at: string | null;
  trial_extension_days: number;
  grace_until: string | null;
  created_at: string;
  converted_at: string | null;
  cancelled_at: string | null;
  plan_code: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  mrr_cents: number;
  active_members: number;
};

export const listOrganizations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      search: z.string().max(120).optional(),
      status: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
      plan_code: z.string().max(60).optional(),
      only_delinquent: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertStaff(context.userId);
    let q = admin
      .from("organizations")
      .select(
        "id, name, legal_name, tax_id, status, billing_email, trial_ends_at, trial_extension_days, grace_until, created_at, converted_at, cancelled_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`name.ilike.${s},legal_name.ilike.${s},billing_email.ilike.${s},tax_id.ilike.${s}`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    const [subsRes, membersRes] = await Promise.all([
      ids.length
        ? admin
            .from("organization_subscriptions")
            .select("organization_id, status, amount_cents, billing_interval, plans(code, name)")
            .in("organization_id", ids)
            .in("status", ["trialing", "active", "past_due", "suspended"])
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? admin
            .from("organization_memberships")
            .select("organization_id, status")
            .in("organization_id", ids)
            .eq("status", "active")
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const subByOrg = new Map<string, any>();
    for (const s of (subsRes.data ?? []) as any[]) {
      if (!subByOrg.has(s.organization_id)) subByOrg.set(s.organization_id, s);
    }
    const memberCount = new Map<string, number>();
    for (const m of (membersRes.data ?? []) as any[]) {
      memberCount.set(m.organization_id, (memberCount.get(m.organization_id) ?? 0) + 1);
    }

    let mapped: OrgListRow[] = (rows ?? []).map((r: any) => {
      const sub = subByOrg.get(r.id);
      return {
        ...r,
        plan_code: sub?.plans?.code ?? null,
        plan_name: sub?.plans?.name ?? null,
        subscription_status: sub?.status ?? null,
        mrr_cents: sub ? monthlyEquivalentCents(sub.amount_cents, sub.billing_interval) : 0,
        active_members: memberCount.get(r.id) ?? 0,
      };
    });
    if (data.plan_code) mapped = mapped.filter((r: { plan_code: string | null }) => r.plan_code === data.plan_code);
    if (data.only_delinquent)
      mapped = mapped.filter((r: { subscription_status: string | null }) => r.subscription_status === "past_due");

    return { total: count ?? mapped.length, rows: mapped };
  });

export const getOrganizationDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const snapshot = await B.getBillingSnapshot(admin, data.id);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [members, invoices, payments, events, usage, audit] = await Promise.all([
      admin
        .from("organization_memberships")
        .select("user_id, role, status, created_at, profiles(full_name, firm_name)")
        .eq("organization_id", data.id)
        .order("created_at", { ascending: true }),
      admin
        .from("organization_invoices")
        .select("*")
        .eq("organization_id", data.id)
        .order("issued_at", { ascending: false, nullsFirst: false })
        .limit(100),
      admin
        .from("organization_payments")
        .select("*")
        .eq("organization_id", data.id)
        .order("paid_at", { ascending: false })
        .limit(100),
      admin
        .from("subscription_events")
        .select("*")
        .eq("organization_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("ai_usage_events")
        .select("cost_usd, total_tokens")
        .eq("organization_id", data.id)
        .gte("created_at", monthStart),
      admin
        .from("organization_audit_log")
        .select("*")
        .eq("organization_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const usageRows = (usage.data ?? []) as Array<{ cost_usd: number; total_tokens: number }>;
    return {
      snapshot,
      members: ((members.data ?? []) as any[]).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        status: m.status,
        created_at: m.created_at,
        full_name: m.profiles?.full_name ?? null,
        firm_name: m.profiles?.firm_name ?? null,
      })),
      invoices: (invoices.data ?? []) as any[],
      payments: (payments.data ?? []) as any[],
      events: (events.data ?? []) as any[],
      audit: (audit.data ?? []) as any[],
      usageMonth: {
        costUsd: usageRows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
        tokens: usageRows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0),
        calls: usageRows.length,
      },
    };
  });

export const updateOrganizationCommercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(2).max(160).optional(),
      legal_name: z.string().max(200).nullable().optional(),
      tax_id: z.string().max(32).nullable().optional(),
      billing_email: z.string().email().nullable().optional(),
      primary_contact_name: z.string().max(160).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
      domain: z.string().max(120).nullable().optional(),
      address_line: z.string().max(200).nullable().optional(),
      address_city: z.string().max(120).nullable().optional(),
      address_state: z.string().max(60).nullable().optional(),
      address_postal_code: z.string().max(20).nullable().optional(),
      country: z.string().length(2).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const { id, ...patch } = data;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(clean).length === 0) return { ok: true as const };
    const { error } = await admin
      .from("organizations")
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await B.writePlatformAudit(admin, context.userId, "organization.update", {
      metadata: { organization_id: id, fields: Object.keys(clean) },
    });
    return { ok: true as const };
  });

export const setOrganizationLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      action: z.enum(["suspend", "reactivate", "cancel", "extend_trial"]),
      days: z.number().int().min(1).max(180).optional(),
      reason: z.string().max(500).optional(),
      environment: billingEnvironmentSchema.optional(),
    }),
  )
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const org = await B.getOrgBillingRow(admin, data.id);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };

    if (data.action === "suspend") {
      patch["status"] = "suspended";
      patch["suspended_at"] = now;
    } else if (data.action === "reactivate") {
      patch["status"] = "active";
      patch["suspended_at"] = null;
      patch["grace_until"] = null;
    } else if (data.action === "cancel") {
      patch["status"] = "cancelled";
      patch["cancelled_at"] = now;
    } else {
      if (!data.days) return { error: "Informe quantos dias de avaliação adicionar." };
      patch["trial_extension_days"] = (org.trial_extension_days ?? 0) + data.days;
      patch["status"] = org.status === "cancelled" ? "trial" : org.status;
    }

    const { error } = await admin.from("organizations").update(patch).eq("id", data.id);
    if (error) return { error: error.message };

    // Reflete no provedor quando existir assinatura recorrente.
    if (data.action === "cancel" && data.environment) {
      const { data: sub } = await admin
        .from("organization_subscriptions")
        .select("id, external_subscription_id")
        .eq("organization_id", data.id)
        .in("status", ["trialing", "active", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const external = (sub as { external_subscription_id: string | null } | null)
        ?.external_subscription_id;
      if (external) {
        try {
          const stripe = B.stripeClient(data.environment);
          await stripe.subscriptions.cancel(external);
        } catch (err) {
          return { error: getStripeErrorMessage(err) };
        }
      }
      await admin
        .from("organization_subscriptions")
        .update({ status: "cancelled", cancelled_at: now, updated_at: now })
        .eq("organization_id", data.id)
        .in("status", ["trialing", "active", "past_due"]);
    }

    if (data.action === "suspend") {
      await admin
        .from("organization_subscriptions")
        .update({ status: "suspended", updated_at: now })
        .eq("organization_id", data.id)
        .in("status", ["active", "past_due"]);
    }

    await B.writeSubscriptionEvent(admin, {
      organizationId: data.id,
      actorUserId: context.userId,
      event: `lifecycle.${data.action}`,
      fromStatus: org.status,
      toStatus: (patch["status"] as string) ?? org.status,
      reason: data.reason ?? null,
      metadata: { days: data.days ?? null },
    });
    await B.writePlatformAudit(admin, context.userId, `organization.${data.action}`, {
      metadata: { organization_id: data.id, reason: data.reason ?? null, days: data.days ?? null },
    });
    await B.sendBillingEmail(admin, {
      organizationId: data.id,
      event: `lifecycle.${data.action}`,
      recipient: org.billing_email,
      subject:
        data.action === "extend_trial"
          ? "Seu período de avaliação do JurisMind foi estendido"
          : "Atualização do seu contrato JurisMind",
      body:
        data.action === "extend_trial"
          ? `Adicionamos ${data.days} dias ao seu período de avaliação.`
          : `A situação do seu contrato foi alterada para: ${patch["status"]}.`,
    });
    return { ok: true };
  });

/** Assinatura manual (contrato fora do provedor de pagamento). */
export const setManualSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      organization_id: z.string().uuid(),
      plan_id: z.string().uuid(),
      interval: billingIntervalSchema,
      seats: z.number().int().min(1).max(1000).default(1),
      amount_cents: z.number().int().min(0).max(100_000_000),
      period_start: z.string().min(10),
      period_end: z.string().min(10),
      notes: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const now = new Date().toISOString();

    await admin
      .from("organization_subscriptions")
      .update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("organization_id", data.organization_id)
      .in("status", ["trialing", "active", "past_due"]);

    const { data: created, error } = await admin
      .from("organization_subscriptions")
      .insert({
        organization_id: data.organization_id,
        plan_id: data.plan_id,
        status: "active",
        seats: data.seats,
        billing_interval: data.interval,
        amount_cents: data.amount_cents,
        currency: "BRL",
        provider: "manual",
        current_period_start: new Date(data.period_start).toISOString(),
        current_period_end: new Date(data.period_end).toISOString(),
        started_at: now,
        notes: data.notes ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    await B.applySubscriptionStatusToOrganization(admin, data.organization_id, "active");
    await B.writeSubscriptionEvent(admin, {
      organizationId: data.organization_id,
      subscriptionId: (created as { id: string } | null)?.id ?? null,
      actorUserId: context.userId,
      event: "subscription.manual_assigned",
      toStatus: "active",
      toPlanId: data.plan_id,
      reason: data.notes ?? null,
      metadata: { interval: data.interval, amount_cents: data.amount_cents },
    });
    await B.writePlatformAudit(admin, context.userId, "subscription.manual_assigned", {
      metadata: { organization_id: data.organization_id, plan_id: data.plan_id },
    });
    return { ok: true as const };
  });

// ─────────────────────── Planos e limites ───────────────────────

export const listPlansAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const plans = await B.listPlanRows(admin, true);
    const { data: ents, error } = await admin.from("plan_entitlements").select("*");
    if (error) throw new Error(error.message);
    const { data: subs } = await admin
      .from("organization_subscriptions")
      .select("plan_id, status, amount_cents, billing_interval")
      .in("status", ["trialing", "active", "past_due"]);

    const byPlan = new Map<string, Record<string, unknown>>();
    for (const e of (ents ?? []) as Array<{ plan_id: string; key: string; value: unknown }>) {
      const cur = byPlan.get(e.plan_id) ?? {};
      cur[e.key] = e.value;
      byPlan.set(e.plan_id, cur);
    }
    const counts = new Map<string, { customers: number; mrr: number }>();
    for (const s of (subs ?? []) as any[]) {
      if (!s.plan_id) continue;
      const cur = counts.get(s.plan_id) ?? { customers: 0, mrr: 0 };
      cur.customers += 1;
      if (s.status !== "trialing") {
        cur.mrr += monthlyEquivalentCents(s.amount_cents, s.billing_interval);
      }
      counts.set(s.plan_id, cur);
    }

    return plans.map((p) => ({
      ...p,
      entitlements: (byPlan.get(p.id) ?? {}) as Record<string, string | number | boolean | null>,
      customers: counts.get(p.id)?.customers ?? 0,
      mrr_cents: counts.get(p.id)?.mrr ?? 0,
    }));
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid().optional(),
      code: z
        .string()
        .min(2)
        .max(40)
        .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
      name: z.string().min(2).max(120),
      description: z.string().max(400).nullable().optional(),
      monthly_price_cents: z.number().int().min(0).max(100_000_000),
      yearly_price_cents: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
      currency: z.enum(["BRL", "USD"]).default("BRL"),
      active: z.boolean().default(true),
      sort_order: z.number().int().min(0).max(999).default(10),
      provider_product_id: z.string().max(120).nullable().optional(),
      provider_monthly_price_id: z.string().max(120).nullable().optional(),
      provider_yearly_price_id: z.string().max(120).nullable().optional(),
      entitlements: z.record(entitlementKeySchema, z.union([z.number(), z.boolean(), z.string()])),
    }),
  )
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const { id, entitlements, ...planFields } = data;

    const { data: saved, error } = id
      ? await admin
          .from("plans")
          .update({ ...planFields, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select("id")
          .maybeSingle()
      : await admin.from("plans").insert(planFields).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    const planId = (saved as { id: string } | null)?.id;
    if (!planId) throw new Error("Não foi possível salvar o plano.");

    await admin.from("plan_entitlements").delete().eq("plan_id", planId);
    const rows = Object.entries(entitlements).map(([key, value]) => ({
      plan_id: planId,
      key,
      value,
    }));
    if (rows.length) {
      const ins = await admin.from("plan_entitlements").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }

    await B.writePlatformAudit(admin, context.userId, id ? "plan.update" : "plan.create", {
      metadata: { plan_id: planId, code: data.code },
    });
    return { ok: true as const, id: planId };
  });

export const archivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid(), archived: z.boolean() }))
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    if (data.archived) {
      const { count } = await admin
        .from("organization_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", data.id)
        .in("status", ["trialing", "active", "past_due"]);
      if ((count ?? 0) > 0) {
        return { error: `Existem ${count} assinaturas vigentes neste plano. Migre-as antes de arquivar.` };
      }
    }
    const { error } = await admin
      .from("plans")
      .update({
        archived_at: data.archived ? new Date().toISOString() : null,
        active: !data.archived,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) return { error: error.message };
    await B.writePlatformAudit(admin, context.userId, data.archived ? "plan.archive" : "plan.restore", {
      metadata: { plan_id: data.id },
    });
    return { ok: true };
  });

// ─────────────────────── Assinaturas / faturas / pagamentos ───────────────────────

export const listSubscriptionsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      status: z.enum(["trialing", "active", "past_due", "suspended", "cancelled"]).optional(),
      provider: z.enum(["stripe", "manual"]).optional(),
      limit: z.number().int().min(1).max(200).default(100),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertStaff(context.userId);
    let q = admin
      .from("organization_subscriptions")
      .select(
        "id, organization_id, status, provider, billing_interval, amount_cents, currency, seats, current_period_start, current_period_end, cancel_at_period_end, external_subscription_id, created_at, plans(code, name), organizations(name)",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.provider) q = q.eq("provider", data.provider);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      organization_id: r.organization_id,
      organization_name: r.organizations?.name ?? "—",
      plan_name: r.plans?.name ?? null,
      plan_code: r.plans?.code ?? null,
      status: r.status,
      provider: r.provider,
      billing_interval: r.billing_interval,
      amount_cents: r.amount_cents,
      currency: r.currency,
      seats: r.seats,
      current_period_start: r.current_period_start,
      current_period_end: r.current_period_end,
      cancel_at_period_end: r.cancel_at_period_end,
      external_subscription_id: r.external_subscription_id,
      mrr_cents: monthlyEquivalentCents(r.amount_cents, r.billing_interval),
      created_at: r.created_at,
    }));
  });

export const listInvoicesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      status: z.enum(["draft", "open", "paid", "void", "overdue"]).optional(),
      organization_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).default(100),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertStaff(context.userId);
    let q = admin
      .from("organization_invoices")
      .select(
        "id, organization_id, number, status, currency, total_cents, issued_at, due_date, paid_at, origin, hosted_url, pdf_url, organizations(name)",
      )
      .order("issued_at", { ascending: false, nullsFirst: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      organization_name: r.organizations?.name ?? "—",
    }));
  });

export const createManualInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      organization_id: z.string().uuid(),
      description: z.string().min(2).max(200),
      amount_cents: z.number().int().min(1).max(100_000_000),
      due_date: z.string().min(10),
      notes: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const org = await B.getOrgBillingRow(admin, data.organization_id);

    const { count } = await admin
      .from("organization_invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", data.organization_id);
    const number = `M-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: invoice, error } = await admin
      .from("organization_invoices")
      .insert({
        organization_id: data.organization_id,
        number,
        status: "open",
        origin: "manual",
        currency: "BRL",
        subtotal_cents: data.amount_cents,
        total_cents: data.amount_cents,
        issued_at: new Date().toISOString(),
        due_date: data.due_date,
        notes: data.notes ?? null,
        billing_email: org.billing_email,
        created_by_user_id: context.userId,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const invoiceId = (invoice as { id: string }).id;

    const item = await admin.from("organization_invoice_items").insert({
      invoice_id: invoiceId,
      description: data.description,
      quantity: 1,
      unit_price_cents: data.amount_cents,
      amount_cents: data.amount_cents,
    });
    if (item.error) throw new Error(item.error.message);

    await B.writePlatformAudit(admin, context.userId, "invoice.create_manual", {
      metadata: { organization_id: data.organization_id, invoice_id: invoiceId, number },
    });
    await B.sendBillingEmail(admin, {
      organizationId: data.organization_id,
      event: "invoice.created",
      recipient: org.billing_email,
      subject: `Nova fatura ${number} — JurisMind`,
      body: `Emitimos a fatura ${number} com vencimento em ${data.due_date}.`,
    });
    return { ok: true as const, id: invoiceId, number };
  });

export const updateInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["open", "paid", "void", "overdue"]),
      justification: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const now = new Date().toISOString();
    const { error } = await admin
      .from("organization_invoices")
      .update({
        status: data.status,
        paid_at: data.status === "paid" ? now : null,
        voided_at: data.status === "void" ? now : null,
        updated_at: now,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await B.writePlatformAudit(admin, context.userId, "invoice.status_change", {
      metadata: { invoice_id: data.id, status: data.status, justification: data.justification ?? null },
    });
    return { ok: true as const };
  });

export const listPaymentsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      status: z.enum(["pending", "succeeded", "failed", "refunded"]).optional(),
      organization_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).default(100),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertStaff(context.userId);
    let q = admin
      .from("organization_payments")
      .select(
        "id, organization_id, invoice_id, amount_cents, status, provider, method, method_summary, failure_reason, paid_at, reference, organizations(name)",
      )
      .order("paid_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.organization_id) q = q.eq("organization_id", data.organization_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      organization_name: r.organizations?.name ?? "—",
    }));
  });

export const recordManualPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      organization_id: z.string().uuid(),
      invoice_id: z.string().uuid().optional(),
      amount_cents: z.number().int().min(1).max(100_000_000),
      method: z.enum(["pix", "transferencia", "boleto", "cartao_externo", "outro"]),
      paid_at: z.string().min(10),
      reference: z.string().max(120).optional(),
      justification: z.string().min(3).max(500),
    }),
  )
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const { error } = await admin.from("organization_payments").insert({
      organization_id: data.organization_id,
      invoice_id: data.invoice_id ?? null,
      amount_cents: data.amount_cents,
      method: data.method,
      method_summary: data.method,
      provider: "manual",
      status: "succeeded",
      paid_at: new Date(data.paid_at).toISOString(),
      reference: data.reference ?? null,
      justification: data.justification,
      recorded_by_user_id: context.userId,
    });
    if (error) throw new Error(error.message);

    if (data.invoice_id) {
      await admin
        .from("organization_invoices")
        .update({ status: "paid", paid_at: new Date(data.paid_at).toISOString() })
        .eq("id", data.invoice_id);
    }
    await B.writePlatformAudit(admin, context.userId, "payment.record_manual", {
      metadata: {
        organization_id: data.organization_id,
        invoice_id: data.invoice_id ?? null,
        amount_cents: data.amount_cents,
        justification: data.justification,
      },
    });
    return { ok: true as const };
  });

// ─────────────────────── Consumo, eventos e configuração ───────────────────────

export const listUsageByOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ days: z.number().int().min(1).max(120).default(30) }))
  .handler(async ({ context, data }) => {
    const admin = await assertStaff(context.userId);
    const from = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const [usage, orgs] = await Promise.all([
      admin
        .from("ai_usage_events")
        .select("organization_id, cost_usd, total_tokens")
        .gte("created_at", from),
      admin.from("organizations").select("id, name"),
    ]);
    const names = new Map(
      ((orgs.data ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]),
    );
    const agg = new Map<string, { calls: number; tokens: number; costUsd: number }>();
    for (const row of (usage.data ?? []) as Array<{
      organization_id: string | null;
      cost_usd: number;
      total_tokens: number;
    }>) {
      const key = row.organization_id ?? "sem-organizacao";
      const cur = agg.get(key) ?? { calls: 0, tokens: 0, costUsd: 0 };
      cur.calls += 1;
      cur.tokens += Number(row.total_tokens ?? 0);
      cur.costUsd += Number(row.cost_usd ?? 0);
      agg.set(key, cur);
    }
    return [...agg.entries()]
      .map(([organization_id, v]) => ({
        organization_id,
        organization_name: names.get(organization_id) ?? "Sem organização",
        ...v,
      }))
      .sort((a, b) => b.costUsd - a.costUsd);
  });

export const listBillingWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
  .handler(async ({ context, data }) => {
    const admin = await assertStaff(context.userId);
    const { data: rows, error } = await admin
      .from("billing_webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const listBillingEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
  .handler(async ({ context, data }) => {
    const admin = await assertStaff(context.userId);
    const { data: rows, error } = await admin
      .from("billing_email_log")
      .select("*, organizations(name)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r) => ({
      ...r,
      organization_name: r.organizations?.name ?? "—",
    }));
  });

export const getCommercialSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    return await B.getCommercialSettings(admin);
  });

export const saveCommercialSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(commercialSettingsSchema)
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await assertSuperAdmin(context.userId);
    await B.saveCommercialSettings(admin, data);
    await B.writePlatformAudit(admin, context.userId, "commercial_settings.update", {
      metadata: { ...data },
    });
    return { ok: true as const };
  });

/** Reconcilia uma organização com o provedor (assinaturas, faturas e cobranças). */
export const reconcileOrganizationBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({ organization_id: z.string().uuid(), environment: billingEnvironmentSchema }),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; subscriptions: number; invoices: number } | { error: string }> => {
    const B = await lib();
    const admin = await assertStaff(context.userId);
    const org = await B.getOrgBillingRow(admin, data.organization_id);
    if (!org.billing_provider_customer_id) {
      return { error: "Este cliente ainda não tem cadastro no provedor de pagamento." };
    }
    try {
      const stripe = B.stripeClient(data.environment);
      const subs = await stripe.subscriptions.list({
        customer: org.billing_provider_customer_id,
        status: "all",
        limit: 100,
      });
      for (const sub of subs.data) {
        await B.syncSubscriptionFromProvider(admin, sub, data.environment);
      }
      const invoices = await stripe.invoices.list({
        customer: org.billing_provider_customer_id,
        limit: 100,
      });
      for (const inv of invoices.data) {
        await B.syncInvoiceFromProvider(admin, inv, data.environment);
      }
      await B.writePlatformAudit(admin, context.userId, "billing.reconcile", {
        metadata: {
          organization_id: data.organization_id,
          subscriptions: subs.data.length,
          invoices: invoices.data.length,
        },
      });
      return { ok: true, subscriptions: subs.data.length, invoices: invoices.data.length };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
