CREATE POLICY "Case members can read document chunks" ON public.document_chunks FOR SELECT TO authenticated USING (case_id IS NOT NULL AND public.user_can_access_case(case_id, auth.uid()));

CREATE POLICY "Invited users can read invitation by token" ON public.team_invitations FOR SELECT TO authenticated USING (status = 'pending' AND token IS NOT NULL);