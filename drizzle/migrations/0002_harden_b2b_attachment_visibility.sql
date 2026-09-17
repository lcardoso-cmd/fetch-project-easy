ALTER TABLE public.b2b_service_request_attachments
  ALTER COLUMN visibility SET DEFAULT 'internal';

DROP POLICY IF EXISTS b2b_attachments_insert ON public.b2b_service_request_attachments;
CREATE POLICY b2b_attachments_insert
ON public.b2b_service_request_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.b2b_service_requests r
    WHERE r.id = request_id
      AND (
        (
          visibility = 'client'
          AND public.has_org_permission(r.organization_id, auth.uid(), 'services.request')
        )
        OR (
          visibility = 'internal'
          AND public.has_platform_role(auth.uid(), 'platform_operations')
        )
      )
  )
);