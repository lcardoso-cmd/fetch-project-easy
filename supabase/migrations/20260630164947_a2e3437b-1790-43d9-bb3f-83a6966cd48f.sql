-- Fix security linter warnings

-- 1. Move vector extension to dedicated schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- 2. Recreate match_chunks with explicit search_path and correct vector type
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding extensions.vector,
  match_count INT DEFAULT 5,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  case_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE SQL STABLE
SET search_path = public, extensions
AS $$
  SELECT
    c.id,
    c.document_id,
    c.case_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks c
  WHERE filter_user_id IS NULL OR c.user_id = filter_user_id
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks(extensions.vector, INT, UUID) TO authenticated;
GRANT ALL ON FUNCTION public.match_chunks(extensions.vector, INT, UUID) TO service_role;
