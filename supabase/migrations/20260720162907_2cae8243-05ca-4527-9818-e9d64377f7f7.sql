
CREATE TABLE public.monitoring_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('oab','advogado','parte','cnj')),
  value text NOT NULL,
  uf text,
  label text,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  use_paid_fallback boolean NOT NULL DEFAULT false,
  deadline_days integer NOT NULL DEFAULT 5,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_terms TO authenticated;
GRANT ALL ON public.monitoring_terms TO service_role;

ALTER TABLE public.monitoring_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own monitoring terms"
  ON public.monitoring_terms FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX monitoring_terms_unique_idx
  ON public.monitoring_terms (user_id, kind, value, COALESCE(uf,''));
CREATE INDEX monitoring_terms_user_active_idx
  ON public.monitoring_terms (user_id, active);
CREATE INDEX monitoring_terms_active_idx
  ON public.monitoring_terms (active) WHERE active = true;

CREATE TRIGGER monitoring_terms_updated_at
  BEFORE UPDATE ON public.monitoring_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('djen','firecrawl','codilo','manual')),
  external_id text,
  tribunal text,
  orgao text,
  publication_date date,
  captured_at timestamptz NOT NULL DEFAULT now(),
  cnj text,
  content text NOT NULL,
  snippet text,
  url_original text,
  hash text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','archived')),
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own publications"
  ON public.publications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX publications_user_status_date_idx
  ON public.publications (user_id, status, publication_date DESC);
CREATE INDEX publications_user_cnj_idx
  ON public.publications (user_id, cnj);
CREATE INDEX publications_captured_idx
  ON public.publications (captured_at DESC);

CREATE TABLE public.publication_term_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.monitoring_terms(id) ON DELETE CASCADE,
  matched_field text,
  matched_snippet text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, term_id)
);

GRANT SELECT, INSERT, DELETE ON public.publication_term_matches TO authenticated;
GRANT ALL ON public.publication_term_matches TO service_role;

ALTER TABLE public.publication_term_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own publication matches"
  ON public.publication_term_matches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.publications p WHERE p.id = publication_id AND p.user_id = auth.uid()));

CREATE POLICY "Users insert own publication matches"
  ON public.publication_term_matches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.publications p WHERE p.id = publication_id AND p.user_id = auth.uid()));

CREATE POLICY "Users delete own publication matches"
  ON public.publication_term_matches FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.publications p WHERE p.id = publication_id AND p.user_id = auth.uid()));

CREATE INDEX publication_term_matches_term_idx
  ON public.publication_term_matches (term_id);
CREATE INDEX publication_term_matches_publication_idx
  ON public.publication_term_matches (publication_id);

CREATE TABLE public.publication_fetch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term_id uuid REFERENCES public.monitoring_terms(id) ON DELETE SET NULL,
  source text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  http_status integer,
  latency_ms integer,
  results_count integer NOT NULL DEFAULT 0,
  error text,
  cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.publication_fetch_log TO authenticated;
GRANT ALL ON public.publication_fetch_log TO service_role;

ALTER TABLE public.publication_fetch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own fetch log"
  ON public.publication_fetch_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX publication_fetch_log_user_idx
  ON public.publication_fetch_log (user_id, created_at DESC);
CREATE INDEX publication_fetch_log_term_idx
  ON public.publication_fetch_log (term_id, created_at DESC);
