
-- 1. Add super_admin to app_capability enum
ALTER TYPE public.app_capability ADD VALUE IF NOT EXISTS 'super_admin';

-- Commit enum change before use
COMMIT;
BEGIN;

-- 2. Helper: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_capabilities
    WHERE user_id = _user_id AND capability = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_capabilities
    WHERE user_id = _user_id
      AND capability IN ('super_admin','platform_admin')
  );
$$;

-- 3. customer_accounts
CREATE TABLE IF NOT EXISTS public.customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE,
  name text,
  status text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','suspended','canceled')),
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  billing_email text,
  mrr_cents integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_accounts TO authenticated;
GRANT ALL ON public.customer_accounts TO service_role;

ALTER TABLE public.customer_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own account"
  ON public.customer_accounts FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_platform_staff(auth.uid()));

CREATE POLICY "Platform staff manages accounts"
  ON public.customer_accounts FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

CREATE TRIGGER customer_accounts_updated
  BEFORE UPDATE ON public.customer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Auto-provision customer_account on new signup
CREATE OR REPLACE FUNCTION public.create_customer_account_for_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_accounts (owner_user_id, billing_email, status, plan)
  VALUES (NEW.id, NEW.email, 'trial', 'free')
  ON CONFLICT (owner_user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer_account ON auth.users;
CREATE TRIGGER on_auth_user_created_customer_account
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_customer_account_for_new_user();

-- 5. Backfill customer_accounts for existing profiles
INSERT INTO public.customer_accounts (owner_user_id, name, billing_email, status, plan)
SELECT p.id, p.firm_name, u.email, 'active', 'free'
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
ON CONFLICT (owner_user_id) DO NOTHING;

-- 6. platform_audit_log
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_customer_id uuid REFERENCES public.customer_accounts(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.platform_audit_log TO authenticated;
GRANT ALL ON public.platform_audit_log TO service_role;

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform staff reads audit"
  ON public.platform_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));

CREATE POLICY "Platform staff writes audit"
  ON public.platform_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_staff(auth.uid()) AND actor_user_id = auth.uid());

-- 7. Grant super_admin + platform_admin to lcardoso@b2bconsulting.com.br
INSERT INTO public.user_capabilities (user_id, capability, granted_by)
SELECT u.id, 'super_admin'::app_capability, u.id
FROM auth.users u
WHERE u.email = 'lcardoso@b2bconsulting.com.br'
ON CONFLICT (user_id, capability) DO NOTHING;

INSERT INTO public.user_capabilities (user_id, capability, granted_by)
SELECT u.id, 'platform_admin'::app_capability, u.id
FROM auth.users u
WHERE u.email = 'lcardoso@b2bconsulting.com.br'
ON CONFLICT (user_id, capability) DO NOTHING;

INSERT INTO public.user_capabilities (user_id, capability, granted_by)
SELECT u.id, 'office_admin'::app_capability, u.id
FROM auth.users u
WHERE u.email = 'lcardoso@b2bconsulting.com.br'
ON CONFLICT (user_id, capability) DO NOTHING;
