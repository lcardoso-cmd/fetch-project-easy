CREATE TABLE public.document_image_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  page_local integer,
  label text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (document_id, page_number)
);

CREATE INDEX idx_document_image_pages_document ON public.document_image_pages(document_id, page_number);
CREATE INDEX idx_document_image_pages_case ON public.document_image_pages(case_id);

GRANT SELECT ON public.document_image_pages TO authenticated;
GRANT ALL ON public.document_image_pages TO service_role;

ALTER TABLE public.document_image_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "image_pages_select" ON public.document_image_pages
  FOR SELECT TO authenticated
  USING (public.user_can_access_case(case_id, auth.uid()));

CREATE TRIGGER update_document_image_pages_updated_at
  BEFORE UPDATE ON public.document_image_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();