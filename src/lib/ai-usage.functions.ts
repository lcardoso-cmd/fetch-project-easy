// Server functions do painel de consumo de IA.
// - `getAiUsageSummary`: agregações por dia / feature / modelo / usuário
//   dentro de um mês (mês/ano) para o admin do escritório (ou o próprio
//   usuário, quando não for admin). Também retorna o total do mês.
// - RLS já filtra por dono; office_admin/platform_admin/super_admin veem tudo.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12), // 1..12
  user_id: z.string().uuid().nullable().optional(), // filtro individual (admin)
});

type Row = {
  created_at: string;
  user_id: string;
  feature: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
};

export interface UsageSummary {
  scope: "workspace" | "personal";
  totals: {
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: number;
  };
  by_day: { day: string; total_tokens: number; cost_usd: number }[];
  by_feature: { feature: string; calls: number; total_tokens: number; cost_usd: number }[];
  by_model: { model: string; calls: number; total_tokens: number; cost_usd: number }[];
  by_user: {
    user_id: string;
    name: string;
    email: string | null;
    calls: number;
    total_tokens: number;
    cost_usd: number;
  }[];
}

function monthRange(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

export const getAiUsageSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ context, data }): Promise<UsageSummary> => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => any;
    };

    // Detecta se pode ver consumo do workspace inteiro.
    const capsRes = await admin
      .from("user_capabilities")
      .select("capability")
      .eq("user_id", userId);
    const caps = (capsRes.data ?? []) as Array<{ capability: string }>;
    const capSet = new Set(caps.map((c) => c.capability));
    const canViewAll =
      capSet.has("office_admin") ||
      capSet.has("platform_admin") ||
      capSet.has("super_admin");

    const { from, to } = monthRange(data.year, data.month);

    let query = admin
      .from("ai_usage_events")
      .select(
        "created_at,user_id,feature,model,prompt_tokens,completion_tokens,total_tokens,cost_usd",
      )
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .limit(50000);

    if (!canViewAll) query = query.eq("user_id", userId);
    else if (data.user_id) query = query.eq("user_id", data.user_id);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const events = (rows ?? []) as Row[];

    const totals = events.reduce(
      (acc, r) => {
        acc.calls += 1;
        acc.prompt_tokens += r.prompt_tokens;
        acc.completion_tokens += r.completion_tokens;
        acc.total_tokens += r.total_tokens;
        acc.cost_usd += Number(r.cost_usd) || 0;
        return acc;
      },
      { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, cost_usd: 0 },
    );

    const byDay = new Map<string, { total_tokens: number; cost_usd: number }>();
    const byFeat = new Map<string, { calls: number; total_tokens: number; cost_usd: number }>();
    const byModel = new Map<string, { calls: number; total_tokens: number; cost_usd: number }>();
    const byUser = new Map<string, { calls: number; total_tokens: number; cost_usd: number }>();

    for (const r of events) {
      const day = r.created_at.slice(0, 10);
      const d = byDay.get(day) ?? { total_tokens: 0, cost_usd: 0 };
      d.total_tokens += r.total_tokens;
      d.cost_usd += Number(r.cost_usd) || 0;
      byDay.set(day, d);

      const f = byFeat.get(r.feature) ?? { calls: 0, total_tokens: 0, cost_usd: 0 };
      f.calls += 1;
      f.total_tokens += r.total_tokens;
      f.cost_usd += Number(r.cost_usd) || 0;
      byFeat.set(r.feature, f);

      const m = byModel.get(r.model) ?? { calls: 0, total_tokens: 0, cost_usd: 0 };
      m.calls += 1;
      m.total_tokens += r.total_tokens;
      m.cost_usd += Number(r.cost_usd) || 0;
      byModel.set(r.model, m);

      const u = byUser.get(r.user_id) ?? { calls: 0, total_tokens: 0, cost_usd: 0 };
      u.calls += 1;
      u.total_tokens += r.total_tokens;
      u.cost_usd += Number(r.cost_usd) || 0;
      byUser.set(r.user_id, u);
    }

    // Enriquecer by_user com nome/e-mail (só se vier alguém).
    const userIds = Array.from(byUser.keys());
    const profileMap = new Map<string, { name: string; email: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id as string, {
          name: (p.full_name as string) || "Sem nome",
          email: (p.email as string | null) ?? null,
        });
      }
    }

    const result: UsageSummary = {
      scope: canViewAll ? "workspace" : "personal",
      totals: {
        ...totals,
        cost_usd: Math.round(totals.cost_usd * 1_000_000) / 1_000_000,
      },
      by_day: Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({
          day,
          total_tokens: v.total_tokens,
          cost_usd: Math.round(v.cost_usd * 1_000_000) / 1_000_000,
        })),
      by_feature: Array.from(byFeat.entries())
        .map(([feature, v]) => ({ feature, ...v, cost_usd: round6(v.cost_usd) }))
        .sort((a, b) => b.total_tokens - a.total_tokens),
      by_model: Array.from(byModel.entries())
        .map(([model, v]) => ({ model, ...v, cost_usd: round6(v.cost_usd) }))
        .sort((a, b) => b.total_tokens - a.total_tokens),
      by_user: Array.from(byUser.entries())
        .map(([uid, v]) => {
          const p = profileMap.get(uid);
          return {
            user_id: uid,
            name: p?.name ?? "Usuário",
            email: p?.email ?? null,
            calls: v.calls,
            total_tokens: v.total_tokens,
            cost_usd: round6(v.cost_usd),
          };
        })
        .sort((a, b) => b.total_tokens - a.total_tokens),
    };
    return result;
  });

function round6(n: number) {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ============================================================
// Orçamento mensal (alerta + bloqueio)
// ============================================================

export interface AiBudgetStatus {
  limit_usd: number;
  spent_usd: number;
  warn_threshold_pct: number;
  max_tokens: number;
  max_context_chars: number;
  max_retries: number;
  pct: number;
  warn: boolean;
  blocked: boolean;
}

export const getAiBudgetStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiBudgetStatus> => {
    const { getAiBudgetSnapshot } = await import("./ai-usage.server");
    return getAiBudgetSnapshot(context.userId);
  });

const UpdateBudgetSchema = z.object({
  monthly_limit_usd: z.number().min(0).max(100000),
  warn_threshold_pct: z.number().int().min(1).max(100),
  max_tokens: z.number().int().min(0).max(200000).optional(),
  max_context_chars: z.number().int().min(0).max(2000000).optional(),
  max_retries: z.number().int().min(0).max(5).optional(),
});

export const updateAiBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((raw: unknown) => UpdateBudgetSchema.parse(raw))
  .handler(async ({ context, data }): Promise<AiBudgetStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    const row: Record<string, unknown> = {
      user_id: context.userId,
      monthly_limit_usd: data.monthly_limit_usd,
      warn_threshold_pct: data.warn_threshold_pct,
      updated_at: new Date().toISOString(),
    };
    if (data.max_tokens !== undefined) row.max_tokens = data.max_tokens;
    if (data.max_context_chars !== undefined) row.max_context_chars = data.max_context_chars;
    if (data.max_retries !== undefined) row.max_retries = data.max_retries;
    const { error } = await admin
      .from("ai_budgets")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    const { invalidateBudgetCache, getAiBudgetSnapshot } = await import("./ai-usage.server");
    invalidateBudgetCache(context.userId);
    return getAiBudgetSnapshot(context.userId);
  });
