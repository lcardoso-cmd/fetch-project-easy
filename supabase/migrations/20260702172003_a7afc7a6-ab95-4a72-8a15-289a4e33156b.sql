
-- Enums
CREATE TYPE public.b2b_request_status AS ENUM (
  'novo', 'em_analise', 'proposta_enviada', 'aceita', 'recusada', 'cancelada'
);
CREATE TYPE public.b2b_request_urgency AS ENUM ('normal', 'alta', 'critica');
CREATE TYPE public.b2b_event_kind AS ENUM (
  'status_change', 'note_public', 'note_internal', 'attachment', 'created'
);
CREATE TYPE public.b2b_attachment_visibility AS ENUM ('client', 'internal');

-- app_settings (chave/valor genérico)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read settings" ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_platform_staff(auth.uid()));
CREATE POLICY "Staff can write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid())) WITH CHECK (public.is_platform_staff(auth.uid()));

INSERT INTO public.app_settings (key, value) VALUES
  ('b2b_inbox_email', '"lcardoso@b2bconsulting.com.br"'::jsonb);

-- Catálogo
CREATE TABLE public.b2b_service_catalog (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Briefcase',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.b2b_service_catalog TO authenticated;
GRANT ALL ON public.b2b_service_catalog TO service_role;
ALTER TABLE public.b2b_service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read active catalog" ON public.b2b_service_catalog
  FOR SELECT TO authenticated USING (active = true OR public.is_platform_staff(auth.uid()));
CREATE POLICY "Staff manages catalog" ON public.b2b_service_catalog
  FOR ALL TO authenticated
  USING (public.is_platform_staff(auth.uid()))
  WITH CHECK (public.is_platform_staff(auth.uid()));

INSERT INTO public.b2b_service_catalog (slug, title, description, icon, sort_order) VALUES
  ('assistencia-tecnica', 'Assistência Técnica em Processos',
   'Perícia econômico-contábil-financeira e de engenharia. Elaboração de quesitos, laudos e contra-laudos em processos judiciais e arbitrais.',
   'Microscope', 10),
  ('auditoria-calculos', 'Auditoria e Revisão de Cálculos Judiciais',
   'Refazimento e conferência de cálculos em execuções, liquidações de sentença, atualização monetária, juros e correções.',
   'Calculator', 20),
  ('parecer-tecnico', 'Parecer Técnico',
   'Pareceres econômicos, contábeis, financeiros ou de engenharia elaborados por especialistas com atuação em arbitragens nacionais e internacionais.',
   'FileCheck2', 30),
  ('administracao-contratual', 'Administração Contratual & Claims',
   'Gestão contratual, elaboração e defesa de pleitos, disruption/atrasos, litigation support e suporte técnico em Dispute Boards.',
   'FileSignature', 40),
  ('financas-forense', 'Finanças Corporativas & Forense',
   'Valuation, apuração de haveres societários, contabilidade forense, due diligence financeiro-contábil e reestruturação de empresas.',
   'Landmark', 50),
  ('estrategia-investigacoes', 'Estratégia & Investigações',
   'Investigações corporativas, compliance, FCPA, governança e consultoria em assuntos regulatórios.',
   'ShieldCheck', 60);

-- Solicitações
CREATE TABLE public.b2b_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  service_slug TEXT NOT NULL REFERENCES public.b2b_service_catalog(slug),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency public.b2b_request_urgency NOT NULL DEFAULT 'normal',
  desired_deadline DATE,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status public.b2b_request_status NOT NULL DEFAULT 'novo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.b2b_service_requests (requester_user_id, created_at DESC);
CREATE INDEX ON public.b2b_service_requests (status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.b2b_service_requests TO authenticated;
GRANT ALL ON public.b2b_service_requests TO service_role;
ALTER TABLE public.b2b_service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Requester reads own" ON public.b2b_service_requests
  FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR public.is_platform_staff(auth.uid()));
CREATE POLICY "Requester inserts own" ON public.b2b_service_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());
CREATE POLICY "Requester updates own or staff" ON public.b2b_service_requests
  FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid() OR public.is_platform_staff(auth.uid()))
  WITH CHECK (requester_user_id = auth.uid() OR public.is_platform_staff(auth.uid()));

CREATE TRIGGER trg_b2b_service_requests_updated
  BEFORE UPDATE ON public.b2b_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Anexos
CREATE TABLE public.b2b_service_request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.b2b_service_requests(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visibility public.b2b_attachment_visibility NOT NULL DEFAULT 'client',
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.b2b_service_request_attachments (request_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.b2b_service_request_attachments TO authenticated;
GRANT ALL ON public.b2b_service_request_attachments TO service_role;
ALTER TABLE public.b2b_service_request_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attachments read" ON public.b2b_service_request_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
      AND (r.requester_user_id = auth.uid() OR public.is_platform_staff(auth.uid())))
    AND (visibility = 'client' OR public.is_platform_staff(auth.uid()))
  );
CREATE POLICY "Attachments insert" ON public.b2b_service_request_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
      AND (r.requester_user_id = auth.uid() OR public.is_platform_staff(auth.uid())))
    AND (visibility = 'client' OR public.is_platform_staff(auth.uid()))
  );
CREATE POLICY "Attachments delete" ON public.b2b_service_request_attachments
  FOR DELETE TO authenticated
  USING (uploaded_by_user_id = auth.uid() OR public.is_platform_staff(auth.uid()));

-- Eventos (timeline)
CREATE TABLE public.b2b_service_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.b2b_service_requests(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.b2b_event_kind NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.b2b_service_request_events (request_id, created_at ASC);
GRANT SELECT, INSERT ON public.b2b_service_request_events TO authenticated;
GRANT ALL ON public.b2b_service_request_events TO service_role;
ALTER TABLE public.b2b_service_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events read" ON public.b2b_service_request_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
      AND (r.requester_user_id = auth.uid() OR public.is_platform_staff(auth.uid())))
    AND (kind <> 'note_internal' OR public.is_platform_staff(auth.uid()))
  );
CREATE POLICY "Events insert" ON public.b2b_service_request_events
  FOR INSERT TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.b2b_service_requests r WHERE r.id = request_id
      AND (r.requester_user_id = auth.uid() OR public.is_platform_staff(auth.uid())))
    AND (kind <> 'note_internal' OR public.is_platform_staff(auth.uid()))
  );
