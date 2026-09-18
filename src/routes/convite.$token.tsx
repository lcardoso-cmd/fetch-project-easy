import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { peekOrgInvitation, acceptOrgInvitation, createInvitedUser } from "@/lib/org-team.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Convite para o escritório — JurisMind AI" },
      {
        name: "description",
        content:
          "Aceite seu convite para participar do escritório no JurisMind AI e colaborar nos casos.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Convite para o escritório — JurisMind AI" },
      {
        property: "og:description",
        content: "Aceite o convite e comece a colaborar nos casos do escritório.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, isLoading: loading } = useAuth();
  const peekFn = useServerFn(peekOrgInvitation);
  const acceptFn = useServerFn(acceptOrgInvitation);
  const createInvitedUserFn = useServerFn(createInvitedUser);

  const { data: inv, isLoading } = useQuery({
    queryKey: ["org-invitation", token],
    queryFn: () => peekFn({ data: { token } }),
  });

  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

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
      toast.success("Convite aceito! Bem-vindo(a) ao escritório.");
      navigate({ to: "/painel" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao aceitar o convite");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!inv || inv.status !== "pending") return;
    setBusy(true);
    try {
      const created = await createInvitedUserFn({ data: { token, full_name: fullName, password } });
      const { error } = await supabase.auth.signInWithPassword({
        email: created.email,
        password,
      });
      if (error) throw error;
      await acceptFn({ data: { token } });
      sessionStorage.removeItem("pending_invite_token");
      toast.success("Conta criada e convite aceito.");
      navigate({ to: "/painel", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar a conta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="sr-only">Convite para o escritório no JurisMind AI</h1>
          <CardTitle>Convite para o escritório</CardTitle>
          <CardDescription>
            Você foi convidado(a) a participar de uma organização no JurisMind.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !inv ? (
            <p className="text-ui text-destructive">Convite inválido.</p>
          ) : inv.status === "accepted" ? (
            <p className="text-ui">
              Este convite já foi aceito.{" "}
              <button onClick={() => navigate({ to: "/painel" })} className="underline">
                Ir ao painel
              </button>
              .
            </p>
          ) : inv.status === "revoked" ? (
            <p className="text-ui text-destructive">Este convite foi revogado.</p>
          ) : inv.status === "expired" ? (
            <p className="text-ui text-destructive">
              Este convite expirou. Peça um novo ao administrador do escritório.
            </p>
          ) : (
            <>
              <div className="rounded-md border bg-muted/30 p-3 text-ui">
                <p>
                  <span className="text-muted-foreground">Escritório:</span>{" "}
                  <span className="font-medium">{inv.organization_name}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Para o e-mail:</span>{" "}
                  <span className="font-medium">{inv.email}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Papel:</span>{" "}
                  <span className="font-medium">{inv.role_label}</span>
                </p>
              </div>

              {!user ? (
                <div className="space-y-4">
                  <p className="text-ui text-muted-foreground">
                    Crie sua conta autorizada com o e-mail <strong>{inv.email}</strong> ou entre se já possuir uma.
                  </p>
                  <form className="space-y-3" onSubmit={createAccount}>
                    <div className="space-y-2">
                      <Label htmlFor="invite-name">Nome completo</Label>
                      <Input id="invite-name" value={fullName} onChange={(e) => setFullName(e.target.value)} minLength={2} maxLength={160} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-password">Crie sua senha</Label>
                      <Input id="invite-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} required />
                    </div>
                    <Button className="w-full" type="submit" disabled={busy}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Criar conta e aceitar convite
                    </Button>
                  </form>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => navigate({ to: "/entrar", search: { redirect: `/convite/${token}` } })}
                  >
                    Já tenho conta
                  </Button>
                </div>
              ) : user.email?.toLowerCase() !== inv.email.toLowerCase() ? (
                <p className="text-ui text-destructive">
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
    </main>
  );
}
