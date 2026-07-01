import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Microsoft identity platform (v2) — multi-tenant + personal accounts.
// Scopes: openid/profile/email + offline_access (refresh token) + Calendars.Read.
const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Calendars.Read",
  "https://graph.microsoft.com/User.Read",
].join(" ");

const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export const getOutlookAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("MICROSOFT_OAUTH_CLIENT_ID não configurado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const state = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabaseAdmin.from("outlook_oauth_states").insert({
      state,
      user_id: context.userId,
    });
    if (error) throw error;

    const redirectUri = `${data.origin}/api/public/outlook/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: OUTLOOK_SCOPES,
      state,
      prompt: "select_account",
    });

    return { url: `${AUTH_URL}?${params.toString()}` };
  });

export const getOutlookConnection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("outlook_connections")
      .select("outlook_email, scope, expires_at, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const disconnectOutlook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("outlook_connections")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

async function getValidOutlookAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn, error } = await supabaseAdmin
    .from("outlook_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !conn) return null;

  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return conn.access_token;

  const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
      scope: OUTLOOK_SCOPES,
    }),
  });
  if (!res.ok) {
    console.error("outlook token refresh failed", res.status, await res.text());
    return null;
  }
  const j = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
  await supabaseAdmin
    .from("outlook_connections")
    .update({
      access_token: j.access_token,
      refresh_token: j.refresh_token ?? conn.refresh_token,
      expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
    })
    .eq("user_id", userId);
  return j.access_token;
}

export const listOutlookCalendarEvents = createServerFn({ method: "GET" })
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
    const token = await getValidOutlookAccessToken(context.userId);
    if (!token) return { connected: false as const, events: [] };

    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    // calendarView expands recurring events between the window.
    const params = new URLSearchParams({
      startDateTime: data.timeMin ?? now.toISOString(),
      endDateTime: data.timeMax ?? in90.toISOString(),
      $orderby: "start/dateTime",
      $top: String(data.maxResults ?? 100),
      $select: "id,subject,bodyPreview,start,end,isAllDay,location,webLink",
    });

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error("outlook calendar list failed", res.status, txt);
      return { connected: true as const, events: [], error: `Outlook Calendar: ${res.status}` };
    }
    const j = (await res.json()) as {
      value?: Array<{
        id: string;
        subject?: string;
        bodyPreview?: string;
        start?: { dateTime?: string; timeZone?: string };
        end?: { dateTime?: string };
        isAllDay?: boolean;
        webLink?: string;
        location?: { displayName?: string };
      }>;
    };
    const events = (j.value ?? []).map((e) => {
      // Microsoft returns dateTime without a trailing Z when Prefer outlook.timezone="UTC" —
      // it's still UTC, so normalize to an ISO with Z.
      const raw = e.start?.dateTime ?? "";
      const iso = raw
        ? raw.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(raw)
          ? raw
          : `${raw}Z`
        : new Date().toISOString();
      return {
        id: e.id,
        title: e.subject ?? "(sem título)",
        description: e.bodyPreview ?? null,
        starts_at: iso,
        all_day: Boolean(e.isAllDay),
        location: e.location?.displayName ?? null,
        html_link: e.webLink ?? null,
      };
    });
    return { connected: true as const, events };
  });
