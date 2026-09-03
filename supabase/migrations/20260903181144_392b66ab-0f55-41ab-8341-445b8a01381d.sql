-- =====================================================================
-- Módulo Comercial (CRM) — entidades, RLS e integração com propostas
-- =====================================================================

-- 1) Permissões padrão por papel (inclui as permissões comerciais)
CREATE OR REPLACE FUNCTION public.org_role_default_permissions(_role org_role)
RETURNS org_permission[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE _role
    WHEN 'owner' THEN ARRAY(SELECT unnest(enum_range(NULL::public.org_permission)))
    WHEN 'admin' THEN ARRAY[
      'members.view','members.invite','members.manage','permissions.manage',
      'services.view','services.request',
      'integrations.view','integrations.manage',
      'usage.view_self','usage.view_organization','usage.manage_budget',
      'cases.create','cases.view_all','cases.manage_all','cases.delete',
      'documents.upload','documents.delete',
      'ai.use','proposals.use','marketing.use','publications.use',
      'crm.view','crm.manage_own','crm.view_all','crm.manage_all','crm.view_values',
      'crm.proposals_create','crm.proposals_approve','crm.proposals_share',
      'crm.record_outcome','crm.convert','crm.admin'
    ]::public.org_permission[]
    WHEN 'manager' THEN ARRAY[
      'members.view','services.view','services.request',
      'integrations.view','usage.view_self','usage.view_organization',
      'cases.create','cases.view_all','cases.manage_all',
      'documents.upload','documents.delete',
      'ai.use','proposals.use','marketing.use','publications.use',
      'crm.view','crm.manage_own','crm.view_all','crm.manage_all','crm.view_values',
      'crm.proposals_create','crm.proposals_approve','crm.proposals_share',
      'crm.record_outcome','crm.convert'
    ]::public.org_permission[]
    WHEN 'lawyer' THEN ARRAY[
      'members.view','usage.view_self','cases.create','documents.upload',
      'ai.use','proposals.use','marketing.use','publications.use',
      'crm.view','crm.manage_own','crm.view_values',
      'crm.proposals_create','crm.proposals_share','crm.record_outcome'
    ]::public.org_permission[]
    WHEN 'collaborator' THEN ARRAY[
      'members.view','usage.view_self','documents.upload','ai.use','crm.view'
    ]::public.org_permission[]
    WHEN 'viewer' THEN ARRAY[
      'members.view','usage.view_self'
    ]::public.org_permission[]
    WHEN 'billing_manager' THEN ARRAY[
      'members.view','billing.view','billing.manage','subscription.manage',
      'services.view','usage.view_self','usage.view_organization',
      'crm.view','crm.view_values'
    ]::public.org_permission[]
    ELSE ARRAY[]::public.org_permission[]
  END;
$function$;

-- 2) Helpers de autorização comercial
CREATE OR REPLACE FUNCTION public.crm_can_view_all(_organization_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_permission(_organization_id, _user_id, 'crm.view_all')
      OR public.has_org_permission(_organization_id, _user_id, 'crm.manage_all');
$$;
REVOKE EXECUTE ON FUNCTION public.crm_can_view_all(uuid, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.crm_can_write(_organization_id uuid, _user_id uuid, _owner_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_permission(_organization_id, _user_id, 'crm.manage_all')
      OR (
        public.has_org_permission(_organization_id, _user_id, 'crm.manage_own')
        AND (_owner_user_id IS NULL OR _owner_user_id = _user_id)
      );
$$;
REVOKE EXECUTE ON FUNCTION public.crm_can_write(uuid, uuid, uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.crm_digits(_value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(COALESCE(_value, ''), '[^0-9]', '', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.crm_normalize_email(_value text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(btrim(COALESCE(_value, ''))), '');
$$;

-- 3) Potenciais clientes
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'person' CHECK (kind IN ('person','company')),
  name text NOT NULL,
  trade_name text,
  document text,
  document_digits text GENERATED ALWAYS AS (public.crm_digits(document)) STORED,
  email text,
  email_normalized text GENERATED ALWAYS AS (public.crm_normalize_email(email)) STORED,
  phone text,
  phone_digits text GENERATED ALWAYS AS (public.crm_digits(phone)) STORED,
  whatsapp text,
  whatsapp_digits text GENERATED ALWAYS AS (public.crm_digits(whatsapp)) STORED,
  address text,
  city text,
  state text,
  source text,
  notes text,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','client','inactive')),
  last_interaction_at timestamptz,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_leads_select" ON public.crm_leads FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
);
CREATE POLICY "crm_leads_insert" ON public.crm_leads FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND created_by_user_id = auth.uid()
  AND public.crm_can_write(organization_id, auth.uid(), owner_user_id)
);
CREATE POLICY "crm_leads_update" ON public.crm_leads FOR UPDATE TO authenticated
USING (public.crm_can_write(organization_id, auth.uid(), owner_user_id))
WITH CHECK (public.crm_can_write(organization_id, auth.uid(), owner_user_id));
CREATE POLICY "crm_leads_delete" ON public.crm_leads FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'crm.manage_all'));

CREATE INDEX crm_leads_org_idx ON public.crm_leads (organization_id, status);
CREATE INDEX crm_leads_doc_idx ON public.crm_leads (organization_id, document_digits);
CREATE INDEX crm_leads_email_idx ON public.crm_leads (organization_id, email_normalized);
CREATE INDEX crm_leads_phone_idx ON public.crm_leads (organization_id, phone_digits);
CREATE TRIGGER crm_leads_updated BEFORE UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Contatos
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  name text NOT NULL,
  role_title text,
  email text,
  email_normalized text GENERATED ALWAYS AS (public.crm_normalize_email(email)) STORED,
  phone text,
  phone_digits text GENERATED ALWAYS AS (public.crm_digits(phone)) STORED,
  whatsapp text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_contacts_select" ON public.crm_contacts FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
);
CREATE POLICY "crm_contacts_write" ON public.crm_contacts FOR ALL TO authenticated
USING (public.crm_can_write(organization_id, auth.uid(), NULL))
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND public.crm_can_write(organization_id, auth.uid(), NULL)
);
CREATE INDEX crm_contacts_lead_idx ON public.crm_contacts (lead_id);
CREATE TRIGGER crm_contacts_updated BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Oportunidades
CREATE TABLE public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  practice_area text,
  source text,
  owner_user_id uuid,
  stage text NOT NULL DEFAULT 'new_contact' CHECK (stage IN (
    'new_contact','qualifying','conflict_check','meeting_scheduled',
    'proposal_drafting','proposal_sent','negotiating','won','lost'
  )),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  estimated_value_cents bigint NOT NULL DEFAULT 0 CHECK (estimated_value_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  probability integer NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date date,
  next_activity_at timestamptz,
  lost_reason text,
  proposal_id uuid,
  converted_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  stage_changed_at timestamptz NOT NULL DEFAULT now(),
  stage_changed_by_user_id uuid,
  archived_at timestamptz,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_opportunities_lost_reason CHECK (stage <> 'lost' OR COALESCE(btrim(lost_reason), '') <> '')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_opportunities TO authenticated;
GRANT ALL ON public.crm_opportunities TO service_role;
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_opps_select" ON public.crm_opportunities FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
  AND (
    public.crm_can_view_all(organization_id, auth.uid())
    OR owner_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
  )
);
CREATE POLICY "crm_opps_insert" ON public.crm_opportunities FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND created_by_user_id = auth.uid()
  AND public.crm_can_write(organization_id, auth.uid(), owner_user_id)
);
CREATE POLICY "crm_opps_update" ON public.crm_opportunities FOR UPDATE TO authenticated
USING (public.crm_can_write(organization_id, auth.uid(), owner_user_id))
WITH CHECK (public.crm_can_write(organization_id, auth.uid(), owner_user_id));
CREATE POLICY "crm_opps_delete" ON public.crm_opportunities FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'crm.manage_all'));

CREATE INDEX crm_opps_org_stage_idx ON public.crm_opportunities (organization_id, stage, position);
CREATE INDEX crm_opps_owner_idx ON public.crm_opportunities (organization_id, owner_user_id);
CREATE INDEX crm_opps_lead_idx ON public.crm_opportunities (lead_id);
CREATE TRIGGER crm_opps_updated BEFORE UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Histórico de etapas
CREATE TABLE public.crm_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  note text,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.crm_stage_history TO authenticated;
GRANT ALL ON public.crm_stage_history TO service_role;
ALTER TABLE public.crm_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_stage_history_select" ON public.crm_stage_history FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
);
CREATE POLICY "crm_stage_history_insert" ON public.crm_stage_history FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND created_by_user_id = auth.uid()
  AND public.crm_can_write(organization_id, auth.uid(), NULL)
);
CREATE INDEX crm_stage_history_opp_idx ON public.crm_stage_history (opportunity_id, created_at DESC);

-- 7) Atividades comerciais
CREATE TABLE public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('note','call','meeting','email','task','followup','reminder')),
  title text NOT NULL,
  description text,
  activity_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','canceled')),
  outcome text,
  next_step text,
  owner_user_id uuid,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_activities_select" ON public.crm_activities FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
);
CREATE POLICY "crm_activities_write" ON public.crm_activities FOR ALL TO authenticated
USING (public.crm_can_write(organization_id, auth.uid(), owner_user_id))
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND public.crm_can_write(organization_id, auth.uid(), owner_user_id)
);
CREATE INDEX crm_activities_opp_idx ON public.crm_activities (opportunity_id, activity_at DESC);
CREATE INDEX crm_activities_due_idx ON public.crm_activities (organization_id, status, due_at);
CREATE TRIGGER crm_activities_updated BEFORE UPDATE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Verificação de conflito
CREATE TABLE public.crm_conflict_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','cleared','conflict','cleared_with_note')),
  terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  decided_by_user_id uuid,
  decided_at timestamptz,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crm_conflict_checks TO authenticated;
GRANT ALL ON public.crm_conflict_checks TO service_role;
ALTER TABLE public.crm_conflict_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_conflicts_select" ON public.crm_conflict_checks FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
);
CREATE POLICY "crm_conflicts_insert" ON public.crm_conflict_checks FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND created_by_user_id = auth.uid()
  AND public.crm_can_write(organization_id, auth.uid(), NULL)
);
CREATE POLICY "crm_conflicts_update" ON public.crm_conflict_checks FOR UPDATE TO authenticated
USING (public.crm_can_write(organization_id, auth.uid(), NULL))
WITH CHECK (public.crm_can_write(organization_id, auth.uid(), NULL));
CREATE INDEX crm_conflicts_opp_idx ON public.crm_conflict_checks (opportunity_id, created_at DESC);
CREATE TRIGGER crm_conflicts_updated BEFORE UPDATE ON public.crm_conflict_checks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9) Propostas (entidade principal)
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  owner_user_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','in_review','approved','shared','viewed','negotiating',
    'accepted','declined','expired','canceled'
  )),
  content_html text NOT NULL DEFAULT '',
  form jsonb NOT NULL DEFAULT '{}'::jsonb,
  fixed_value_cents bigint NOT NULL DEFAULT 0 CHECK (fixed_value_cents >= 0),
  recurring_value_cents bigint NOT NULL DEFAULT 0 CHECK (recurring_value_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  success_fee_percent numeric(5,2) CHECK (success_fee_percent IS NULL OR (success_fee_percent >= 0 AND success_fee_percent <= 100)),
  payment_terms text,
  commercial_notes text,
  sent_at timestamptz,
  valid_until timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  responded_at timestamptz,
  response_name text,
  response_email text,
  response_comment text,
  decline_reason text,
  converted_case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  approved_by_user_id uuid,
  approved_at timestamptz,
  created_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals_select" ON public.proposals FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
  AND (
    public.crm_can_view_all(organization_id, auth.uid())
    OR owner_user_id = auth.uid()
    OR created_by_user_id = auth.uid()
  )
);
CREATE POLICY "proposals_insert" ON public.proposals FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND created_by_user_id = auth.uid()
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.proposals_create')
);
CREATE POLICY "proposals_update" ON public.proposals FOR UPDATE TO authenticated
USING (public.crm_can_write(organization_id, auth.uid(), owner_user_id))
WITH CHECK (public.crm_can_write(organization_id, auth.uid(), owner_user_id));
CREATE POLICY "proposals_delete" ON public.proposals FOR DELETE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'crm.manage_all'));

CREATE UNIQUE INDEX proposals_org_number_idx ON public.proposals (organization_id, number);
CREATE INDEX proposals_org_status_idx ON public.proposals (organization_id, status);
CREATE INDEX proposals_opportunity_idx ON public.proposals (opportunity_id);
CREATE TRIGGER proposals_updated BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- numeração sequencial por escritório
CREATE OR REPLACE FUNCTION public.proposals_assign_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number <= 0 THEN
    SELECT COALESCE(MAX(number), 0) + 1 INTO NEW.number
    FROM public.proposals WHERE organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proposals_number BEFORE INSERT ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.proposals_assign_number();

-- vínculo oportunidade → proposta
ALTER TABLE public.crm_opportunities
  ADD CONSTRAINT crm_opps_proposal_fk FOREIGN KEY (proposal_id)
  REFERENCES public.proposals(id) ON DELETE SET NULL;

-- 10) Eventos da proposta (auditoria)
CREATE TABLE public.proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  kind text NOT NULL,
  actor_user_id uuid,
  actor_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.proposal_events TO authenticated;
GRANT ALL ON public.proposal_events TO service_role;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposal_events_select" ON public.proposal_events FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
);
CREATE POLICY "proposal_events_insert" ON public.proposal_events FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id, auth.uid())
  AND public.crm_can_write(organization_id, auth.uid(), NULL)
);
CREATE INDEX proposal_events_proposal_idx ON public.proposal_events (proposal_id, created_at DESC);

-- 11) Configurações comerciais
CREATE TABLE public.crm_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  loss_reasons text[] NOT NULL DEFAULT ARRAY['Preço','Prazo','Escolheu outro escritório','Sem resposta','Fora do escopo']::text[],
  practice_areas text[] NOT NULL DEFAULT ARRAY['Cível','Trabalhista','Empresarial','Tributário','Família','Penal']::text[],
  sources text[] NOT NULL DEFAULT ARRAY['Indicação','Site','Redes sociais','Evento','Cliente atual','Prospecção ativa']::text[],
  default_currency text NOT NULL DEFAULT 'BRL',
  default_validity_days integer NOT NULL DEFAULT 15 CHECK (default_validity_days BETWEEN 1 AND 365),
  proposal_prefix text NOT NULL DEFAULT 'PROP',
  required_fields jsonb NOT NULL DEFAULT '{"opportunity":["title"],"lead":["name"]}'::jsonb,
  updated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crm_settings TO authenticated;
GRANT ALL ON public.crm_settings TO service_role;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_settings_select" ON public.crm_settings FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND public.has_org_permission(organization_id, auth.uid(), 'crm.view')
);
CREATE POLICY "crm_settings_insert" ON public.crm_settings FOR INSERT TO authenticated
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'crm.admin'));
CREATE POLICY "crm_settings_update" ON public.crm_settings FOR UPDATE TO authenticated
USING (public.has_org_permission(organization_id, auth.uid(), 'crm.admin'))
WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'crm.admin'));
CREATE TRIGGER crm_settings_updated BEFORE UPDATE ON public.crm_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12) Integração das tabelas existentes com a nova entidade de proposta
ALTER TABLE public.proposal_drafts ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE;
ALTER TABLE public.proposal_versions ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE;
ALTER TABLE public.proposal_shares ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE;
ALTER TABLE public.proposal_shares ADD COLUMN IF NOT EXISTS first_accessed_at timestamptz;
ALTER TABLE public.proposal_shares ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.proposal_attachments ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE INDEX proposal_drafts_proposal_idx ON public.proposal_drafts (proposal_id);
CREATE INDEX proposal_versions_proposal_idx ON public.proposal_versions (proposal_id);
CREATE INDEX proposal_shares_proposal_idx ON public.proposal_shares (proposal_id);

-- a restrição antiga de "um rascunho por escritório/caso" não pode limitar
-- múltiplas propostas: passa a valer apenas para o rascunho avulso (sem proposta)
DROP INDEX IF EXISTS proposal_drafts_org_case_uniq;
DROP INDEX IF EXISTS proposal_drafts_user_case_uniq;
DROP INDEX IF EXISTS proposal_drafts_unique_scope;
CREATE UNIQUE INDEX proposal_drafts_legacy_scope_uniq
  ON public.proposal_drafts (organization_id, COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE proposal_id IS NULL;
CREATE UNIQUE INDEX proposal_drafts_proposal_uniq
  ON public.proposal_drafts (proposal_id) WHERE proposal_id IS NOT NULL;

-- 13) Rastreabilidade nos módulos existentes
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE;
CREATE INDEX cases_opportunity_idx ON public.cases (opportunity_id);
CREATE INDEX tasks_opportunity_idx ON public.tasks (opportunity_id);
CREATE INDEX events_opportunity_idx ON public.events (opportunity_id);

-- 14) Impede conversão duplicada da mesma oportunidade em caso
CREATE UNIQUE INDEX cases_opportunity_unique_idx ON public.cases (opportunity_id) WHERE opportunity_id IS NOT NULL;