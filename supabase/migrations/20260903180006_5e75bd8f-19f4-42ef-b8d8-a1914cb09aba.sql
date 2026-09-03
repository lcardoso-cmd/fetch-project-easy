ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id, status ORDER BY created_at) AS rn
  FROM public.tasks
)
UPDATE public.tasks t SET position = ranked.rn
FROM ranked WHERE ranked.id = t.id;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending','in_progress','in_review','blocked','done'));

CREATE INDEX IF NOT EXISTS tasks_org_status_position_idx
  ON public.tasks (organization_id, status, position);