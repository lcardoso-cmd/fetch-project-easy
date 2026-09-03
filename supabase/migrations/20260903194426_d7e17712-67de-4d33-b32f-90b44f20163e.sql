REVOKE ALL ON FUNCTION public.org_operational_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.org_trial_end(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.org_effective_entitlements(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.org_subscription_mrr_cents(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_operational_state(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_trial_end(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_effective_entitlements(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.org_subscription_mrr_cents(integer, text) TO authenticated, service_role;