CREATE TABLE public.case_intake_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0,
  content_hash text,
  status text NOT NULL DEFAULT 'uploaded',
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  extraction_mode text,
  pages_total integer,
  pages_analyzed integer,
  ocr_pages integer[] NOT NULL DEFAULT '{}',
  failed_pages integer[] NOT NULL DEFAULT '{}',
  extracted_data jsonb,
  missing_fields text[] NOT NULL DEFAULT '{}',
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error_code text,
  last_error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  locked_by text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_intake_status_check CHECK (status IN (
    'uploaded','queued','extracting_text','ocr_processing','analyzing',
    'ready','partial','error','converted','cancelled'
  ))
);

CREATE INDEX idx_case_intake_org_user ON public.case_intake_documents (organization_id, created_by_user_id, created_at DESC);
CREATE INDEX idx_case_intake_pending ON public.case_intake_documents (status, heartbeat_at) WHERE status IN ('queued','extracting_text','ocr_processing','analyzing');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_intake_documents TO authenticated;
GRANT ALL ON public.case_intake_documents TO service_role;
ALTER TABLE public.case_intake_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_select_own_or_org_managers" ON public.case_intake_documents
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      created_by_user_id = auth.uid()
      OR public.has_org_permission(organization_id, auth.uid(), 'cases.view_all')
    )
  );

CREATE POLICY "intake_insert_own" ON public.case_intake_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  );

CREATE POLICY "intake_update_own" ON public.case_intake_documents
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  )
  WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "intake_delete_own" ON public.case_intake_documents
  FOR DELETE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  );

CREATE TRIGGER trg_case_intake_updated
  BEFORE UPDATE ON public.case_intake_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.document_index_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  force_vision boolean NOT NULL DEFAULT false,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error_code text,
  last_error_message text,
  locked_by text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_index_jobs_status_check CHECK (status IN ('queued','running','done','error','cancelled','paused'))
);

CREATE UNIQUE INDEX idx_index_jobs_active_unique
  ON public.document_index_jobs (document_id)
  WHERE status IN ('queued','running');
CREATE INDEX idx_index_jobs_pending ON public.document_index_jobs (status, heartbeat_at);
CREATE INDEX idx_index_jobs_org ON public.document_index_jobs (organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.document_index_jobs TO authenticated;
GRANT ALL ON public.document_index_jobs TO service_role;
ALTER TABLE public.document_index_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "index_jobs_select_org" ON public.document_index_jobs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "index_jobs_insert_uploader" ON public.document_index_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    requested_by_user_id = auth.uid()
    AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  );

CREATE POLICY "index_jobs_update_uploader" ON public.document_index_jobs
  FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, auth.uid(), 'documents.upload'))
  WITH CHECK (public.has_org_permission(organization_id, auth.uid(), 'documents.upload'));

CREATE TRIGGER trg_index_jobs_updated
  BEFORE UPDATE ON public.document_index_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_intake_jobs(_worker text, _limit integer DEFAULT 1, _stale_seconds integer DEFAULT 180)
RETURNS SETOF public.case_intake_documents
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT id FROM public.case_intake_documents
    WHERE (
        status = 'queued'
        OR (status IN ('extracting_text','ocr_processing','analyzing')
            AND COALESCE(heartbeat_at, locked_at, started_at) < now() - make_interval(secs => _stale_seconds))
      )
      AND attempt_count < max_attempts
    ORDER BY created_at
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.case_intake_documents d
  SET status = 'extracting_text',
      locked_by = _worker,
      locked_at = now(),
      heartbeat_at = now(),
      started_at = COALESCE(d.started_at, now()),
      attempt_count = d.attempt_count + 1,
      last_error_code = NULL,
      last_error_message = NULL
  FROM candidates c
  WHERE d.id = c.id
  RETURNING d.*;
$$;

CREATE OR REPLACE FUNCTION public.claim_index_jobs(_worker text, _limit integer DEFAULT 1, _stale_seconds integer DEFAULT 300)
RETURNS SETOF public.document_index_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT id FROM public.document_index_jobs
    WHERE (
        status = 'queued'
        OR (status = 'running'
            AND COALESCE(heartbeat_at, locked_at, started_at) < now() - make_interval(secs => _stale_seconds))
      )
      AND attempt_count < max_attempts
    ORDER BY created_at
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.document_index_jobs j
  SET status = 'running',
      locked_by = _worker,
      locked_at = now(),
      heartbeat_at = now(),
      started_at = COALESCE(j.started_at, now()),
      attempt_count = j.attempt_count + 1,
      last_error_code = NULL,
      last_error_message = NULL
  FROM candidates c
  WHERE j.id = c.id
  RETURNING j.*;
$$;

REVOKE ALL ON FUNCTION public.claim_intake_jobs(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_index_jobs(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_intake_jobs(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_index_jobs(text, integer, integer) TO service_role;