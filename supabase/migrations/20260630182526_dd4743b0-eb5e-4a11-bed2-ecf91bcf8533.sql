
CREATE TABLE public.google_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.google_connections TO authenticated;
GRANT ALL ON public.google_connections TO service_role;
ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own google connection" ON public.google_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own google connection" ON public.google_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.google_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
