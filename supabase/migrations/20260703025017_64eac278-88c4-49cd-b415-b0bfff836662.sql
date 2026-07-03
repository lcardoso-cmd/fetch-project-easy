
REVOKE EXECUTE ON FUNCTION public.ai_usage_current_month_cost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_current_month_cost(uuid) TO service_role;
