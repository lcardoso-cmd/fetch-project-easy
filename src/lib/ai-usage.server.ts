// Contexto por request para registro de consumo de IA.
// Usa AsyncLocalStorage para evitar propagar `userId` por toda a stack.
// Callers wrap o handler com `runWithUsageContext({...}, fn)`; cada função
// de `ai.server.ts` chama `logAiUsage()` após um sucesso do gateway.

import { AsyncLocalStorage } from "node:async_hooks";
import { estimateCostUsd } from "./ai-pricing";

export interface UsageContext {
  userId?: string;
  caseId?: string | null;
  threadId?: string | null;
  feature?: string;
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

interface LogArgs {
  feature?: string; // sobrescreve o feature do contexto
  model: string;
  usage: RawUsage | null | undefined;
  gatewayRunId?: string | null;
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

    const { error } = await client.from("ai_usage_events").insert({
      user_id: ctx.userId,
      feature,
      model: args.model,
      prompt_tokens: prompt,
      completion_tokens: completion,
      cost_usd: cost,
      gateway_run_id: args.gatewayRunId ?? null,
      case_id: ctx.caseId ?? null,
      thread_id: ctx.threadId ?? null,
    });
    if (error) console.warn("[ai-usage] insert falhou:", error.message);
  } catch (e) {
    console.warn("[ai-usage] erro:", e instanceof Error ? e.message : String(e));
  }
}
