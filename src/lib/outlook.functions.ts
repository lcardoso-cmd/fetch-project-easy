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
    const { getProviderCredentials } = await import("@/lib/oauth-settings.server");
    const creds = await getProviderCredentials("outlook");
    if (!creds) throw new Error("Credenciais do Microsoft/Outlook não configuradas. Peça a um admin para preencher em Configurações → OAuth.");
    const clientId = creds.clientId;

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
      .select("outlook_email, scope, expires_at, created_at, updated_at, is_active, last_synced_at, sync_window_days, sync_end_date, selected_calendar_ids")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const setOutlookSelectedCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ calendar_ids: z.array(z.string()).nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("outlook_connections")
      .update({ selected_calendar_ids: data.calendar_ids })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

export const listOutlookCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const token = await getValidOutlookAccessToken(context.userId);
    if (!token) return { connected: false as const, calendars: [] };
    const res = await fetch(
      "https://graph.microsoft.com/v1.0/me/calendars?$top=200&$select=id,name,isDefaultCalendar,hexColor,owner",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error("outlook calendars failed", res.status, txt);
      return { connected: true as const, calendars: [], error: `Outlook: ${res.status}` };
    }
    const j = (await res.json()) as {
      value?: Array<{ id: string; name?: string; isDefaultCalendar?: boolean; hexColor?: string }>;
    };
    const calendars = (j.value ?? []).map((c) => ({
      id: c.id,
      summary: c.name ?? c.id,
      primary: Boolean(c.isDefaultCalendar),
      color: c.hexColor ?? null,
    }));
    return { connected: true as const, calendars };
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

export const setOutlookActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("outlook_connections")
      .update({ is_active: data.active })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });

export const setOutlookSyncWindow = createServerFn({ method: "POST" })
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
      .from("outlook_connections")
      .update({
        sync_window_days: data.sync_window_days,
        sync_end_date: data.sync_end_date,
      })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { success: true };
  });


async function getValidOutlookAccessToken(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: conn, error } = await supabaseAdmin
    .from("outlook_connections")
    .select("access_token, refresh_token, expires_at, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !conn || conn.is_active === false) return null;

  const expiresAt = new Date(conn.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return conn.access_token;

  const { getProviderCredentials } = await import("@/lib/oauth-settings.server");
  const creds = await getProviderCredentials("outlook");
  if (!creds) return null;
  const { clientId, clientSecret } = creds;

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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: connRow } = await supabaseAdmin
      .from("outlook_connections")
      .select("selected_calendar_ids")
      .eq("user_id", context.userId)
      .maybeSingle();
    const calendarIds: (string | null)[] =
      connRow?.selected_calendar_ids && connRow.selected_calendar_ids.length > 0
        ? connRow.selected_calendar_ids
        : [null]; // null means default calendar (/me/calendarView)

    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 3600 * 1000);
    const paramsBase = {
      startDateTime: data.timeMin ?? now.toISOString(),
      endDateTime: data.timeMax ?? in90.toISOString(),
      $orderby: "start/dateTime",
      $top: String(data.maxResults ?? 100),
      $select: "id,subject,bodyPreview,start,end,isAllDay,location,webLink",
    };

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
      const params = new URLSearchParams(paramsBase);
      const url = calId
        ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calId)}/calendarView?${params.toString()}`
        : `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("outlook calendar list failed", calId, res.status, txt);
        firstError ??= `Outlook Calendar (${calId ?? "default"}): ${res.status}`;
        continue;
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
      for (const e of j.value ?? []) {
        const raw = e.start?.dateTime ?? "";
        const iso = raw
          ? raw.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(raw)
            ? raw
            : `${raw}Z`
          : new Date().toISOString();
        all.push({
          id: `${calId ?? "default"}:${e.id}`,
          title: e.subject ?? "(sem título)",
          description: e.bodyPreview ?? null,
          starts_at: iso,
          all_day: Boolean(e.isAllDay),
          location: e.location?.displayName ?? null,
          html_link: e.webLink ?? null,
        });
      }
    }

    all.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    await supabaseAdmin
      .from("outlook_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return firstError
      ? { connected: true as const, events: all, error: firstError }
      : { connected: true as const, events: all };
  });
