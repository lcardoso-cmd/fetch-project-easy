import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ORG_ROLE_LABELS,
  effectivePermissions,
  type OrgPermission,
  type OrgRole,
  type PlatformRole,
} from "@/lib/org-permissions";

export type AccessOrganization = {
  id: string;
  name: string;
  status: string;
  operational_state: string;
  trial_ends_at: string | null;
};

export type MyAccess = {
  user_id: string;
  /** Organização ativa resolvida pelo servidor (nunca enviada pelo cliente). */
  organization: AccessOrganization | null;
  /** Papel na organização ativa. */
  role: OrgRole | null;
  role_label: string | null;
  /** Permissões efetivas (padrão do papel + concessões − revogações). */
  permissions: OrgPermission[];
  /** Papéis internos da B2B — nunca se misturam com os papéis da organização. */
  platform_roles: PlatformRole[];
  /** Outras organizações às quais o usuário pertence (troca de contexto). */
  memberships: Array<{ organization_id: string; name: string; role: OrgRole }>;
};

/**
 * Fonte única de verdade do acesso do usuário autenticado.
 * Resolve organização ativa, papel, permissões efetivas e papéis da B2B.
 */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAccess> => {
    const supabase = context.supabase;
    const userId = context.userId;

    const { data: memberships, error: mErr } = await supabase
      .from("organization_memberships")
      .select("organization_id, role, created_at, organizations(id, name, status, trial_ends_at)")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    const rows = (memberships ?? []) as Array<{
      organization_id: string;
      role: OrgRole;
      organizations: { id: string; name: string; status: string; trial_ends_at: string | null } | null;
    }>;

    // Papéis internos da B2B (tabela dedicada) + ponte com capacidades legadas.
    const [platformRes, legacyRes] = await Promise.all([
      supabase.from("platform_user_roles").select("role").eq("user_id", userId),
      supabase.from("user_capabilities").select("capability").eq("user_id", userId),
    ]);
    const platformRoles = new Set<PlatformRole>(
      ((platformRes.data ?? []) as Array<{ role: PlatformRole }>).map((r) => r.role),
    );
    for (const row of (legacyRes.data ?? []) as Array<{ capability: string }>) {
      if (row.capability === "super_admin") platformRoles.add("super_admin");
      if (row.capability === "platform_admin") platformRoles.add("platform_admin");
    }
    if (platformRoles.has("super_admin")) platformRoles.add("platform_admin");

    const active = rows[0] ?? null;
    if (!active) {
      return {
        user_id: userId,
        organization: null,
        role: null,
        role_label: null,
        permissions: [],
        platform_roles: Array.from(platformRoles),
        memberships: [],
      };
    }

    const [overridesRes, stateRes] = await Promise.all([
      supabase
        .from("organization_member_permissions")
        .select("permission, granted")
        .eq("organization_id", active.organization_id)
        .eq("user_id", userId),
      supabase.rpc("org_operational_state", { _organization_id: active.organization_id }),
    ]);

    const overrides = ((overridesRes.data ?? []) as Array<{
      permission: OrgPermission;
      granted: boolean;
    }>).map((o) => ({ permission: o.permission, granted: o.granted }));

    return {
      user_id: userId,
      organization: {
        id: active.organization_id,
        name: active.organizations?.name ?? "Organização",
        status: active.organizations?.status ?? "trial",
        operational_state: (stateRes.data as string) ?? "unknown",
        trial_ends_at: active.organizations?.trial_ends_at ?? null,
      },
      role: active.role,
      role_label: ORG_ROLE_LABELS[active.role] ?? active.role,
      permissions: effectivePermissions(active.role, overrides),
      platform_roles: Array.from(platformRoles),
      memberships: rows.map((r) => ({
        organization_id: r.organization_id,
        name: r.organizations?.name ?? "Organização",
        role: r.role,
      })),
    };
  });
