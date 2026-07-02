
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS documents_case_content_hash_uniq
  ON public.documents (case_id, content_hash)
  WHERE content_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS documents_case_filename_uniq
  ON public.documents (case_id, filename);
