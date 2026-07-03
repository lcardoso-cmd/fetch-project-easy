import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { IconBox } from "@/components/ui/icon-box";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail, Lock, User, LogIn, UserPlus, MailCheck, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

const OAUTH_REDIRECT_KEY = "jm:auth:redirect";

function safeInternalPath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  // Only allow same-origin internal paths (no protocol, no protocol-relative).
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  if (p.startsWith("/entrar") || p.startsWith("/auth")) return null;
  return p;
}

export const Route = createFileRoute("/entrar")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeInternalPath(search.redirect) ?? undefined,
  }),
  component: AuthPage,
});


/**
 * Rótulo padronizado com IconBox pequeno + fundo primário. Mantém o mesmo
 * arredondamento (squircle) usado no restante do app.
 */
function FieldLabel({
  htmlFor,
  icon,
  children,
}: {
  htmlFor: string;
  icon: React.ComponentProps<typeof IconBox>["icon"];
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="flex items-center gap-2 text-sm font-medium">
      <IconBox icon={icon} size="xs" />
      {children}
    </Label>
  );
}

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email enviado", {
        description: `Se houver conta para ${forgotEmail}, você receberá o link em instantes.`,
      });
      setForgotOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar email";
      toast.error("Não foi possível enviar", { description: message });
    } finally {
      setIsSendingReset(false);
    }
  };

  const resendStorageKey = (email: string) => `jm.resendCooldown:${email.toLowerCase()}`;

  // Restaura cooldown persistido ao trocar de e-mail pendente (ou no mount).
  useEffect(() => {
    if (!pendingEmail || typeof window === "undefined") {
      setResendCooldown(0);
      return;
    }
    const raw = window.localStorage.getItem(resendStorageKey(pendingEmail));
    const until = raw ? Number(raw) : 0;
    const remaining = until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0;
    setResendCooldown(remaining);
    if (!remaining && raw) window.localStorage.removeItem(resendStorageKey(pendingEmail));
  }, [pendingEmail]);

  // Timer para o cooldown do botão de reenviar confirmação.
  useEffect(() => {
    if (resendCooldown <= 0) {
      if (pendingEmail && typeof window !== "undefined") {
        window.localStorage.removeItem(resendStorageKey(pendingEmail));
      }
      return;
    }
    const t = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown, pendingEmail]);


  const isUnconfirmedError = (msg: string) => {
    const m = msg.toLowerCase();
    return (
      m.includes("email not confirmed") ||
      m.includes("not confirmed") ||
      m.includes("confirme") ||
      m.includes("email_not_confirmed")
    );
  };

  const handleResendConfirmation = async () => {
    if (!pendingEmail || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success("Email de confirmação reenviado", {
        description: `Verifique a caixa de entrada de ${pendingEmail}.`,
      });
      setResendCooldown(60);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(resendStorageKey(pendingEmail), String(Date.now() + 60_000));
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao reenviar";
      toast.error("Não foi possível reenviar", { description: message });
    } finally {
      setIsResending(false);
    }
  };


  // Resolve destino pós-login: query ?redirect=, senão sessionStorage (OAuth), senão /painel.
  const resolveRedirect = (): string => {
    const fromQuery = safeInternalPath(search.redirect);
    if (fromQuery) return fromQuery;
    if (typeof window !== "undefined") {
      const stashed = safeInternalPath(sessionStorage.getItem(OAUTH_REDIRECT_KEY));
      if (stashed) return stashed;
    }
    return "/painel";
  };

  const goPostLogin = () => {
    const target = resolveRedirect();
    if (typeof window !== "undefined") sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
    navigate({ to: target, replace: true });
  };

  // Redireciona quando o usuário autentica — inclui o caso em que confirma o
  // e-mail em outra aba/janela: o onAuthStateChange do Supabase propaga via
  // storage events e atualiza `user` aqui, disparando o efeito abaixo.
  useEffect(() => {
    if (user) {
      setPendingEmail(null);
      goPostLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Enquanto o card de confirmação estiver visível, revalida a sessão sempre
  // que a aba volta ao foco — cobre o fluxo "confirmei no e-mail e voltei".
  useEffect(() => {
    if (!pendingEmail) return;
    const revalidate = () => {
      if (document.visibilityState === "visible") {
        void supabase.auth.getSession();
      }
    };
    document.addEventListener("visibilitychange", revalidate);
    window.addEventListener("focus", revalidate);
    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      window.removeEventListener("focus", revalidate);
    };
  }, [pendingEmail]);

  if (user) return null;



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login realizado", {
        description: "Bem-vindo(a) de volta ao B2B | JurisMind AI.",
      });
      goPostLogin();

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao entrar";
      setError(message);
      if (isUnconfirmedError(message) && email) {
        setPendingEmail(email);
      }
      toast.error("Não foi possível entrar", { description: message });
    } finally {
      setIsLoading(false);
    }

  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      // Se a confirmação de email estiver ativa, não haverá sessão ainda.
      if (data.session) {
        toast.success("Conta criada", {
          description: "Redirecionando...",
        });
        goPostLogin();
      } else {
        setPendingEmail(email);
        toast.success("Confirme seu email", {
          description: "Enviamos um link de confirmação para " + email + ".",
        });
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar conta";
      setError(message);
      toast.error("Não foi possível criar a conta", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    // Persiste destino para após o retorno do OAuth (roundtrip perde ?redirect=).
    const target = safeInternalPath(search.redirect);
    if (target && typeof window !== "undefined") {
      sessionStorage.setItem(OAUTH_REDIRECT_KEY, target);
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError(result.error instanceof Error ? result.error.message : "Erro ao entrar com Google");
    }
  };


  const cardClass = cn(
    "space-y-4 rounded-2xl border bg-card p-6 shadow-sm",
  );

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <header className="w-full px-4 pt-4 sm:absolute sm:left-4 sm:top-4 sm:z-10 sm:w-auto sm:p-0">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/">
            <IconBox icon={ArrowLeft} size="xs" bgColor="bg-muted" iconColor="text-foreground" />
            Voltar à página inicial
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <JurisMindMark size={48} context={JURISMIND_CONTEXT.auth} rounded className="mb-4" />
            <h1 className="text-3xl font-bold text-foreground">B2B | JurisMind AI</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Inteligência para advogados, peritos e assistentes técnicos
            </p>
          </div>

          {pendingEmail && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2">
                <IconBox icon={MailCheck} size="xs" bgColor="bg-amber-500/15" iconColor="text-amber-700 dark:text-amber-300" />
                <div className="min-w-0">
                  <p className="font-medium">Confirme seu email</p>
                  <p className="text-xs opacity-80">
                    Enviamos um link para <span className="font-medium">{pendingEmail}</span>. Não recebeu?
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleResendConfirmation}
                  disabled={isResending || resendCooldown > 0}
                >
                  {isResending
                    ? "Reenviando..."
                    : resendCooldown > 0
                      ? `Aguarde ${resendCooldown}s`
                      : "Reenviar confirmação"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingEmail(null)}
                  aria-label="Dispensar aviso"
                >
                  ✕
                </Button>
              </div>
            </div>
          )}



          <Tabs value={mode} onValueChange={(v) => { setMode(v as "login" | "signup"); setError(null); }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl">
              <TabsTrigger value="login" className="rounded-xl">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className={cardClass}>
                <div className="space-y-2">
                  <FieldLabel htmlFor="email" icon={Mail}>Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="password" icon={Lock}>Senha</FieldLabel>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setForgotOpen(true);
                      }}
                      className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  <IconBox icon={LogIn} size="xs" bgColor="bg-primary-foreground/15" iconColor="text-primary-foreground" />
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle}>
                  <IconBox icon={Mail} size="xs" bgColor="bg-muted" iconColor="text-foreground" />
                  Entrar com Google
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Ainda não tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError(null); }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Criar conta
                </button>
              </p>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className={cardClass}>
                <div className="space-y-2">
                  <FieldLabel htmlFor="fullName" icon={User}>Nome completo</FieldLabel>
                  <Input
                    id="fullName"
                    placeholder="Dr. João Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="signupEmail" icon={Mail}>Email</FieldLabel>
                  <Input
                    id="signupEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="signupPassword" icon={Lock}>Senha</FieldLabel>
                  <Input
                    id="signupPassword"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  <IconBox icon={UserPlus} size="xs" bgColor="bg-primary-foreground/15" iconColor="text-primary-foreground" />
                  {isLoading ? "Criando..." : "Criar conta"}
                </Button>
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle}>
                  <IconBox icon={Mail} size="xs" bgColor="bg-muted" iconColor="text-foreground" />
                  Criar conta com Google
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Já tem uma conta?{" "}
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(null); }}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Entrar
                </button>
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconBox icon={KeyRound} size="xs" />
              Redefinir senha
            </DialogTitle>
            <DialogDescription>
              Informe o email da sua conta. Enviaremos um link para você criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <FieldLabel htmlFor="forgotEmail" icon={Mail}>Email</FieldLabel>
              <Input
                id="forgotEmail"
                type="email"
                placeholder="seu@email.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSendingReset || !forgotEmail}>
                {isSendingReset ? "Enviando..." : "Enviar link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
