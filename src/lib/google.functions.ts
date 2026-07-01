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
    const { getProviderCredentials } = await import("@/lib/oauth-settings.server");
    const creds = await getProviderCredentials("google");
    if (!creds) throw new Error("Credenciais do Google não configuradas. Peça a um admin para preencher em Configurações → OAuth.");
    const clientId = creds.clientId;

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
      .select("google_email, scope, expires_at, created_at, updated_at, is_active, last_synced_at, sync_window_days, sync_end_date, selected_calendar_ids")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const setGoogleSelectedCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ calendar_ids: z.array(z.string()).nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("google_connections")
      .update({ selected_calendar_ids: data.calendar_ids })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

export const listGoogleCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = await getValidGoogleAccessToken(context.userId);
    if (!token) return { connected: false as const, calendars: [] };
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error("google calendarList failed", res.status, txt);
      return { connected: true as const, calendars: [], error: `Google: ${res.status}` };
    }
    const j = (await res.json()) as {
      items?: Array<{ id: string; summary?: string; primary?: boolean; backgroundColor?: string; accessRole?: string }>;
    };
    const calendars = (j.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary ?? c.id,
      primary: Boolean(c.primary),
      color: c.backgroundColor ?? null,
    }));
    return { connected: true as const, calendars };
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

export const setGoogleActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("google_connections")
      .update({ is_active: data.active })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

export const setGoogleSyncWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        sync_window_days: z.number().int().min(1).max(3650),
        sync_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("google_connections")
      .update({
        sync_window_days: data.sync_window_days,
        sync_end_date: data.sync_end_date,
      })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });


async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn, error } = await supabaseAdmin
    .from("google_connections")
    .select("access_token, refresh_token, expires_at, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !conn || conn.is_active === false) return null;

  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return conn.access_token;

  // Refresh
  const { getProviderCredentials } = await import("@/lib/oauth-settings.server");
  const creds = await getProviderCredentials("google");
  if (!creds) return null;
  const { clientId, clientSecret } = creds;

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: connRow } = await supabaseAdmin
      .from("google_connections")
      .select("selected_calendar_ids")
      .eq("user_id", context.userId)
      .maybeSingle();
    const calendarIds =
      connRow?.selected_calendar_ids && connRow.selected_calendar_ids.length > 0
        ? connRow.selected_calendar_ids
        : ["primary"];

    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    const maxResults = String(data.maxResults ?? 100);
    const timeMin = data.timeMin ?? now.toISOString();
    const timeMax = data.timeMax ?? in90.toISOString();

    const all: Array<{
      id: string;
      title: string;
      description: string | null;
      starts_at: string;
      all_day: boolean;
      location: string | null;
      html_link: string | null;
    }> = [];
    let firstError: string | undefined;

    for (const calId of calendarIds) {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults,
      });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const txt = await res.text();
        console.error("google calendar list failed", calId, res.status, txt);
        firstError ??= `Google Calendar (${calId}): ${res.status}`;
        continue;
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
      for (const e of j.items ?? []) {
        all.push({
          id: `${calId}:${e.id}`,
          title: e.summary ?? "(sem título)",
          description: e.description ?? null,
          starts_at:
            (e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : null)) as string,
          all_day: Boolean(e.start?.date && !e.start?.dateTime),
          location: e.location ?? null,
          html_link: e.htmlLink ?? null,
        });
      }
    }

    all.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    await supabaseAdmin
      .from("google_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return firstError
      ? { connected: true as const, events: all, error: firstError }
      : { connected: true as const, events: all };
  });
