import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Loader2, ShieldAlert, Eye, EyeOff, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  getOAuthSettings,
  updateOAuthSettings,
  clearOAuthSecret,
  isCurrentUserAdmin,
} from "@/lib/oauth-settings.functions";

export const Route = createFileRoute("/_authenticated/settings/oauth")({
  component: OAuthSettingsPage,
});

type Provider = "google" | "outlook";

const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google (Calendar / Drive)",
  outlook: "Microsoft / Outlook (Calendar)",
};

const PROVIDER_HELP: Record<Provider, { console: string; scopes: string }> = {
  google: {
    console: "https://console.cloud.google.com/apis/credentials",
    scopes: "Habilite Google Calendar API + Google Drive API e adicione o Client ID/Secret do tipo OAuth Web application.",
  },
  outlook: {
    console: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    scopes: "Registre um app Multi-tenant no Entra ID com permissões delegadas Calendars.Read e User.Read.",
  },
};

function OAuthSettingsPage() {
  const qc = useQueryClient();
  const adminFn = useServerFn(isCurrentUserAdmin);
  const listFn = useServerFn(getOAuthSettings);
  const saveFn = useServerFn(updateOAuthSettings);
  const clearFn = useServerFn(clearOAuthSecret);

  const { data: adminInfo, isLoading: adminLoading } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => adminFn(),
  });

  const isAdmin = adminInfo?.isAdmin ?? false;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["oauth-settings"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar a Configurações
        </Link>
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Esta tela é restrita a administradores.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar a Configurações
        </Link>
        <h1 className="mt-2 text-3xl font-bold font-heading tracking-tight">Credenciais OAuth</h1>
        <p className="mt-1 text-muted-foreground">
          Client ID e Client Secret dos provedores OAuth. As credenciais são criptografadas
          (AES-256-GCM) antes de serem armazenadas e ficam acessíveis apenas ao servidor.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        (["google", "outlook"] as Provider[]).map((p) => (
          <ProviderCard
            key={p}
            provider={p}
            current={settings?.[p]}
            onSave={async (input) => {
              await saveFn({ data: { provider: p, ...input } });
              toast.success(`Credenciais do ${p === "google" ? "Google" : "Outlook"} salvas`);
              qc.invalidateQueries({ queryKey: ["oauth-settings"] });
            }}
            onClearSecret={async () => {
              await clearFn({ data: { provider: p } });
              toast.success("Segredo removido");
              qc.invalidateQueries({ queryKey: ["oauth-settings"] });
            }}
          />
        ))
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  current,
  onSave,
  onClearSecret,
}: {
  provider: Provider;
  current: {
    client_id: string;
    has_secret: boolean;
    updated_at: string | null;
    env_fallback: boolean;
  } | undefined;
  onSave: (i: { client_id: string; client_secret?: string }) => Promise<void>;
  onClearSecret: () => Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    setClientId(current?.client_id ?? "");
    setClientSecret("");
  }, [current?.client_id, current?.updated_at]);

  const saveMut = useMutation({
    mutationFn: () =>
      onSave({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim() || undefined,
      }),
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  const clearMut = useMutation({
    mutationFn: () => onClearSecret(),
    onError: (e: Error) => toast.error(e.message || "Falha ao remover segredo"),
  });

  const help = PROVIDER_HELP[provider];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> {PROVIDER_LABELS[provider]}
        </CardTitle>
        <CardDescription>
          {help.scopes}{" "}
          <a
            href={help.console}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Abrir console
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current?.env_fallback && !current?.has_secret && (
          <Alert>
            <AlertDescription className="text-xs">
              Usando credenciais legadas do ambiente. Ao salvar aqui, elas substituem
              o fallback.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1">
          <Label htmlFor={`${provider}-client-id`}>Client ID</Label>
          <Input
            id={`${provider}-client-id`}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={provider === "google" ? "xxx.apps.googleusercontent.com" : "00000000-0000-0000-0000-000000000000"}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${provider}-client-secret`}>Client Secret</Label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {current?.has_secret ? (
                <span className="text-emerald-600 dark:text-emerald-400">✓ segredo salvo</span>
              ) : (
                <span>nenhum segredo salvo</span>
              )}
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showSecret ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>
          <Input
            id={`${provider}-client-secret`}
            type={showSecret ? "text" : "password"}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={current?.has_secret ? "•••••••• (deixe em branco para manter)" : "Cole o Client Secret"}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            O valor é criptografado no servidor antes de gravar. Nunca é enviado de volta ao navegador.
          </p>
        </div>

        {current?.updated_at && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date(current.updated_at).toLocaleString("pt-BR")}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          {current?.has_secret ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Remover o Client Secret salvo?")) clearMut.mutate();
              }}
              disabled={clearMut.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Remover segredo
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !clientId.trim()}
          >
            {saveMut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
