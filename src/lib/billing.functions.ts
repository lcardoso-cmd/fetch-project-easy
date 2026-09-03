/**
 * Cobrança na visão do escritório (organização).
 * Toda função resolve a organização ativa no servidor e exige permissão real.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrgPermission } from "@/lib/org-middleware";
import {
  billingEnvironmentSchema,
  billingIntervalSchema,
  monthlyEquivalentCents,
  type BillingInterval,
} from "@/lib/billing-shared";
import { getStripeErrorMessage } from "@/lib/stripe.server";

async function lib() {
  return await import("@/lib/billing.server");
}

// ─────────────────────── Leitura ───────────────────────

export const getMyBilling = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("billing.view")])
  .validator(z.object({ environment: billingEnvironmentSchema }))
  .handler(async ({ context, data }) => {
    const B = await lib();
    const admin = await B.getAdmin();
    const [snapshot, plans, invoices, payments, events] = await Promise.all([
      B.getBillingSnapshot(admin, context.organizationId),
      B.listPlanRows(admin),
      admin
        .from("organization_invoices")
        .select(
          "id, number, status, currency, total_cents, issued_at, due_date, paid_at, hosted_url, pdf_url, origin, period_start, period_end",
        )
        .eq("organization_id", context.organizationId)
        .order("issued_at", { ascending: false, nullsFirst: false })
        .limit(50),
      admin
        .from("organization_payments")
        .select("id, amount_cents, status, method, method_summary, paid_at, provider, failure_reason")
        .eq("organization_id", context.organizationId)
        .order("paid_at", { ascending: false })
        .limit(50),
      admin
        .from("subscription_events")
        .select("id, event, from_status, to_status, reason, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    return {
      environment: data.environment,
      snapshot,
      plans: plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        currency: p.currency,
        monthly_price_cents: p.monthly_price_cents,
        yearly_price_cents: p.yearly_price_cents,
        is_trial_default: p.is_trial_default,
        purchasable: Boolean(p.provider_monthly_price_id || p.provider_yearly_price_id),
      })),
      invoices: (invoices.data ?? []) as any[],
      payments: (payments.data ?? []) as any[],
      events: (events.data ?? []) as any[],
    };
  });

// ─────────────────────── Checkout ───────────────────────

type CheckoutResult = { clientSecret: string } | { error: string };

export const startSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("subscription.manage")])
  .validator(
    z.object({
      plan_code: z.string().min(1).max(60),
      interval: billingIntervalSchema,
      returnUrl: z.string().url(),
      environment: billingEnvironmentSchema,
    }),
  )
  .handler(async ({ context, data }): Promise<CheckoutResult> => {
    const B = await lib();
    const admin = await B.getAdmin();
    const plans = await B.listPlanRows(admin);
    const plan = plans.find((p) => p.code === data.plan_code);
    if (!plan) return { error: "Plano indisponível." };
    const lookupKey = B.planPriceLookupKey(plan, data.interval as BillingInterval);
    if (!lookupKey) return { error: "Este plano não tem preço configurado para essa periodicidade." };

    try {
      const stripe = B.stripeClient(data.environment);
      const org = await B.getOrgBillingRow(admin, context.organizationId);
      const customerId = await B.ensureProviderCustomer(admin, stripe, org, data.environment);

      const prices = await stripe.prices.list({ lookup_keys: [lookupKey] });
      const price = prices.data[0];
      if (!price) return { error: "Preço não encontrado no provedor de pagamento." };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        automatic_tax: { enabled: true },
        metadata: {
          organizationId: context.organizationId,
          planCode: plan.code,
          interval: data.interval,
        },
        subscription_data: {
          metadata: {
            organizationId: context.organizationId,
            planCode: plan.code,
            interval: data.interval,
          },
        },
      });

      await B.writeSubscriptionEvent(admin, {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        event: "checkout.started",
        toStatus: null,
        toPlanId: plan.id,
        metadata: { interval: data.interval, environment: data.environment },
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// ─────────────────────── Portal do provedor ───────────────────────

export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("billing.manage")])
  .validator(z.object({ returnUrl: z.string().url(), environment: billingEnvironmentSchema }))
  .handler(async ({ context, data }): Promise<{ url: string } | { error: string }> => {
    const B = await lib();
    const admin = await B.getAdmin();
    const org = await B.getOrgBillingRow(admin, context.organizationId);
    if (!org.billing_provider_customer_id) {
      return { error: "Ainda não existe assinatura ativa para abrir o portal de cobrança." };
    }
    try {
      const stripe = B.stripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: org.billing_provider_customer_id,
        return_url: data.returnUrl,
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

// ─────────────────────── Cancelamento / retomada ───────────────────────

export const setSubscriptionCancellation = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("subscription.manage")])
  .validator(
    z.object({
      cancel: z.boolean(),
      reason: z.string().max(500).optional(),
      environment: billingEnvironmentSchema,
    }),
  )
  .handler(async ({ context, data }): Promise<{ ok: true } | { error: string }> => {
    const B = await lib();
    const admin = await B.getAdmin();
    const snapshot = await B.getBillingSnapshot(admin, context.organizationId);
    const sub = snapshot.subscription;
    if (!sub) return { error: "Nenhuma assinatura ativa encontrada." };

    const { data: row } = await admin
      .from("organization_subscriptions")
      .select("id, external_subscription_id, provider")
      .eq("id", sub.id)
      .maybeSingle();
    const external = (row as { external_subscription_id: string | null } | null)
      ?.external_subscription_id;

    try {
      if (external) {
        const stripe = B.stripeClient(data.environment);
        await stripe.subscriptions.update(external, { cancel_at_period_end: data.cancel });
      }
      const { error } = await admin
        .from("organization_subscriptions")
        .update({ cancel_at_period_end: data.cancel, updated_at: new Date().toISOString() })
        .eq("id", sub.id);
      if (error) return { error: error.message };

      await B.writeSubscriptionEvent(admin, {
        organizationId: context.organizationId,
        subscriptionId: sub.id,
        actorUserId: context.userId,
        event: data.cancel ? "cancellation.scheduled" : "cancellation.reverted",
        fromStatus: sub.status,
        toStatus: sub.status,
        reason: data.reason ?? null,
      });
      return { ok: true };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Resumo leve para banners/guards (qualquer membro pode ver). */
export const getOrgAccessState = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("usage.view_self")])
  .handler(async ({ context }) => {
    const B = await lib();
    const admin = await B.getAdmin();
    const snapshot = await B.getBillingSnapshot(admin, context.organizationId);
    return {
      state: snapshot.operationalState,
      trialEndsAt: snapshot.trialEndsAt,
      planName: snapshot.subscription?.plan_name ?? null,
      graceUntil: snapshot.organization.grace_until,
      mrrCents: snapshot.subscription
        ? monthlyEquivalentCents(
            snapshot.subscription.amount_cents,
            snapshot.subscription.billing_interval,
          )
        : 0,
    };
  });
