CREATE TABLE public.ai_response_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  document_version text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('fast', 'balanced', 'max')),
  response_content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (organization_id, cache_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_response_cache TO authenticated;
GRANT ALL ON public.ai_response_cache TO service_role;
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_response_cache_select ON public.ai_response_cache FOR SELECT TO authenticated USING (public.user_can_access_case(case_id, auth.uid()) AND public.has_org_permission(organization_id, auth.uid(), 'ai.use'));
CREATE POLICY ai_response_cache_insert ON public.ai_response_cache FOR INSERT TO authenticated WITH CHECK (public.user_can_access_case(case_id, auth.uid()) AND public.has_org_permission(organization_id, auth.uid(), 'ai.use'));
CREATE POLICY ai_response_cache_update ON public.ai_response_cache FOR UPDATE TO authenticated USING (public.user_can_access_case(case_id, auth.uid()) AND public.has_org_permission(organization_id, auth.uid(), 'ai.use')) WITH CHECK (public.user_can_access_case(case_id, auth.uid()) AND public.has_org_permission(organization_id, auth.uid(), 'ai.use'));
CREATE POLICY ai_response_cache_delete ON public.ai_response_cache FOR DELETE TO authenticated USING (public.user_can_access_case(case_id, auth.uid()) AND public.has_org_permission(organization_id, auth.uid(), 'ai.use'));
CREATE INDEX idx_ai_response_cache_expiry ON public.ai_response_cache (expires_at);
CREATE INDEX idx_ai_response_cache_case ON public.ai_response_cache (organization_id, case_id);
CREATE TRIGGER update_ai_response_cache_updated_at BEFORE UPDATE ON public.ai_response_cache FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();