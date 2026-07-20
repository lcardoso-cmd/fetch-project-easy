// Schema compartilhado entre cliente (BudgetCard) e servidor (updateAiBudget).
// Manter num único arquivo garante que as mensagens/limites fiquem sincronizadas
// e que o backend rejeite qualquer payload que a UI aceitaria por engano.
import { z } from "zod";

export const AI_BUDGET_LIMITS = {
  limit: { min: 0, max: 100000, label: "Limite mensal (USD)" },
  warn: { min: 1, max: 100, label: "Aviso (%)" },
  maxTokens: { min: 0, max: 200000, label: "Máx. tokens de resposta" },
  maxCtx: { min: 0, max: 2000000, label: "Contexto máx." },
  maxRetries: { min: 0, max: 5, label: "Tentativas por chamada" },
} as const;

const L = AI_BUDGET_LIMITS;

// Payload cru enviado pelo cliente (chaves como salvas no banco).
export const AiBudgetPayloadSchema = z.object({
  monthly_limit_usd: z
    .number({ error: `${L.limit.label} é obrigatório.` })
    .min(L.limit.min, `Use um valor entre ${L.limit.min} e ${L.limit.max}.`)
    .max(L.limit.max, `Use um valor entre ${L.limit.min} e ${L.limit.max}.`),
  warn_threshold_pct: z
    .number({ error: `${L.warn.label} é obrigatório.` })
    .int(`${L.warn.label} deve ser um inteiro.`)
    .min(L.warn.min, `Use um valor entre ${L.warn.min} e ${L.warn.max}.`)
    .max(L.warn.max, `Use um valor entre ${L.warn.min} e ${L.warn.max}.`),
  max_tokens: z
    .number()
    .int(`${L.maxTokens.label} deve ser um inteiro.`)
    .min(L.maxTokens.min)
    .max(L.maxTokens.max)
    .optional(),
  max_context_chars: z
    .number()
    .int(`${L.maxCtx.label} deve ser um inteiro.`)
    .min(L.maxCtx.min)
    .max(L.maxCtx.max)
    .optional(),
  max_retries: z
    .number()
    .int(`${L.maxRetries.label} deve ser um inteiro.`)
    .min(L.maxRetries.min)
    .max(L.maxRetries.max)
    .optional(),
  force_fallback_on_retry: z.boolean().optional(),
});

export type AiBudgetPayload = z.infer<typeof AiBudgetPayloadSchema>;

// Mapeia chaves do payload para as chaves de formulário usadas no BudgetCard.
export const AI_BUDGET_FIELD_MAP: Record<string, string> = {
  monthly_limit_usd: "limit",
  warn_threshold_pct: "warn",
  max_tokens: "maxTokens",
  max_context_chars: "maxCtx",
  max_retries: "maxRetries",
  force_fallback_on_retry: "forceFallback",
};

export interface AiBudgetValidationError {
  code: "VALIDATION";
  message: string;
  fieldErrors: Record<string, string>;
}

/** Serializa erro estruturado para trafegar pela RPC como Error.message. */
export function encodeValidationError(err: AiBudgetValidationError): string {
  return `AI_BUDGET_VALIDATION::${JSON.stringify(err)}`;
}

export function tryDecodeValidationError(
  message: string,
): AiBudgetValidationError | null {
  if (!message.startsWith("AI_BUDGET_VALIDATION::")) return null;
  try {
    return JSON.parse(message.slice("AI_BUDGET_VALIDATION::".length));
  } catch {
    return null;
  }
}

/** Converte um ZodError em erro estruturado com chaves de formulário. */
export function toFieldErrors(zodError: z.ZodError): AiBudgetValidationError {
  const fieldErrors: Record<string, string> = {};
  for (const issue of zodError.issues) {
    const rawKey = String(issue.path[0] ?? "");
    const key = AI_BUDGET_FIELD_MAP[rawKey] ?? rawKey;
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    code: "VALIDATION",
    message: "Corrija os campos destacados antes de salvar.",
    fieldErrors,
  };
}
