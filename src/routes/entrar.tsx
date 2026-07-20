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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

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
  head: () => ({
    meta: [
      { title: "Entrar no JurisMind — IA para advogados" },
      {
        name: "description",
        content:
          "Acesse sua conta JurisMind AI para gerenciar casos, documentos e peças com inteligência artificial jurídica.",
      },
      { property: "og:title", content: "Entrar no JurisMind — IA para advogados" },
      {
        property: "og:description",
        content: "Acesse sua conta JurisMind AI para gerenciar casos, documentos e peças com IA jurídica.",
      },
      { property: "og:url", content: "https://b2bjurismind.lovable.app/entrar" },
    ],
    links: [{ rel: "canonical", href: "https://b2bjurismind.lovable.app/entrar" }],
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);
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
    // hidrata contador persistido
    try {
      const s = window.localStorage.getItem(`jm.resendStats:${pendingEmail.toLowerCase()}`);
      setResendCount(s ? (JSON.parse(s).count ?? 0) : 0);
    } catch {
      setResendCount(0);
    }
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

  const resendStatsKey = (email: string) => `jm.resendStats:${email.toLowerCase()}`;

  type ResendStats = { count: number; firstAt: number; lastAt: number };
  const readResendStats = (email: string): ResendStats => {
    if (typeof window === "undefined") return { count: 0, firstAt: 0, lastAt: 0 };
    try {
      const raw = window.localStorage.getItem(resendStatsKey(email));
      return raw ? (JSON.parse(raw) as ResendStats) : { count: 0, firstAt: 0, lastAt: 0 };
    } catch {
      return { count: 0, firstAt: 0, lastAt: 0 };
    }
  };

  const describeResendError = (err: unknown): { title: string; description: string } => {
    // Supabase rate limit: status 429 ou mensagens "over_email_send_rate_limit" / "rate limit".
    const anyErr = err as { status?: number; message?: string; code?: string; name?: string } | null;
    const raw = anyErr?.message ?? "";
    const lower = raw.toLowerCase();
    const status = anyErr?.status;
    const code = anyErr?.code?.toLowerCase() ?? "";
    const isRate =
      status === 429 ||
      code.includes("rate") ||
      lower.includes("rate limit") ||
      lower.includes("too many") ||
      lower.includes("over_email_send_rate_limit");
    if (isRate) {
      // Tenta extrair "after N seconds"
      const secs = /after\s+(\d+)\s*seconds?/i.exec(raw)?.[1];
      const waitHint = secs ? `Aguarde ~${secs}s antes de tentar de novo.` : "Aguarde alguns minutos antes de tentar de novo.";
      return {
        title: "Limite de envios atingido",
        description: `O servidor bloqueou temporariamente novos envios para este e-mail. ${waitHint} (código: ${status ?? code ?? "rate_limit"})`,
      };
    }
    if (lower.includes("user not found") || lower.includes("invalid")) {
      return { title: "E-mail inválido", description: raw || "Verifique o endereço informado." };
    }
    return { title: "Não foi possível reenviar", description: raw || "Falha desconhecida." };
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

      // Telemetria local: contabiliza reenvios bem-sucedidos por e-mail.
      const now = Date.now();
      const prev = readResendStats(pendingEmail);
      const next: ResendStats = {
        count: prev.count + 1,
        firstAt: prev.firstAt || now,
        lastAt: now,
      };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(resendStatsKey(pendingEmail), JSON.stringify(next));
      }
      setResendCount(next.count);

      toast.success("Email de confirmação reenviado", {
        description: `Verifique a caixa de entrada de ${pendingEmail}. (${next.count}º envio)`,
      });
      setResendCooldown(60);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(resendStorageKey(pendingEmail), String(Date.now() + 60_000));
      }

    } catch (err) {
      const { title, description } = describeResendError(err);
      toast.error(title, { description });
      // Se for rate-limit, aplica um cooldown mínimo para o botão não ficar
      // pronto imediatamente e disparar de novo.
      const anyErr = err as { status?: number; message?: string } | null;
      const raw = (anyErr?.message ?? "").toLowerCase();
      if (anyErr?.status === 429 || raw.includes("rate limit") || raw.includes("over_email_send_rate_limit")) {
        const secs = Number(/after\s+(\d+)\s*seconds?/i.exec(anyErr?.message ?? "")?.[1] ?? 60);
        setResendCooldown(secs);
        if (pendingEmail && typeof window !== "undefined") {
          window.localStorage.setItem(resendStorageKey(pendingEmail), String(Date.now() + secs * 1000));
        }
      }
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

  // Detecta erros de OAuth vindos por hash/query após retorno do provedor.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.search);
    const oauthError = params.get("error") || params.get("error_code");
    if (!oauthError) return;
    const desc = params.get("error_description") || oauthError;
    const raw = desc.toLowerCase();
    let title = "Falha no login com Google";
    let description = desc;
    if (raw.includes("access_denied")) {
      title = "Permissão negada";
      description = "Você precisa autorizar o acesso da conta Google para entrar.";
    } else if (raw.includes("provider") && raw.includes("not enabled")) {
      title = "Google indisponível";
      description = "O login com Google não está habilitado neste ambiente.";
    }
    setError(description);
    toast.error(title, { description });
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
  }, []);

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

  const describeGoogleError = (err: unknown): { title: string; description: string } => {
    const raw = (err instanceof Error ? err.message : typeof err === "string" ? err : "")
      .toString()
      .toLowerCase();
    if (!raw) {
      return {
        title: "Não foi possível entrar com Google",
        description: "Tente novamente em instantes. Se persistir, use email e senha.",
      };
    }
    if (raw.includes("popup") && (raw.includes("block") || raw.includes("bloque"))) {
      return {
        title: "Pop-up bloqueado pelo navegador",
        description: "Habilite pop-ups para este site e tente novamente.",
      };
    }
    if (raw.includes("popup_closed") || raw.includes("closed by user") || raw.includes("user closed") || raw.includes("cancel")) {
      return {
        title: "Login cancelado",
        description: "A janela do Google foi fechada antes de concluir.",
      };
    }
    if (raw.includes("access_denied") || raw.includes("consent")) {
      return {
        title: "Permissão negada",
        description: "Você precisa autorizar o acesso da conta Google para entrar.",
      };
    }
    if (raw.includes("network") || raw.includes("failed to fetch") || raw.includes("timeout")) {
      return {
        title: "Sem conexão",
        description: "Verifique sua internet e tente novamente.",
      };
    }
    if (raw.includes("unsupported provider") || raw.includes("provider is not enabled") || raw.includes("provider_not_enabled")) {
      return {
        title: "Google indisponível",
        description: "O login com Google não está habilitado neste ambiente. Use email e senha ou fale com o suporte.",
      };
    }
    if (raw.includes("redirect") && (raw.includes("uri") || raw.includes("mismatch") || raw.includes("allow"))) {
      return {
        title: "URL de redirecionamento não autorizada",
        description: "Este domínio precisa estar liberado no provedor Google. Fale com o suporte.",
      };
    }
    if (raw.includes("invalid_client") || raw.includes("client_id")) {
      return {
        title: "Configuração do Google inválida",
        description: "As credenciais OAuth não estão configuradas corretamente. Fale com o suporte.",
      };
    }
    if (raw.includes("rate limit") || raw.includes("too many")) {
      return {
        title: "Muitas tentativas",
        description: "Aguarde alguns minutos antes de tentar novamente.",
      };
    }
    return {
      title: "Falha no login com Google",
      description: err instanceof Error ? err.message : "Tente novamente em instantes.",
    };
  };

  const handleGoogle = async () => {
    if (isGoogleLoading) return;
    setError(null);
    setIsGoogleLoading(true);
    // Persiste destino para após o retorno do OAuth (roundtrip perde ?redirect=).
    const target = safeInternalPath(search.redirect);
    if (target && typeof window !== "undefined") {
      sessionStorage.setItem(OAUTH_REDIRECT_KEY, target);
    }
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const { title, description } = describeGoogleError(result.error);
        setError(description);
        toast.error(title, { description });
        setIsGoogleLoading(false);
        return;
      }
      // Se result.redirected, o navegador está indo para o Google — mantém loading.
      if (!result.redirected) {
        // Sessão já estabelecida (popup). O efeito de `user` cuidará do redirect.
        setIsGoogleLoading(false);
      }
    } catch (err) {
      const { title, description } = describeGoogleError(err);
      setError(description);
      toast.error(title, { description });
      setIsGoogleLoading(false);
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
            <h1 className="text-3xl font-bold text-foreground">Entrar no JurisMind</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Inteligência para escritórios de advocacia
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
                  {resendCount > 0 && (
                    <p className="text-xs opacity-70 mt-0.5">
                      Reenvios feitos: <span className="font-medium">{resendCount}</span>
                      {resendCount >= 3 && " — verifique também a caixa de spam."}
                    </p>
                  )}
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
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={isGoogleLoading || isLoading}>
                  <GoogleIcon className="h-4 w-4" />
                  {isGoogleLoading ? "Conectando ao Google..." : "Entrar com Google"}
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
                <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={isGoogleLoading || isLoading}>
                  <GoogleIcon className="h-4 w-4" />
                  {isGoogleLoading ? "Conectando ao Google..." : "Criar conta com Google"}
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
