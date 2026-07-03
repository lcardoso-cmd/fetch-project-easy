DROP POLICY IF EXISTS "office admin grants to members" ON public.user_capabilities;
DROP POLICY IF EXISTS "office admin revokes from members" ON public.user_capabilities;

CREATE POLICY "office admin grants to members"
ON public.user_capabilities
FOR INSERT
TO authenticated
WITH CHECK (
  has_capability(auth.uid(), 'office_admin'::app_capability)
  AND capability NOT IN ('super_admin'::app_capability, 'platform_admin'::app_capability, 'office_admin'::app_capability)
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.member_user_id = user_capabilities.user_id
  )
);

CREATE POLICY "office admin revokes from members"
ON public.user_capabilities
FOR DELETE
TO authenticated
USING (
  has_capability(auth.uid(), 'office_admin'::app_capability)
  AND capability NOT IN ('super_admin'::app_capability, 'platform_admin'::app_capability, 'office_admin'::app_capability)
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.member_user_id = user_capabilities.user_id
  )
);