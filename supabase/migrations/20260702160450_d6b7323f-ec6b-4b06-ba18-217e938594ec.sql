
-- 1. Enum de capacidades
CREATE TYPE public.app_capability AS ENUM (
  'cases',
  'expert_opinion',
  'commercial',
  'marketing',
  'office_admin',
  'platform_admin'
);

-- 2. Tabela user_capabilities
CREATE TABLE public.user_capabilities (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability public.app_capability NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, capability)
);

GRANT SELECT, INSERT, DELETE ON public.user_capabilities TO authenticated;
GRANT ALL ON public.user_capabilities TO service_role;

ALTER TABLE public.user_capabilities ENABLE ROW LEVEL SECURITY;

-- 3. Função has_capability (security definer, evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_capability(_user_id uuid, _capability public.app_capability)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_capabilities
    WHERE user_id = _user_id AND capability = _capability
  );
$$;

-- 4. Policies
-- Leitura: sempre pode ler as próprias capacidades
CREATE POLICY "read own capabilities"
ON public.user_capabilities
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- office_admin lê capacidades dos membros do seu escritório
CREATE POLICY "office admin reads members"
ON public.user_capabilities
FOR SELECT
TO authenticated
USING (
  public.has_capability(auth.uid(), 'office_admin')
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.member_user_id = user_capabilities.user_id
  )
);

-- office_admin insere capacidades para membros do seu escritório
CREATE POLICY "office admin grants to members"
ON public.user_capabilities
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_capability(auth.uid(), 'office_admin')
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.member_user_id = user_capabilities.user_id
  )
);

-- office_admin remove capacidades dos membros do seu escritório
CREATE POLICY "office admin revokes from members"
ON public.user_capabilities
FOR DELETE
TO authenticated
USING (
  public.has_capability(auth.uid(), 'office_admin')
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.member_user_id = user_capabilities.user_id
  )
);

-- 5. Seed: todos ganham 'cases'
INSERT INTO public.user_capabilities (user_id, capability)
SELECT id, 'cases' FROM auth.users
ON CONFLICT DO NOTHING;

-- Admins da plataforma (app_role = admin) viram office_admin + comercial + marketing
INSERT INTO public.user_capabilities (user_id, capability)
SELECT ur.user_id, cap
FROM public.user_roles ur
CROSS JOIN (VALUES ('office_admin'::public.app_capability), ('commercial'::public.app_capability), ('marketing'::public.app_capability)) AS c(cap)
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;

-- Peritos ganham expert_opinion
INSERT INTO public.user_capabilities (user_id, capability)
SELECT id, 'expert_opinion'
FROM public.profiles
WHERE practice_type = 'perito'
ON CONFLICT DO NOTHING;

-- Profissionais autônomos (dono da conta sem team_members) viram office_admin com tudo
INSERT INTO public.user_capabilities (user_id, capability)
SELECT p.id, cap
FROM public.profiles p
CROSS JOIN (VALUES ('office_admin'::public.app_capability), ('commercial'::public.app_capability), ('marketing'::public.app_capability)) AS c(cap)
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members tm WHERE tm.member_user_id = p.id
)
ON CONFLICT DO NOTHING;
