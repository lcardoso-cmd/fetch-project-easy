
-- Remove the overly broad team invitations SELECT policy that let any
-- authenticated user enumerate every pending invitation. The remaining
-- policy already scopes reads to the invited email or accepted user;
-- token lookups still work server-side via supabaseAdmin (peekInvitation).
DROP POLICY IF EXISTS "Invited users can read invitation by token" ON public.team_invitations;

-- Tighten document_chunks: users can only insert/update chunks tied
-- to cases they can edit. The existing SELECT policy for case members
-- stays in place.
DROP POLICY IF EXISTS "Users can manage own chunks" ON public.document_chunks;

CREATE POLICY "Users read own chunks"
  ON public.document_chunks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own chunks scoped to case"
  ON public.document_chunks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      case_id IS NULL
      OR public.user_can_edit_case(case_id, auth.uid())
    )
  );

CREATE POLICY "Users update own chunks scoped to case"
  ON public.document_chunks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      case_id IS NULL
      OR public.user_can_edit_case(case_id, auth.uid())
    )
  );

CREATE POLICY "Users delete own chunks"
  ON public.document_chunks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
