-- Divisão automática de documentos grandes em partes
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS part_index int,
  ADD COLUMN IF NOT EXISTS part_count int,
  ADD COLUMN IF NOT EXISTS page_offset int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_count int,
  ADD COLUMN IF NOT EXISTS is_split_root boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documents_parent ON public.documents(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent_part ON public.documents(parent_document_id, part_index);

COMMENT ON COLUMN public.documents.parent_document_id IS 'Documento original quando este registro é uma parte gerada automaticamente.';
COMMENT ON COLUMN public.documents.part_index IS 'Índice da parte (1-based) quando o documento foi dividido.';
COMMENT ON COLUMN public.documents.part_count IS 'Total de partes em que o documento original foi dividido.';
COMMENT ON COLUMN public.documents.page_offset IS 'Número de páginas anteriores a esta parte no documento original (para citações apontarem à página correta).';
COMMENT ON COLUMN public.documents.page_count IS 'Quantidade de páginas desta parte ou do documento inteiro.';
COMMENT ON COLUMN public.documents.is_split_root IS 'True para o documento-pai que agrupa as partes geradas automaticamente.';
