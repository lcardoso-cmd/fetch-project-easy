REVOKE ALL ON FUNCTION public.claim_intake_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_index_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_intake_jobs(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_index_jobs(text, integer, integer) TO service_role;