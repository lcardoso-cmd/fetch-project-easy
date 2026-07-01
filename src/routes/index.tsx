import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrainCircuit, ListTodo, Scale, FileText, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "B2B | JurisMind Ai — Inteligência para advogados, peritos e assistentes técnicos" },
      {
        name: "description",
        content:
          "B2B | JurisMind Ai: plataforma de IA jurídica para advogados, peritos judiciais e assistentes técnicos. RAG de documentos, prazos e modelos de petição, laudo e parecer.",
      },
    ],
  }),
});

const features = [
  {
    icon: BrainCircuit,
    title: "Chat com seus documentos",
    description:
      "Pergunte qualquer coisa sobre seus processos, perícias ou laudos. O JurisMind Ai busca trechos relevantes e responde citando as fontes.",
  },
  {
    icon: FileText,
    title: "Análise automática",
    description:
      "Faça upload de PDFs, contratos, despachos de nomeação e laudos. O JurisMind Ai extrai, indexa e gera resumos em segundos.",
  },
  {
    icon: ListTodo,
    title: "Casos, perícias e assistências",
    description:
      "Organize processos do cliente, perícias nomeadas pelo juízo e assistências técnicas em um único painel adaptável ao seu perfil.",
  },
  {
    icon: Scale,
    title: "Para todo o jurídico técnico",
    description:
      "Advogados, peritos contadores, peritos engenheiros, peritos médicos e assistentes técnicos das partes — com vocabulário e modelos próprios para cada um.",
  },
];

function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <span className="font-heading text-xl font-extrabold tracking-tight text-foreground">
              B2B | JurisMind Ai
            </span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild>
                <Link to="/dashboard">
                  Ir para o painel <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/auth">Entrar</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Começar grátis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, oklch(0.86 0.16 195) 0, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.65 0.16 220) 0, transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="h-3 w-3" />
            B2B | JurisMind Ai aplicado à advocacia
          </div>
          <h1 className="font-heading text-5xl font-extrabold tracking-tight md:text-6xl">
            Sua mente jurídica,
            <br />
            potencializada por B2B | JurisMind Ai.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            B2B | JurisMind Ai transforma a forma como você lida com documentos: faça upload, pergunte,
            obtenha resumos e cite as fontes — tudo em um único lugar.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Abrir painel" : "Começar agora"} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <a href="#features">Conhecer recursos</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Tudo que sua banca precisa em um só lugar
          </h2>
          <p className="mt-3 text-muted-foreground">
            Reduza horas de leitura, encontre informação em segundos e foque no que importa: a tese.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-xl font-bold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/40">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Pronto para experimentar?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Crie sua conta gratuita, suba seus primeiros documentos e converse com o JurisMind.
          </p>
          <Button size="lg" asChild className="mt-6">
            <Link to={user ? "/dashboard" : "/auth"}>
              {user ? "Abrir painel" : "Criar conta grátis"} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} JurisMind. Feito para advogados.
        </div>
      </footer>
    </div>
  );
}
