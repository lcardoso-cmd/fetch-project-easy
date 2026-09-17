CREATE OR REPLACE FUNCTION public.document_folder_descendant_ids(_folder_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH RECURSIVE descendants AS (
    SELECT f.id
    FROM public.document_folders f
    WHERE f.id = _folder_id
    UNION ALL
    SELECT child.id
    FROM public.document_folders child
    JOIN descendants parent ON child.parent_folder_id = parent.id
  )
  SELECT descendants.id FROM descendants;
$$;

GRANT EXECUTE ON FUNCTION public.document_folder_descendant_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_folder_descendant_ids(uuid) TO service_role;