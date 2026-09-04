-- Partes temporárias de PDFs grandes enviados antes da criação do caso.
-- A primeira parte alimenta a extração dos dados iniciais; todas as partes são
-- convertidas em documentos do caso sem novo upload.
CREATE TABLE IF NOT EXISTS public.case_intake_document_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_document_id uuid NOT NULL REFERENCES public.case_intake_documents(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/pdf',
  file_size bigint NOT NULL CHECK (file_size > 0),
  split_group_id uuid NOT NULL,
  part_index integer NOT NULL CHECK (part_index > 0),
  part_count integer NOT NULL CHECK (part_count > 1),
  page_offset integer NOT NULL DEFAULT 0 CHECK (page_offset >= 0),
  page_count integer NOT NULL CHECK (page_count > 0),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (intake_document_id, part_index),
  CHECK (part_index <= part_count)
);

CREATE INDEX IF NOT EXISTS idx_intake_parts_intake
  ON public.case_intake_document_parts (intake_document_id, part_index);
CREATE INDEX IF NOT EXISTS idx_intake_parts_group
  ON public.case_intake_document_parts (split_group_id, part_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_intake_document_parts TO authenticated;
GRANT ALL ON public.case_intake_document_parts TO service_role;
ALTER TABLE public.case_intake_document_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_parts_select_own_or_org_managers"
  ON public.case_intake_document_parts
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (
      created_by_user_id = auth.uid()
      OR public.has_org_permission(organization_id, auth.uid(), 'cases.view_all')
    )
  );

CREATE POLICY "intake_parts_insert_own"
  ON public.case_intake_document_parts
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
    AND EXISTS (
      SELECT 1
      FROM public.case_intake_documents intake
      WHERE intake.id = case_intake_document_parts.intake_document_id
        AND intake.organization_id = case_intake_document_parts.organization_id
        AND intake.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "intake_parts_update_own"
  ON public.case_intake_document_parts
  FOR UPDATE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  )
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.case_intake_documents intake
      WHERE intake.id = case_intake_document_parts.intake_document_id
        AND intake.organization_id = case_intake_document_parts.organization_id
        AND intake.created_by_user_id = auth.uid()
    )
  );

CREATE POLICY "intake_parts_delete_own"
  ON public.case_intake_document_parts
  FOR DELETE TO authenticated
  USING (
    created_by_user_id = auth.uid()
    AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  );
