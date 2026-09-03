import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/org-permissions";

export type MyOrganization = {
  id: string;
  name: string;
  status: string;
  trial_ends_at: string;
  role: OrgRole;
  role_label: string;
  is_active: boolean;
};

/**
 * Organizações do usuário autenticado (memberships ativas).
 * A organização ativa é a membership mais antiga — mesma regra do servidor.
 */
export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyOrganization[]> => {
    const { data, error } = await context.supabase
      .from("organization_memberships")
      .select("organization_id, role, created_at")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return [];

    const { data: orgs, error: orgErr } = await context.supabase
      .from("organizations")
      .select("id, name, status, trial_ends_at")
      .in(
        "id",
        rows.map((r) => r.organization_id),
      );
    if (orgErr) throw orgErr;
    const byId = new Map((orgs ?? []).map((o) => [o.id, o] as const));

    return rows.flatMap((r, index) => {
      const org = byId.get(r.organization_id);
      if (!org) return [];
      const role = r.role as OrgRole;
      return [
        {
          id: org.id,
          name: org.name,
          status: org.status,
          trial_ends_at: org.trial_ends_at,
          role,
          role_label: ORG_ROLE_LABELS[role] ?? role,
          is_active: index === 0,
        },
      ];
    });
  });

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do escritório.").max(160),
  legal_name: z.string().trim().max(200).optional(),
  tax_id: z.string().trim().max(32).optional(),
});

/**
 * Cria a organização do usuário e o vincula como owner, iniciando o trial
 * de 30 dias (default do banco). Idempotente por usuário sem organização:
 * se já existir membership ativa, retorna a organização atual.
 */
export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ organization_id: string; created: boolean }> => {
    const { data: existing, error: existingErr } = await context.supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) {
      return { organization_id: existing.organization_id, created: false };
    }

    const { data: org, error: orgErr } = await context.supabase
      .from("organizations")
      .insert({
        name: data.name,
        legal_name: data.legal_name?.trim() || null,
        tax_id: data.tax_id?.replace(/\D+/g, "") || null,
        created_by_user_id: context.userId,
      })
      .select("id")
      .single();
    if (orgErr) throw orgErr;

    const { error: memberErr } = await context.supabase
      .from("organization_memberships")
      .insert({
        organization_id: org.id,
        user_id: context.userId,
        role: "owner",
        status: "active",
      });
    if (memberErr) {
      // Sem membership a organização fica órfã e inacessível: remove.
      await context.supabase.from("organizations").delete().eq("id", org.id);
      throw memberErr;
    }

    await context.supabase.from("organization_audit_log").insert({
      organization_id: org.id,
      actor_user_id: context.userId,
      action: "organization.created",
      metadata: { name: data.name },
    });

    return { organization_id: org.id, created: true };
  });
