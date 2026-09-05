-- 1. Documents storage: deny by default when no document row exists
DROP POLICY IF EXISTS documents_storage_select ON storage.objects;
CREATE POLICY documents_storage_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND is_org_member(((storage.foldername(name))[1])::uuid, auth.uid())
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = objects.name
        AND user_can_access_case(d.case_id, auth.uid())
    )
  )
);

-- 2. B2B service request events: immutable audit trail (no updates/deletes)
REVOKE UPDATE, DELETE, TRUNCATE ON public.b2b_service_request_events FROM authenticated, anon;
GRANT SELECT, INSERT ON public.b2b_service_request_events TO authenticated;
GRANT ALL ON public.b2b_service_request_events TO service_role;

DROP POLICY IF EXISTS b2b_events_no_update ON public.b2b_service_request_events;
CREATE POLICY b2b_events_no_update ON public.b2b_service_request_events
AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS b2b_events_no_delete ON public.b2b_service_request_events;
CREATE POLICY b2b_events_no_delete ON public.b2b_service_request_events
AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);