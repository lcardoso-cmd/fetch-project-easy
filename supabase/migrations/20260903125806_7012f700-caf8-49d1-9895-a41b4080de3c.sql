-- 1. Metadados de procedência e versionamento nos trechos
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS page_start integer,
  ADD COLUMN IF NOT EXISTS page_end integer,
  ADD COLUMN IF NOT EXISTS section_title text,
  ADD COLUMN IF NOT EXISTS sheet_name text,
  ADD COLUMN IF NOT EXISTS row_start integer,
  ADD COLUMN IF NOT EXISTS row_end integer,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS chunking_version text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS token_count integer,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS document_chunks_doc_index_idx
  ON public.document_chunks (document_id, chunk_index);

-- 2. Log técnico de recuperação (sem conteúdo de documento)
CREATE TABLE IF NOT EXISTS public.rag_retrieval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid,
  thread_id uuid,
  question_chars integer NOT NULL DEFAULT 0,
  queries_used integer NOT NULL DEFAULT 1,
  keywords_used integer NOT NULL DEFAULT 0,
  candidates integer NOT NULL DEFAULT 0,
  retrieved integer NOT NULL DEFAULT 0,
  neighbors integer NOT NULL DEFAULT 0,
  documents_touched integer NOT NULL DEFAULT 0,
  sufficiency text,
  top_similarity numeric,
  reranker_used boolean NOT NULL DEFAULT false,
  reranker_reason text,
  retrieval_version text,
  chunking_versions text[],
  embedding_model text,
  model_tier text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.rag_retrieval_events TO authenticated;
GRANT ALL ON public.rag_retrieval_events TO service_role;
ALTER TABLE public.rag_retrieval_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own retrieval events" ON public.rag_retrieval_events;
CREATE POLICY "Users read own retrieval events"
  ON public.rag_retrieval_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS "Users insert own retrieval events" ON public.rag_retrieval_events;
CREATE POLICY "Users insert own retrieval events"
  ON public.rag_retrieval_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS rag_retrieval_events_user_created_idx
  ON public.rag_retrieval_events (user_id, created_at DESC);

-- 3. Busca híbrida v2: acesso efetivo ao caso + termos-chave + procedência
CREATE OR REPLACE FUNCTION public.hybrid_search_chunks_v2(
  query_embedding extensions.vector,
  query_text text,
  filter_case_id uuid,
  keyword_text text DEFAULT NULL,
  filter_doc_ids uuid[] DEFAULT NULL,
  match_count integer DEFAULT 24,
  rrf_k integer DEFAULT 60
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  case_id uuid,
  chunk_index integer,
  content text,
  source_kind text,
  page_start integer,
  page_end integer,
  section_title text,
  sheet_name text,
  row_start integer,
  row_end integer,
  chunking_version text,
  vector_similarity double precision,
  fts_rank double precision,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  WITH allowed AS (
    SELECT public.user_can_access_case(filter_case_id, auth.uid()) AS ok
  ),
  base AS (
    SELECT c.*
    FROM public.document_chunks c, allowed a
    WHERE a.ok
      AND c.case_id = filter_case_id
      AND (filter_doc_ids IS NULL OR c.document_id = ANY (filter_doc_ids))
  ),
  v AS (
    SELECT b.id,
           1 - (b.embedding <=> query_embedding) AS vector_similarity,
           ROW_NUMBER() OVER (ORDER BY b.embedding <=> query_embedding) AS rn
    FROM base b
    ORDER BY b.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  f AS (
    SELECT b.id,
           ts_rank(b.content_tsv, plainto_tsquery('portuguese', query_text)) AS fts_rank,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(b.content_tsv, plainto_tsquery('portuguese', query_text)) DESC
           ) AS rn
    FROM base b
    WHERE b.content_tsv @@ plainto_tsquery('portuguese', query_text)
    ORDER BY fts_rank DESC
    LIMIT match_count * 3
  ),
  kw AS (
    SELECT b.id,
           ts_rank(b.content_tsv, plainto_tsquery('portuguese', keyword_text)) AS kw_rank,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(b.content_tsv, plainto_tsquery('portuguese', keyword_text)) DESC
           ) AS rn
    FROM base b
    WHERE keyword_text IS NOT NULL
      AND length(btrim(keyword_text)) > 0
      AND b.content_tsv @@ plainto_tsquery('portuguese', keyword_text)
    ORDER BY kw_rank DESC
    LIMIT match_count * 3
  ),
  fused AS (
    SELECT COALESCE(v.id, f.id, kw.id) AS id,
           COALESCE(v.vector_similarity, 0) AS vector_similarity,
           GREATEST(COALESCE(f.fts_rank, 0), COALESCE(kw.kw_rank, 0)) AS fts_rank,
           (CASE WHEN v.rn IS NOT NULL THEN 1.0 / (rrf_k + v.rn) ELSE 0 END) +
           (CASE WHEN f.rn IS NOT NULL THEN 1.0 / (rrf_k + f.rn) ELSE 0 END) +
           (CASE WHEN kw.rn IS NOT NULL THEN 0.5 / (rrf_k + kw.rn) ELSE 0 END) AS score
    FROM v
    FULL OUTER JOIN f ON f.id = v.id
    FULL OUTER JOIN kw ON kw.id = COALESCE(v.id, f.id)
  )
  SELECT b.id, b.document_id, b.case_id, b.chunk_index, b.content, b.source_kind,
         b.page_start, b.page_end, b.section_title, b.sheet_name, b.row_start, b.row_end,
         b.chunking_version,
         fused.vector_similarity, fused.fts_rank, fused.score
  FROM fused
  JOIN base b ON b.id = fused.id
  ORDER BY fused.score DESC
  LIMIT match_count;
$function$;

REVOKE ALL ON FUNCTION public.hybrid_search_chunks_v2(extensions.vector, text, uuid, text, uuid[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hybrid_search_chunks_v2(extensions.vector, text, uuid, text, uuid[], integer, integer) TO authenticated, service_role;

-- 4. Trechos vizinhos para contexto
CREATE OR REPLACE FUNCTION public.fetch_chunk_neighbors(
  filter_case_id uuid,
  doc_ids uuid[],
  chunk_indexes integer[]
)
RETURNS TABLE(
  id uuid,
  document_id uuid,
  case_id uuid,
  chunk_index integer,
  content text,
  source_kind text,
  page_start integer,
  page_end integer,
  section_title text,
  sheet_name text,
  row_start integer,
  row_end integer,
  chunking_version text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.document_id, c.case_id, c.chunk_index, c.content, c.source_kind,
         c.page_start, c.page_end, c.section_title, c.sheet_name, c.row_start, c.row_end,
         c.chunking_version
  FROM public.document_chunks c
  JOIN unnest(doc_ids, chunk_indexes) AS t(doc_id, idx)
    ON t.doc_id = c.document_id AND t.idx = c.chunk_index
  WHERE c.case_id = filter_case_id
    AND public.user_can_access_case(filter_case_id, auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.fetch_chunk_neighbors(uuid, uuid[], integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_chunk_neighbors(uuid, uuid[], integer[]) TO authenticated, service_role;