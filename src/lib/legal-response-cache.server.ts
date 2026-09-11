import type { Citation, Tier } from "./chat-rag.server";

const CACHE_TTL_MS = 10 * 60 * 1000;

const ACTION_PATTERN = /\b(cri(e|ar)|adicione|agende|registre|gere|redija|produza|monte|pesquise jurisprudência|precedente|súmula|atualize|exclua)\b/i;

export function isSafeLegalCacheQuestion(question: string, hasImages: boolean): boolean {
  return !hasImages && question.length <= 2000 && !ACTION_PATTERN.test(question);
}

export async function buildLegalCacheKey(input: {
  organizationId: string;
  caseId: string;
  question: string;
  selectedDocIds: string[];
  documentVersion: string;
  tier: Tier;
}): Promise<string> {
  const payload = JSON.stringify({
    v: 1,
    organizationId: input.organizationId,
    caseId: input.caseId,
    q: input.question.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"),
    docs: [...input.selectedDocIds].sort(),
    documentVersion: input.documentVersion,
    tier: input.tier,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getLegalCache(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  key: string;
}): Promise<{ content: string; citations: Citation[] } | null> {
  const { data } = await opts.supabase
    .from("ai_response_cache")
    .select("response_content, citations")
    .eq("organization_id", opts.organizationId)
    .eq("cache_key", opts.key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data) return null;
  return {
    content: String(data.response_content ?? ""),
    citations: Array.isArray(data.citations) ? data.citations as Citation[] : [],
  };
}

export async function setLegalCache(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  organizationId: string;
  caseId: string;
  key: string;
  documentVersion: string;
  tier: Tier;
  content: string;
  citations: Citation[];
}) {
  await opts.supabase.from("ai_response_cache").upsert({
    organization_id: opts.organizationId,
    case_id: opts.caseId,
    cache_key: opts.key,
    document_version: opts.documentVersion,
    mode: opts.tier,
    response_content: opts.content,
    citations: opts.citations,
    expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  }, { onConflict: "organization_id,cache_key" });
}