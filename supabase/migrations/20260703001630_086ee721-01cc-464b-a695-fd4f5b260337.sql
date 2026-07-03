
CREATE TABLE public.proposal_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  title text NOT NULL,
  client_name text,
  html text NOT NULL,
  page_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover jsonb,
  watermark jsonb,
  password_salt text,
  password_hash text,
  max_downloads integer,
  download_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX proposal_shares_user_id_created_idx
  ON public.proposal_shares (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_shares TO authenticated;
GRANT ALL ON public.proposal_shares TO service_role;

ALTER TABLE public.proposal_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their proposal shares"
  ON public.proposal_shares
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
