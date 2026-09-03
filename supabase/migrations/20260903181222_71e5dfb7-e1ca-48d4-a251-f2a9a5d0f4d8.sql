ALTER FUNCTION public.crm_digits(text) SET search_path = public;
ALTER FUNCTION public.crm_normalize_email(text) SET search_path = public;

CREATE OR REPLACE FUNCTION public.crm_can_view_all(_organization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.has_org_permission(_organization_id, _user_id, 'crm.view_all')
      OR public.has_org_permission(_organization_id, _user_id, 'crm.manage_all');
$$;

CREATE OR REPLACE FUNCTION public.crm_can_write(_organization_id uuid, _user_id uuid, _owner_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.has_org_permission(_organization_id, _user_id, 'crm.manage_all')
      OR (
        public.has_org_permission(_organization_id, _user_id, 'crm.manage_own')
        AND (_owner_user_id IS NULL OR _owner_user_id = _user_id)
      );
$$;