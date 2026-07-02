
ALTER TABLE public.ai_chat_messages
  ADD COLUMN IF NOT EXISTS input_kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_duration_ms integer;

ALTER TABLE public.ai_chat_messages
  DROP CONSTRAINT IF EXISTS ai_chat_messages_input_kind_check;
ALTER TABLE public.ai_chat_messages
  ADD CONSTRAINT ai_chat_messages_input_kind_check
  CHECK (input_kind IN ('text','voice'));

-- Storage policies for chat-audio bucket (created via storage tool). Users may
-- only read/write objects inside their own uid folder.
DO $$ BEGIN
  CREATE POLICY "chat_audio_owner_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'chat-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "chat_audio_owner_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'chat-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "chat_audio_owner_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'chat-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
