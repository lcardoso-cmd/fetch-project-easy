
-- Coluna para diferenciar chunks de texto normal vs visão (OCR/multimodal)
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'text';

-- Full-text search em português
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS document_chunks_content_tsv_idx
  ON public.document_chunks USING GIN (content_tsv);

-- Busca híbrida: combina similaridade vetorial + full-text via Reciprocal Rank Fusion
CREATE OR REPLACE FUNCTION public.hybrid_search_chunks(
  query_embedding extensions.vector,
  query_text text,
  filter_user_id uuid,
  filter_case_id uuid DEFAULT NULL,
  filter_doc_ids uuid[] DEFAULT NULL,
  match_count int DEFAULT 24,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  case_id uuid,
  content text,
  source_kind text,
  vector_similarity double precision,
  fts_rank double precision,
  score double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  WITH v AS (
    SELECT c.id, c.document_id, c.case_id, c.content, c.source_kind,
           1 - (c.embedding <=> query_embedding) AS vector_similarity,
           ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rn
    FROM public.document_chunks c
    WHERE c.user_id = filter_user_id
      AND (filter_case_id IS NULL OR c.case_id = filter_case_id)
      AND (filter_doc_ids IS NULL OR c.document_id = ANY (filter_doc_ids))
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  f AS (
    SELECT c.id, c.document_id, c.case_id, c.content, c.source_kind,
           ts_rank(c.content_tsv, plainto_tsquery('portuguese', query_text)) AS fts_rank,
           ROW_NUMBER() OVER (
             ORDER BY ts_rank(c.content_tsv, plainto_tsquery('portuguese', query_text)) DESC
           ) AS rn
    FROM public.document_chunks c
    WHERE c.user_id = filter_user_id
      AND (filter_case_id IS NULL OR c.case_id = filter_case_id)
      AND (filter_doc_ids IS NULL OR c.document_id = ANY (filter_doc_ids))
      AND c.content_tsv @@ plainto_tsquery('portuguese', query_text)
    ORDER BY fts_rank DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT COALESCE(v.id, f.id) AS id,
           COALESCE(v.document_id, f.document_id) AS document_id,
           COALESCE(v.case_id, f.case_id) AS case_id,
           COALESCE(v.content, f.content) AS content,
           COALESCE(v.source_kind, f.source_kind) AS source_kind,
           COALESCE(v.vector_similarity, 0) AS vector_similarity,
           COALESCE(f.fts_rank, 0) AS fts_rank,
           (CASE WHEN v.rn IS NOT NULL THEN 1.0 / (rrf_k + v.rn) ELSE 0 END) +
           (CASE WHEN f.rn IS NOT NULL THEN 1.0 / (rrf_k + f.rn) ELSE 0 END) AS score
    FROM v
    FULL OUTER JOIN f ON f.id = v.id
  )
  SELECT id, document_id, case_id, content, source_kind,
         vector_similarity, fts_rank, score
  FROM combined
  ORDER BY score DESC
  LIMIT match_count;
$$;
