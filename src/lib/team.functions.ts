import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AccessRole = z.enum(["viewer", "editor", "admin"]);

const MemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  role: z.string().trim().max(120).optional().or(z.literal("")),
  color: z.string().trim().max(20).optional().or(z.literal("")),
  access_role: AccessRole.optional(),
});

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("team_members")
      .select("*")
      .eq("user_id", context.userId)
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => MemberSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("team_members")
      .insert({
        user_id: context.userId,
        name: data.name,
        email: data.email || null,
        role: data.role || null,
        color: data.color || null,
        access_role: data.access_role ?? "editor",
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const updateTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).merge(MemberSchema.partial()).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...updates } = data;
    const { data: row, error } = await context.supabase
      .from("team_members")
      .update({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.email !== undefined ? { email: updates.email || null } : {}),
        ...(updates.role !== undefined ? { role: updates.role || null } : {}),
        ...(updates.color !== undefined ? { color: updates.color || null } : {}),
        ...(updates.access_role !== undefined ? { access_role: updates.access_role } : {}),
      })
      .eq("id", id)
      .eq("user_id", context.userId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_members")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// Workspaces (owners) where I am an accepted member
export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("team_members")
      .select("id, user_id, name, access_role")
      .eq("member_user_id", context.userId);
    if (error) throw error;
    return data ?? [];
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().toLowerCase(),
        role: z.string().max(120).optional().nullable(),
        access_role: AccessRole.default("editor"),
        color: z.string().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const existing = await context.supabase
      .from("team_members")
      .select("*")
      .eq("user_id", context.userId)
      .eq("email", data.email)
      .maybeSingle();

    let member = existing.data;
    if (!member) {
      const ins = await context.supabase
        .from("team_members")
        .insert({
          user_id: context.userId,
          name: data.name,
          email: data.email,
          role: data.role ?? null,
          access_role: data.access_role,
          color: data.color ?? null,
        })
        .select("*")
        .single();
      if (ins.error) throw ins.error;
      member = ins.data;
    } else {
      await context.supabase
        .from("team_members")
        .update({ name: data.name, access_role: data.access_role, role: data.role ?? null })
        .eq("id", member.id);
    }

    // Link immediately if the email already has an account
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let linkedUserId: string | null = null;
    try {
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = list.data?.users.find((u) => u.email?.toLowerCase() === data.email);
      if (match) linkedUserId = match.id;
    } catch {
      // ignore — fall back to invite token
    }

    if (linkedUserId && member && !member.member_user_id) {
      await context.supabase
        .from("team_members")
        .update({ member_user_id: linkedUserId })
        .eq("id", member.id);
    }

    const token =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const inv = await context.supabase
      .from("team_invitations")
      .insert({
        owner_user_id: context.userId,
        team_member_id: member!.id,
        email: data.email,
        token,
        status: linkedUserId ? "accepted" : "pending",
        accepted_at: linkedUserId ? new Date().toISOString() : null,
        accepted_by: linkedUserId,
      })
      .select("*")
      .single();
    if (inv.error) throw inv.error;

    return {
      member,
      invitation: inv.data,
      alreadyRegistered: Boolean(linkedUserId),
    };
  });

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("team_invitations")
      .select("*")
      .eq("owner_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("team_invitations")
      .update({ status: "revoked" })
      .eq("id", data.id)
      .eq("owner_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("team_invitations")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!inv) throw new Error("Convite não encontrado");
    if (inv.status === "revoked") throw new Error("Convite revogado");
    if (inv.status === "expired" || new Date(inv.expires_at) < new Date()) {
      throw new Error("Convite expirado");
    }

    const userEmail = (
      (context.claims as Record<string, unknown> | undefined)?.email as string | undefined
    )?.toLowerCase?.();
    if (!userEmail || userEmail !== inv.email.toLowerCase()) {
      throw new Error("Este convite é para outro e-mail. Faça login com o e-mail correto.");
    }

    await supabaseAdmin
      .from("team_members")
      .update({ member_user_id: context.userId })
      .eq("id", inv.team_member_id);

    await supabaseAdmin
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by: context.userId,
      })
      .eq("id", inv.id);

    return { ok: true, owner_user_id: inv.owner_user_id };
  });

export const peekInvitation = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("team_invitations")
      .select("id, email, status, expires_at, owner_user_id, team_member_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return null;
    const { data: tm } = await supabaseAdmin
      .from("team_members")
      .select("name")
      .eq("id", inv.team_member_id)
      .maybeSingle();
    const { data: owner } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", inv.owner_user_id)
      .maybeSingle();
    return { ...inv, member_name: tm?.name ?? null, owner_name: owner?.full_name ?? null };
  });
