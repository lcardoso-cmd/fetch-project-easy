
REVOKE EXECUTE ON FUNCTION public.has_capability(uuid, public.app_capability) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_capability(uuid, public.app_capability) TO service_role;
