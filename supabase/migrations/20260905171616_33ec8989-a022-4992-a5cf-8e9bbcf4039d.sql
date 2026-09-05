CREATE UNIQUE INDEX IF NOT EXISTS idx_index_jobs_one_running_per_org
  ON public.document_index_jobs (organization_id)
  WHERE status = 'running';

CREATE OR REPLACE FUNCTION public.claim_index_jobs(
  _worker text,
  _limit integer DEFAULT 1,
  _stale_seconds integer DEFAULT 300
)
RETURNS SETOF public.document_index_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _candidate record;
  _claimed public.document_index_jobs;
  _claimed_count integer := 0;
BEGIN
  FOR _candidate IN
    SELECT j.id
    FROM public.document_index_jobs j
    JOIN public.documents d ON d.id = j.document_id
    WHERE (
        (
          j.status = 'running'
          AND COALESCE(j.heartbeat_at, j.locked_at, j.started_at)
              < now() - make_interval(secs => _stale_seconds)
        )
        OR (
          j.status = 'queued'
          AND NOT EXISTS (
            SELECT 1
            FROM public.document_index_jobs active
            WHERE active.organization_id = j.organization_id
              AND active.status = 'running'
              AND COALESCE(active.heartbeat_at, active.locked_at, active.started_at)
                  >= now() - make_interval(secs => _stale_seconds)
          )
        )
      )
      AND j.attempt_count < j.max_attempts
      AND (
        d.split_group_id IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM public.documents earlier_document
          JOIN public.document_index_jobs earlier_job
            ON earlier_job.document_id = earlier_document.id
          WHERE earlier_document.organization_id = d.organization_id
            AND earlier_document.split_group_id = d.split_group_id
            AND COALESCE(earlier_document.part_index, 1) < COALESCE(d.part_index, 1)
            AND earlier_job.status NOT IN ('done', 'cancelled')
        )
      )
    ORDER BY
      CASE
        WHEN j.status = 'running' THEN 0
        WHEN j.started_at IS NOT NULL OR COALESCE(j.progress, '{}'::jsonb) <> '{}'::jsonb THEN 1
        ELSE 2
      END,
      j.started_at NULLS LAST,
      j.created_at,
      COALESCE(d.part_index, 1)
    FOR UPDATE OF j SKIP LOCKED
  LOOP
    EXIT WHEN _claimed_count >= GREATEST(1, LEAST(_limit, 10));
    BEGIN
      UPDATE public.document_index_jobs j
      SET status = 'running',
          locked_by = _worker,
          locked_at = now(),
          heartbeat_at = now(),
          started_at = COALESCE(j.started_at, now()),
          attempt_count = j.attempt_count + 1,
          last_error_code = NULL,
          last_error_message = NULL
      WHERE j.id = _candidate.id
        AND (
          j.status = 'queued'
          OR (
            j.status = 'running'
            AND COALESCE(j.heartbeat_at, j.locked_at, j.started_at)
                < now() - make_interval(secs => _stale_seconds)
          )
        )
      RETURNING j.* INTO _claimed;

      IF FOUND THEN
        _claimed_count := _claimed_count + 1;
        RETURN NEXT _claimed;
      END IF;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_index_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_index_jobs(text, integer, integer) TO service_role;