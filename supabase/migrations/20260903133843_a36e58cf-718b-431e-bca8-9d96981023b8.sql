ALTER TABLE public.publications DROP CONSTRAINT publications_user_id_hash_key;
ALTER TABLE public.publications ADD CONSTRAINT publications_organization_id_hash_key UNIQUE (organization_id, hash);