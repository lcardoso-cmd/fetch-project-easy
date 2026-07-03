
-- 1) Remove redundant public-role policy on case_quesitos
DROP POLICY IF EXISTS "Users manage their own quesitos" ON public.case_quesitos;

-- 2) Allow invited users to read their own team invitations by matching auth email
CREATE POLICY "Invited users can read own invitations"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  OR accepted_by = auth.uid()
);

-- 3) Storage: allow team members to read/delete case document files based on documents table access
CREATE POLICY "Team members can read shared case documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = storage.objects.name
      AND d.case_id IS NOT NULL
      AND public.user_can_access_case(d.case_id, auth.uid())
  )
);

CREATE POLICY "Team editors can delete shared case documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.storage_path = storage.objects.name
      AND d.case_id IS NOT NULL
      AND public.user_can_edit_case(d.case_id, auth.uid())
  )
);

-- 4) Lock down SECURITY DEFINER functions: revoke EXECUTE from PUBLIC and anon
REVOKE EXECUTE ON FUNCTION public.has_capability(uuid, app_capability) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_staff(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_case(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_edit_case(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_customer_account_for_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure authenticated role can still call the helpers used by RLS policies
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, app_capability) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_case(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated;
