create or replace function public.match_chunks_scoped(
  query_embedding extensions.vector,
  filter_user_id uuid,
  filter_case_id uuid default null,
  filter_doc_ids uuid[] default null,
  match_count int default 24
)
returns table (
  id uuid,
  document_id uuid,
  case_id uuid,
  content text,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    c.case_id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where c.user_id = filter_user_id
    and (filter_case_id is null or c.case_id = filter_case_id)
    and (filter_doc_ids is null or c.document_id = any(filter_doc_ids))
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
