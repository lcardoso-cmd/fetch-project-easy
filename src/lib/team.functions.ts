import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AccessRole = z.enum(["viewer", "editor", "admin"]);

export const listTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("team_members")
      .select("*")
      .eq("user_id", context.userId)
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

// Workspaces this user can see: own + ones they've joined
export const listMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Memberships where I am the joined account
    const { data: memberships, error } = await context.supabase
      .from("team_members")
      .select("id, user_id, name, access_role")
      .eq("member_user_id", context.userId);
    if (error) throw error;
    return memberships ?? [];
  });

export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().trim().email().toLowerCase(),
        role: z.string().max(80).optional().nullable(),
        access_role: AccessRole.default("editor"),
        color: z.string().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Create or reuse a team_member row for this email under this owner
    let { data: member } = await context.supabase
      .from("team_members")
      .select("*")
      .eq("user_id", context.userId)
      .eq("email", data.email)
      .maybeSingle();

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

    // If the email already belongs to a registered auth user, link immediately and skip invite token
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existingUser } = await supabaseAdmin.rpc("get_user_id_by_email", {
      _email: data.email,
    }).maybeSingle?.() ?? { data: null };

    // Fallback: directly query auth.users via admin (RPC may not exist)
    let linkedUserId: string | null = null;
    if (existingUser && typeof existingUser === "object" && "id" in existingUser) {
      linkedUserId = (existingUser as { id: string }).id;
    } else {
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = list.data?.users.find((u) => u.email?.toLowerCase() === data.email);
      if (match) linkedUserId = match.id;
    }

    if (linkedUserId && member && !member.member_user_id) {
      await context.supabase
        .from("team_members")
        .update({ member_user_id: linkedUserId })
        .eq("id", member.id);
    }

    // Create invitation record (with token) regardless — link to share
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
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

    // Confirm email matches signed-in user
    const userEmail = (context.claims?.email as string | undefined)?.toLowerCase?.();
    if (!userEmail || userEmail !== inv.email.toLowerCase()) {
      throw new Error("Este convite é para outro e-mail. Faça login com o e-mail certo.");
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
