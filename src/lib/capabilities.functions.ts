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
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  cases: "Casos e trabalho diário",
  expert_opinion: "Parecer técnico (peritos)",
  commercial: "Proposta comercial",
  marketing: "Marketing e publicações",
  office_admin: "Gestão do escritório",
  platform_admin: "Administração da plataforma (B2B)",
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
};

/**
 * Frase padrão "Requer a permissão «X»" usada em todo o app.
 */
export function formatRequiresPhrase(cap: Capability): string {
  return `Requer a permissão «${CAPABILITY_LABELS[cap]}».`;
}

/**
 * Retorna as capacidades do usuário autenticado.
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
    return (data ?? []).map((r) => r.capability);
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
    // Substitui o conjunto: apaga tudo (exceto platform_admin, que só a B2B controla) e insere o novo.
    const filtered = data.capabilities.filter((c) => c !== "platform_admin");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: () => {
          eq: (k: string, v: string) => {
            neq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
          };
        };
        insert: (rows: unknown[]) => Promise<{ error: { message: string } | null }>;
      };
    };
    const del = await client
      .from("user_capabilities")
      .delete()
      .eq("user_id", data.user_id)
      .neq("capability", "platform_admin");
    if (del.error) throw new Error(del.error.message);
    if (filtered.length > 0) {
      const ins = await client
        .from("user_capabilities")
        .insert(
          filtered.map((capability) => ({
            user_id: data.user_id,
            capability,
            granted_by: context.userId,
          })),
        );
      if (ins.error) throw new Error(ins.error.message);
    }
    return { ok: true };
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
