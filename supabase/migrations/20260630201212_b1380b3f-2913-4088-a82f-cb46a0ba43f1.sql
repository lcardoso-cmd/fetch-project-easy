
-- =========================================================================
-- 1. TEAM: link members to real auth users, add role, invitations
-- =========================================================================

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS member_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'editor'
    CHECK (access_role IN ('viewer','editor','admin'));

CREATE INDEX IF NOT EXISTS team_members_member_user_idx
  ON public.team_members(member_user_id) WHERE member_user_id IS NOT NULL;

-- A member account can only be linked once per owner workspace
CREATE UNIQUE INDEX IF NOT EXISTS team_members_owner_member_unique
  ON public.team_members(user_id, member_user_id) WHERE member_user_id IS NOT NULL;

-- Allow members to read their own membership rows (so client can resolve workspaces they belong to)
DROP POLICY IF EXISTS "Members can read own membership" ON public.team_members;
CREATE POLICY "Members can read own membership" ON public.team_members
  FOR SELECT TO authenticated
  USING (auth.uid() = member_user_id);

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_invitations_owner_idx ON public.team_invitations(owner_user_id);
CREATE INDEX IF NOT EXISTS team_invitations_email_idx ON public.team_invitations(lower(email)) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own invitations" ON public.team_invitations
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

CREATE TRIGGER update_team_invitations_updated_at
  BEFORE UPDATE ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 2. CASE ACCESS: helper + extend RLS for cases/documents/tasks/events/quesitos
-- =========================================================================

CREATE OR REPLACE FUNCTION public.user_can_access_case(_case_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = _case_id
      AND (
        c.user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.user_id = c.user_id
            AND tm.member_user_id = _user_id
            AND tm.id = ANY (c.team_member_ids)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_edit_case(_case_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cases c
    WHERE c.id = _case_id
      AND (
        c.user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.user_id = c.user_id
            AND tm.member_user_id = _user_id
            AND tm.id = ANY (c.team_member_ids)
            AND tm.access_role IN ('editor','admin')
        )
      )
  );
$$;

-- CASES: extend SELECT/UPDATE to invited members
DROP POLICY IF EXISTS "Users can manage own cases" ON public.cases;
CREATE POLICY "Owner manages own cases" ON public.cases
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can view shared cases" ON public.cases
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = cases.user_id
      AND tm.member_user_id = auth.uid()
      AND tm.id = ANY (cases.team_member_ids)
  ));
CREATE POLICY "Editors can update shared cases" ON public.cases
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = cases.user_id
      AND tm.member_user_id = auth.uid()
      AND tm.id = ANY (cases.team_member_ids)
      AND tm.access_role IN ('editor','admin')
  ));

-- DOCUMENTS
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
CREATE POLICY "Owner manages own documents" ON public.documents
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can view case documents" ON public.documents
  FOR SELECT TO authenticated
  USING (case_id IS NOT NULL AND public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY "Members can add case documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (case_id IS NOT NULL AND public.user_can_edit_case(case_id, auth.uid()));

-- TASKS
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;
CREATE POLICY "Owner manages own tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can view case tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (case_id IS NOT NULL AND public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY "Members can manage case tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (case_id IS NOT NULL AND public.user_can_edit_case(case_id, auth.uid()));
CREATE POLICY "Members can update case tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (case_id IS NOT NULL AND public.user_can_edit_case(case_id, auth.uid()));

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_message_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- EVENTS
DROP POLICY IF EXISTS "Users can manage own events" ON public.events;
CREATE POLICY "Owner manages own events" ON public.events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can view case events" ON public.events
  FOR SELECT TO authenticated
  USING (case_id IS NOT NULL AND public.user_can_access_case(case_id, auth.uid()));

-- QUESITOS
DROP POLICY IF EXISTS "Users can manage own quesitos" ON public.case_quesitos;
CREATE POLICY "Owner manages own quesitos" ON public.case_quesitos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can view case quesitos" ON public.case_quesitos
  FOR SELECT TO authenticated
  USING (case_id IS NOT NULL AND public.user_can_access_case(case_id, auth.uid()));

-- PROFILES: anyone authenticated can read profile basics of other team members they share a workspace with
DROP POLICY IF EXISTS "Members can read shared profiles" ON public.profiles;
CREATE POLICY "Members can read shared profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.member_user_id = profiles.id
        AND (
          tm.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.team_members me
            WHERE me.user_id = tm.user_id AND me.member_user_id = auth.uid()
          )
        )
    )
  );

GRANT SELECT ON public.profiles TO authenticated;

-- =========================================================================
-- 3. CHAT TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('case','dm')),
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  title text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_case_required CHECK (
    (kind = 'case' AND case_id IS NOT NULL) OR (kind = 'dm' AND case_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_case_unique
  ON public.conversations(case_id) WHERE kind = 'case';
CREATE INDEX IF NOT EXISTS conversations_last_message_idx
  ON public.conversations(last_message_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS conv_participants_user_idx ON public.conversation_participants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Helper to check participation without recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

CREATE POLICY "Participants can read conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));
CREATE POLICY "Authenticated users can create conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Participants can update conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()));

CREATE POLICY "Participants read participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants update own read" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Creator can add participants" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
    OR public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages(conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Authors edit own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, mentioned_user_id)
);
CREATE INDEX IF NOT EXISTS message_mentions_user_idx
  ON public.message_mentions(mentioned_user_id, read_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_mentions TO authenticated;
GRANT ALL ON public.message_mentions TO service_role;
ALTER TABLE public.message_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentioned user reads own mention" ON public.message_mentions
  FOR SELECT TO authenticated
  USING (mentioned_user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Author inserts mentions" ON public.message_mentions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Mentioned user updates own mention" ON public.message_mentions
  FOR UPDATE TO authenticated
  USING (mentioned_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_tasks (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, task_id)
);
GRANT SELECT, INSERT, DELETE ON public.message_tasks TO authenticated;
GRANT ALL ON public.message_tasks TO service_role;
ALTER TABLE public.message_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants link tasks" ON public.message_tasks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m
                 WHERE m.id = message_id
                   AND public.is_conversation_participant(m.conversation_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m
                      WHERE m.id = message_id
                        AND public.is_conversation_participant(m.conversation_id, auth.uid())));

-- =========================================================================
-- 4. TRIGGERS: bump conversation last_message_at on new message
-- =========================================================================

CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at, updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_conversation ON public.messages;
CREATE TRIGGER messages_bump_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 5. REALTIME
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_mentions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
