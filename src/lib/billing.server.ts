/**
 * Camada interna de cobrança (server-only).
 *
 * Regras:
 * - Nenhum dado comercial vem do cliente: organização, valores e planos são
 *   sempre resolvidos aqui a partir do banco ou do provedor de pagamento.
 * - `customer_accounts` é legado e NÃO é lido por nenhuma função deste arquivo.
 * - Toda gravação relevante gera histórico (`subscription_events`) e auditoria.
 */
import type Stripe from "stripe";
import {
  DEFAULT_COMMERCIAL_SETTINGS,
  commercialSettingsSchema,
  monthlyEquivalentCents,
  type BillingEnvironment,
  type BillingInterval,
  type CommercialSettings,
  type SubscriptionStatus,
} from "@/lib/billing-shared";
import { createStripeClient } from "@/lib/stripe.server";

export type Admin = {
  from: (table: string) => any;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ─────────────────────── Configuração comercial ───────────────────────

export async function getCommercialSettings(admin: Admin): Promise<CommercialSettings> {
  const { data, error } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "commercial")
    .maybeSingle();
  if (error) throw new Error(error.message);
  const parsed = commercialSettingsSchema.safeParse((data as any)?.value ?? {});
  return parsed.success ? parsed.data : DEFAULT_COMMERCIAL_SETTINGS;
}

export async function saveCommercialSettings(
  admin: Admin,
  settings: CommercialSettings,
): Promise<void> {
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "commercial", value: settings, updated_at: new Date().toISOString() }, {
      onConflict: "key",
    });
  if (error) throw new Error(error.message);
}

// ─────────────────────── Auditoria e histórico ───────────────────────

export async function writePlatformAudit(
  admin: Admin,
  actor: string,
  action: string,
  opts: {
    targetUserId?: string | null;
    targetCustomerId?: string | null;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await admin.from("platform_audit_log").insert({
    actor_user_id: actor,
    action,
    target_user_id: opts.targetUserId ?? null,
    target_customer_id: opts.targetCustomerId ?? null,
    metadata: opts.metadata ?? {},
  });
}

export async function writeSubscriptionEvent(
  admin: Admin,
  input: {
    organizationId: string;
    subscriptionId?: string | null;
    actorUserId?: string | null;
    event: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    fromPlanId?: string | null;
    toPlanId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from("subscription_events").insert({
    organization_id: input.organizationId,
    subscription_id: input.subscriptionId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event: input.event,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    from_plan_id: input.fromPlanId ?? null,
    to_plan_id: input.toPlanId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}

// ─────────────────────── E-mails comerciais ───────────────────────

/**
 * Envio desacoplado: se `RESEND_API_KEY` existir, envia; caso contrário
 * registra `skipped` com o motivo — nunca falha o fluxo de cobrança.
 */
export async function sendBillingEmail(
  admin: Admin,
  input: {
    organizationId: string | null;
    event: string;
    recipient: string | null;
    subject: string;
    body: string;
  },
): Promise<{ status: "sent" | "skipped" | "failed"; error?: string }> {
  if (!input.recipient) {
    await admin.from("billing_email_log").insert({
      organization_id: input.organizationId,
      event: input.event,
      recipient: "(sem destinatário)",
      status: "skipped",
      error: "Organização sem e-mail financeiro cadastrado",
    });
    return { status: "skipped", error: "sem destinatário" };
  }

  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["BILLING_EMAIL_FROM"] ?? "JurisMind <financeiro@b2bconsulting.com.br>";

  if (!apiKey) {
    await admin.from("billing_email_log").insert({
      organization_id: input.organizationId,
      event: input.event,
      recipient: input.recipient,
      status: "skipped",
      error: "RESEND_API_KEY não configurada",
    });
    return { status: "skipped", error: "RESEND_API_KEY não configurada" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject: input.subject,
        text: input.body,
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(payload.message ?? `HTTP ${res.status}`);
    await admin.from("billing_email_log").insert({
      organization_id: input.organizationId,
      event: input.event,
      recipient: input.recipient,
      status: "sent",
      provider_message_id: payload.id ?? null,
    });
    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    await admin.from("billing_email_log").insert({
      organization_id: input.organizationId,
      event: input.event,
      recipient: input.recipient,
      status: "failed",
      error: message,
    });
    return { status: "failed", error: message };
  }
}

// ─────────────────────── Planos ───────────────────────

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  currency: string;
  monthly_price_cents: number;
  yearly_price_cents: number | null;
  provider_product_id: string | null;
  provider_monthly_price_id: string | null;
  provider_yearly_price_id: string | null;
  active: boolean;
  archived_at: string | null;
  is_trial_default: boolean;
  description: string | null;
  sort_order: number;
};

export async function listPlanRows(admin: Admin, includeArchived = false): Promise<PlanRow[]> {
  let q = admin.from("plans").select("*").order("sort_order", { ascending: true });
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
}

export function planPriceLookupKey(plan: PlanRow, interval: BillingInterval): string | null {
  return interval === "year"
    ? plan.provider_yearly_price_id ?? null
    : plan.provider_monthly_price_id ?? null;
}

export function planAmountCents(plan: PlanRow, interval: BillingInterval): number {
  return interval === "year" ? plan.yearly_price_cents ?? 0 : plan.monthly_price_cents;
}

export async function findPlanByLookupKey(
  admin: Admin,
  lookupKey: string | null | undefined,
): Promise<{ plan: PlanRow; interval: BillingInterval } | null> {
  if (!lookupKey) return null;
  const plans = await listPlanRows(admin, true);
  for (const plan of plans) {
    if (plan.provider_monthly_price_id === lookupKey) return { plan, interval: "month" };
    if (plan.provider_yearly_price_id === lookupKey) return { plan, interval: "year" };
  }
  return null;
}

// ─────────────────────── Cliente no provedor ───────────────────────

export type OrgBillingRow = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  status: string;
  billing_email: string | null;
  billing_provider_customer_id: string | null;
  billing_environment: string;
  trial_ends_at: string | null;
  trial_extension_days: number;
  grace_until: string | null;
  created_by_user_id: string;
  primary_contact_name: string | null;
  phone: string | null;
  domain: string | null;
  address_line: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  country: string | null;
};

export async function getOrgBillingRow(admin: Admin, organizationId: string): Promise<OrgBillingRow> {
  const { data, error } = await admin
    .from("organizations")
    .select(
      "id, name, legal_name, tax_id, status, billing_email, billing_provider_customer_id, billing_environment, trial_ends_at, trial_extension_days, grace_until, created_by_user_id, primary_contact_name, phone, domain, address_line, address_city, address_state, address_postal_code, country",
    )
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organização não encontrada");
  return data as OrgBillingRow;
}

/** Garante um Customer no provedor com metadata.organizationId (pesquisável). */
export async function ensureProviderCustomer(
  admin: Admin,
  stripe: Stripe,
  org: OrgBillingRow,
  env: BillingEnvironment,
): Promise<string> {
  if (org.billing_provider_customer_id && org.billing_environment === env) {
    return org.billing_provider_customer_id;
  }

  const found = await stripe.customers.search({
    query: `metadata['organizationId']:'${org.id}'`,
    limit: 1,
  });
  let customerId = found.data[0]?.id;

  if (!customerId) {
    const created = await stripe.customers.create({
      name: org.legal_name || org.name,
      ...(org.billing_email ? { email: org.billing_email } : {}),
      metadata: { organizationId: org.id, taxId: org.tax_id ?? "" },
    });
    customerId = created.id;
  }

  const { error } = await admin
    .from("organizations")
    .update({ billing_provider_customer_id: customerId, billing_environment: env })
    .eq("id", org.id);
  if (error) throw new Error(error.message);
  return customerId;
}

// ─────────────────────── Sincronização de assinaturas ───────────────────────

export function mapProviderSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "paused":
      return "suspended";
    default:
      return "cancelled";
  }
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

export async function syncSubscriptionFromProvider(
  admin: Admin,
  subscription: any,
  env: BillingEnvironment,
): Promise<{ organizationId: string | null; status: SubscriptionStatus }> {
  const item = subscription.items?.data?.[0];
  const lookupKey: string | undefined =
    item?.price?.lookup_key ?? item?.price?.metadata?.lovable_external_id;
  const resolved = await findPlanByLookupKey(admin, lookupKey);

  const organizationId: string | null =
    subscription.metadata?.organizationId ??
    (await (async () => {
      const { data } = await admin
        .from("organizations")
        .select("id")
        .eq("billing_provider_customer_id", subscription.customer)
        .maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    })());

  const status = mapProviderSubscriptionStatus(subscription.status);
  if (!organizationId) return { organizationId: null, status };

  const existing = await admin
    .from("organization_subscriptions")
    .select("id, status, plan_id")
    .eq("external_subscription_id", subscription.id)
    .maybeSingle();
  const previous = existing.data as { id: string; status: string; plan_id: string } | null;

  const amountCents = item?.price?.unit_amount ?? 0;
  const interval: BillingInterval =
    item?.price?.recurring?.interval === "year" ? "year" : "month";

  const row = {
    organization_id: organizationId,
    plan_id: resolved?.plan.id ?? previous?.plan_id ?? null,
    status,
    seats: item?.quantity ?? 1,
    billing_interval: interval,
    amount_cents: amountCents,
    currency: (item?.price?.currency ?? "brl").toUpperCase(),
    provider: "stripe",
    environment: env,
    external_subscription_id: subscription.id,
    external_customer_id:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    external_price_id: lookupKey ?? item?.price?.id ?? null,
    current_period_start: isoFromUnix(item?.current_period_start ?? subscription.current_period_start),
    current_period_end: isoFromUnix(item?.current_period_end ?? subscription.current_period_end),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    cancel_effective_at: isoFromUnix(subscription.cancel_at),
    trial_end: isoFromUnix(subscription.trial_end),
    cancelled_at: status === "cancelled" ? isoFromUnix(subscription.canceled_at) ?? new Date().toISOString() : null,
    past_due_since: status === "past_due" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  if (!row.plan_id) delete (row as Record<string, unknown>).plan_id;

  const { data: saved, error } = await admin
    .from("organization_subscriptions")
    .upsert(row, { onConflict: "external_subscription_id" })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);

  await applySubscriptionStatusToOrganization(admin, organizationId, status, subscription);

  if (!previous || previous.status !== status || previous.plan_id !== row.plan_id) {
    await writeSubscriptionEvent(admin, {
      organizationId,
      subscriptionId: (saved as { id: string } | null)?.id ?? previous?.id ?? null,
      event: previous ? "provider.subscription_updated" : "provider.subscription_created",
      fromStatus: previous?.status ?? null,
      toStatus: status,
      fromPlanId: previous?.plan_id ?? null,
      toPlanId: (row as { plan_id?: string }).plan_id ?? null,
      metadata: { environment: env, external_subscription_id: subscription.id },
    });
  }

  return { organizationId, status };
}

/** Reflete a situação da assinatura no cadastro do escritório (trial/ativo/suspenso/cancelado). */
export async function applySubscriptionStatusToOrganization(
  admin: Admin,
  organizationId: string,
  status: SubscriptionStatus,
  subscription?: any,
): Promise<void> {
  const settings = await getCommercialSettings(admin);
  const patch: Record<string, unknown> = {};

  if (status === "active" || status === "trialing") {
    patch["status"] = status === "active" ? "active" : "trial";
    patch["grace_until"] = null;
    patch["suspended_at"] = null;
    patch["cancelled_at"] = null;
    if (status === "active") {
      const { data } = await admin
        .from("organizations")
        .select("converted_at")
        .eq("id", organizationId)
        .maybeSingle();
      if (!(data as { converted_at: string | null } | null)?.converted_at) {
        patch["converted_at"] = new Date().toISOString();
        patch["conversion_source"] = subscription ? "checkout" : "manual";
      }
    }
  } else if (status === "past_due") {
    patch["status"] = "active";
    patch["grace_until"] = new Date(
      Date.now() + settings.grace_days * 24 * 60 * 60 * 1000,
    ).toISOString();
  } else if (status === "suspended") {
    patch["status"] = "suspended";
    patch["suspended_at"] = new Date().toISOString();
  } else if (status === "cancelled") {
    patch["status"] = "cancelled";
    patch["cancelled_at"] = new Date().toISOString();
  }

  if (Object.keys(patch).length === 0) return;
  const { error } = await admin.from("organizations").update(patch).eq("id", organizationId);
  if (error) throw new Error(error.message);
}

// ─────────────────────── Faturas e pagamentos ───────────────────────

async function resolveOrganizationByCustomer(
  admin: Admin,
  customerId: string | null | undefined,
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("billing_provider_customer_id", customerId)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function syncInvoiceFromProvider(
  admin: Admin,
  invoice: any,
  env: BillingEnvironment,
): Promise<string | null> {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const organizationId =
    invoice.subscription_details?.metadata?.organizationId ??
    invoice.metadata?.organizationId ??
    (await resolveOrganizationByCustomer(admin, customerId));
  if (!organizationId) return null;

  const subscriptionId = invoice.subscription
    ? (
        (
          await admin
            .from("organization_subscriptions")
            .select("id")
            .eq("external_subscription_id", invoice.subscription)
            .maybeSingle()
        ).data as { id: string } | null
      )?.id ?? null
    : null;

  const status =
    invoice.status === "paid"
      ? "paid"
      : invoice.status === "void"
        ? "void"
        : invoice.status === "draft"
          ? "draft"
          : invoice.due_date && invoice.due_date * 1000 < Date.now()
            ? "overdue"
            : "open";

  const line = invoice.lines?.data?.[0];
  const { error } = await admin.from("organization_invoices").upsert(
    {
      organization_id: organizationId,
      subscription_id: subscriptionId,
      external_invoice_id: invoice.id,
      origin: "stripe",
      environment: env,
      number: invoice.number ?? invoice.id,
      status,
      currency: (invoice.currency ?? "brl").toUpperCase(),
      subtotal_cents: invoice.subtotal ?? 0,
      total_cents: invoice.total ?? 0,
      discount_cents: invoice.total_discount_amounts?.[0]?.amount ?? 0,
      tax_cents: invoice.tax ?? 0,
      issued_at: isoFromUnix(invoice.created),
      due_date: invoice.due_date
        ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10)
        : null,
      period_start: line?.period?.start
        ? new Date(line.period.start * 1000).toISOString().slice(0, 10)
        : null,
      period_end: line?.period?.end
        ? new Date(line.period.end * 1000).toISOString().slice(0, 10)
        : null,
      paid_at: invoice.status === "paid" ? isoFromUnix(invoice.status_transitions?.paid_at) : null,
      voided_at: invoice.status === "void" ? new Date().toISOString() : null,
      hosted_url: invoice.hosted_invoice_url ?? null,
      pdf_url: invoice.invoice_pdf ?? null,
      attempt_count: invoice.attempt_count ?? 0,
      billing_email: invoice.customer_email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "external_invoice_id" },
  );
  if (error) throw new Error(error.message);
  return organizationId;
}

export async function syncPaymentFromProvider(
  admin: Admin,
  input: {
    externalPaymentId: string;
    customerId?: string | null;
    externalInvoiceId?: string | null;
    amountCents: number;
    status: "succeeded" | "failed" | "pending" | "refunded";
    paidAt?: string | null;
    methodSummary?: string | null;
    failureReason?: string | null;
    attempt?: number;
  },
  env: BillingEnvironment,
): Promise<string | null> {
  const organizationId = await resolveOrganizationByCustomer(admin, input.customerId);
  if (!organizationId) return null;

  const invoiceId = input.externalInvoiceId
    ? (
        (
          await admin
            .from("organization_invoices")
            .select("id")
            .eq("external_invoice_id", input.externalInvoiceId)
            .maybeSingle()
        ).data as { id: string } | null
      )?.id ?? null
    : null;

  const { error } = await admin.from("organization_payments").upsert(
    {
      organization_id: organizationId,
      invoice_id: invoiceId,
      amount_cents: input.amountCents,
      method: "provider",
      method_summary: input.methodSummary ?? null,
      provider: "stripe",
      environment: env,
      external_payment_id: input.externalPaymentId,
      status: input.status,
      failure_reason: input.failureReason ?? null,
      attempt: input.attempt ?? 1,
      paid_at: input.paidAt ?? new Date().toISOString(),
      reference: input.externalInvoiceId ?? null,
    },
    { onConflict: "external_payment_id" },
  );
  if (error) throw new Error(error.message);
  return organizationId;
}

// ─────────────────────── Visão consolidada ───────────────────────

export type BillingSnapshot = {
  organization: OrgBillingRow;
  operationalState: string;
  entitlements: Record<string, string | number | boolean | null>;
  subscription:
    | {
        id: string;
        status: SubscriptionStatus;
        plan_id: string | null;
        plan_name: string | null;
        plan_code: string | null;
        billing_interval: BillingInterval;
        amount_cents: number;
        currency: string;
        seats: number;
        provider: string;
        current_period_start: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        trial_end: string | null;
        mrr_cents: number;
      }
    | null;
  trialEndsAt: string | null;
};

export async function getBillingSnapshot(
  admin: Admin,
  organizationId: string,
): Promise<BillingSnapshot> {
  const org = await getOrgBillingRow(admin, organizationId);

  const [{ data: state }, { data: entitlements }, subRes] = await Promise.all([
    admin.rpc("org_operational_state", { _organization_id: organizationId }),
    admin.rpc("org_effective_entitlements", { _organization_id: organizationId }),
    admin
      .from("organization_subscriptions")
      .select("*, plans(name, code)")
      .eq("organization_id", organizationId)
      .in("status", ["trialing", "active", "past_due", "suspended"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (subRes.error) throw new Error(subRes.error.message);

  const sub = subRes.data as any | null;
  const trialEnd = org.trial_ends_at
    ? new Date(
        new Date(org.trial_ends_at).getTime() +
          (org.trial_extension_days ?? 0) * 24 * 60 * 60 * 1000,
      ).toISOString()
    : null;

  return {
    organization: org,
    operationalState: (state as string) ?? "unknown",
    entitlements: (entitlements as Record<string, string | number | boolean | null>) ?? {},
    trialEndsAt: trialEnd,
    subscription: sub
      ? {
          id: sub.id,
          status: sub.status,
          plan_id: sub.plan_id ?? null,
          plan_name: sub.plans?.name ?? null,
          plan_code: sub.plans?.code ?? null,
          billing_interval: sub.billing_interval,
          amount_cents: sub.amount_cents ?? 0,
          currency: sub.currency ?? "BRL",
          seats: sub.seats ?? 1,
          provider: sub.provider,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: Boolean(sub.cancel_at_period_end),
          trial_end: sub.trial_end,
          mrr_cents: monthlyEquivalentCents(sub.amount_cents, sub.billing_interval),
        }
      : null,
  };
}

export function stripeClient(env: BillingEnvironment) {
  return createStripeClient(env);
}
