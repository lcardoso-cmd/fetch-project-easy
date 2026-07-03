import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconBox } from "@/components/ui/icon-box";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — JurisMind AI" },
      { name: "description", content: "Redefina sua senha da conta JurisMind AI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supabase entrega o token de recovery no fragmento (#access_token=...&type=recovery)
  // e o client já o processa automaticamente. Confirmamos que uma sessão de recovery existe.
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const isRecovery = hash.includes("type=recovery");
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (isRecovery || data.session) {
        setReady(true);
      } else {
        setError("Link inválido ou expirado. Solicite um novo email de redefinição.");
        setReady(true);
      }
    };
    check();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada", { description: "Você já pode entrar com a nova senha." });
      await supabase.auth.signOut();
      navigate({ to: "/entrar", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao atualizar senha";
      setError(message);
      toast.error("Não foi possível atualizar", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <header className="w-full px-4 pt-4 sm:absolute sm:left-4 sm:top-4 sm:z-10 sm:w-auto sm:p-0">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/entrar">
            <IconBox icon={ArrowLeft} size="xs" bgColor="bg-muted" iconColor="text-foreground" />
            Voltar para entrar
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <JurisMindMark size={48} context={JURISMIND_CONTEXT.auth} rounded className="mb-4" />
            <h1 className="text-3xl font-bold text-foreground">Redefinir senha</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Escolha uma nova senha para acessar sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="flex items-center gap-2 text-sm font-medium">
                <IconBox icon={Lock} size="xs" />
                Nova senha
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!ready || isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="flex items-center gap-2 text-sm font-medium">
                <IconBox icon={ShieldCheck} size="xs" />
                Confirmar senha
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                disabled={!ready || isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="w-full" disabled={!ready || isLoading}>
              {isLoading ? "Atualizando..." : "Atualizar senha"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
