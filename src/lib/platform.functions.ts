import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CAPABILITIES, type Capability } from "@/lib/capabilities.functions";

type Admin = {
  from: (t: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  auth: {
    admin: {
      listUsers: (params: { page: number; perPage: number }) => Promise<{
        data: { users: Array<{ id: string; email?: string | null; last_sign_in_at?: string | null }> } | null;
        error: { message: string } | null;
      }>;
    };
  };
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

    // Organização ativa (papel + nome) por usuário — dados reais de membership.
    const memberships = ids.length
      ? (
          await admin
            .from("organization_memberships")
            .select("user_id, role, status, organizations(name)")
            .in("user_id", ids)
            .eq("status", "active")
        ).data ?? []
      : [];
    const orgMap = new Map<string, { org_name: string | null; role: string | null }>();
    for (const m of memberships as any[]) {
      if (!orgMap.has(m.user_id)) {
        orgMap.set(m.user_id, { org_name: m.organizations?.name ?? null, role: m.role ?? null });
      }
    }

    // E-mail e último acesso vêm do provedor de autenticação.
    const authMap = new Map<string, { email: string | null; last_sign_in_at: string | null }>();
    try {
      const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of authList?.users ?? []) {
        authMap.set(u.id, {
          email: u.email ?? null,
          last_sign_in_at: (u as any).last_sign_in_at ?? null,
        });
      }
    } catch {
      // Sem acesso à listagem de auth: as colunas exibem "—" na interface.
    }

    let rows = (profiles ?? []).map((p: any) => ({
      ...p,
      capabilities: map.get(p.id) ?? [],
      organization_name: orgMap.get(p.id)?.org_name ?? null,
      organization_role: orgMap.get(p.id)?.role ?? null,
      email: authMap.get(p.id)?.email ?? null,
      last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
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

// ─── Capability presets (bulk apply + overview) ──────────────────

/**
 * Presets = "visões" do produto. Cada visão mapeia para um conjunto de
 * capabilities coerente. `b2b` requer super_admin para aplicar.
 */
export const CAPABILITY_PRESETS = {
  b2b: {
    label: "JurisMind B2B (staff)",
    description: "Equipe interna da plataforma: acesso ao painel B2B.",
    capabilities: ["platform_admin"] as Capability[],
    requiresSuperAdmin: true,
  },
  office_admin: {
    label: "Admin de escritório",
    description: "Sócio/gestor: casos, comercial, marketing e gestão do escritório.",
    capabilities: ["cases", "commercial", "marketing", "office_admin"] as Capability[],
    requiresSuperAdmin: false,
  },
  perito: {
    label: "Perito",
    description: "Perito técnico: casos e elaboração de pareceres.",
    capabilities: ["cases", "expert_opinion"] as Capability[],
    requiresSuperAdmin: false,
  },
} as const;

export type PresetKey = keyof typeof CAPABILITY_PRESETS;

export const getCapabilitiesOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertPlatformStaff(context.userId);
    const [{ data: capsData, error: capsErr }, { count: totalUsers, error: usersErr }] =
      await Promise.all([
        admin.from("user_capabilities").select("user_id, capability"),
        admin.from("profiles").select("id", { count: "exact", head: true }),
      ]);
    if (capsErr) throw new Error(capsErr.message);
    if (usersErr) throw new Error(usersErr.message);

    const rows = (capsData ?? []) as Array<{ user_id: string; capability: Capability }>;
    const byUser = new Map<string, Set<Capability>>();
    const perCap: Record<string, number> = {};
    for (const r of rows) {
      perCap[r.capability] = (perCap[r.capability] ?? 0) + 1;
      let set = byUser.get(r.user_id);
      if (!set) {
        set = new Set();
        byUser.set(r.user_id, set);
      }
      set.add(r.capability);
    }

    const presets = (Object.keys(CAPABILITY_PRESETS) as PresetKey[]).map((key) => {
      const preset = CAPABILITY_PRESETS[key];
      let matching = 0;
      let partial = 0;
      for (const set of byUser.values()) {
        const hits = preset.capabilities.filter((c) => set.has(c)).length;
        if (hits === preset.capabilities.length) matching += 1;
        else if (hits > 0) partial += 1;
      }
      return {
        key,
        label: preset.label,
        description: preset.description,
        capabilities: preset.capabilities,
        requiresSuperAdmin: preset.requiresSuperAdmin,
        matchingUsers: matching,
        partialUsers: partial,
      };
    });

    return {
      totalUsers: totalUsers ?? 0,
      usersWithAnyCapability: byUser.size,
      perCapability: perCap as Record<Capability, number>,
      presets,
    };
  });

export const applyCapabilityPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      preset: z.enum(["b2b", "office_admin", "perito"]),
      user_ids: z.array(z.string().uuid()).min(1).max(200),
      mode: z.enum(["add", "replace"]).default("add"),
    }),
  )
  .handler(async ({ context, data }) => {
    const admin = await assertPlatformStaff(context.userId);
    const preset = CAPABILITY_PRESETS[data.preset];
    if (preset.requiresSuperAdmin) await assertSuperAdmin(context.userId);

    // Nunca mexer em super_admin nem tocar em platform_admin fora do preset b2b.
    const SAFE_MANAGED: Capability[] = [
      "cases",
      "expert_opinion",
      "commercial",
      "marketing",
      "office_admin",
    ];
    const managed = data.preset === "b2b" ? [...SAFE_MANAGED, "platform_admin"] : SAFE_MANAGED;
    const targetCaps = preset.capabilities.filter((c) => c !== "super_admin");

    let grantedCount = 0;
    let revokedCount = 0;

    for (const uid of data.user_ids) {
      // snapshot atual (apenas caps gerenciadas por este preset)
      const cur = await admin
        .from("user_capabilities")
        .select("capability")
        .eq("user_id", uid)
        .in("capability", managed);
      if (cur.error) throw new Error(cur.error.message);
      const currentSet = new Set<Capability>(
        ((cur.data ?? []) as Array<{ capability: Capability }>).map((r) => r.capability),
      );
      const targetSet = new Set<Capability>(targetCaps);

      const toGrant =
        data.mode === "replace"
          ? [...targetSet].filter((c) => !currentSet.has(c))
          : [...targetSet].filter((c) => !currentSet.has(c));
      const toRevoke =
        data.mode === "replace"
          ? [...currentSet].filter((c) => !targetSet.has(c))
          : [];

      if (toGrant.length > 0) {
        const ins = await admin.from("user_capabilities").upsert(
          toGrant.map((capability) => ({
            user_id: uid,
            capability,
            granted_by: context.userId,
          })),
          { onConflict: "user_id,capability" },
        );
        if (ins.error) throw new Error(ins.error.message);
        grantedCount += toGrant.length;
      }
      if (toRevoke.length > 0) {
        // Segurança extra: não permita o admin se auto-remover platform/super
        const safeRevoke = toRevoke.filter(
          (c) =>
            !(
              uid === context.userId && (c === "platform_admin" || c === "super_admin")
            ),
        );
        if (safeRevoke.length > 0) {
          const del = await admin
            .from("user_capabilities")
            .delete()
            .eq("user_id", uid)
            .in("capability", safeRevoke);
          if (del.error) throw new Error(del.error.message);
          revokedCount += safeRevoke.length;
        }
      }

      const auditRows = [
        ...toGrant.map((capability) => ({
          actor_user_id: context.userId,
          action: "capability.grant" as const,
          target_user_id: uid,
          metadata: { capability, scope: "preset", preset: data.preset },
        })),
        ...toRevoke.map((capability) => ({
          actor_user_id: context.userId,
          action: "capability.revoke" as const,
          target_user_id: uid,
          metadata: { capability, scope: "preset", preset: data.preset },
        })),
      ];
      if (auditRows.length > 0) {
        const auditRes = await admin.from("platform_audit_log").insert(auditRows);
        if (auditRes.error) {
          console.error("[preset] falha ao registrar auditoria", auditRes.error.message);
        }
      }
    }

    return {
      ok: true,
      preset: data.preset,
      users: data.user_ids.length,
      granted: grantedCount,
      revoked: revokedCount,
    };
  });

