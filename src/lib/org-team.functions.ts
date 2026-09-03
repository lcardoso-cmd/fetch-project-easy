import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgPermission } from "@/lib/org-middleware";
import {
  ORG_PERMISSIONS,
  ORG_ROLES,
  ORG_ROLE_LABELS,
  OWNER_ONLY_GRANTABLE,
  canAssignRole,
  effectivePermissions,
  type OrgPermission,
  type OrgRole,
} from "@/lib/org-permissions";

const RoleSchema = z.enum(ORG_ROLES);
const PermissionSchema = z.enum(ORG_PERMISSIONS);

type AdminClient = {
  from: (t: string) => any;
};

async function admin(): Promise<AdminClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AdminClient;
}

async function audit(
  organizationId: string,
  actorUserId: string,
  action: string,
  targetUserId: string | null,
  metadata: Record<string, unknown>,
) {
  const db = await admin();
  await db.from("organization_audit_log").insert({
    organization_id: organizationId,
    actor_user_id: actorUserId,
    action,
    target_user_id: targetUserId,
    metadata,
  });
}

/** Papel do usuário na organização ativa (null se não for membro ativo). */
async function roleOf(
  supabase: any,
  organizationId: string,
  userId: string,
): Promise<OrgRole | null> {
  const { data } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data?.role as OrgRole) ?? null;
}

export type OrgTeamMember = {
  user_id: string;
  name: string;
  role: OrgRole;
  role_label: string;
  permissions: OrgPermission[];
  overrides: Array<{ permission: OrgPermission; granted: boolean }>;
  is_me: boolean;
};

export type OrgTeamInvitation = {
  id: string;
  email: string;
  role: OrgRole;
  role_label: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export const listOrgTeam = createServerFn({ method: "GET" })
  .middleware([requireOrgPermission("members.view")])
  .handler(async ({ context }) => {
    const orgId = context.organizationId;
    const [membersRes, permsRes, invitesRes] = await Promise.all([
      context.supabase
        .from("organization_memberships")
        .select("user_id, role, created_at")
        .eq("organization_id", orgId)
        .eq("status", "active"),
      context.supabase
        .from("organization_member_permissions")
        .select("user_id, permission, granted")
        .eq("organization_id", orgId),
      context.supabase
        .from("organization_invitations")
        .select("id, email, role, status, expires_at, created_at")
        .eq("organization_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);

    const rows = (membersRes.data ?? []) as Array<{ user_id: string; role: OrgRole }>;
    const ids = rows.map((r) => r.user_id);
    const { data: profiles } = ids.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const nameById = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map(
        (p) => [p.id, p.full_name?.trim() || null] as const,
      ),
    );

    const overridesByUser = new Map<string, Array<{ permission: OrgPermission; granted: boolean }>>();
    for (const o of ((permsRes.data ?? []) as Array<{
      user_id: string;
      permission: OrgPermission;
      granted: boolean;
    }>)) {
      const list = overridesByUser.get(o.user_id) ?? [];
      list.push({ permission: o.permission, granted: o.granted });
      overridesByUser.set(o.user_id, list);
    }

    const members: OrgTeamMember[] = rows
      .map((r) => {
        const overrides = overridesByUser.get(r.user_id) ?? [];
        return {
          user_id: r.user_id,
          name: nameById.get(r.user_id) ?? "Integrante sem nome",
          role: r.role,
          role_label: ORG_ROLE_LABELS[r.role] ?? r.role,
          permissions: effectivePermissions(r.role, overrides),
          overrides,
          is_me: r.user_id === context.userId,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    const invitations: OrgTeamInvitation[] = ((invitesRes.data ?? []) as Array<{
      id: string;
      email: string;
      role: OrgRole;
      status: string;
      expires_at: string;
      created_at: string;
    }>).map((i) => ({ ...i, role_label: ORG_ROLE_LABELS[i.role] ?? i.role }));

    const myRole = await roleOf(context.supabase, orgId, context.userId);

    return {
      organization_id: orgId,
      my_role: myRole,
      assignable_roles: ORG_ROLES.filter((r) => canAssignRole(myRole, r)),
      members,
      invitations,
    };
  });

export const inviteOrgMember = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("members.invite")])
  .inputValidator((i: unknown) =>
    z.object({ email: z.string().trim().email().toLowerCase(), role: RoleSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId;
    const myRole = await roleOf(context.supabase, orgId, context.userId);
    if (!canAssignRole(myRole, data.role)) {
      throw new Error(
        `Seu papel não permite convidar alguém como «${ORG_ROLE_LABELS[data.role]}».`,
      );
    }

    const db = await admin();
    // Já é membro ativo? Convite é desnecessário.
    const { data: existingProfileMember } = await db
      .from("organization_invitations")
      .select("id, token, status")
      .eq("organization_id", orgId)
      .eq("email", data.email)
      .eq("status", "pending")
      .maybeSingle();

    if (existingProfileMember) {
      // Idempotente: atualiza papel/validade e reaproveita o mesmo token.
      await db
        .from("organization_invitations")
        .update({
          role: data.role,
          expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
          invited_by_user_id: context.userId,
        })
        .eq("id", existingProfileMember.id);
      await audit(orgId, context.userId, "invitation.resent", null, {
        email: data.email,
        role: data.role,
      });
      return { token: existingProfileMember.token as string, reused: true };
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await db.from("organization_invitations").insert({
      organization_id: orgId,
      email: data.email,
      role: data.role,
      token,
      invited_by_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    await audit(orgId, context.userId, "invitation.created", null, {
      email: data.email,
      role: data.role,
    });
    return { token, reused: false };
  });

export const revokeOrgInvitation = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("members.invite")])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: inv } = await db
      .from("organization_invitations")
      .select("id, email, organization_id")
      .eq("id", data.id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (!inv) throw new Error("Convite não encontrado nesta organização.");
    await db
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("organization_id", context.organizationId);
    await audit(context.organizationId, context.userId, "invitation.revoked", null, {
      email: inv.email,
    });
    return { ok: true };
  });

export const updateOrgMemberRole = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("members.manage")])
  .inputValidator((i: unknown) =>
    z.object({ user_id: z.string().uuid(), role: RoleSchema }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId;
    if (data.user_id === context.userId) {
      throw new Error("Você não pode alterar o seu próprio papel.");
    }
    const myRole = await roleOf(context.supabase, orgId, context.userId);
    const targetRole = await roleOf(context.supabase, orgId, data.user_id);
    if (!targetRole) throw new Error("Integrante não encontrado nesta organização.");
    if (!canAssignRole(myRole, data.role) || !canAssignRole(myRole, targetRole)) {
      throw new Error("Seu papel não permite alterar este integrante.");
    }

    const { error } = await context.supabase
      .from("organization_memberships")
      .update({ role: data.role })
      .eq("organization_id", orgId)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    await audit(orgId, context.userId, "member.role_changed", data.user_id, {
      from: targetRole,
      to: data.role,
    });
    return { ok: true };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("members.manage")])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId;
    if (data.user_id === context.userId) {
      throw new Error("Você não pode remover o seu próprio acesso.");
    }
    const myRole = await roleOf(context.supabase, orgId, context.userId);
    const targetRole = await roleOf(context.supabase, orgId, data.user_id);
    if (!targetRole) throw new Error("Integrante não encontrado nesta organização.");
    if (!canAssignRole(myRole, targetRole)) {
      throw new Error("Seu papel não permite remover este integrante.");
    }

    // O gatilho do banco impede a remoção do último titular.
    const { error } = await context.supabase
      .from("organization_memberships")
      .update({ status: "revoked" })
      .eq("organization_id", orgId)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    await audit(orgId, context.userId, "member.revoked", data.user_id, { role: targetRole });
    return { ok: true };
  });

export const setOrgMemberPermission = createServerFn({ method: "POST" })
  .middleware([requireOrgPermission("permissions.manage")])
  .inputValidator((i: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        permission: PermissionSchema,
        /** true concede, false revoga, null volta ao padrão do papel. */
        granted: z.boolean().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const orgId = context.organizationId;
    if (data.user_id === context.userId) {
      throw new Error("Você não pode alterar as suas próprias permissões.");
    }
    const myRole = await roleOf(context.supabase, orgId, context.userId);
    if (
      OWNER_ONLY_GRANTABLE.includes(data.permission) &&
      myRole !== "owner"
    ) {
      throw new Error("Somente o titular pode conceder permissões de cobrança e contratação.");
    }
    const targetRole = await roleOf(context.supabase, orgId, data.user_id);
    if (!targetRole) throw new Error("Integrante não encontrado nesta organização.");
    if (targetRole === "owner" && myRole !== "owner") {
      throw new Error("Somente o titular pode alterar permissões de outro titular.");
    }

    const db = await admin();
    if (data.granted === null) {
      await db
        .from("organization_member_permissions")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", data.user_id)
        .eq("permission", data.permission);
    } else {
      await db
        .from("organization_member_permissions")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", data.user_id)
        .eq("permission", data.permission);
      const { error } = await db.from("organization_member_permissions").insert({
        organization_id: orgId,
        user_id: data.user_id,
        permission: data.permission,
        granted: data.granted,
        granted_by_user_id: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    await audit(orgId, context.userId, "permission.changed", data.user_id, {
      permission: data.permission,
      granted: data.granted,
    });
    return { ok: true };
  });

/** Consulta pública mínima de um convite (a página de convite é pública). */
export const peekOrgInvitation = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(i))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: inv } = await db
      .from("organization_invitations")
      .select("email, role, status, expires_at, organization_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return null;
    const { data: org } = await db
      .from("organizations")
      .select("name")
      .eq("id", inv.organization_id)
      .maybeSingle();
    const expired = new Date(inv.expires_at as string).getTime() < Date.now();
    return {
      email: inv.email as string,
      role: inv.role as OrgRole,
      role_label: ORG_ROLE_LABELS[inv.role as OrgRole],
      status: expired && inv.status === "pending" ? "expired" : (inv.status as string),
      organization_name: (org?.name as string) ?? "Organização",
    };
  });

export const acceptOrgInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: inv } = await db
      .from("organization_invitations")
      .select("id, organization_id, email, role, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) throw new Error("Convite inválido.");
    if (inv.status === "revoked") throw new Error("Este convite foi revogado.");
    if (new Date(inv.expires_at as string).getTime() < Date.now() && inv.status === "pending") {
      throw new Error("Este convite expirou. Peça um novo ao administrador.");
    }

    const email = (context.claims as { email?: string } | undefined)?.email?.toLowerCase() ?? null;
    if (email && email !== (inv.email as string).toLowerCase()) {
      throw new Error(
        `Este convite é para ${inv.email}. Entre com esse e-mail para aceitá-lo.`,
      );
    }

    // Idempotente: se já é membro, apenas confirma.
    const { data: existing } = await db
      .from("organization_memberships")
      .select("id, status")
      .eq("organization_id", inv.organization_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing) {
      if (existing.status !== "active") {
        await db
          .from("organization_memberships")
          .update({ status: "active", role: inv.role })
          .eq("id", existing.id);
      }
    } else {
      const { error } = await db.from("organization_memberships").insert({
        organization_id: inv.organization_id,
        user_id: context.userId,
        role: inv.role,
        status: "active",
      });
      if (error) throw new Error(error.message);
    }

    if (inv.status !== "accepted") {
      await db
        .from("organization_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          accepted_by_user_id: context.userId,
        })
        .eq("id", inv.id);
    }

    await audit(inv.organization_id, context.userId, "invitation.accepted", context.userId, {
      email: inv.email,
      role: inv.role,
    });
    return { organization_id: inv.organization_id as string };
  });
