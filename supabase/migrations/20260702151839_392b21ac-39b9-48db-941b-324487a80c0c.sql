
-- proposal_drafts
CREATE TABLE public.proposal_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  form jsonb NOT NULL DEFAULT '{}'::jsonb,
  output text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX proposal_drafts_user_case_uidx
  ON public.proposal_drafts (user_id, COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_drafts TO authenticated;
GRANT ALL ON public.proposal_drafts TO service_role;

ALTER TABLE public.proposal_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own proposal drafts"
  ON public.proposal_drafts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_proposal_drafts_updated_at
  BEFORE UPDATE ON public.proposal_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- proposal_versions
CREATE TABLE public.proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  origin text NOT NULL CHECK (origin IN ('manual','auto-generate','auto-restore')),
  pinned boolean NOT NULL DEFAULT false,
  form jsonb NOT NULL DEFAULT '{}'::jsonb,
  output text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX proposal_versions_user_case_created_idx
  ON public.proposal_versions (user_id, case_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_versions TO authenticated;
GRANT ALL ON public.proposal_versions TO service_role;

ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own proposal versions"
  ON public.proposal_versions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger de limite: manter até 50 não-fixadas por (user_id, case_id)
CREATE OR REPLACE FUNCTION public.enforce_proposal_versions_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  keep_count int := 50;
BEGIN
  DELETE FROM public.proposal_versions v
  WHERE v.id IN (
    SELECT id FROM public.proposal_versions
    WHERE user_id = NEW.user_id
      AND COALESCE(case_id::text, '') = COALESCE(NEW.case_id::text, '')
      AND pinned = false
    ORDER BY created_at DESC
    OFFSET keep_count
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_proposal_versions_limit
  AFTER INSERT ON public.proposal_versions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_proposal_versions_limit();
