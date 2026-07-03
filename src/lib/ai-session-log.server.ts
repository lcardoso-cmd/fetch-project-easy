// Diagnóstico por sessão de IA: registra eventos de cache/truncamento/fallback/latência.
// Cada request de chat abre uma "sessão" (sessionId no UsageContext) e vários eventos
// podem ser gravados até o `chat_finish`. Falhas de log são silenciosas.

import { getUsageContext } from "./ai-usage.server";

export type SessionEventType =
  | "cache_hit"
  | "cache_miss"
  | "context_truncated"
  | "fallback"
  | "chat_finish";

export interface SessionEventArgs {
  event_type: SessionEventType;
  model?: string | null;
  fallback_model?: string | null;
  reason?: string | null;
  chars_before?: number | null;
  chars_after?: number | null;
  messages_truncated?: number | null;
  latency_ms?: number | null;
  payload?: Record<string, unknown> | null;
  feature?: string | null;
}

export async function logSessionEvent(args: SessionEventArgs): Promise<void> {
  try {
    const ctx = getUsageContext();
    if (!ctx?.userId || !ctx.sessionId) return;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };

    const row: Record<string, unknown> = {
      user_id: ctx.userId,
      session_id: ctx.sessionId,
      thread_id: ctx.threadId ?? null,
      case_id: ctx.caseId ?? null,
      feature: args.feature ?? ctx.feature ?? null,
      event_type: args.event_type,
      model: args.model ?? null,
      fallback_model: args.fallback_model ?? null,
      reason: args.reason ?? null,
      chars_before: args.chars_before ?? null,
      chars_after: args.chars_after ?? null,
      messages_truncated: args.messages_truncated ?? null,
      latency_ms: args.latency_ms ?? null,
      payload: args.payload ?? null,
    };

    const { error } = await client.from("ai_session_events").insert(row);
    if (error) console.warn("[ai-session-log] insert falhou:", error.message);
  } catch (e) {
    console.warn("[ai-session-log] erro:", e instanceof Error ? e.message : String(e));
  }
}
