-- =====================================================================
-- FASE 1: fundação multiempresa
-- =====================================================================

-- ---------- ENUMS ----------
CREATE TYPE public.platform_role AS ENUM (
  'super_admin','platform_admin','platform_operations',
  'platform_finance','platform_support','platform_readonly'
);

CREATE TYPE public.org_role AS ENUM (
  'owner','admin','manager','lawyer','collaborator','viewer','billing_manager'
);

CREATE TYPE public.org_permission AS ENUM (
  'members.view','members.invite','members.manage','permissions.manage',
  'billing.view','billing.manage','subscription.manage',
  'services.view','services.request','services.contract',
  'integrations.view','integrations.manage',
  'usage.view_self','usage.view_organization','usage.manage_budget',
  'cases.create','cases.view_all','cases.manage_all','cases.delete',
  'documents.upload','documents.delete',
  'ai.use','proposals.use','marketing.use','publications.use'
);

CREATE TYPE public.org_status AS ENUM ('trial','active','suspended','cancelled');
CREATE TYPE public.membership_status AS ENUM ('active','revoked');
CREATE TYPE public.org_invitation_status AS ENUM ('pending','accepted','revoked','expired');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','suspended','cancelled');
CREATE TYPE public.invoice_status AS ENUM ('draft','open','paid','void','overdue');
CREATE TYPE public.case_access_level AS ENUM ('viewer','editor','manager');

-- ---------- ORGANIZATIONS ----------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_id text,
  status public.org_status NOT NULL DEFAULT 'trial',
  is_demo boolean NOT NULL DEFAULT false,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'lawyer',
  status public.membership_status NOT NULL DEFAULT 'active',
  invited_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_memberships_user ON public.organization_memberships(user_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO authenticated;
GRANT ALL ON public.organization_memberships TO service_role;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_member_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  permission public.org_permission NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  granted_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_member_permissions TO authenticated;
GRANT ALL ON public.organization_member_permissions TO service_role;
ALTER TABLE public.organization_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.org_role NOT NULL DEFAULT 'lawyer',
  token text NOT NULL UNIQUE,
  status public.org_invitation_status NOT NULL DEFAULT 'pending',
  invited_by_user_id uuid NOT NULL,
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- ---------- PLATFORM (B2B) ROLES ----------
CREATE TABLE public.platform_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.platform_role NOT NULL,
  granted_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.platform_user_roles TO authenticated;
GRANT ALL ON public.platform_user_roles TO service_role;
ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;

-- Preserva acesso da equipe B2B atual (nada é removido do mecanismo antigo aqui).
INSERT INTO public.platform_user_roles (user_id, role)
SELECT uc.user_id, uc.capability::text::public.platform_role
FROM public.user_capabilities uc
WHERE uc.capability::text IN ('super_admin','platform_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- ---------- CASE ACCESS ----------
CREATE TABLE public.case_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  access_level public.case_access_level NOT NULL DEFAULT 'viewer',
  granted_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id)
);
CREATE INDEX idx_case_access_user ON public.case_access(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_access TO authenticated;
GRANT ALL ON public.case_access TO service_role;
ALTER TABLE public.case_access ENABLE ROW LEVEL SECURITY;

-- ---------- PLANS / BILLING ----------
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, key)
);
GRANT SELECT ON public.plan_entitlements TO authenticated;
GRANT ALL ON public.plan_entitlements TO service_role;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  seats integer NOT NULL DEFAULT 1,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);
GRANT SELECT ON public.organization_subscriptions TO authenticated;
GRANT ALL ON public.organization_subscriptions TO service_role;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number text NOT NULL UNIQUE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'BRL',
  subtotal_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  issued_at timestamptz,
  due_date date,
  paid_at timestamptz,
  notes text,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_invoices TO authenticated;
GRANT ALL ON public.organization_invoices TO service_role;
ALTER TABLE public.organization_invoices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.organization_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_invoice_items TO authenticated;
GRANT ALL ON public.organization_invoice_items TO service_role;
ALTER TABLE public.organization_invoice_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.organization_invoices(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  method text,
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_payments TO authenticated;
GRANT ALL ON public.organization_payments TO service_role;
ALTER TABLE public.organization_payments ENABLE ROW LEVEL SECURITY;

-- ---------- AUDIT / SUPPORT ----------
CREATE TABLE public.organization_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  target_user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_audit_org ON public.organization_audit_log(organization_id, created_at DESC);
GRANT SELECT, INSERT ON public.organization_audit_log TO authenticated;
GRANT ALL ON public.organization_audit_log TO service_role;
ALTER TABLE public.organization_audit_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  support_user_id uuid NOT NULL,
  granted_by_user_id uuid NOT NULL,
  reason text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_grants_lookup ON public.support_access_grants(support_user_id, organization_id);
GRANT SELECT, INSERT, UPDATE ON public.support_access_grants TO authenticated;
GRANT ALL ON public.support_access_grants TO service_role;
ALTER TABLE public.support_access_grants ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- FUNÇÕES DE AUTORIZAÇÃO
-- =====================================================================

CREATE OR REPLACE FUNCTION public.has_platform_role(_user_id uuid, _role public.platform_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_user_roles
    WHERE user_id = _user_id AND (role = _role OR role = 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_user_roles WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_organization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.organization_id = _organization_id
      AND m.user_id = _user_id
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.org_member_role(_organization_id uuid, _user_id uuid)
RETURNS public.org_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.organization_memberships m
  WHERE m.organization_id = _organization_id
    AND m.user_id = _user_id
    AND m.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.org_role_default_permissions(_role public.org_role)
RETURNS public.org_permission[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'owner' THEN ARRAY(SELECT unnest(enum_range(NULL::public.org_permission)))
    WHEN 'admin' THEN ARRAY[
      'members.view','members.invite','members.manage','permissions.manage',
      'services.view','services.request',
      'integrations.view','integrations.manage',
      'usage.view_self','usage.view_organization','usage.manage_budget',
      'cases.create','cases.view_all','cases.manage_all','cases.delete',
      'documents.upload','documents.delete',
      'ai.use','proposals.use','marketing.use','publications.use'
    ]::public.org_permission[]
    WHEN 'manager' THEN ARRAY[
      'members.view','services.view','services.request',
      'integrations.view','usage.view_self','usage.view_organization',
      'cases.create','cases.view_all','cases.manage_all',
      'documents.upload','documents.delete',
      'ai.use','proposals.use','marketing.use','publications.use'
    ]::public.org_permission[]
    WHEN 'lawyer' THEN ARRAY[
      'members.view','usage.view_self','cases.create','documents.upload',
      'ai.use','proposals.use','marketing.use','publications.use'
    ]::public.org_permission[]
    WHEN 'collaborator' THEN ARRAY[
      'members.view','usage.view_self','documents.upload','ai.use'
    ]::public.org_permission[]
    WHEN 'viewer' THEN ARRAY[
      'members.view','usage.view_self'
    ]::public.org_permission[]
    WHEN 'billing_manager' THEN ARRAY[
      'members.view','billing.view','billing.manage','subscription.manage',
      'services.view','usage.view_self','usage.view_organization'
    ]::public.org_permission[]
    ELSE ARRAY[]::public.org_permission[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_org_permission(
  _organization_id uuid, _user_id uuid, _permission public.org_permission
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.org_role;
  _override boolean;
BEGIN
  SELECT m.role INTO _role FROM public.organization_memberships m
  WHERE m.organization_id = _organization_id AND m.user_id = _user_id AND m.status = 'active'
  LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;

  SELECT p.granted INTO _override FROM public.organization_member_permissions p
  WHERE p.organization_id = _organization_id AND p.user_id = _user_id AND p.permission = _permission
  LIMIT 1;
  IF _override IS NOT NULL THEN RETURN _override; END IF;

  RETURN _permission = ANY (public.org_role_default_permissions(_role));
END;
$$;

CREATE OR REPLACE FUNCTION public.org_effective_permissions(_organization_id uuid, _user_id uuid)
RETURNS public.org_permission[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(ARRAY(
    SELECT p FROM unnest(public.org_role_default_permissions(public.org_member_role(_organization_id, _user_id))) AS p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.organization_member_permissions o
      WHERE o.organization_id = _organization_id AND o.user_id = _user_id
        AND o.permission = p AND o.granted = false
    )
    UNION
    SELECT o.permission FROM public.organization_member_permissions o
    WHERE o.organization_id = _organization_id AND o.user_id = _user_id AND o.granted = true
      AND public.is_org_member(_organization_id, _user_id)
  ), ARRAY[]::public.org_permission[]);
$$;

CREATE OR REPLACE FUNCTION public.support_has_active_grant(_organization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_access_grants g
    WHERE g.organization_id = _organization_id
      AND g.support_user_id = _user_id
      AND g.revoked_at IS NULL
      AND now() BETWEEN g.starts_at AND g.expires_at
  );
$$;

CREATE OR REPLACE FUNCTION public.org_is_active(_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _organization_id
      AND (
        (o.status = 'active')
        OR (o.status = 'trial' AND o.trial_ends_at > now())
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.org_can_use_ai(_organization_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.org_is_active(_organization_id);
$$;

-- Owners restantes (usado para impedir remoção do último owner)
CREATE OR REPLACE FUNCTION public.org_active_owner_count(_organization_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.organization_memberships
  WHERE organization_id = _organization_id AND role = 'owner' AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.prevent_last_owner_removal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' AND OLD.status = 'active'
       AND public.org_active_owner_count(OLD.organization_id) <= 1 THEN
      RAISE EXCEPTION 'Não é possível remover o último owner da organização';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.role = 'owner' AND OLD.status = 'active'
     AND (NEW.role <> 'owner' OR NEW.status <> 'active')
     AND public.org_active_owner_count(OLD.organization_id) <= 1 THEN
    RAISE EXCEPTION 'Não é possível remover o último owner da organização';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_last_owner_removal
BEFORE UPDATE OR DELETE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_owner_removal();

-- Impede auto-elevação de papel
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id = auth.uid() AND OLD.role <> NEW.role THEN
    RAISE EXCEPTION 'Um usuário não pode alterar o próprio papel';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_self_role_escalation
BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- updated_at
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_memberships_updated BEFORE UPDATE ON public.organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_invitations_updated BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_subscriptions_updated BEFORE UPDATE ON public.organization_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_org_invoices_updated BEFORE UPDATE ON public.organization_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- POLICIES
-- =====================================================================

-- organizations
CREATE POLICY org_select_member ON public.organizations FOR SELECT TO authenticated
USING (
  public.is_org_member(id, auth.uid())
  OR public.is_platform_user(auth.uid())
);
CREATE POLICY org_insert_self ON public.organizations FOR INSERT TO authenticated
WITH CHECK (created_by_user_id = auth.uid());
CREATE POLICY org_update_admin ON public.organizations FOR UPDATE TO authenticated
USING (public.has_org_permission(id, auth.uid(), 'members.manage') OR public.is_platform_user(auth.uid()))
WITH CHECK (public.has_org_permission(id, auth.uid(), 'members.manage') OR public.is_platform_user(auth.uid()));

-- memberships
CREATE POLICY memberships_select ON public.organization_memberships FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_org_permission(organization_id, auth.uid(), 'members.view')
  OR public.is_platform_user(auth.uid())
);
CREATE POLICY memberships_insert ON public.organization_memberships FOR INSERT TO authenticated
WITH CHECK (
  -- primeiro owner na criação da organização
  (user_id = auth.uid() AND role = 'owner'
   AND EXISTS (SELECT 1 FROM public.organizations o
               WHERE o.id = organization_id AND o.created_by_user_id = auth.uid())
   AND public.org_active_owner_count(organization_id) = 0)
  OR public.has_org_permission(organization_id, auth.uid(), 'members.manage')
);
CREATE POLICY memberships_update ON public.organization_memberships FOR UPDATE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'members.manage'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'members.manage'));
CREATE POLICY memberships_delete ON public.organization_memberships FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'members.manage'));

-- member permissions
CREATE POLICY member_perms_select ON public.organization_member_permissions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_org_permission(organization_id, auth.uid(), 'members.view')
  OR public.is_platform_user(auth.uid())
);
CREATE POLICY member_perms_write ON public.organization_member_permissions FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'permissions.manage'))
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'permissions.manage')
  -- permissões de faturamento/contratação só o owner concede
  AND (
    permission NOT IN ('billing.view','billing.manage','subscription.manage','services.contract')
    OR public.org_member_role(organization_id, auth.uid()) = 'owner'
  )
);

-- invitations
CREATE POLICY invitations_select ON public.organization_invitations FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'members.view')
  OR public.is_platform_user(auth.uid())
);
CREATE POLICY invitations_write ON public.organization_invitations FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'members.invite'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'members.invite'));

-- platform roles
CREATE POLICY platform_roles_select ON public.platform_user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_platform_user(auth.uid()));

-- case access
CREATE POLICY case_access_select ON public.case_access FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_org_permission(organization_id, auth.uid(), 'cases.view_all')
);
CREATE POLICY case_access_write ON public.case_access FOR ALL TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'cases.manage_all'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'cases.manage_all'));

-- plans (leitura pública autenticada; escrita apenas service_role/plataforma)
CREATE POLICY plans_select ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_entitlements_select ON public.plan_entitlements FOR SELECT TO authenticated USING (true);

-- subscriptions / invoices / payments: faturamento
CREATE POLICY subs_select ON public.organization_subscriptions FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'billing.view')
  OR public.has_platform_role(auth.uid(), 'platform_finance')
  OR public.has_platform_role(auth.uid(), 'platform_admin')
);
CREATE POLICY invoices_select ON public.organization_invoices FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'billing.view')
  OR public.has_platform_role(auth.uid(), 'platform_finance')
  OR public.has_platform_role(auth.uid(), 'platform_admin')
);
CREATE POLICY invoice_items_select ON public.organization_invoice_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.organization_invoices i
  WHERE i.id = invoice_id
    AND (
      public.has_org_permission(i.organization_id, auth.uid(), 'billing.view')
      OR public.has_platform_role(auth.uid(), 'platform_finance')
      OR public.has_platform_role(auth.uid(), 'platform_admin')
    )
));
CREATE POLICY payments_select ON public.organization_payments FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'billing.view')
  OR public.has_platform_role(auth.uid(), 'platform_finance')
  OR public.has_platform_role(auth.uid(), 'platform_admin')
);

-- audit log
CREATE POLICY org_audit_select ON public.organization_audit_log FOR SELECT TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'members.manage')
  OR public.is_platform_user(auth.uid())
);
CREATE POLICY org_audit_insert ON public.organization_audit_log FOR INSERT TO authenticated
WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND actor_user_id = auth.uid());

-- support grants
CREATE POLICY support_grants_select ON public.support_access_grants FOR SELECT TO authenticated
USING (
  support_user_id = auth.uid()
  OR public.has_org_permission(organization_id, auth.uid(), 'members.manage')
  OR public.is_platform_user(auth.uid())
);
CREATE POLICY support_grants_insert ON public.support_access_grants FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'members.manage')
  AND granted_by_user_id = auth.uid()
);
CREATE POLICY support_grants_revoke ON public.support_access_grants FOR UPDATE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'members.manage'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'members.manage'));

-- =====================================================================
-- §4: nenhuma organização automática por usuário
-- =====================================================================
DROP TRIGGER IF EXISTS on_auth_user_created_customer_account ON auth.users;
DROP FUNCTION IF EXISTS public.create_customer_account_for_new_user();

-- =====================================================================
-- SEEDS: planos + entitlements
-- =====================================================================
INSERT INTO public.plans (code, name, description, monthly_price_cents, sort_order) VALUES
  ('trial','Trial','Avaliação de 30 dias com limites reduzidos.',0,1),
  ('pro','Pro','Plano padrão para escritórios em operação.',0,2),
  ('enterprise','Enterprise','Escritórios com alto volume e governança dedicada.',0,3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, key, value)
SELECT p.id, e.key, e.value
FROM public.plans p
JOIN (VALUES
  ('trial','max_members','5'::jsonb),
  ('trial','max_cases','10'::jsonb),
  ('trial','ai_monthly_usd','25'::jsonb),
  ('trial','features','["cases","documents","ai","proposals"]'::jsonb),
  ('pro','max_members','25'::jsonb),
  ('pro','max_cases','500'::jsonb),
  ('pro','ai_monthly_usd','200'::jsonb),
  ('pro','features','["cases","documents","ai","proposals","marketing","publications","integrations"]'::jsonb),
  ('enterprise','max_members','-1'::jsonb),
  ('enterprise','max_cases','-1'::jsonb),
  ('enterprise','ai_monthly_usd','2000'::jsonb),
  ('enterprise','features','["cases","documents","ai","proposals","marketing","publications","integrations","b2b_services"]'::jsonb)
) AS e(plan_code, key, value) ON e.plan_code = p.code
ON CONFLICT (plan_id, key) DO NOTHING;