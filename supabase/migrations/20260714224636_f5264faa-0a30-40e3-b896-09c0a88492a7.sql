
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_capabilities
    WHERE user_id = _user_id AND capability = 'super_admin'
  )
$$;

CREATE POLICY "marketing_deck_read_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'marketing-deck');

CREATE POLICY "marketing_deck_insert_super_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'marketing-deck' AND public.is_super_admin(auth.uid()));

CREATE POLICY "marketing_deck_update_super_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'marketing-deck' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'marketing-deck' AND public.is_super_admin(auth.uid()));

CREATE POLICY "marketing_deck_delete_super_admin"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'marketing-deck' AND public.is_super_admin(auth.uid()));
