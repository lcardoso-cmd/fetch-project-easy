import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Retorna o contexto necessário para o modal "Solicitar acesso por e-mail":
 * - `me`: nome e e-mail do usuário atual (para citar quem está pedindo).
 * - `admins`: administradores do(s) escritório(s) ao(s) qual(is) o usuário
 *   pertence — os "donos" de team_members onde ele é membro. Se o próprio
 *   usuário for o dono, retornamos apenas ele. Emails vêm da Auth API.
 */
export const getAccessRequestContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as {
      from: (t: string) => any;
      auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string | null } | null }; error: unknown }> } };
    };

    // Nome do usuário atual
    const meProfile = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const meAuth = await admin.auth.admin.getUserById(context.userId);
    const me = {
      id: context.userId,
      name: (meProfile.data?.full_name as string | null) ?? null,
      email: meAuth.data.user?.email ?? null,
    };

    // Donos dos workspaces em que sou membro
    const memberships = await admin
      .from("team_members")
      .select("user_id, name, email")
      .eq("member_user_id", context.userId);

    const ownerIds = Array.from(
      new Set(((memberships.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
    );

    const admins: Array<{ id: string; name: string | null; email: string | null }> = [];
    for (const ownerId of ownerIds) {
      const [prof, auth] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", ownerId).maybeSingle(),
        admin.auth.admin.getUserById(ownerId),
      ]);
      admins.push({
        id: ownerId,
        name: (prof.data?.full_name as string | null) ?? null,
        email: auth.data.user?.email ?? null,
      });
    }

    // Fallback: sem membership → o próprio usuário é o dono; sugere ele mesmo
    // (útil quando o gestor abre uma rota que ele mesmo não tem capability).
    if (admins.length === 0) {
      admins.push({ id: me.id, name: me.name, email: me.email });
    }

    return { me, admins: admins.filter((a) => a.email) };
  });
