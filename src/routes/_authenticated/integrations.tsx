import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Puzzle, HardDrive, CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { getGoogleAuthUrl, getGoogleConnection, disconnectGoogle } from "@/lib/google.functions";
import {
  getOutlookAuthUrl,
  getOutlookConnection,
  disconnectOutlook,
} from "@/lib/outlook.functions";
import { z } from "zod";

const searchSchema = z.object({
  google: z.enum(["success", "error"]).optional(),
  outlook: z.enum(["success", "error"]).optional(),
  msg: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/integrations")({
  validateSearch: searchSchema,
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const search = useSearch({ from: "/_authenticated/integrations" });
  const qc = useQueryClient();
  const getConn = useServerFn(getGoogleConnection);
  const getUrl = useServerFn(getGoogleAuthUrl);
  const disconnect = useServerFn(disconnectGoogle);

  const { data: connection, isLoading } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => getConn(),
  });

  const connectMut = useMutation({
    mutationFn: async () => getUrl({ data: { origin: window.location.origin } }),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao iniciar conexão"),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Google desconectado");
      qc.invalidateQueries({ queryKey: ["google-connection"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao desconectar"),
  });

  useEffect(() => {
    if (search.google === "success") toast.success("Google conectado com sucesso!");
    if (search.google === "error") toast.error(`Erro ao conectar Google: ${search.msg ?? ""}`);
    if (search.google) {
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      window.history.replaceState({}, "", "/integrations");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.google]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Integrações</h1>
        <p className="mt-1 text-muted-foreground">
          Conecte serviços externos ao seu JurisMind.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <HardDrive className="h-5 w-5" /> Google Drive & Calendar
              {connection && (
                <Badge variant="secondary" className="ml-auto gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Acesse seus arquivos do Drive e gerencie eventos do Calendar diretamente no JurisMind.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : connection ? (
              <>
                <div className="text-sm">
                  <span className="text-muted-foreground">Conta: </span>
                  <span className="font-medium">{connection.google_email ?? "—"}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                >
                  {disconnectMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Desconectar
                </Button>
              </>
            ) : (
              <Button
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending}
              >
                {connectMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Conectar Google
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Puzzle className="h-5 w-5" /> Outras integrações
            </CardTitle>
            <CardDescription>
              Gamma.app, monitoramento processual e mais — em breve.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  );
}
