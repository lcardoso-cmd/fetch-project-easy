-- Revoga execução anônima em todas as novas funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.has_platform_role(uuid, public.platform_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_member_role(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_org_permission(uuid, uuid, public.org_permission) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_effective_permissions(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.support_has_active_grant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_is_active(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_can_use_ai(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_active_owner_count(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_role_default_permissions(public.org_role) FROM anon;

-- Verificação de acesso do suporte: uso restrito ao servidor
REVOKE EXECUTE ON FUNCTION public.support_has_active_grant(uuid, uuid) FROM authenticated;