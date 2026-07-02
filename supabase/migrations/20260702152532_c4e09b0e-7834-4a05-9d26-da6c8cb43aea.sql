
CREATE TABLE public.proposal_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id uuid NULL REFERENCES public.cases(id) ON DELETE SET NULL,
  filename text NOT NULL,
  file_type text NOT NULL DEFAULT '',
  file_size bigint NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  extracted_text text NULL,
  extraction_status text NOT NULL DEFAULT 'pending',
  extracted_fields jsonb NULL,
  extraction_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposal_attachments_status_chk
    CHECK (extraction_status IN ('pending','processing','done','error'))
);

CREATE INDEX proposal_attachments_user_case_idx
  ON public.proposal_attachments(user_id, case_id);
CREATE INDEX proposal_attachments_user_created_idx
  ON public.proposal_attachments(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_attachments TO authenticated;
GRANT ALL ON public.proposal_attachments TO service_role;

ALTER TABLE public.proposal_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own proposal attachments"
  ON public.proposal_attachments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER proposal_attachments_set_updated_at
  BEFORE UPDATE ON public.proposal_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
