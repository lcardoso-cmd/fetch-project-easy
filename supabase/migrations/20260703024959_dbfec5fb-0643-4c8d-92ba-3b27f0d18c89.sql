
CREATE TABLE public.ai_budgets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_limit_usd numeric(10,2) NOT NULL DEFAULT 0,
  warn_threshold_pct integer NOT NULL DEFAULT 80,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_budgets_limit_nonneg CHECK (monthly_limit_usd >= 0),
  CONSTRAINT ai_budgets_warn_pct_range CHECK (warn_threshold_pct BETWEEN 1 AND 100)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_budgets TO authenticated;
GRANT ALL ON public.ai_budgets TO service_role;

ALTER TABLE public.ai_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_budgets_owner_all"
  ON public.ai_budgets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ai_budgets_admin_select"
  ON public.ai_budgets FOR SELECT
  TO authenticated
  USING (public.can_view_all_ai_usage(auth.uid()));

-- Soma o custo do mês corrente (America/Sao_Paulo) do usuário.
CREATE OR REPLACE FUNCTION public.ai_usage_current_month_cost(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(cost_usd), 0)::numeric
  FROM public.ai_usage_events
  WHERE user_id = _user_id
    AND created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';
$$;
