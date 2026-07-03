import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SessionEventRow {
  id: string;
  session_id: string;
  thread_id: string | null;
  feature: string | null;
  event_type: string;
  model: string | null;
  fallback_model: string | null;
  reason: string | null;
  chars_before: number | null;
  chars_after: number | null;
  messages_truncated: number | null;
  latency_ms: number | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface SessionSummary {
  session_id: string;
  thread_id: string | null;
  feature: string | null;
  started_at: string;
  finished_at: string;
  total_events: number;
  cache_hit: boolean;
  had_truncation: boolean;
  had_fallback: boolean;
  latency_ms: number | null;
  last_model: string | null;
}

/** Lista as últimas N sessões (agrupamento por session_id) do usuário atual. */
export const listRecentSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) =>
    z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<SessionSummary[]> => {
    const { supabase, userId } = context;
    const limit = data.limit ?? 15;

    // Pega os eventos mais recentes e agrupa por sessão em memória (simples e barato).
    const { data: rows, error } = await supabase
      .from("ai_session_events")
      .select(
        "session_id, thread_id, feature, event_type, model, latency_ms, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const bySession = new Map<string, SessionSummary>();
    for (const r of rows ?? []) {
      const sid = r.session_id as string;
      const existing = bySession.get(sid);
      if (!existing) {
        bySession.set(sid, {
          session_id: sid,
          thread_id: (r.thread_id as string | null) ?? null,
          feature: (r.feature as string | null) ?? null,
          started_at: r.created_at as string,
          finished_at: r.created_at as string,
          total_events: 1,
          cache_hit: r.event_type === "cache_hit",
          had_truncation: r.event_type === "context_truncated",
          had_fallback: r.event_type === "fallback",
          latency_ms: r.event_type === "chat_finish" ? (r.latency_ms as number | null) ?? null : null,
          last_model: (r.model as string | null) ?? null,
        });
      } else {
        existing.total_events += 1;
        if (r.event_type === "cache_hit") existing.cache_hit = true;
        if (r.event_type === "context_truncated") existing.had_truncation = true;
        if (r.event_type === "fallback") existing.had_fallback = true;
        if (r.event_type === "chat_finish" && existing.latency_ms == null) {
          existing.latency_ms = (r.latency_ms as number | null) ?? null;
        }
        // eventos vêm do mais recente ao mais antigo
        existing.started_at = r.created_at as string;
      }
    }

    return Array.from(bySession.values()).slice(0, limit);
  });

/** Retorna todos os eventos ordenados cronologicamente de uma sessão específica. */
export const getSessionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => z.object({ session_id: z.string().min(1) }).parse(raw))
  .handler(async ({ context, data }): Promise<SessionEventRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("ai_session_events")
      .select("*")
      .eq("user_id", userId)
      .eq("session_id", data.session_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as SessionEventRow[];
  });
