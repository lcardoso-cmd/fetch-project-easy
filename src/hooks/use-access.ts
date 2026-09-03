import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getMyAccess, type MyAccess } from "@/lib/access.functions";
import {
  ORG_ROLES,
  ORG_ROLE_LABELS,
  ORG_ROLE_DEFAULT_PERMISSIONS,
  type OrgPermission,
  type OrgRole,
  type PlatformRole,
} from "@/lib/org-permissions";

const SIM_KEY = "jm.viewAsRole";
const SIM_EVENT = "jm.viewAsRole.change";

function readSim(): OrgRole | null {
  if (typeof window === "undefined") return null;
  const v = window.sessionStorage.getItem(SIM_KEY);
  return v && (ORG_ROLES as readonly string[]).includes(v) ? (v as OrgRole) : null;
}

function writeSim(role: OrgRole | null) {
  if (typeof window === "undefined") return;
  if (role) window.sessionStorage.setItem(SIM_KEY, role);
  else window.sessionStorage.removeItem(SIM_KEY);
  window.dispatchEvent(new CustomEvent(SIM_EVENT));
}

/** Presets de simulação visual — apenas papéis reais da organização. */
export const VIEW_AS_ROLES = ORG_ROLES.map((role) => ({
  role,
  label: ORG_ROLE_LABELS[role],
}));

/**
 * Hook único de autorização no frontend.
 * O servidor continua sendo a autoridade final (RLS + requireOrgPermission);
 * a simulação abaixo é apenas visual e restrita à equipe B2B.
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

  const [simulation, setSimulationState] = useState<OrgRole | null>(readSim);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setSimulationState(readSim());
    window.addEventListener(SIM_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SIM_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!isPlatformUser && simulation) {
      writeSim(null);
      setSimulationState(null);
    }
  }, [isPlatformUser, simulation]);

  const setSimulation = useCallback((role: OrgRole | null) => {
    writeSim(role);
    setSimulationState(role);
  }, []);

  const realRole = access?.role ?? null;
  const role = isPlatformUser && simulation ? simulation : realRole;

  const permissions = useMemo<OrgPermission[]>(() => {
    if (isPlatformUser && simulation) {
      return [...ORG_ROLE_DEFAULT_PERMISSIONS[simulation]];
    }
    return access?.permissions ?? [];
  }, [access, isPlatformUser, simulation]);

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
    realRole,
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
    /** Simulação visual (somente equipe B2B). */
    simulation: isPlatformUser ? simulation : null,
    setSimulation,
    clearSimulation: () => setSimulation(null),
  };
}
