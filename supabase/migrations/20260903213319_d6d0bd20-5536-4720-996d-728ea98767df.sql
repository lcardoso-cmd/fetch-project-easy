-- 1. Matriz oficial de permissões por papel (espelho de src/lib/org-permissions.ts)
CREATE OR REPLACE FUNCTION public.org_role_default_permissions(_role public.org_role)
RETURNS public.org_permission[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'owner' THEN ARRAY(SELECT unnest(enum_range(NULL::public.org_permission)))
    WHEN 'admin' THEN ARRAY[
      'members.view','members.invite','members.manage','permissions.manage',
      'services.view','services.request',
      'integrations.view','integrations.manage',
      'usage.view_self','usage.view_organization','usage.manage_budget',
      'cases.create','cases.view_all','cases.manage_all','cases.delete',
      'documents.upload','documents.delete',
      'ai.use','proposals.use','marketing.use','publications.use',
      'crm.view','crm.manage_own','crm.view_all','crm.manage_all','crm.view_values',
      'crm.proposals_create','crm.proposals_approve','crm.proposals_share',
      'crm.record_outcome','crm.convert','crm.admin'
    ]::public.org_permission[]
    WHEN 'manager' THEN ARRAY[
      'members.view',
      'integrations.view',
      'usage.view_self','usage.view_organization',
      'cases.create','cases.view_all','cases.manage_all',
      'documents.upload','documents.delete',
      'ai.use'
    ]::public.org_permission[]
    WHEN 'lawyer' THEN ARRAY[
      'members.view','usage.view_self','cases.create','documents.upload','ai.use'
    ]::public.org_permission[]
    WHEN 'collaborator' THEN ARRAY[
      'members.view','usage.view_self','documents.upload','ai.use'
    ]::public.org_permission[]
    WHEN 'viewer' THEN ARRAY[
      'members.view','usage.view_self'
    ]::public.org_permission[]
    WHEN 'billing_manager' THEN ARRAY[
      'members.view','billing.view','billing.manage','subscription.manage',
      'usage.view_self','usage.view_organization'
    ]::public.org_permission[]
    ELSE ARRAY[]::public.org_permission[]
  END;
$$;

-- 2. Migração conservadora do modelo legado de equipe para o modelo de organização
INSERT INTO public.organization_memberships (organization_id, user_id, role, status, invited_by_user_id)
SELECT DISTINCT ON (o.organization_id, t.member_user_id)
  o.organization_id,
  t.member_user_id,
  CASE t.access_role
    WHEN 'admin' THEN 'admin'::public.org_role
    WHEN 'editor' THEN 'lawyer'::public.org_role
    ELSE 'viewer'::public.org_role
  END,
  'active'::public.membership_status,
  t.user_id
FROM public.team_members t
JOIN public.organization_memberships o
  ON o.user_id = t.user_id AND o.role = 'owner' AND o.status = 'active'
WHERE t.member_user_id IS NOT NULL
ORDER BY o.organization_id, t.member_user_id, t.created_at
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO public.organization_invitations (organization_id, email, role, token, status, invited_by_user_id, expires_at)
SELECT DISTINCT ON (o.organization_id, lower(btrim(i.email)))
  o.organization_id,
  lower(btrim(i.email)),
  CASE t.access_role
    WHEN 'admin' THEN 'admin'::public.org_role
    WHEN 'editor' THEN 'lawyer'::public.org_role
    ELSE 'viewer'::public.org_role
  END,
  i.token,
  'pending'::public.org_invitation_status,
  i.owner_user_id,
  GREATEST(i.expires_at, now() + interval '7 days')
FROM public.team_invitations i
JOIN public.team_members t ON t.id = i.team_member_id
JOIN public.organization_memberships o
  ON o.user_id = i.owner_user_id AND o.role = 'owner' AND o.status = 'active'
WHERE i.status = 'pending'
  AND i.accepted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_invitations x
    WHERE x.organization_id = o.organization_id
      AND lower(btrim(x.email)) = lower(btrim(i.email))
      AND x.status = 'pending'
  )
ORDER BY o.organization_id, lower(btrim(i.email)), i.created_at DESC
ON CONFLICT (token) DO NOTHING;
