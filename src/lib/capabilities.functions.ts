import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CAPABILITIES = [
  "cases",
  "expert_opinion",
  "commercial",
  "marketing",
  "office_admin",
  "platform_admin",
  "super_admin",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  cases: "Casos e trabalho diário",
  expert_opinion: "Parecer técnico (peritos)",
  commercial: "Proposta comercial",
  marketing: "Marketing e publicações",
  office_admin: "Gestão do escritório",
  platform_admin: "Administração da plataforma (B2B)",
  super_admin: "Super administrador da B2B",
};

/**
 * Explicação curta ("por quê") de cada permissão — usada em tooltips,
 * legendas de menus ocultos e telas de gestão de equipe. Fonte única
 * da verdade: qualquer motivo mostrado ao usuário sobre permissões
 * deve vir daqui.
 */
export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  cases:
    "Acesso aos casos, clientes e documentos vinculados do escritório.",
  expert_opinion:
    "Elaboração de pareceres técnicos — reservado a peritos.",
  commercial:
    "Criação e versionamento de propostas comerciais.",
  marketing:
    "Materiais de marketing e monitoramento de publicações.",
  office_admin:
    "Gestão do escritório: equipe, integrações, cobrança e configurações.",
  platform_admin:
    "Administração B2B da JurisMind — restrita à equipe interna.",
  super_admin:
    "Controle total do SaaS — só para o time B2B da JurisMind.",
};

/**
 * Frase padrão "Requer a permissão «X»" usada em todo o app.
 */
export function formatRequiresPhrase(cap: Capability): string {
  return `Requer a permissão «${CAPABILITY_LABELS[cap]}».`;
}

/**
 * Retorna as capacidades do usuário autenticado.
 * super_admin implicitamente concede todas as demais.
 */
export const getMyCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Capability[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: string,
          ) => Promise<{
            data: Array<{ capability: Capability }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    })
      .from("user_capabilities")
      .select("capability")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const caps = new Set<Capability>((data ?? []).map((r) => r.capability));
    // super_admin implica todas as outras
    if (caps.has("super_admin")) {
      for (const c of CAPABILITIES) caps.add(c);
    }
    return Array.from(caps);
  });

/**
 * Lista capacidades de um membro do escritório (para o gestor conceder/revogar).
 */
export const listMemberCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ user_id: z.string().uuid() }))
  .handler(async ({ context, data }): Promise<Capability[]> => {
    await assertOfficeAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: string,
          ) => Promise<{
            data: Array<{ capability: Capability }> | null;
            error: { message: string } | null;
          }>;
        };
      };
    })
      .from("user_capabilities")
      .select("capability")
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => r.capability);
  });

export const setMemberCapabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      user_id: z.string().uuid(),
      capabilities: z.array(z.enum(CAPABILITIES)),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertOfficeAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Substitui o conjunto do escritório: office_admin nunca revoga permissões da B2B.
    const OFFICE_SCOPED = [
      "cases",
      "expert_opinion",
      "commercial",
      "marketing",
      "office_admin",
    ] as const;
    const filtered = data.capabilities.filter(
      (c) => c !== "platform_admin" && c !== "super_admin",
    );

    const admin = supabaseAdmin as unknown as {
      from: (t: string) => any;
    };

    // 1) Snapshot dos valores atuais para calcular o diff (auditoria).
    const beforeRes = await admin
      .from("user_capabilities")
      .select("capability")
      .eq("user_id", data.user_id)
      .in("capability", OFFICE_SCOPED as unknown as string[]);
    if (beforeRes.error) throw new Error(beforeRes.error.message);
    const before = new Set<Capability>(
      ((beforeRes.data ?? []) as Array<{ capability: Capability }>).map((r) => r.capability),
    );
    const after = new Set<Capability>(filtered);
    const added = [...after].filter((c) => !before.has(c));
    const removed = [...before].filter((c) => !after.has(c));

    // 2) Aplica a substituição.
    const del = await admin
      .from("user_capabilities")
      .delete()
      .eq("user_id", data.user_id)
      .in("capability", OFFICE_SCOPED as unknown as string[]);
    if (del.error) throw new Error(del.error.message);
    if (filtered.length > 0) {
      const ins = await admin.from("user_capabilities").insert(
        filtered.map((capability) => ({
          user_id: data.user_id,
          capability,
          granted_by: context.userId,
        })),
      );
      if (ins.error) throw new Error(ins.error.message);
    }

    // 3) Registra auditoria (uma linha por capacidade concedida/revogada).
    const auditRows = [
      ...added.map((capability) => ({
        actor_user_id: context.userId,
        action: "capability.grant" as const,
        target_user_id: data.user_id,
        metadata: { capability, scope: "office" },
      })),
      ...removed.map((capability) => ({
        actor_user_id: context.userId,
        action: "capability.revoke" as const,
        target_user_id: data.user_id,
        metadata: { capability, scope: "office" },
      })),
    ];
    if (auditRows.length > 0) {
      // Best-effort: falhas de auditoria não devem reverter a alteração já aplicada.
      const auditRes = await admin.from("platform_audit_log").insert(auditRows);
      if (auditRes.error) {
        console.error("[capabilities] falha ao registrar auditoria", auditRes.error.message);
      }
    }

    return { ok: true, granted: added, revoked: removed };
  });

/**
 * Histórico de concessões/revogações de capacidades de um membro do escritório.
 * Somente office_admin do próprio escritório (ou platform staff) pode consultar.
 */
export const listMemberCapabilityAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      user_id: z.string().uuid(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertOfficeAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data: rows, error } = await admin
      .from("platform_audit_log")
      .select("id, created_at, actor_user_id, action, target_user_id, metadata")
      .eq("target_user_id", data.user_id)
      .in("action", ["capability.grant", "capability.revoke"])
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      created_at: string;
      actor_user_id: string;
      action: "capability.grant" | "capability.revoke";
      target_user_id: string;
      metadata: { capability?: Capability; scope?: string } | null;
    }>;
  });

async function assertOfficeAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          eq: (
            k: string,
            v: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { capability: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  })
    .from("user_capabilities")
    .select("capability")
    .eq("user_id", userId)
    .eq("capability", "office_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores do escritório");
}
