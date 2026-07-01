import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID não configurado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");

    const { error } = await supabaseAdmin.from("google_oauth_states").insert({
      state,
      user_id: context.userId,
    });
    if (error) throw error;

    const redirectUri = `${data.origin}/api/public/google/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      scope: GOOGLE_SCOPES,
      state,
    });

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  });

export const getGoogleConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("google_connections")
      .select("google_email, scope, expires_at, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("google_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn, error } = await supabaseAdmin
    .from("google_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !conn) return null;

  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return conn.access_token;

  // Refresh
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { access_token: string; expires_in: number };
  await supabaseAdmin
    .from("google_connections")
    .update({
      access_token: j.access_token,
      expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);
  return j.access_token;
}

export const listGoogleCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        maxResults: z.number().int().min(1).max(250).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const token = await getValidGoogleAccessToken(context.userId);
    if (!token) return { connected: false as const, events: [] };

    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    const params = new URLSearchParams({
      timeMin: data.timeMin ?? now.toISOString(),
      timeMax: data.timeMax ?? in90.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(data.maxResults ?? 100),
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error("google calendar list failed", res.status, txt);
      return { connected: true as const, events: [], error: `Google Calendar: ${res.status}` };
    }
    const j = (await res.json()) as {
      items?: Array<{
        id: string;
        summary?: string;
        description?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
        htmlLink?: string;
        location?: string;
      }>;
    };
    const events = (j.items ?? []).map((e) => ({
      id: e.id,
      title: e.summary ?? "(sem título)",
      description: e.description ?? null,
      starts_at:
        (e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : null)) as string,
      all_day: Boolean(e.start?.date && !e.start?.dateTime),
      location: e.location ?? null,
      html_link: e.htmlLink ?? null,
    }));
    return { connected: true as const, events };
  });
