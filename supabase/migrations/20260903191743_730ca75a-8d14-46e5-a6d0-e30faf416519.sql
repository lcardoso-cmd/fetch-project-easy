DROP POLICY IF EXISTS cases_select ON public.cases;

CREATE POLICY cases_select ON public.cases
FOR SELECT TO authenticated
USING (
  (
    public.is_org_member(organization_id, auth.uid())
    AND (
      created_by_user_id = auth.uid()
      OR public.has_org_permission(organization_id, auth.uid(), 'cases.view_all'::public.org_permission)
      OR EXISTS (
        SELECT 1 FROM public.case_access a
        WHERE a.case_id = cases.id AND a.user_id = auth.uid()
      )
    )
  )
  OR public.support_can_read(organization_id, auth.uid())
);