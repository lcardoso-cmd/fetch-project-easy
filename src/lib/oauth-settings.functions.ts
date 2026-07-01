import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });

export const getOAuthSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => Promise<{
          data: Array<{
            provider: string;
            client_id: string | null;
            client_secret_encrypted: string | null;
            updated_at: string;
          }> | null;
          error: { message: string } | null;
        }>;
      };
    })
      .from("app_oauth_settings")
      .select("provider, client_id, client_secret_encrypted, updated_at");
    if (error) throw new Error(error.message);

    const byProvider = (name: "google" | "outlook") => {
      const row = data?.find((r) => r.provider === name);
      return {
        client_id: row?.client_id ?? "",
        has_secret: Boolean(row?.client_secret_encrypted),
        updated_at: row?.updated_at ?? null,
        env_fallback:
          name === "google"
            ? Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
            : Boolean(
                process.env.MICROSOFT_OAUTH_CLIENT_ID &&
                  process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
              ),
      };
    };
    return { google: byProvider("google"), outlook: byProvider("outlook") };
  });

export const updateOAuthSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        provider: z.enum(["google", "outlook"]),
        client_id: z.string().trim().min(1).max(500),
        // empty string / undefined = keep current secret
        client_secret: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("@/lib/oauth-settings.server");

    const patch: Record<string, unknown> = {
      provider: data.provider,
      client_id: data.client_id,
      updated_at: new Date().toISOString(),
      updated_by: context.userId,
    };
    if (data.client_secret && data.client_secret.length > 0) {
      patch.client_secret_encrypted = encryptSecret(data.client_secret);
    }

    const { error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        upsert: (
          row: Record<string, unknown>,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      };
    })
      .from("app_oauth_settings")
      .upsert(patch, { onConflict: "provider" });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const clearOAuthSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ provider: z.enum(["google", "outlook"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (row: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    })
      .from("app_oauth_settings")
      .update({ client_secret_encrypted: null, updated_at: new Date().toISOString() })
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { success: true };
  });
