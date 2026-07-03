import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, ShieldAlert, ShieldCheck, Clock } from "lucide-react";

type ShareMeta = {
  title: string;
  client_name: string | null;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  requires_password: boolean;
  revoked: boolean;
  expired: boolean;
  exhausted: boolean;
};

export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: "Proposta compartilhada · JurisMind" },
      { name: "description", content: "Baixe a proposta comercial enviada pelo escritório." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SharedProposalPage,
});

function SharedProposalPage() {
  const { token } = Route.useParams();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/public/proposal-share/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return (await r.json()) as ShareMeta;
      })
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Não foi possível carregar o link.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const unavailable = useMemo(() => {
    if (!meta) return null;
    if (meta.revoked) return "Este link foi revogado pelo escritório.";
    if (meta.expired) return "Este link expirou.";
    if (meta.exhausted) return "O limite de downloads deste link foi atingido.";
    return null;
  }, [meta]);

  const expiresLabel = useMemo(() => {
    if (!meta?.expires_at) return null;
    try {
      return new Date(meta.expires_at).toLocaleString(undefined, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return meta.expires_at;
    }
  }, [meta]);

  async function download() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const r = await fetch(`/api/public/proposal-share/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() || undefined }),
      });
      if (!r.ok) {
        const msg = await r.text();
        throw new Error(msg || `Erro ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(meta?.title ?? "proposta").replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // Refresh metadata to reflect new download count / exhaustion.
      const rMeta = await fetch(`/api/public/proposal-share/${encodeURIComponent(token)}`);
      if (rMeta.ok) setMeta((await rMeta.json()) as ShareMeta);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Falha ao baixar a proposta.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="sr-only">Proposta comercial compartilhada</h1>
          <CardTitle className="font-heading flex items-center gap-2">

            <FileText className="h-5 w-5 text-primary" />
            Proposta comercial
          </CardTitle>
          <CardDescription>
            Este documento foi compartilhado com você pelo escritório.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando link…
            </div>
          )}

          {loadError && !loading && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <ShieldAlert className="h-4 w-4 mt-0.5" />
              <span>{loadError}</span>
            </div>
          )}

          {meta && (
            <>
              <div className="rounded border bg-background p-3 space-y-1">
                <p className="text-sm font-medium">{meta.title}</p>
                {meta.client_name && (
                  <p className="text-xs text-muted-foreground">Para: {meta.client_name}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
                  {expiresLabel && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Expira em {expiresLabel}
                    </span>
                  )}
                  {typeof meta.max_downloads === "number" && (
                    <span>
                      Downloads: {meta.download_count}/{meta.max_downloads}
                    </span>
                  )}
                  {meta.requires_password && (
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Protegido por senha
                    </span>
                  )}
                </div>
              </div>

              {unavailable ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <ShieldAlert className="h-4 w-4 mt-0.5" />
                  <span>{unavailable}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {meta.requires_password && (
                    <div className="space-y-1">
                      <Label htmlFor="share-password">Senha de acesso</Label>
                      <Input
                        id="share-password"
                        type="password"
                        autoComplete="off"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Informe a senha"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !downloading) void download();
                        }}
                      />
                    </div>
                  )}
                  {downloadError && (
                    <div
                      role="alert"
                      className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
                    >
                      {downloadError}
                    </div>
                  )}
                  <Button
                    className="w-full"
                    disabled={downloading || (meta.requires_password && !password.trim())}
                    onClick={() => void download()}
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparando PDF…
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" /> Baixar PDF
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          <p className="text-[11px] text-muted-foreground text-center pt-2">
            Link seguro emitido pelo JurisMind.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
