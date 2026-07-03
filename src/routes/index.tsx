import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IconBox } from "@/components/ui/icon-box";
import {
  ArrowRight,
  Scale,
  Microscope,
  FileText,
  MessageSquare,
  Handshake,
  CalendarDays,
  Megaphone,
  FileSearch,
  Sparkles,
  Mic,
  Puzzle,
  Users,
  ShieldCheck,
  Workflow,
  FileCheck2,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "B2B | JurisMind AI — Inteligência para advogados, peritos e assistentes técnicos" },
      {
        name: "description",
        content:
          "Plataforma de IA jurídica: chat com documentos, peças, laudos, pareceres, propostas comerciais, agenda integrada (Google/Outlook), marketing e monitoramento de publicações.",
      },
      { property: "og:title", content: "JurisMind AI — Inteligência para advogados, peritos e assistentes técnicos" },
      {
        property: "og:description",
        content:
          "Plataforma B2B de IA jurídica: RAG de documentos, geração de peças, laudos, pareceres e propostas, com agenda e monitoramento integrados.",
      },
      { property: "og:url", content: "https://b2bjurismind.lovable.app/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp" },
      { name: "twitter:title", content: "JurisMind AI — Inteligência para advogados, peritos e assistentes técnicos" },
      {
        name: "twitter:description",
        content:
          "Plataforma B2B de IA jurídica: RAG de documentos, geração de peças, laudos, pareceres e propostas.",
      },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp" },
    ],
    links: [{ rel: "canonical", href: "https://b2bjurismind.lovable.app/" }],
  }),
});

type Pillar = {
  icon: typeof Sparkles;
  title: string;
  description: string;
  span?: string;
};

const PILLARS: Pillar[] = [
  {
    icon: Sparkles,
    title: "Assistente JurisMind por caso",
    description:
      "RAG híbrido dedicado ao processo: pergunte sobre laudos, quesitos, contratos e receba respostas citando os trechos e páginas dos documentos.",
    span: "md:col-span-2",
  },
  {
    icon: FileText,
    title: "Peças, laudos e pareceres",
    description:
      "Petições, contestações, quesitos, laudos periciais e pareceres técnicos — padronizados em DOCX/PDF com a marca do escritório.",
  },
  {
    icon: Handshake,
    title: "Proposta comercial em minutos",
    description:
      "Gere propostas a partir dos documentos do cliente, versione com diff, exporte em Word e converta em caso com um clique.",
  },
  {
    icon: CalendarDays,
    title: "Agenda integrada",
    description:
      "Sincronize Google Agenda e Outlook. Prazos, audiências e compromissos em uma única visão.",
  },
  {
    icon: Megaphone,
    title: "Marketing jurídico",
    description:
      "Uma trilha dedicada ao escritório para trabalhar captação, comunicação e presença de marca.",
  },
  {
    icon: FileSearch,
    title: "Publicações monitoradas",
    description:
      "Acompanhe intimações e movimentações para nunca mais perder um prazo importante.",
    span: "md:col-span-2",
  },
];

const STEPS = [
  {
    icon: Handshake,
    title: "Capte",
    text: "Proposta comercial inteligente com auto-preenchimento dos dados do cliente a partir de documentos.",
  },
  {
    icon: MessageSquare,
    title: "Trabalhe",
    text: "Chat com os documentos do caso, geração de peças, laudos e pareceres com citação das fontes.",
  },
  {
    icon: FileCheck2,
    title: "Entregue",
    text: "Exportação padronizada em DOCX/PDF com logo, cabeçalho e margens do seu escritório.",
  },
  {
    icon: Workflow,
    title: "Acompanhe",
    text: "Agenda sincronizada, publicações monitoradas e notificações centralizadas no painel.",
  },
];

const INTEGRATIONS = [
  { icon: CalendarDays, label: "Google Agenda" },
  { icon: CalendarDays, label: "Microsoft Outlook" },
  { icon: FileText, label: "Exportação DOCX / PDF" },
  { icon: Mic, label: "Transcrição por voz" },
  { icon: Users, label: "Equipe com convites" },
  { icon: ShieldCheck, label: "Capacidades granulares" },
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
            <JurisMindMark size={32} context={JURISMIND_CONTEXT.header} interactive />
            <span className="font-heading text-xl font-extrabold tracking-tight text-foreground">
              B2B | JurisMind AI
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild>
                <Link to="/painel">
                  Ir para o painel <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/entrar">Entrar</Link>
                </Button>
                <Button asChild>
                  <Link to="/entrar">Começar grátis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, oklch(0.86 0.16 195) 0, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.65 0.16 220) 0, transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
            <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />
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
              <Link to={user ? "/painel" : "/entrar"}>
                {user ? "Abrir painel" : "Começar agora"} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <a href="#plataforma">Conhecer a plataforma</a>
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
              <div key={p.title} className="flex items-start gap-3 rounded-2xl border bg-card p-4">
                <IconBox icon={Icon} size="md" />
                <div>
                  <h3 className="font-heading font-bold text-foreground">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plataforma completa — Bento */}
      <section id="plataforma" className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Uma plataforma completa para o escritório jurídico
          </h2>
          <p className="mt-3 text-muted-foreground">
            Do primeiro contato com o cliente até a entrega do laudo: tudo integrado, sem trocar de
            ferramenta.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className={`rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md ${
                  p.span ?? ""
                }`}
              >
                <IconBox icon={Icon} size="md" className="mb-4" />
                <h3 className="font-heading text-lg font-bold text-foreground">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Fluxo ponta a ponta */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Fluxo de trabalho ponta a ponta
            </h2>
            <p className="mt-3 text-muted-foreground">
              Um único sistema acompanha o caso desde a proposta até o acompanhamento processual.
            </p>
          </div>

          <ol className="mt-12 grid gap-6 md:grid-cols-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.title}
                  className="relative rounded-2xl border bg-card p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground">
                      {i + 1}
                    </div>
                    <IconBox icon={Icon} size="sm" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Integrações */}
      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              <Puzzle className="h-3.5 w-3.5" />
              Integra com o seu dia a dia
            </div>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Se conecta às ferramentas que você já usa
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3">
            {INTEGRATIONS.map((i) => {
              const Icon = i.icon;
              return (
                <div
                  key={i.label}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">{i.label}</span>
                </div>
              );
            })}
          </div>
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
            <Link to={user ? "/painel" : "/entrar"}>
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
