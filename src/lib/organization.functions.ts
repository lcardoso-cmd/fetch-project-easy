import { createServerFn } from "@tanstack/react-start";
import { requireOrg } from "@/lib/org-middleware";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/org-permissions";

export type OrgMember = {
  /** ID do usuário (auth.users.id) — usado como responsável de tarefas. */
  id: string;
  name: string;
  role: OrgRole;
  role_label: string;
};

/**
 * Integrantes da organização ativa. Fonte única de verdade da equipe:
 * memberships ativas + perfis. Não usa o modelo antigo por proprietário.
 */
export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .handler(async ({ context }): Promise<OrgMember[]> => {
    const { data: memberships, error } = await context.supabase
      .from("organization_memberships")
      .select("user_id, role")
      .eq("organization_id", context.organizationId)
      .eq("status", "active");
    if (error) throw error;
    const rows = memberships ?? [];
    if (rows.length === 0) return [];

    const ids = rows.map((m) => m.user_id);
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);

    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, p.full_name?.trim() || null] as const),
    );

    return rows
      .map((m) => {
        const role = m.role as OrgRole;
        return {
          id: m.user_id,
          name: nameById.get(m.user_id) ?? "Integrante sem nome",
          role,
          role_label: ORG_ROLE_LABELS[role] ?? role,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  });
