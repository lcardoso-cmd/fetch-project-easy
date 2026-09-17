CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  parent_folder_id uuid REFERENCES public.document_folders(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_folders_no_self_parent CHECK (parent_folder_id IS NULL OR parent_folder_id <> id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_folders TO authenticated;
GRANT ALL ON public.document_folders TO service_role;

CREATE UNIQUE INDEX document_folders_unique_root_name
  ON public.document_folders (organization_id, COALESCE(case_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  WHERE parent_folder_id IS NULL;
CREATE UNIQUE INDEX document_folders_unique_child_name
  ON public.document_folders (organization_id, parent_folder_id, lower(name))
  WHERE parent_folder_id IS NOT NULL;
CREATE INDEX document_folders_org_case_idx ON public.document_folders (organization_id, case_id);
CREATE INDEX document_folders_parent_idx ON public.document_folders (parent_folder_id);

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view accessible document folders"
ON public.document_folders FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (case_id IS NULL OR public.user_can_access_case(case_id, auth.uid()))
);

CREATE POLICY "Uploaders can create document folders"
ON public.document_folders FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  AND created_by_user_id = auth.uid()
  AND (case_id IS NULL OR public.user_can_access_case(case_id, auth.uid()))
);

CREATE POLICY "Uploaders can update document folders"
ON public.document_folders FOR UPDATE TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  AND (case_id IS NULL OR public.user_can_access_case(case_id, auth.uid()))
)
WITH CHECK (
  public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  AND (case_id IS NULL OR public.user_can_access_case(case_id, auth.uid()))
);

CREATE POLICY "Uploaders can delete document folders"
ON public.document_folders FOR DELETE TO authenticated
USING (
  public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  AND (case_id IS NULL OR public.user_can_access_case(case_id, auth.uid()))
);

CREATE TRIGGER update_document_folders_updated_at
BEFORE UPDATE ON public.document_folders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.documents
  ADD COLUMN folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL,
  ADD COLUMN relative_path text;
CREATE INDEX documents_folder_id_idx ON public.documents (folder_id);
CREATE INDEX documents_org_case_folder_idx ON public.documents (organization_id, case_id, folder_id);

CREATE TABLE public.document_folder_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  case_id uuid REFERENCES public.cases(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.document_folders(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('created', 'renamed', 'moved', 'deleted')),
  previous_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.document_folder_audit_events TO authenticated;
GRANT ALL ON public.document_folder_audit_events TO service_role;
ALTER TABLE public.document_folder_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view accessible folder audit"
ON public.document_folder_audit_events FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id, auth.uid())
  AND (case_id IS NULL OR public.user_can_access_case(case_id, auth.uid()))
);

CREATE POLICY "Uploaders can create folder audit"
ON public.document_folder_audit_events FOR INSERT TO authenticated
WITH CHECK (
  actor_user_id = auth.uid()
  AND public.has_org_permission(organization_id, auth.uid(), 'documents.upload')
  AND (case_id IS NULL OR public.user_can_access_case(case_id, auth.uid()))
);