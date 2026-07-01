import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type OAuthProvider = "google" | "outlook";

function getKey(): Buffer {
  const raw = process.env.OAUTH_SETTINGS_ENC_KEY;
  if (!raw) throw new Error("OAUTH_SETTINGS_ENC_KEY não configurado");
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Formato inválido");
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const enc = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/**
 * Reads OAuth credentials for a provider from the DB (admin-managed table),
 * falling back to legacy env vars if the DB row is missing or incomplete.
 */
export async function getProviderCredentials(
  provider: OAuthProvider,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { client_id: string | null; client_secret_encrypted: string | null } | null;
          }>;
        };
      };
    };
  })
    .from("app_oauth_settings")
    .select("client_id, client_secret_encrypted")
    .eq("provider", provider)
    .maybeSingle();

  let clientId = data?.client_id ?? null;
  let clientSecret: string | null = null;
  if (data?.client_secret_encrypted) {
    try {
      clientSecret = decryptSecret(data.client_secret_encrypted);
    } catch (e) {
      console.error(`decrypt ${provider} secret failed`, e);
    }
  }

  const envIdName = provider === "google" ? "GOOGLE_OAUTH_CLIENT_ID" : "MICROSOFT_OAUTH_CLIENT_ID";
  const envSecretName =
    provider === "google" ? "GOOGLE_OAUTH_CLIENT_SECRET" : "MICROSOFT_OAUTH_CLIENT_SECRET";

  if (!clientId) clientId = process.env[envIdName] ?? null;
  if (!clientSecret) clientSecret = process.env[envSecretName] ?? null;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
