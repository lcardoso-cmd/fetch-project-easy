CREATE TABLE public.document_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  document_id uuid,
  action text NOT NULL CHECK (action IN ('uploaded','imported','replaced','duplicate_ignored','discarded','deleted')),
  reason text,
  filename text,
  content_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_audit_events_case_id_created_idx
  ON public.document_audit_events (case_id, created_at DESC);

GRANT SELECT, INSERT ON public.document_audit_events TO authenticated;
GRANT ALL ON public.document_audit_events TO service_role;

ALTER TABLE public.document_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Case members can read document audit"
  ON public.document_audit_events
  FOR SELECT
  TO authenticated
  USING (public.user_can_access_case(case_id, auth.uid()));

CREATE POLICY "Case editors can insert document audit"
  ON public.document_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_edit_case(case_id, auth.uid())
  );
