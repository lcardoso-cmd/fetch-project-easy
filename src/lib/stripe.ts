import { loadStripe, type Stripe } from "@stripe/stripe-js";
import type { BillingEnvironment } from "@/lib/billing-shared";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

/**
 * Deriva o ambiente pelo PREFIXO do token. Token ausente/desconhecido é erro
 * de configuração — nunca cair para "live" silenciosamente.
 */
export function paymentsEnvironment(): BillingEnvironment {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "A cobrança não está configurada nesta versão do app. Conclua a ativação de pagamentos para habilitar o checkout.",
  );
}

export function isPaymentsConfigured(): boolean {
  return Boolean(
    clientToken && (clientToken.startsWith("pk_test_") || clientToken.startsWith("pk_live_")),
  );
}

export function getStripeEnvironment(): BillingEnvironment {
  return paymentsEnvironment();
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}
