import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        const errorUri = url.searchParams.get("error_uri");

        const origin = url.origin;
        const redirectBack = (status: "success" | "error", msg?: string, detail?: string) => {
          const target = new URL("/agenda", origin);
          target.searchParams.set("google", status);
          if (msg) target.searchParams.set("msg", msg);
          if (detail) target.searchParams.set("detail", detail);
          return Response.redirect(target.toString(), 302);
        };

        if (errorParam) return redirectBack("error", errorParam, errorDescription ?? errorUri ?? undefined);
        if (!code || !state) return redirectBack("error", "missing_code_or_state");

        const { getProviderCredentials } = await import("@/lib/oauth-settings.server");
        const creds = await getProviderCredentials("google");
        if (!creds) return redirectBack("error", "server_misconfigured");
        const { clientId, clientSecret } = creds;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Validate state
        const { data: stateRow, error: stateErr } = await supabaseAdmin
          .from("google_oauth_states")
          .select("user_id, expires_at")
          .eq("state", state)
          .maybeSingle();
        if (stateErr || !stateRow) return redirectBack("error", "invalid_state");
        if (new Date(stateRow.expires_at).getTime() < Date.now())
          return redirectBack("error", "state_expired");

        // Single-use
        await supabaseAdmin.from("google_oauth_states").delete().eq("state", state);

        const redirectUri = `${origin}/api/public/google/callback`;
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) {
          const txt = await tokenRes.text();
          console.error("Google token exchange failed", txt);
          return redirectBack("error", "token_exchange_failed");
        }
        const tokens = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope?: string;
          id_token?: string;
        };

        // Fetch userinfo email
        let googleEmail: string | null = null;
        try {
          const uiRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (uiRes.ok) {
            const ui = (await uiRes.json()) as { email?: string };
            googleEmail = ui.email ?? null;
          }
        } catch (e) {
          console.warn("userinfo fetch failed", e);
        }

        if (!tokens.refresh_token) {
          // Without refresh token we can't keep the connection alive
          return redirectBack("error", "no_refresh_token");
        }

        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        const { data: membership } = await supabaseAdmin
          .from("organization_memberships")
          .select("organization_id")
          .eq("user_id", stateRow.user_id)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!membership) return redirectBack("error", "no_organization");
        const connectionOrgId = membership.organization_id;

        const { error: upsertErr } = await supabaseAdmin
          .from("google_connections")
          .upsert(
            {
              user_id: stateRow.user_id,
              organization_id: connectionOrgId,
              google_email: googleEmail,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: expiresAt,
              scope: tokens.scope ?? null,
            },
            { onConflict: "user_id" },
          );
        if (upsertErr) {
          console.error("upsert google_connections failed", upsertErr);
          return redirectBack("error", "save_failed");
        }

        return redirectBack("success");
      },
    },
  },
});
