
-- Adicionar campos extras à tabela cases inspirados no Jurismind original
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS case_number text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS case_type text,
  ADD COLUMN IF NOT EXISTS parties jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz;

-- Storage RLS policies para o bucket 'documents' (privado, escopo por user_id no caminho)
-- Caminho esperado: {user_id}/{case_id}/{filename}
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can read own documents') THEN
    CREATE POLICY "Users can read own documents"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can upload own documents') THEN
    CREATE POLICY "Users can upload own documents"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Users can delete own documents') THEN
    CREATE POLICY "Users can delete own documents"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
