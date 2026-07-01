
-- 1) Roles enum + user_roles table + has_role()
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own roles" ON public.user_roles;
CREATE POLICY "Users can read their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- 2) Seed admin: promote every existing profile to admin (single-user projects → the owner becomes admin)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Encrypted OAuth settings (global, admin-managed)
CREATE TABLE IF NOT EXISTS public.app_oauth_settings (
  provider text PRIMARY KEY CHECK (provider IN ('google', 'outlook')),
  client_id text,
  client_secret_encrypted text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_oauth_settings TO authenticated;
GRANT ALL ON public.app_oauth_settings TO service_role;

ALTER TABLE public.app_oauth_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read oauth settings" ON public.app_oauth_settings;
CREATE POLICY "Admins can read oauth settings"
  ON public.app_oauth_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert oauth settings" ON public.app_oauth_settings;
CREATE POLICY "Admins can insert oauth settings"
  ON public.app_oauth_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update oauth settings" ON public.app_oauth_settings;
CREATE POLICY "Admins can update oauth settings"
  ON public.app_oauth_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
