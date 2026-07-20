import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { fetchFromDJEN } from "./sources/djen";
import { fetchFromFirecrawl } from "./sources/firecrawl";
import { normalizeOab, publicationHash, makeSnippet, stripAccents, type NormalizedPublication } from "./normalize";

type TermRow = Database["public"]["Tables"]["monitoring_terms"]["Row"];

/**
 * Roda o pipeline de captura para 1 termo.
 * Escalonamento: DJEN → Firecrawl → (Codilo, se ativado).
 * Grava publicações + matches + fetch_log e retorna contagens.
 */
export async function runPipelineForTerm(
  supabase: SupabaseClient<Database>,
  term: TermRow,
): Promise<{ captured: number; matched: number; sourcesTried: string[] }> {
  const sourcesTried: string[] = [];
  const collected: Array<{ pub: NormalizedPublication; matchedField: string; matchedSnippet: string }> = [];

  // 1) DJEN
  sourcesTried.push("djen");
  const djen = await tryDjen(term);
  await logFetch(supabase, term, "djen", djen.ok, djen.httpStatus, djen.latencyMs, djen.publications.length, djen.error);
  if (djen.ok && djen.publications.length > 0) {
    for (const p of djen.publications) {
      collected.push({ pub: p, matchedField: matchedFieldFor(term), matchedSnippet: makeSnippet(p.content) });
    }
  }

  // 2) Firecrawl fallback quando DJEN vazio ou falhou
  if (djen.publications.length === 0 && termQueryString(term).length >= 3) {
    sourcesTried.push("firecrawl");
    const fc = await fetchFromFirecrawl({ query: termQueryString(term), limit: 8 });
    await logFetch(supabase, term, "firecrawl", fc.ok, fc.httpStatus, fc.latencyMs, fc.publications.length, fc.error, 0.001);
    if (fc.ok) {
      for (const p of fc.publications) {
        collected.push({ pub: p, matchedField: matchedFieldFor(term), matchedSnippet: makeSnippet(p.content) });
      }
    }
  }

  // 3) Codilo (placeholder — só ativa se termo pediu e chave existir)
  if (term.use_paid_fallback && collected.length === 0 && process.env.CODILO_API_KEY) {
    sourcesTried.push("codilo");
    await logFetch(supabase, term, "codilo", false, undefined, 0, 0, "Fonte paga não implementada nesta versão.", 0);
  }

  if (collected.length === 0) {
    await supabase.from("monitoring_terms").update({ last_run_at: new Date().toISOString() }).eq("id", term.id);
    return { captured: 0, matched: 0, sourcesTried };
  }

  // Persistir com dedupe por (user_id, hash)
  let captured = 0;
  for (const { pub, matchedField, matchedSnippet } of collected) {
    const hash = publicationHash(pub);

    // Tentar auto-vincular a caso pelo CNJ
    let caseId: string | null = null;
    if (pub.cnj) {
      const digits = pub.cnj.replace(/\D/g, "");
      const { data: caseMatch } = await supabase
        .from("cases")
        .select("id")
        .eq("user_id", term.user_id)
        .not("case_number", "is", null)
        .limit(1)
        .filter("case_number", "ilike", `%${digits.slice(-10)}%`)
        .maybeSingle();
      caseId = caseMatch?.id ?? term.case_id ?? null;
    } else {
      caseId = term.case_id ?? null;
    }

    const { data: inserted, error } = await supabase
      .from("publications")
      .upsert(
        {
          user_id: term.user_id,
          source: pub.source,
          external_id: pub.external_id,
          tribunal: pub.tribunal,
          orgao: pub.orgao,
          publication_date: pub.publication_date,
          cnj: pub.cnj,
          content: pub.content,
          snippet: makeSnippet(pub.content),
          url_original: pub.url_original,
          hash,
          status: "new",
          case_id: caseId,
        },
        { onConflict: "user_id,hash", ignoreDuplicates: false },
      )
      .select("id, created_at")
      .single();

    if (error || !inserted) continue;

    // A publicação é "nova" para o feed apenas se acabou de ser inserida.
    // Como usamos upsert, comparamos created_at ~ agora (< 5s).
    const isNew = Date.now() - new Date(inserted.created_at).getTime() < 5000;
    if (isNew) captured++;

    // Registrar match (idempotente por unique)
    await supabase
      .from("publication_term_matches")
      .upsert(
        {
          publication_id: inserted.id,
          term_id: term.id,
          matched_field: matchedField,
          matched_snippet: matchedSnippet,
        },
        { onConflict: "publication_id,term_id", ignoreDuplicates: true },
      );

    // Se novo e vinculado a caso, criar tarefa com deadline
    if (isNew && caseId && term.deadline_days > 0) {
      const due = new Date();
      due.setDate(due.getDate() + term.deadline_days);
      const { data: task } = await supabase
        .from("tasks")
        .insert({
          user_id: term.user_id,
          case_id: caseId,
          title: `Publicação: ${pub.tribunal ?? "tribunal"} — ${makeSnippet(pub.content, 80)}`,
          description: pub.content.slice(0, 2000),
          status: "pending",
          priority: "high",
          due_date: due.toISOString(),
          assigned_to_user_id: term.responsible_user_id ?? term.user_id,
        })
        .select("id")
        .single();
      if (task?.id) {
        await supabase.from("publications").update({ task_id: task.id }).eq("id", inserted.id);
      }
    }
  }

  const matched = collected.length;
  await supabase.from("monitoring_terms").update({ last_run_at: new Date().toISOString() }).eq("id", term.id);

  return { captured, matched, sourcesTried };
}

function termQueryString(term: TermRow): string {
  if (term.kind === "oab") return normalizeOab(term.value, term.uf);
  return term.value.trim();
}

function matchedFieldFor(term: TermRow): string {
  return term.kind;
}

async function tryDjen(term: TermRow) {
  const base = { itensPorPagina: 50 as number };
  if (term.kind === "oab") {
    const [num, uf] = term.value.includes("/") ? term.value.split("/") : [term.value, term.uf ?? ""];
    return fetchFromDJEN({ ...base, numeroOab: `${num.replace(/\D/g, "")}/${(uf ?? "").toUpperCase()}` });
  }
  if (term.kind === "advogado") return fetchFromDJEN({ ...base, nomeAdvogado: term.value });
  if (term.kind === "parte") return fetchFromDJEN({ ...base, nomeParte: term.value });
  if (term.kind === "cnj") return fetchFromDJEN({ ...base, numeroProcesso: term.value });
  return { ok: false, latencyMs: 0, error: "kind desconhecido", publications: [] };
}

async function logFetch(
  supabase: SupabaseClient<Database>,
  term: TermRow,
  source: string,
  ok: boolean,
  httpStatus: number | undefined,
  latencyMs: number,
  results: number,
  error?: string,
  costUsd = 0,
) {
  await supabase.from("publication_fetch_log").insert({
    user_id: term.user_id,
    term_id: term.id,
    source,
    ok,
    http_status: httpStatus ?? null,
    latency_ms: latencyMs,
    results_count: results,
    error: error ?? null,
    cost_usd: costUsd,
  });
}

/** Uso apenas em busca ampla textual do feed. */
export function contentMatchesTerm(content: string, term: TermRow): boolean {
  const c = stripAccents(content);
  const v = stripAccents(term.value);
  return c.includes(v);
}
