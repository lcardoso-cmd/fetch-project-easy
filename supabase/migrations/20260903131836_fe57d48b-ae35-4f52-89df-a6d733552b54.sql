DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'has_platform_role','is_platform_user','is_org_member','org_member_role',
        'has_org_permission','org_effective_permissions','support_has_active_grant',
        'org_is_active','org_can_use_ai','org_active_owner_count'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.proname <> 'support_has_active_grant' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.org_role_default_permissions(public.org_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_role_default_permissions(public.org_role) TO authenticated, service_role;