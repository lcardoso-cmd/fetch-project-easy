/**
 * Webhook público de cobrança (Stripe sandbox/live).
 *
 * Segurança: não há sessão do usuário — a autenticidade vem da assinatura HMAC
 * verificada em `verifyWebhook`. Idempotência via `billing_webhook_events`.
 */
import { createFileRoute } from "@tanstack/react-router";
import type { BillingEnvironment } from "@/lib/billing-shared";

async function processEvent(
  event: { id?: string; type: string; data: { object: any } },
  env: BillingEnvironment,
) {
  const B = await import("@/lib/billing.server");
  const admin = await B.getAdmin();
  const eventId = event.id ?? `${event.type}:${Date.now()}`;

  // Idempotência: insere primeiro; conflito = evento já processado.
  const claim = await admin
    .from("billing_webhook_events")
    .insert({
      provider: "stripe",
      environment: env,
      external_event_id: eventId,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      status: "processing",
    })
    .select("id")
    .maybeSingle();

  if (claim.error) {
    if (claim.error.code === "23505" || /duplicate|unique/i.test(claim.error.message)) {
      return { duplicated: true as const };
    }
    throw new Error(claim.error.message);
  }
  const rowId = (claim.data as { id: string } | null)?.id ?? null;

  try {
    const object = event.data?.object;
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await B.syncSubscriptionFromProvider(admin, object, env);
        break;

      case "invoice.created":
      case "invoice.finalized":
      case "invoice.updated":
      case "invoice.paid":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
      case "invoice.marked_uncollectible":
      case "invoice.voided":
        await B.syncInvoiceFromProvider(admin, object, env);
        break;

      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
      case "charge.succeeded":
      case "charge.failed":
      case "charge.refunded":
        await B.syncPaymentFromProvider(admin, object, env);
        break;

      case "checkout.session.completed": {
        // Assinaturas: a fonte da verdade é customer.subscription.*, que o Stripe
        // envia junto. Aqui apenas garantimos o vínculo do cliente do provedor.
        const customerId =
          typeof object?.customer === "string" ? object.customer : object?.customer?.id;
        const organizationId = object?.metadata?.organization_id ?? null;
        if (customerId && organizationId) {
          await admin
            .from("organizations")
            .update({
              billing_provider: "stripe",
              billing_provider_customer_id: customerId,
              billing_environment: env,
              updated_at: new Date().toISOString(),
            })
            .eq("id", organizationId);
        }
        break;
      }

      default:
        break;
    }

    if (rowId) {
      await admin
        .from("billing_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", rowId);
    }
    return { duplicated: false as const };
  } catch (error) {
    if (rowId) {
      await admin
        .from("billing_webhook_events")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
          processed_at: new Date().toISOString(),
        })
        .eq("id", rowId);
    }
    throw error;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("[payments-webhook] env inválido:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: BillingEnvironment = rawEnv;
        try {
          const { verifyWebhook } = await import("@/lib/stripe.server");
          const event = await verifyWebhook(request, env);
          const result = await processEvent(event as any, env);
          return Response.json({ received: true, duplicated: result.duplicated });
        } catch (error) {
          console.error("[payments-webhook] erro:", error);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
