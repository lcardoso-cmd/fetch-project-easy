import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JurisMindMark } from "@/components/brand/jurismind-mark";
import { IconBox } from "@/components/ui/icon-box";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Mail, Lock, User, LogIn, UserPlus } from "lucide-react";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (user) {
    navigate({ to: "/painel", replace: true });
    return null;
  }

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
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao entrar";
      setError(message);
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
          description: "Redirecionando para o painel...",
        });
        navigate({ to: "/painel", replace: true });
      } else {
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
            <JurisMindMark size={48} context="auth" rounded className="mb-4" />
            <h1 className="text-3xl font-bold text-foreground">B2B | JurisMind AI</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Inteligência para advogados, peritos e assistentes técnicos
            </p>
          </div>

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
                  <FieldLabel htmlFor="password" icon={Lock}>Senha</FieldLabel>
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
    </div>
  );
}
