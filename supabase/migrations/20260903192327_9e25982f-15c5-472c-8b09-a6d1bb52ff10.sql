-- 1) Canal geral por organização
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_case_required;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('general','case','dm'));
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_case_required CHECK (
    (kind = 'case' AND case_id IS NOT NULL)
    OR (kind IN ('dm','general') AND case_id IS NULL)
  );

-- Chave normalizada do par de uma DM (ex.: "uuidA:uuidB" ordenado)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS dm_key text;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_general_unique
  ON public.conversations (organization_id) WHERE kind = 'general';
CREATE UNIQUE INDEX IF NOT EXISTS conversations_case_unique
  ON public.conversations (case_id) WHERE kind = 'case';
CREATE UNIQUE INDEX IF NOT EXISTS conversations_dm_unique
  ON public.conversations (organization_id, dm_key) WHERE kind = 'dm' AND dm_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_org_last_message_idx
  ON public.conversations (organization_id, last_message_at DESC);

-- 2) Mensagens: exclusão lógica + índices
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_org_created_idx
  ON public.messages (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_body_fts_idx
  ON public.messages USING gin (to_tsvector('portuguese', body));

CREATE INDEX IF NOT EXISTS participants_user_idx
  ON public.conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS mentions_user_created_idx
  ON public.message_mentions (mentioned_user_id, created_at DESC);

-- 3) Policies mais restritas
DROP POLICY IF EXISTS participants_insert ON public.conversation_participants;
CREATE POLICY participants_insert ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (
      user_id = auth.uid()
      OR public.is_conversation_participant(conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS participants_delete ON public.conversation_participants;
CREATE POLICY participants_delete ON public.conversation_participants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS mentions_insert ON public.message_mentions;
CREATE POLICY mentions_insert ON public.message_mentions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND public.is_conversation_participant(conversation_id, mentioned_user_id)
  );

-- 4) Anexos de conversa em bucket próprio (participantes apenas)
DROP POLICY IF EXISTS conversation_files_select ON storage.objects;
CREATE POLICY conversation_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'conversation-files'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND public.is_conversation_participant(((storage.foldername(name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS conversation_files_insert ON storage.objects;
CREATE POLICY conversation_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'conversation-files'
    AND public.is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
    AND public.is_conversation_participant(((storage.foldername(name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS conversation_files_delete ON storage.objects;
CREATE POLICY conversation_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'conversation-files'
    AND owner = auth.uid()
  );