
-- 1) cross_case_data_injection: tighten WITH CHECK on owner policies
DROP POLICY IF EXISTS "Owner manages own tasks" ON public.tasks;
CREATE POLICY "Owner manages own tasks" ON public.tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (case_id IS NULL OR public.user_can_edit_case(case_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owner manages own events" ON public.events;
CREATE POLICY "Owner manages own events" ON public.events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (case_id IS NULL OR public.user_can_edit_case(case_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owner manages own quesitos" ON public.case_quesitos;
CREATE POLICY "Owner manages own quesitos" ON public.case_quesitos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (case_id IS NULL OR public.user_can_edit_case(case_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owner manages own documents" ON public.documents;
CREATE POLICY "Owner manages own documents" ON public.documents
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (case_id IS NULL OR public.user_can_edit_case(case_id, auth.uid()))
  );

-- 2) office_admin_global_ai_usage: restrict platform-wide AI usage visibility
--    to platform_admin/super_admin only. Office admins now see only their own
--    usage rows via the fallback user_id = auth.uid() branch in the aggregate
--    functions and RLS policies.
CREATE OR REPLACE FUNCTION public.can_view_all_ai_usage(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_capability(_user_id, 'platform_admin'::app_capability)
    OR public.has_capability(_user_id, 'super_admin'::app_capability);
$$;

-- 3) SUPA_anon_security_definer_function_executable:
--    remove EXECUTE from anon and PUBLIC on SECURITY DEFINER aggregate helpers.
REVOKE EXECUTE ON FUNCTION public.ai_usage_by_feature(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ai_usage_by_model(timestamptz, timestamptz)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ai_usage_by_user(timestamptz, timestamptz)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_all_ai_usage(uuid)                   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ai_usage_by_feature(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_usage_by_model(timestamptz, timestamptz)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_usage_by_user(timestamptz, timestamptz)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, timestamptz)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_all_ai_usage(uuid)                   TO authenticated, service_role;
