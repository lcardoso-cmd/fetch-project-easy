CREATE TABLE public.process_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.ai_chat_threads(id) ON DELETE SET NULL,
  cnj text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','partial','failed')),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  consulted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.process_consultations TO authenticated;
GRANT ALL ON public.process_consultations TO service_role;
ALTER TABLE public.process_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_consultations_select ON public.process_consultations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY process_consultations_insert ON public.process_consultations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND requested_by_user_id = auth.uid() AND public.user_can_edit_case(case_id, auth.uid()));
CREATE POLICY process_consultations_update ON public.process_consultations FOR UPDATE TO authenticated
  USING (requested_by_user_id = auth.uid() AND public.user_can_edit_case(case_id, auth.uid()))
  WITH CHECK (requested_by_user_id = auth.uid() AND public.user_can_edit_case(case_id, auth.uid()));
CREATE INDEX idx_process_consultations_case ON public.process_consultations(organization_id, case_id, consulted_at DESC);
CREATE INDEX idx_process_consultations_cnj ON public.process_consultations(organization_id, cnj, consulted_at DESC);
CREATE TRIGGER update_process_consultations_updated_at BEFORE UPDATE ON public.process_consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.process_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  consultation_id uuid NOT NULL REFERENCES public.process_consultations(id) ON DELETE CASCADE,
  cnj text NOT NULL,
  source text NOT NULL CHECK (source IN ('datajud','djen','tjrj')),
  source_id text,
  movement_date timestamptz,
  movement_code integer,
  movement_name text NOT NULL,
  complement text,
  court text,
  unit_name text,
  source_url text,
  source_hash text NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, case_id, source, source_hash)
);
GRANT SELECT, INSERT ON public.process_movements TO authenticated;
GRANT ALL ON public.process_movements TO service_role;
ALTER TABLE public.process_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_movements_select ON public.process_movements FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY process_movements_insert ON public.process_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()) AND public.user_can_edit_case(case_id, auth.uid()));
CREATE INDEX idx_process_movements_case ON public.process_movements(organization_id, case_id, movement_date DESC);
CREATE INDEX idx_process_movements_consultation ON public.process_movements(consultation_id, movement_date DESC);

CREATE TABLE public.case_update_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  consultation_id uuid NOT NULL REFERENCES public.process_consultations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  decided_by_user_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected','expired')),
  current_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposed_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.case_update_proposals TO authenticated;
GRANT ALL ON public.case_update_proposals TO service_role;
ALTER TABLE public.case_update_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_update_proposals_select ON public.case_update_proposals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY case_update_proposals_insert ON public.case_update_proposals FOR INSERT TO authenticated
  WITH CHECK (created_by_user_id = auth.uid() AND public.user_can_edit_case(case_id, auth.uid()));
CREATE POLICY case_update_proposals_update ON public.case_update_proposals FOR UPDATE TO authenticated
  USING (public.user_can_edit_case(case_id, auth.uid()))
  WITH CHECK (public.user_can_edit_case(case_id, auth.uid()));
CREATE INDEX idx_case_update_proposals_case ON public.case_update_proposals(organization_id, case_id, created_at DESC);
CREATE UNIQUE INDEX idx_case_update_one_pending ON public.case_update_proposals(consultation_id) WHERE status = 'pending';
CREATE TRIGGER update_case_update_proposals_updated_at BEFORE UPDATE ON public.case_update_proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.case_update_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.case_update_proposals(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('applied','rejected')),
  previous_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.case_update_audit TO authenticated;
GRANT ALL ON public.case_update_audit TO service_role;
ALTER TABLE public.case_update_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_update_audit_select ON public.case_update_audit FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND public.user_can_access_case(case_id, auth.uid()));
CREATE POLICY case_update_audit_insert ON public.case_update_audit FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() AND public.user_can_edit_case(case_id, auth.uid()));
CREATE INDEX idx_case_update_audit_case ON public.case_update_audit(organization_id, case_id, created_at DESC);