import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { OrgPermission } from "@/lib/org-permissions";
import type { PlatformRole } from "@/lib/org-permissions";

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => any;
};

/**
 * Resolve a organização ativa do usuário autenticado.
 * O MVP usa a membership ativa mais antiga; o cliente NUNCA envia
 * `organization_id` — o servidor sempre resolve pelo `auth.uid()`.
 */
export async function resolveActiveOrganizationId(
  supabase: unknown,
  userId: string,
): Promise<string> {
  const client = supabase as RpcClient;
  const { data, error } = await client
    .from("organization_memberships")
    .select("organization_id, created_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("NO_ORGANIZATION");
  }
  return (data as { organization_id: string }).organization_id;
}

/**
 * Exige que o usuário autenticado pertença a uma organização ativa.
 * Injeta `organizationId` no contexto.
 */
export const requireOrg = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const organizationId = await resolveActiveOrganizationId(
      context.supabase,
      context.userId,
    );
    return next({ context: { organizationId } });
  });

/**
 * Exige uma permissão específica dentro da organização ativa.
 * A checagem é feita pela RPC `has_org_permission` com o cliente do
 * usuário autenticado — não confia em nada enviado pelo cliente.
 */
export function requireOrgPermission(permission: OrgPermission) {
  return createMiddleware({ type: "function" })
    .middleware([requireOrg])
    .server(async ({ next, context }) => {
      const client = context.supabase as unknown as RpcClient;
      const { data, error } = await client.rpc("has_org_permission", {
        _organization_id: context.organizationId,
        _user_id: context.userId,
        _permission: permission,
      });
      if (error) throw new Error(error.message);
      if (data !== true) {
        throw new Error(`Forbidden: permissão "${permission}" necessária`);
      }
      return next();
    });
}

/**
 * Exige que a organização ativa esteja apta a consumir IA
 * (trial vigente ou assinatura ativa; suspensa/cancelada bloqueia).
 */
export const requireAiEnabled = createMiddleware({ type: "function" })
  .middleware([requireOrgPermission("ai.use")])
  .server(async ({ next, context }) => {
    const client = context.supabase as unknown as RpcClient;
    const { data, error } = await client.rpc("org_can_use_ai", {
      _organization_id: context.organizationId,
    });
    if (error) throw new Error(error.message);
    if (data !== true) {
      throw new Error(
        "Período de avaliação encerrado ou organização suspensa. Regularize a assinatura para voltar a usar a IA.",
      );
    }
    return next();
  });

/** Exige um papel interno da B2B (super_admin sempre passa). */
export function requirePlatformRole(role: PlatformRole) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const client = context.supabase as unknown as RpcClient;
      const { data, error } = await client.rpc("has_platform_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (error) throw new Error(error.message);
      if (data !== true) {
        throw new Error(`Forbidden: papel da plataforma "${role}" necessário`);
      }
      return next();
    });
}
