import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getMyAccess, type MyAccess } from "@/lib/access.functions";
import {
  ORG_ROLE_LABELS,
  type OrgPermission,
  type PlatformRole,
} from "@/lib/org-permissions";

/**
 * Hook único de autorização no frontend.
 * Usa exclusivamente o papel e as permissões reais do usuário autenticado —
 * não existe simulação de perfis. O servidor continua sendo a autoridade
 * final (RLS + `requireOrgPermission`); o acesso de suporte da B2B é
 * concedido apenas por `support_access_grants`.
 */
export function useAccess() {
  const { user } = useAuth();
  const fn = useServerFn(getMyAccess);
  const query = useQuery<MyAccess>({
    queryKey: ["my-access", user?.id],
    queryFn: () => fn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const access = query.data ?? null;
  const platformRoles = useMemo<PlatformRole[]>(() => access?.platform_roles ?? [], [access]);
  const isPlatformUser = platformRoles.length > 0;

  const role = access?.role ?? null;
  const permissions = useMemo<OrgPermission[]>(() => access?.permissions ?? [], [access]);
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const hasOrgPermission = useCallback(
    (p: OrgPermission) => permissionSet.has(p),
    [permissionSet],
  );
  const hasAnyOrgPermission = useCallback(
    (...ps: OrgPermission[]) => ps.some((p) => permissionSet.has(p)),
    [permissionSet],
  );
  const hasPlatformRole = useCallback(
    (r: PlatformRole) => platformRoles.includes(r) || platformRoles.includes("super_admin"),
    [platformRoles],
  );

  return {
    isLoading: query.isLoading,
    organization: access?.organization ?? null,
    memberships: access?.memberships ?? [],
    role,
    realRole: role,
    roleLabel: role ? ORG_ROLE_LABELS[role] : null,
    permissions,
    platformRoles,
    hasOrgPermission,
    hasAnyOrgPermission,
    hasPlatformRole,
    isOwner: role === "owner",
    isOfficeAdmin: role === "owner" || role === "admin",
    isPlatformUser,
    isSuperAdmin: platformRoles.includes("super_admin"),
  };
}
