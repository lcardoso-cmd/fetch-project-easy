import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Capability } from "@/lib/capabilities.functions";

/**
 * Middleware factory que exige uma capacidade específica no backend.
 *
 * Espelha o guard do frontend (`requiredCapabilityForPath`) para impedir
 * que serverFns sejam invocadas diretamente por quem burla a UI.
 *
 * Concede acesso implícito a `super_admin` (equivalente ao frontend).
 * A checagem usa a RPC `has_capability` (SECURITY DEFINER) via cliente do
 * usuário autenticado — se falhar, lança 403.
 */
export function requireCapability(cap: Capability) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ next, context }) => {
      const supabase = context.supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };

      // super_admin implica todas as demais capacidades.
      const superRes = await supabase.rpc("has_capability", {
        _user_id: context.userId,
        _capability: "super_admin",
      });
      if (superRes.error) throw new Error(superRes.error.message);
      if (superRes.data === true) return next();

      if (cap === "super_admin") {
        throw new Error(`Forbidden: capability "super_admin" required`);
      }

      const res = await supabase.rpc("has_capability", {
        _user_id: context.userId,
        _capability: cap,
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data !== true) {
        throw new Error(`Forbidden: capability "${cap}" required`);
      }
      return next();
    });
}
