// Contexto por request para registro de consumo de IA.
// Usa AsyncLocalStorage para evitar propagar `userId` por toda a stack.
// Callers wrap o handler com `runWithUsageContext({...}, fn)`; cada função
// de `ai.server.ts` chama `logAiUsage()` após um sucesso do gateway.

import { AsyncLocalStorage } from "node:async_hooks";
import { estimateCostUsd } from "./ai-pricing";

export interface UsageContext {
  userId?: string;
  /** Organização ativa — os limites/orçamento de IA são por organização. */
  organizationId?: string | null;
  caseId?: string | null;
  threadId?: string | null;
  feature?: string;
  /** Identificador único de uma sessão de IA (ex.: um request de streaming). */
  sessionId?: string | null;
}


const storage = new AsyncLocalStorage<UsageContext>();

export function runWithUsageContext<T>(ctx: UsageContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn);
}

export function getUsageContext(): UsageContext | undefined {
  return storage.getStore();
}

export interface RawUsage {
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
}

/** Limites efetivamente aplicados na chamada (auditoria). */
export interface AppliedLimits {
  max_tokens_applied?: number | null;
  context_chars_before?: number | null;
  context_chars_after?: number | null;
  messages_truncated?: number | null;
  retries_used?: number | null;
}

interface LogArgs {
  feature?: string; // sobrescreve o feature do contexto
  model: string;
  usage: RawUsage | null | undefined;
  gatewayRunId?: string | null;
  applied?: AppliedLimits;
}

export async function logAiUsage(args: LogArgs): Promise<void> {
  try {
    const ctx = getUsageContext();
    if (!ctx?.userId) return; // sem usuário → não logamos

    const prompt = Math.max(0, Math.floor(args.usage?.prompt_tokens ?? 0));
    const completion = Math.max(0, Math.floor(args.usage?.completion_tokens ?? 0));
    if (prompt === 0 && completion === 0) return; // nada a registrar

    const feature = args.feature ?? ctx.feature ?? "unknown";
    const cost = estimateCostUsd(args.model, prompt, completion);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };

    const row: Record<string, unknown> = {
      user_id: ctx.userId,
      organization_id: ctx.organizationId ?? null,
      feature,
      model: args.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      cost_usd: cost,
      gateway_run_id: args.gatewayRunId ?? null,
      case_id: ctx.caseId ?? null,
      thread_id: ctx.threadId ?? null,
    };
    if (args.applied) {
      if (args.applied.max_tokens_applied !== undefined)
        row.max_tokens_applied = args.applied.max_tokens_applied;
      if (args.applied.context_chars_before !== undefined)
        row.context_chars_before = args.applied.context_chars_before;
      if (args.applied.context_chars_after !== undefined)
        row.context_chars_after = args.applied.context_chars_after;
      if (args.applied.messages_truncated !== undefined)
        row.messages_truncated = args.applied.messages_truncated;
      if (args.applied.retries_used !== undefined)
        row.retries_used = args.applied.retries_used;
    }

    const { error } = await client.from("ai_usage_events").insert(row);
    if (error) console.warn("[ai-usage] insert falhou:", error.message);
    // Invalida cache para refletir o novo gasto na próxima checagem.
    if (ctx.organizationId) budgetCache.delete(ctx.organizationId);
  } catch (e) {
    console.warn("[ai-usage] erro:", e instanceof Error ? e.message : String(e));
  }
}


// ============================================================
// Orçamento mensal — cache curto para evitar hit no DB por call.
// ============================================================

interface BudgetSnapshot {
  limit: number;
  warnPct: number;
  spent: number;
  maxTokens: number;
  maxContextChars: number;
  maxRetries: number;
  forceFallback: boolean;
  fetchedAt: number;
}

const budgetCache = new Map<string, BudgetSnapshot>();
const BUDGET_TTL_MS = 30_000;

export class AiBudgetExceededError extends Error {
  code = "AI_BUDGET_EXCEEDED" as const;
  constructor(public limit: number, public spent: number) {
    super(
      `Orçamento mensal de IA atingido (US$ ${spent.toFixed(4)} de US$ ${limit.toFixed(2)}). ` +
        "Ajuste o limite em Configurações → Consumo de IA para liberar novas chamadas.",
    );
    this.name = "AiBudgetExceededError";
  }
}

async function loadBudget(organizationId: string): Promise<BudgetSnapshot> {
  const cached = budgetCache.get(organizationId);
  if (cached && Date.now() - cached.fetchedAt < BUDGET_TTL_MS) return cached;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as { from: (t: string) => any; rpc: (n: string, a?: any) => any };

  const { data: row } = await admin
    .from("ai_budgets")
    .select("monthly_limit_usd, warn_threshold_pct, max_tokens, max_context_chars, max_retries, force_fallback_on_retry")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const limit = Number(row?.monthly_limit_usd ?? 0);
  const warnPct = Number(row?.warn_threshold_pct ?? 80);
  const maxTokens = Math.max(0, Number(row?.max_tokens ?? 0));
  const maxContextChars = Math.max(0, Number(row?.max_context_chars ?? 0));
  const maxRetries = Math.max(0, Math.min(5, Number(row?.max_retries ?? 1)));
  const forceFallback = Boolean(row?.force_fallback_on_retry ?? false);

  let spent = 0;
  if (limit > 0) {
    // Gasto do mês corrente da ORGANIZAÇÃO (o orçamento é organizacional).
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data } = await admin
      .from("ai_usage_events")
      .select("cost_usd")
      .eq("organization_id", organizationId)
      .gte("created_at", monthStart);
    spent = ((data ?? []) as Array<{ cost_usd: number | string | null }>).reduce(
      (sum, r) => sum + Number(r.cost_usd ?? 0),
      0,
    );
  }

  const snap: BudgetSnapshot = {
    limit,
    warnPct,
    spent,
    maxTokens,
    maxContextChars,
    maxRetries,
    forceFallback,
    fetchedAt: Date.now(),
  };
  budgetCache.set(organizationId, snap);
  return snap;
}

/** Lança `AiBudgetExceededError` se o usuário já ultrapassou o limite mensal. */
export async function assertAiBudget(): Promise<void> {
  const ctx = getUsageContext();
  if (!ctx?.organizationId) return;
  const b = await loadBudget(ctx.organizationId);
  if (b.limit > 0 && b.spent >= b.limit) {
    throw new AiBudgetExceededError(b.limit, b.spent);
  }
}

export interface AiLimits {
  maxTokens: number; // 0 = sem limite
  maxContextChars: number; // 0 = sem limite
  maxRetries: number; // tentativas EXTRAS após a inicial (0..5)
  forceFallback: boolean; // se true, erro retentável cai imediatamente no fallback
}

/** Limites de chamada configurados pelo dono do contexto atual (ou defaults). */
export async function getAiLimitsForCurrentUser(): Promise<AiLimits> {
  const ctx = getUsageContext();
  if (!ctx?.organizationId)
    return { maxTokens: 0, maxContextChars: 0, maxRetries: 1, forceFallback: false };
  const b = await loadBudget(ctx.organizationId);
  return {
    maxTokens: b.maxTokens,
    maxContextChars: b.maxContextChars,
    maxRetries: b.maxRetries,
    forceFallback: b.forceFallback,
  };
}

/** Snapshot para exibição no cliente (sem cache-invalidação — leitura rápida). */
export async function getAiBudgetSnapshot(organizationId: string) {
  const b = await loadBudget(organizationId);
  return {
    limit_usd: b.limit,
    warn_threshold_pct: b.warnPct,
    spent_usd: b.spent,
    max_tokens: b.maxTokens,
    max_context_chars: b.maxContextChars,
    max_retries: b.maxRetries,
    force_fallback_on_retry: b.forceFallback,
    pct: b.limit > 0 ? Math.min(100, Math.round((b.spent / b.limit) * 1000) / 10) : 0,
    warn: b.limit > 0 && b.spent >= (b.limit * b.warnPct) / 100,
    blocked: b.limit > 0 && b.spent >= b.limit,
  };
}


export function invalidateBudgetCache(organizationId: string) {
  budgetCache.delete(organizationId);
}
