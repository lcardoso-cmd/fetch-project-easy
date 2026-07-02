import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IconBox } from "@/components/ui/icon-box";
import { ListTodo, Scale, FileText, ArrowRight, Microscope, MessageSquare } from "lucide-react";
import { JurisMindMark } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "B2B | JurisMind AI — Inteligência para advogados, peritos e assistentes técnicos" },
      {
        name: "description",
        content:
          "B2B | JurisMind AI: plataforma de IA jurídica para advogados, peritos judiciais e assistentes técnicos. RAG de documentos, prazos, petições, laudos e pareceres técnicos.",
      },
    ],
  }),
});

const features = [
  {
    icon: MessageSquare,
    title: "Chat com seus documentos",
    description:
      "Pergunte sobre processos, laudos, quesitos ou contratos. O JurisMind AI busca trechos relevantes e responde citando as fontes.",
  },
  {
    icon: FileText,
    title: "Peças e laudos em minutos",
    description:
      "Petições, contestações, quesitos, laudos periciais, pareceres técnicos e manifestações a partir dos documentos do caso.",
  },
  {
    icon: ListTodo,
    title: "Casos, perícias e assistências",
    description:
      "Organize processos do escritório, perícias nomeadas pelo juízo e assistências técnicas em um único painel adaptável ao seu perfil.",
  },
  {
    icon: Microscope,
    title: "Feito para o jurídico técnico",
    description:
      "Advogados, peritos judiciais (contadores, engenheiros, médicos) e assistentes técnicos das partes — com vocabulário e modelos próprios para cada perfil.",
  },
];

function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            aria-label="B2B | JurisMind AI — início"
            className="group flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <JurisMindMark size={32} context="header" interactive />
            <span className="font-heading text-xl font-extrabold tracking-tight text-foreground">
              B2B | JurisMind AI
            </span>
          </Link>
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
            <JurisMindMark size={14} context="inline-dark" />
            Para advogados, peritos e assistentes técnicos
          </div>
          <h1 className="font-heading text-5xl font-extrabold tracking-tight md:text-6xl">
            Inteligência jurídica e técnica,
            <br />
            de ponta a ponta.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
            B2B | JurisMind AI reúne processos, laudos e contratos em um só lugar: pergunte,
            gere petições, quesitos, pareceres técnicos e planilhas — sempre com citação das fontes.
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

      {/* Personas */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3">
          {[
            {
              icon: Scale,
              title: "Advogados",
              text: "Petições, contestações, contrarrazões, alegações finais e análise de risco.",
            },
            {
              icon: Microscope,
              title: "Peritos judiciais",
              text: "Laudos periciais, resposta a quesitos e organização de nomeações do juízo.",
            },
            {
              icon: FileText,
              title: "Assistentes técnicos",
              text: "Pareceres técnicos, manifestações e apoio à parte contratante no processo.",
            },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <IconBox icon={Icon} size={40} iconSize={20} />
                <div>
                  <h3 className="font-heading font-bold text-foreground">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Tudo que o jurídico técnico precisa em um só lugar
          </h2>
          <p className="mt-3 text-muted-foreground">
            Reduza horas de leitura, encontre informação em segundos e foque no que importa:
            a tese, o laudo, o parecer.
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
                <IconBox icon={Icon} size={40} iconSize={20} className="mb-4" />
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
            Crie sua conta gratuita, suba seus primeiros documentos e converse com o B2B | JurisMind AI.
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
          © {new Date().getFullYear()} B2B | JurisMind AI. Feito para advogados, peritos e assistentes técnicos.
        </div>
      </footer>
    </div>
  );
}
