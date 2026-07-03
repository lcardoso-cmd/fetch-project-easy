
CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,
  cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  gateway_run_id text,
  case_id uuid,
  thread_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

CREATE INDEX ai_usage_events_created_idx ON public.ai_usage_events (created_at DESC);
CREATE INDEX ai_usage_events_user_created_idx ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX ai_usage_events_model_idx ON public.ai_usage_events (model, created_at DESC);
CREATE INDEX ai_usage_events_feature_idx ON public.ai_usage_events (feature, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_owner_select" ON public.ai_usage_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "ai_usage_admin_select" ON public.ai_usage_events
  FOR SELECT TO authenticated USING (
    public.has_capability(auth.uid(), 'office_admin'::app_capability)
    OR public.has_capability(auth.uid(), 'platform_admin'::app_capability)
    OR public.has_capability(auth.uid(), 'super_admin'::app_capability)
  );

CREATE POLICY "ai_usage_owner_insert" ON public.ai_usage_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.can_view_all_ai_usage(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_capability(_user_id, 'office_admin'::app_capability)
    OR public.has_capability(_user_id, 'platform_admin'::app_capability)
    OR public.has_capability(_user_id, 'super_admin'::app_capability);
$$;

CREATE OR REPLACE FUNCTION public.ai_usage_summary(_from timestamptz, _to timestamptz)
RETURNS TABLE (day date, calls bigint, prompt_tokens bigint, completion_tokens bigint, total_tokens bigint, cost_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day,
    COUNT(*)::bigint,
    COALESCE(SUM(prompt_tokens),0)::bigint,
    COALESCE(SUM(completion_tokens),0)::bigint,
    COALESCE(SUM(total_tokens),0)::bigint,
    COALESCE(SUM(cost_usd),0)::numeric
  FROM public.ai_usage_events
  WHERE created_at >= _from AND created_at < _to
    AND (public.can_view_all_ai_usage(auth.uid()) OR user_id = auth.uid())
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.ai_usage_by_user(_from timestamptz, _to timestamptz)
RETURNS TABLE (user_id uuid, full_name text, email text, calls bigint, prompt_tokens bigint, completion_tokens bigint, total_tokens bigint, cost_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.user_id,
    p.full_name,
    u.email::text,
    COUNT(*)::bigint,
    COALESCE(SUM(e.prompt_tokens),0)::bigint,
    COALESCE(SUM(e.completion_tokens),0)::bigint,
    COALESCE(SUM(e.total_tokens),0)::bigint,
    COALESCE(SUM(e.cost_usd),0)::numeric
  FROM public.ai_usage_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  LEFT JOIN auth.users u ON u.id = e.user_id
  WHERE e.created_at >= _from AND e.created_at < _to
    AND (public.can_view_all_ai_usage(auth.uid()) OR e.user_id = auth.uid())
  GROUP BY e.user_id, p.full_name, u.email
  ORDER BY 8 DESC;
$$;

CREATE OR REPLACE FUNCTION public.ai_usage_by_model(_from timestamptz, _to timestamptz)
RETURNS TABLE (model text, calls bigint, prompt_tokens bigint, completion_tokens bigint, total_tokens bigint, cost_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT model, COUNT(*)::bigint,
    COALESCE(SUM(prompt_tokens),0)::bigint,
    COALESCE(SUM(completion_tokens),0)::bigint,
    COALESCE(SUM(total_tokens),0)::bigint,
    COALESCE(SUM(cost_usd),0)::numeric
  FROM public.ai_usage_events
  WHERE created_at >= _from AND created_at < _to
    AND (public.can_view_all_ai_usage(auth.uid()) OR user_id = auth.uid())
  GROUP BY model ORDER BY 6 DESC;
$$;

CREATE OR REPLACE FUNCTION public.ai_usage_by_feature(_from timestamptz, _to timestamptz)
RETURNS TABLE (feature text, calls bigint, prompt_tokens bigint, completion_tokens bigint, total_tokens bigint, cost_usd numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT feature, COUNT(*)::bigint,
    COALESCE(SUM(prompt_tokens),0)::bigint,
    COALESCE(SUM(completion_tokens),0)::bigint,
    COALESCE(SUM(total_tokens),0)::bigint,
    COALESCE(SUM(cost_usd),0)::numeric
  FROM public.ai_usage_events
  WHERE created_at >= _from AND created_at < _to
    AND (public.can_view_all_ai_usage(auth.uid()) OR user_id = auth.uid())
  GROUP BY feature ORDER BY 6 DESC;
$$;
