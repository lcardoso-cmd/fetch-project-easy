
CREATE TABLE public.outlook_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outlook_email text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlook_connections TO authenticated;
GRANT ALL ON public.outlook_connections TO service_role;
ALTER TABLE public.outlook_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own outlook connection" ON public.outlook_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own outlook connection" ON public.outlook_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own outlook connection" ON public.outlook_connections
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own outlook connection" ON public.outlook_connections
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_outlook_connections_updated_at
  BEFORE UPDATE ON public.outlook_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.outlook_oauth_states (
  state text NOT NULL PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

GRANT ALL ON public.outlook_oauth_states TO service_role;
ALTER TABLE public.outlook_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to outlook oauth states" ON public.outlook_oauth_states
  FOR ALL USING (false) WITH CHECK (false);
