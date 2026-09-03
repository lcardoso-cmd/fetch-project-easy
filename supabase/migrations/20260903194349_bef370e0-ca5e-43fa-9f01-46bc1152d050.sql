-- ─────────────────────────── ORGANIZATIONS ───────────────────────────
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS address_postal_code text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS billing_provider_customer_id text,
  ADD COLUMN IF NOT EXISTS billing_environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS trial_extension_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_source text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_until timestamptz,
  ADD COLUMN IF NOT EXISTS legacy_customer_account_id uuid;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_billing_environment_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_billing_environment_check
  CHECK (billing_environment IN ('sandbox','live'));

CREATE UNIQUE INDEX IF NOT EXISTS organizations_billing_customer_uniq
  ON public.organizations (billing_provider_customer_id)
  WHERE billing_provider_customer_id IS NOT NULL;

-- ─────────────────────────── PLANS ───────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS yearly_price_cents integer,
  ADD COLUMN IF NOT EXISTS provider_product_id text,
  ADD COLUMN IF NOT EXISTS provider_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS provider_yearly_price_id text,
  ADD COLUMN IF NOT EXISTS is_trial_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS plans_code_uniq ON public.plans (code);

-- ─────────────────────── PLAN ENTITLEMENTS ───────────────────────
DELETE FROM public.plan_entitlements
WHERE key NOT IN (
  'max_members','max_active_cases','storage_gb','ai_monthly_budget_usd','ai_overage_allowed',
  'feature_rag','feature_legal_drafting','feature_proposals','feature_monitoring',
  'feature_communication','feature_crm','feature_integrations','feature_audit','support_level'
);

ALTER TABLE public.plan_entitlements
  DROP CONSTRAINT IF EXISTS plan_entitlements_key_check;
ALTER TABLE public.plan_entitlements
  ADD CONSTRAINT plan_entitlements_key_check CHECK (key IN (
    'max_members','max_active_cases','storage_gb','ai_monthly_budget_usd','ai_overage_allowed',
    'feature_rag','feature_legal_drafting','feature_proposals','feature_monitoring',
    'feature_communication','feature_crm','feature_integrations','feature_audit','support_level'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS plan_entitlements_plan_key_uniq
  ON public.plan_entitlements (plan_id, key);

-- ─────────────────────── SUBSCRIPTIONS ───────────────────────
ALTER TABLE public.organization_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'month',
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS external_subscription_id text,
  ADD COLUMN IF NOT EXISTS external_customer_id text,
  ADD COLUMN IF NOT EXISTS external_price_id text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end timestamptz,
  ADD COLUMN IF NOT EXISTS past_due_since timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS scheduled_interval text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS org_subs_interval_check;
ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT org_subs_interval_check CHECK (billing_interval IN ('month','year'));
ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS org_subs_scheduled_interval_check;
ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT org_subs_scheduled_interval_check
  CHECK (scheduled_interval IS NULL OR scheduled_interval IN ('month','year'));
ALTER TABLE public.organization_subscriptions
  DROP CONSTRAINT IF EXISTS org_subs_provider_check;
ALTER TABLE public.organization_subscriptions
  ADD CONSTRAINT org_subs_provider_check CHECK (provider IN ('stripe','manual'));

CREATE UNIQUE INDEX IF NOT EXISTS org_subs_external_uniq
  ON public.organization_subscriptions (external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_subs_org_idx ON public.organization_subscriptions (organization_id, status);

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  actor_user_id uuid,
  event text NOT NULL,
  from_status text,
  to_status text,
  from_plan_id uuid,
  to_plan_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_events_select ON public.subscription_events FOR SELECT TO authenticated
  USING (
    public.has_org_permission(organization_id, auth.uid(), 'billing.view'::public.org_permission)
    OR public.is_platform_staff(auth.uid())
  );
CREATE INDEX IF NOT EXISTS subscription_events_org_idx
  ON public.subscription_events (organization_id, created_at DESC);

-- ─────────────────────── INVOICES ───────────────────────
ALTER TABLE public.organization_invoices
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.organization_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_invoice_id text,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hosted_url text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_email text;

ALTER TABLE public.organization_invoices
  DROP CONSTRAINT IF EXISTS org_invoices_origin_check;
ALTER TABLE public.organization_invoices
  ADD CONSTRAINT org_invoices_origin_check CHECK (origin IN ('stripe','manual'));

CREATE UNIQUE INDEX IF NOT EXISTS org_invoices_external_uniq
  ON public.organization_invoices (external_invoice_id)
  WHERE external_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_invoices_org_idx
  ON public.organization_invoices (organization_id, status, due_date);

-- ─────────────────────── PAYMENTS ───────────────────────
ALTER TABLE public.organization_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'succeeded',
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox',
  ADD COLUMN IF NOT EXISTS external_payment_id text,
  ADD COLUMN IF NOT EXISTS method_summary text,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS justification text;

ALTER TABLE public.organization_payments
  DROP CONSTRAINT IF EXISTS org_payments_status_check;
ALTER TABLE public.organization_payments
  ADD CONSTRAINT org_payments_status_check
  CHECK (status IN ('pending','succeeded','failed','refunded'));
ALTER TABLE public.organization_payments
  DROP CONSTRAINT IF EXISTS org_payments_provider_check;
ALTER TABLE public.organization_payments
  ADD CONSTRAINT org_payments_provider_check CHECK (provider IN ('stripe','manual'));

CREATE UNIQUE INDEX IF NOT EXISTS org_payments_external_uniq
  ON public.organization_payments (external_payment_id)
  WHERE external_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS org_payments_org_idx
  ON public.organization_payments (organization_id, paid_at DESC);

-- ─────────────────── PROVIDER WEBHOOK EVENTS ───────────────────
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  environment text NOT NULL DEFAULT 'sandbox',
  external_event_id text NOT NULL,
  type text NOT NULL,
  occurred_at timestamptz,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  attempts integer NOT NULL DEFAULT 0,
  error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_webhook_events_external_uniq
  ON public.billing_webhook_events (provider, external_event_id);
ALTER TABLE public.billing_webhook_events
  DROP CONSTRAINT IF EXISTS billing_webhook_events_status_check;
ALTER TABLE public.billing_webhook_events
  ADD CONSTRAINT billing_webhook_events_status_check
  CHECK (status IN ('received','processed','ignored','failed'));
GRANT SELECT ON public.billing_webhook_events TO authenticated;
GRANT ALL ON public.billing_webhook_events TO service_role;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_events_select_staff ON public.billing_webhook_events
  FOR SELECT TO authenticated USING (public.is_platform_staff(auth.uid()));

-- ─────────────────── COMMERCIAL EMAIL LOG ───────────────────
CREATE TABLE IF NOT EXISTS public.billing_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  event text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_email_log TO authenticated;
GRANT ALL ON public.billing_email_log TO service_role;
ALTER TABLE public.billing_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_email_log_select ON public.billing_email_log
  FOR SELECT TO authenticated USING (
    public.is_platform_staff(auth.uid())
    OR public.has_org_permission(organization_id, auth.uid(), 'billing.view'::public.org_permission)
  );
CREATE INDEX IF NOT EXISTS billing_email_log_org_idx
  ON public.billing_email_log (organization_id, created_at DESC);

-- ─────────────────── HELPER FUNCTIONS ───────────────────
CREATE OR REPLACE FUNCTION public.org_subscription_mrr_cents(_amount_cents integer, _interval text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _interval = 'year' THEN (COALESCE(_amount_cents,0) / 12)::int
              ELSE COALESCE(_amount_cents,0) END;
$$;

CREATE OR REPLACE FUNCTION public.org_trial_end(_organization_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.trial_ends_at + make_interval(days => o.trial_extension_days)
  FROM public.organizations o WHERE o.id = _organization_id;
$$;

-- Estado operacional consolidado da organização (fonte única para guards).
CREATE OR REPLACE FUNCTION public.org_operational_state(_organization_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.organizations; s public.organization_subscriptions; _trial_end timestamptz;
BEGIN
  SELECT * INTO o FROM public.organizations WHERE id = _organization_id;
  IF o.id IS NULL THEN RETURN 'unknown'; END IF;
  IF o.status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF o.status = 'suspended' THEN RETURN 'suspended'; END IF;

  SELECT * INTO s FROM public.organization_subscriptions
   WHERE organization_id = _organization_id
     AND status IN ('trialing','active','past_due')
   ORDER BY created_at DESC LIMIT 1;

  IF s.id IS NOT NULL THEN
    IF s.status = 'active' THEN RETURN 'active'; END IF;
    IF s.status = 'past_due' THEN
      IF o.grace_until IS NOT NULL AND o.grace_until < now() THEN RETURN 'suspended'; END IF;
      RETURN 'past_due';
    END IF;
  END IF;

  _trial_end := public.org_trial_end(_organization_id);
  IF _trial_end IS NOT NULL AND _trial_end > now() THEN RETURN 'trial'; END IF;
  RETURN 'trial_expired';
END;
$$;
REVOKE ALL ON FUNCTION public.org_operational_state(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.org_trial_end(uuid) FROM anon;

-- Limites efetivos da organização (plano da assinatura vigente ou plano de trial).
CREATE OR REPLACE FUNCTION public.org_effective_entitlements(_organization_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH plan AS (
    SELECT COALESCE(
      (SELECT s.plan_id FROM public.organization_subscriptions s
        WHERE s.organization_id = _organization_id
          AND s.status IN ('trialing','active','past_due')
        ORDER BY s.created_at DESC LIMIT 1),
      (SELECT p.id FROM public.plans p WHERE p.is_trial_default AND p.archived_at IS NULL LIMIT 1)
    ) AS plan_id
  )
  SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM plan JOIN public.plan_entitlements e ON e.plan_id = plan.plan_id;
$$;
REVOKE ALL ON FUNCTION public.org_effective_entitlements(uuid) FROM anon;

-- ─────────────────── MIGRAÇÃO DO MODELO ANTIGO ───────────────────
UPDATE public.organizations o
SET billing_email = COALESCE(o.billing_email, c.billing_email),
    legacy_customer_account_id = c.id,
    status = CASE
      WHEN c.status IN ('canceled','cancelled') THEN 'cancelled'::public.org_status
      WHEN c.status = 'suspended' THEN 'suspended'::public.org_status
      WHEN c.status = 'active' THEN o.status
      ELSE o.status
    END
FROM public.customer_accounts c
WHERE c.owner_user_id = o.created_by_user_id;

COMMENT ON TABLE public.customer_accounts IS
  'LEGADO: mantido apenas como histórico de auditoria da fase pré-multiempresa. Não é fonte de verdade de cliente, plano, assinatura, MRR ou situação financeira. Nenhuma tela ou função comercial pode ler ou gravar aqui.';

-- ─────────────────── CONFIGURAÇÃO COMERCIAL ───────────────────
INSERT INTO public.app_settings (key, value)
VALUES ('commercial', jsonb_build_object(
  'trial_days', 30,
  'grace_days', 7,
  'default_currency', 'BRL',
  'due_soon_days', 5,
  'alert_recipients', '[]'::jsonb,
  'trial_expired_policy', 'read_only',
  'delinquency_policy', 'suspend_after_grace',
  'support_identity', 'suporte@b2bconsulting.com.br'
))
ON CONFLICT (key) DO NOTHING;

-- ─────────────────── POLICIES COMPLEMENTARES ───────────────────
DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans FOR SELECT TO authenticated
  USING (archived_at IS NULL OR public.is_platform_staff(auth.uid()));

DROP POLICY IF EXISTS invoices_manual_insert ON public.organization_invoices;
DROP POLICY IF EXISTS payments_manual_insert ON public.organization_payments;
