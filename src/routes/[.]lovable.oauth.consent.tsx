import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";

// Typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthClient = { name?: string | null; redirect_uris?: string[] | null } | null | undefined;
type OAuthDetails = {
  client?: OAuthClient;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
} | null;
type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthDetails; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{
    data: { redirect_url?: string | null; redirect_to?: string | null } | null;
    error: { message: string } | null;
  }>;
};
export function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: Supabase reads its session from localStorage.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) {
      throw redirect({ to: "/entrar", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentScreen,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold text-foreground">Não foi possível carregar a autorização</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </p>
    </main>
  ),
});

function ConsentScreen() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "Cliente externo";
  const scope = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const res = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-6">
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <JurisMindMark size={40} context={JURISMIND_CONTEXT.auth} rounded />
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              Conectar {clientName} ao JurisMind
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O aplicativo poderá usar o JurisMind agindo em seu nome.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Aplicativo</div>
            <div className="font-medium text-foreground">{clientName}</div>
          </div>
          {scope.length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground">Permissões solicitadas</div>
              <ul className="mt-1 list-disc pl-5 text-foreground">
                {scope.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Suas políticas de acesso (RLS) continuam valendo — o aplicativo só verá o que você já
            pode ver no JurisMind.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>
            Negar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Processando..." : "Aprovar"}
          </Button>
        </div>
      </div>
    </main>
  );
}
