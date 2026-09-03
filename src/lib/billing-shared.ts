import { z } from "zod";

/** Ambientes de cobrança. Nunca inferir "live" por omissão. */
export const BILLING_ENVIRONMENTS = ["sandbox", "live"] as const;
export type BillingEnvironment = (typeof BILLING_ENVIRONMENTS)[number];
export const billingEnvironmentSchema = z.enum(BILLING_ENVIRONMENTS);

export const BILLING_INTERVALS = ["month", "year"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export const billingIntervalSchema = z.enum(BILLING_INTERVALS);

export const BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
  month: "Mensal",
  year: "Anual",
};

export const ORG_STATUSES = ["trial", "active", "suspended", "cancelled"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  trial: "Em avaliação",
  active: "Ativo",
  suspended: "Suspenso",
  cancelled: "Cancelado",
};

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: "Em avaliação",
  active: "Ativa",
  past_due: "Inadimplente",
  suspended: "Suspensa",
  cancelled: "Cancelada",
};

export const INVOICE_STATUSES = ["draft", "open", "paid", "void", "overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Rascunho",
  open: "Aberta",
  paid: "Paga",
  void: "Anulada",
  overdue: "Vencida",
};

export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendente",
  succeeded: "Confirmado",
  failed: "Falhou",
  refunded: "Devolvido",
};

/** Estado operacional consolidado (espelha `org_operational_state` no banco). */
export const OPERATIONAL_STATES = [
  "trial",
  "active",
  "past_due",
  "trial_expired",
  "suspended",
  "cancelled",
  "unknown",
] as const;
export type OperationalState = (typeof OPERATIONAL_STATES)[number];

export const OPERATIONAL_STATE_LABELS: Record<OperationalState, string> = {
  trial: "Avaliação em andamento",
  active: "Assinatura ativa",
  past_due: "Pagamento em atraso",
  trial_expired: "Avaliação encerrada",
  suspended: "Acesso suspenso",
  cancelled: "Contrato cancelado",
  unknown: "Indefinido",
};

/** Estados em que o escritório continua podendo criar/alterar dados. */
export function canWriteInState(state: OperationalState): boolean {
  return state === "trial" || state === "active" || state === "past_due";
}

export const ENTITLEMENT_KEYS = [
  "max_members",
  "max_active_cases",
  "storage_gb",
  "ai_monthly_budget_usd",
  "ai_overage_allowed",
  "feature_rag",
  "feature_legal_drafting",
  "feature_proposals",
  "feature_monitoring",
  "feature_communication",
  "feature_crm",
  "feature_integrations",
  "feature_audit",
  "support_level",
] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];
export const entitlementKeySchema = z.enum(ENTITLEMENT_KEYS);

export const ENTITLEMENT_LABELS: Record<EntitlementKey, string> = {
  max_members: "Integrantes (0 = ilimitado)",
  max_active_cases: "Casos ativos (0 = ilimitado)",
  storage_gb: "Armazenamento (GB)",
  ai_monthly_budget_usd: "Orçamento mensal de IA (USD)",
  ai_overage_allowed: "Permite exceder o orçamento de IA",
  feature_rag: "Biblioteca com busca por evidências",
  feature_legal_drafting: "Redação assistida",
  feature_proposals: "Propostas comerciais",
  feature_monitoring: "Monitoramento de publicações",
  feature_communication: "Comunicação interna",
  feature_crm: "CRM comercial",
  feature_integrations: "Integrações",
  feature_audit: "Auditoria completa",
  support_level: "Nível de suporte",
};

export function formatMoneyCents(cents: number | null | undefined, currency = "BRL"): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function monthlyEquivalentCents(
  amountCents: number | null | undefined,
  interval: BillingInterval | string | null | undefined,
): number {
  const amount = amountCents ?? 0;
  return interval === "year" ? Math.round(amount / 12) : amount;
}

/** Schema único de configuração comercial (usado na UI e no backend). */
export const commercialSettingsSchema = z.object({
  trial_days: z.number().int().min(1).max(365),
  grace_days: z.number().int().min(0).max(90),
  default_currency: z.enum(["BRL", "USD"]),
  due_soon_days: z.number().int().min(1).max(60),
  alert_recipients: z.array(z.string().email()).max(20),
  trial_expired_policy: z.enum(["read_only", "block"]),
  delinquency_policy: z.enum(["suspend_after_grace", "keep_active"]),
  support_identity: z.string().email(),
});

export type CommercialSettings = z.infer<typeof commercialSettingsSchema>;

export const DEFAULT_COMMERCIAL_SETTINGS: CommercialSettings = {
  trial_days: 30,
  grace_days: 7,
  default_currency: "BRL",
  due_soon_days: 5,
  alert_recipients: [],
  trial_expired_policy: "read_only",
  delinquency_policy: "suspend_after_grace",
  support_identity: "suporte@b2bconsulting.com.br",
};
