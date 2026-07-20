import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TermInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["oab", "advogado", "parte", "cnj"]),
  value: z.string().min(2).max(200),
  uf: z.string().length(2).optional().nullable(),
  label: z.string().max(120).optional().nullable(),
  case_id: z.string().uuid().nullable().optional(),
  responsible_user_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
  use_paid_fallback: z.boolean().default(false),
  deadline_days: z.number().int().min(0).max(60).default(5),
});

export const listTerms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("monitoring_terms")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => TermInput.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("monitoring_terms")
        .update(rest)
        .eq("id", id)
        .eq("user_id", context.userId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("monitoring_terms")
      .insert({ ...rest, user_id: context.userId })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("monitoring_terms")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

const ListPubsInput = z.object({
  status: z.enum(["new", "read", "archived", "all"]).default("all"),
  term_id: z.string().uuid().optional(),
  case_id: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

export const listPublications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListPubsInput.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("publications")
      .select("id, source, tribunal, orgao, publication_date, captured_at, cnj, snippet, url_original, status, case_id, task_id, created_at")
      .eq("user_id", context.userId)
      .order("captured_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.case_id) q = q.eq("case_id", data.case_id);
    if (data.search) q = q.ilike("content", `%${data.search}%`);
    if (data.cursor) q = q.lt("captured_at", data.cursor);

    if (data.term_id) {
      // filtro por termo via match table
      const { data: ids } = await context.supabase
        .from("publication_term_matches")
        .select("publication_id")
        .eq("term_id", data.term_id)
        .limit(500);
      const pubIds = (ids ?? []).map((r) => r.publication_id);
      if (pubIds.length === 0) return { rows: [], nextCursor: null };
      q = q.in("id", pubIds);
    }

    const { data: rows, error } = await q;
    if (error) throw error;
    const list = rows ?? [];
    const nextCursor = list.length === data.limit ? list[list.length - 1]?.captured_at ?? null : null;
    return { rows: list, nextCursor };
  });

export const getPublication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("publications")
      .select("*, publication_term_matches(term_id, matched_field, matched_snippet)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    return row;
  });

export const updatePublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "read", "archived"]).optional(),
        case_id: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("publications")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const countUnreadPublications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("publications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("status", "new");
    if (error) throw error;
    return count ?? 0;
  });

const THROTTLE_MS = 5 * 60 * 1000;

export const runFetchNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ termIds: z.array(z.string().uuid()).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { runPipelineForTerm } = await import("./publications/pipeline.server");

    let q = context.supabase
      .from("monitoring_terms")
      .select("*")
      .eq("user_id", context.userId)
      .eq("active", true);
    if (data.termIds && data.termIds.length) q = q.in("id", data.termIds);
    const { data: terms, error } = await q;
    if (error) throw error;

    const now = Date.now();
    const results: Array<{ term_id: string; captured: number; matched: number; skipped?: boolean; sources?: string[] }> = [];
    for (const term of terms ?? []) {
      if (term.last_run_at && now - new Date(term.last_run_at).getTime() < THROTTLE_MS) {
        results.push({ term_id: term.id, captured: 0, matched: 0, skipped: true });
        continue;
      }
      try {
        const r = await runPipelineForTerm(context.supabase, term);
        results.push({ term_id: term.id, captured: r.captured, matched: r.matched, sources: r.sourcesTried });
      } catch (e) {
        results.push({ term_id: term.id, captured: 0, matched: 0, sources: [e instanceof Error ? e.message : "error"] });
      }
    }
    return { results, totalCaptured: results.reduce((a, r) => a + r.captured, 0) };
  });

export const listFetchLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ limit: z.number().int().min(1).max(100).default(30) }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("publication_fetch_log")
      .select("id, source, ok, http_status, latency_ms, results_count, error, cost_usd, created_at, term_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return rows ?? [];
  });
