import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { peekInvitation, acceptInvitation } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/convite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, isLoading: loading } = useAuth();
  const peekFn = useServerFn(peekInvitation);
  const acceptFn = useServerFn(acceptInvitation);

  const { data: inv, isLoading } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => peekFn({ data: { token } }),
  });

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pending_invite_token", token);
    }
  }, [token]);

  async function accept() {
    setBusy(true);
    try {
      await acceptFn({ data: { token } });
      sessionStorage.removeItem("pending_invite_token");
      toast.success("Convite aceito! Bem-vindo à equipe.");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao aceitar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Convite para equipe</CardTitle>
          <CardDescription>
            Você foi convidado a colaborar em casos no Lovable Juris.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !inv ? (
            <p className="text-sm text-destructive">Convite inválido ou expirado.</p>
          ) : inv.status === "accepted" ? (
            <p className="text-sm">
              Este convite já foi aceito.{" "}
              <button onClick={() => navigate({ to: "/dashboard" })} className="underline">
                Ir ao painel
              </button>
              .
            </p>
          ) : inv.status === "revoked" ? (
            <p className="text-sm text-destructive">Este convite foi revogado.</p>
          ) : (
            <>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Convidado por:</span>{" "}
                  <span className="font-medium">{inv.owner_name ?? "—"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Para o e-mail:</span>{" "}
                  <span className="font-medium">{inv.email}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Como:</span>{" "}
                  <span className="font-medium">{inv.member_name ?? "—"}</span>
                </p>
              </div>

              {!user ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Faça login (ou crie sua conta) com o e-mail <strong>{inv.email}</strong> para
                    aceitar.
                  </p>
                  <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>
                    Entrar / criar conta
                  </Button>
                </div>
              ) : user.email?.toLowerCase() !== inv.email.toLowerCase() ? (
                <p className="text-sm text-destructive">
                  Você está logado como <strong>{user.email}</strong>. Saia e entre com{" "}
                  <strong>{inv.email}</strong> para aceitar este convite.
                </p>
              ) : (
                <Button className="w-full" onClick={accept} disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Aceitar convite
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
