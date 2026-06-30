
-- 1) profiles: perfil profissional + onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS practice_type text NOT NULL DEFAULT 'advogado'
    CHECK (practice_type IN ('advogado','perito_judicial','assistente_tecnico')),
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Usuários existentes: marcar onboarding como concluído para não verem o fluxo.
UPDATE public.profiles SET onboarding_completed = true WHERE onboarding_completed = false;

-- 2) cases: tipo de matéria + campos de perícia/assistência
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS practice_type text
    CHECK (practice_type IN ('advogado','perito_judicial','assistente_tecnico')),
  ADD COLUMN IF NOT EXISTS matter_kind text NOT NULL DEFAULT 'processo'
    CHECK (matter_kind IN ('processo','pericia','assistencia_tecnica')),
  ADD COLUMN IF NOT EXISTS assisted_party_name text,
  ADD COLUMN IF NOT EXISTS perito_fee_cents integer,
  ADD COLUMN IF NOT EXISTS perito_appointment_date date,
  ADD COLUMN IF NOT EXISTS perito_deadline_date date,
  ADD COLUMN IF NOT EXISTS perito_nomination_ref text;

-- 3) Quesitos (perícia / assistência técnica)
CREATE TABLE IF NOT EXISTS public.case_quesitos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('juizo','autor','reu','assistido')),
  number integer,
  question text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS case_quesitos_case_id_idx ON public.case_quesitos(case_id);
CREATE INDEX IF NOT EXISTS case_quesitos_user_id_idx ON public.case_quesitos(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_quesitos TO authenticated;
GRANT ALL ON public.case_quesitos TO service_role;

ALTER TABLE public.case_quesitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own quesitos"
  ON public.case_quesitos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_case_quesitos_updated_at
  BEFORE UPDATE ON public.case_quesitos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
