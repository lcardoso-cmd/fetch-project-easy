-- Suporte a documentos raiz de divisão (agrupador sem arquivo próprio)
ALTER TABLE public.documents
  ALTER COLUMN storage_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS split_group_id uuid;

CREATE INDEX IF NOT EXISTS idx_documents_split_group ON public.documents(split_group_id);

COMMENT ON COLUMN public.documents.split_group_id IS 'Identificador compartilhado entre partes de um mesmo documento dividido.';
