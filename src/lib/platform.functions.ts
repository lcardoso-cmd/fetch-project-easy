import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CAPABILITIES, type Capability } from "@/lib/capabilities.functions";

type Admin = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

async function assertPlatformStaff(userId: string): Promise<Admin> {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc("is_platform_staff", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito à equipe da plataforma B2B");
  return admin;
}

async function assertSuperAdmin(userId: string): Promise<Admin> {
  const admin = await getAdmin();
  const { data, error } = await admin.rpc("is_super_admin", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito ao super administrador");
  return admin;
}

async function writeAudit(
  admin: Admin,
  actor: string,
  action: string,
  targetUserId: string | null,
  targetCustomerId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await admin.from("platform_audit_log").insert({
    actor_user_id: actor,
    action,
    target_user_id: targetUserId,
    target_customer_id: targetCustomerId,
    metadata,
  });
}

// ─── KPIs ─────────────────────────────────────────────────────────

export const getPlatformKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertPlatformStaff(context.userId);
    const now = new Date();
    const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [total, newLast30, byStatus, mrrRow, activeUsersRows] = await Promise.all([
      admin.from("customer_accounts").select("id", { count: "exact", head: true }),
      admin
        .from("customer_accounts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", cutoff30),
      admin.from("customer_accounts").select("status, plan"),
      admin.from("customer_accounts").select("mrr_cents"),
      admin
        .from("ai_chat_messages")
        .select("user_id")
        .gte("created_at", cutoff30),
    ]);

    const statuses: Record<string, number> = {};
    const plans: Record<string, number> = {};
    for (const row of (byStatus.data ?? []) as Array<{ status: string; plan: string }>) {
      statuses[row.status] = (statuses[row.status] ?? 0) + 1;
      plans[row.plan] = (plans[row.plan] ?? 0) + 1;
    }
    const mrrCents = ((mrrRow.data ?? []) as Array<{ mrr_cents: number }>).reduce(
      (s, r) => s + (r.mrr_cents ?? 0),
      0,
    );
    const activeUsers = new Set(
      ((activeUsersRows.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
    ).size;

    return {
      customers: total.count ?? 0,
      newLast30: newLast30.count ?? 0,
      activeUsersLast30: activeUsers,
      mrrCents,
      statuses,
      plans,
    };
  });

// ─── Customers ───────────────────────────────────────────────────

const listCustomersInput = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  plan: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const listCustomerAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(listCustomersInput)
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    let q = admin
      .from("customer_accounts")
      .select("id, owner_user_id, name, status, plan, billing_email, mrr_cents, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.status) q = q.eq("status", data.status);
    if (data.plan) q = q.eq("plan", data.plan);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`name.ilike.${s},billing_email.ilike.${s}`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    const ownerIds = (rows ?? []).map((r: any) => r.owner_user_id);
    const profiles = ownerIds.length
      ? (
          await admin
            .from("profiles")
            .select("id, full_name, firm_name")
            .in("id", ownerIds)
        ).data ?? []
      : [];
    const pMap = new Map((profiles as any[]).map((p) => [p.id, p]));
    return {
      total: count ?? 0,
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        owner_full_name: pMap.get(r.owner_user_id)?.full_name ?? null,
        owner_firm_name: pMap.get(r.owner_user_id)?.firm_name ?? null,
      })),
    };
  });

export const getCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    const { data: account, error } = await admin
      .from("customer_accounts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!account) throw new Error("Cliente não encontrado");

    const [profileRes, membersRes, capsRes] = await Promise.all([
      admin.from("profiles").select("*").eq("id", account.owner_user_id).maybeSingle(),
      admin
        .from("team_members")
        .select("id, name, email, role, access_role, member_user_id, created_at")
        .eq("user_id", account.owner_user_id),
      admin
        .from("user_capabilities")
        .select("user_id, capability")
        .eq("user_id", account.owner_user_id),
    ]);
    return {
      account,
      profile: profileRes.data ?? null,
      members: membersRes.data ?? [],
      ownerCapabilities: (capsRes.data ?? []).map((r: any) => r.capability as Capability),
    };
  });

export const updateCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["trial", "active", "suspended", "canceled"]).optional(),
      plan: z.enum(["free", "pro", "enterprise"]).optional(),
      billing_email: z.string().email().nullable().optional(),
      mrr_cents: z.number().int().min(0).optional(),
      notes: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    const { id, ...patch } = data;
    const { error } = await admin.from("customer_accounts").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await writeAudit(admin, context.userId, "customer.update", null, id, patch);
    return { ok: true };
  });

// ─── Platform users ──────────────────────────────────────────────

export const listPlatformUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      search: z.string().optional(),
      capability: z.enum(CAPABILITIES).optional(),
      limit: z.number().int().min(1).max(200).default(100),
      offset: z.number().int().min(0).default(0),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    let q = admin
      .from("profiles")
      .select("id, full_name, firm_name, practice_type, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`full_name.ilike.${s},firm_name.ilike.${s}`);
    }
    const { data: profiles, count, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (profiles ?? []).map((p: any) => p.id);
    const caps = ids.length
      ? (await admin.from("user_capabilities").select("user_id, capability").in("user_id", ids))
          .data ?? []
      : [];
    const map = new Map<string, Capability[]>();
    for (const row of caps as Array<{ user_id: string; capability: Capability }>) {
      const arr = map.get(row.user_id) ?? [];
      arr.push(row.capability);
      map.set(row.user_id, arr);
    }
    let rows = (profiles ?? []).map((p: any) => ({
      ...p,
      capabilities: map.get(p.id) ?? [],
    }));
    if (data.capability) {
      rows = rows.filter((r: any) => r.capabilities.includes(data.capability));
    }
    return { total: count ?? 0, rows };
  });

export const grantCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      user_id: z.string().uuid(),
      capability: z.enum(CAPABILITIES),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    // Só super_admin pode conceder super_admin / platform_admin
    if (data.capability === "super_admin" || data.capability === "platform_admin") {
      await assertSuperAdmin(context.userId);
    }
    const { error } = await admin
      .from("user_capabilities")
      .upsert(
        { user_id: data.user_id, capability: data.capability, granted_by: context.userId },
        { onConflict: "user_id,capability" },
      );
    if (error) throw new Error(error.message);
    await writeAudit(admin, context.userId, "capability.grant", data.user_id, null, {
      capability: data.capability,
    });
    return { ok: true };
  });

export const revokeCapability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      user_id: z.string().uuid(),
      capability: z.enum(CAPABILITIES),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    if (data.capability === "super_admin" || data.capability === "platform_admin") {
      await assertSuperAdmin(context.userId);
    }
    // Evita o super_admin remover a si mesmo por engano
    if (
      data.user_id === context.userId &&
      (data.capability === "super_admin" || data.capability === "platform_admin")
    ) {
      throw new Error("Você não pode remover sua própria permissão de administrador.");
    }
    const { error } = await admin
      .from("user_capabilities")
      .delete()
      .eq("user_id", data.user_id)
      .eq("capability", data.capability);
    if (error) throw new Error(error.message);
    await writeAudit(admin, context.userId, "capability.revoke", data.user_id, null, {
      capability: data.capability,
    });
    return { ok: true };
  });

// ─── Audit log ───────────────────────────────────────────────────

export const listPlatformAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ limit: z.number().int().min(1).max(200).default(100) }))
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    const { data: rows, error } = await admin
      .from("platform_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
