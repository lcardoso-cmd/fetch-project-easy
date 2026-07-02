-- 1) Novos campos no perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'pessoa_fisica',
  ADD COLUMN IF NOT EXISTS firm_name text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS firm_address text,
  ADD COLUMN IF NOT EXISTS firm_website text,
  ADD COLUMN IF NOT EXISTS logo_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_entity_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_entity_type_check
      CHECK (entity_type IN ('pessoa_fisica','pessoa_juridica'));
  END IF;
END $$;

-- 2) Políticas do bucket firm-logos (privado)
DROP POLICY IF EXISTS "firm-logos: owner read"    ON storage.objects;
DROP POLICY IF EXISTS "firm-logos: owner insert"  ON storage.objects;
DROP POLICY IF EXISTS "firm-logos: owner update"  ON storage.objects;
DROP POLICY IF EXISTS "firm-logos: owner delete"  ON storage.objects;

CREATE POLICY "firm-logos: owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "firm-logos: owner insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "firm-logos: owner update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "firm-logos: owner delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'firm-logos' AND (storage.foldername(name))[1] = auth.uid()::text);