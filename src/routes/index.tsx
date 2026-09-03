import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IconBox } from "@/components/ui/icon-box";
import {
  ArrowRight,
  ArrowDown,
  Search,
  FileText,
  Layers,
  Sparkles,
  ShieldCheck,
  Workflow,
  FileSearch,
  Scale,
  Gauge,
  Users,
  Check,
  X,
  Quote,
  Database,
  ListChecks,
  BookOpen,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "JurisMind AI — A camada de inteligência jurídica do seu escritório" },
      {
        name: "description",
        content:
          "O JurisMind transforma os documentos e casos do escritório em uma base de conhecimento consultável por IA, com RAG jurídico, rastreabilidade por documento e trecho, operação e governança.",
      },
      {
        property: "og:title",
        content: "JurisMind AI — Inteligência jurídica construída sobre seus documentos",
      },
      {
        property: "og:description",
        content:
          "GPT e Gemini são modelos de IA. O JurisMind transforma essa tecnologia em inteligência jurídica aplicada aos casos e documentos do seu escritório.",
      },
      { property: "og:url", content: "https://b2bjurismind.lovable.app/" },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "JurisMind AI — Inteligência jurídica sobre seus documentos" },
      {
        name: "twitter:description",
        content:
          "RAG jurídico por caso, busca híbrida em português, rastreabilidade por documento e trecho, operação e governança de IA.",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp",
      },
    ],
    links: [{ rel: "canonical", href: "https://b2bjurismind.lovable.app/" }],
  }),
});

const RAG_STEPS = [
  {
    icon: Scale,
    n: "01",
    t: "Organização por caso",
    d: "Os documentos são vinculados ao contexto jurídico específico em que serão utilizados.",
  },
  {
    icon: Layers,
    n: "02",
    t: "Processamento documental",
    d: "O conteúdo é extraído, segmentado e preparado para consulta inteligente.",
  },
  {
    icon: Search,
    n: "03",
    t: "Busca híbrida",
    d: "A plataforma combina busca semântica por significado com busca textual em português.",
  },
  {
    icon: Workflow,
    n: "04",
    t: "Fusão dos resultados",
    d: "Diferentes sinais de relevância são combinados para selecionar os conteúdos mais relacionados à pergunta.",
  },
  {
    icon: Sparkles,
    n: "05",
    t: "Reescrita e reranqueamento",
    d: "Nos modos avançados, a consulta pode ser aprimorada e os trechos recuperados são novamente classificados antes da geração.",
  },
  {
    icon: FileSearch,
    n: "06",
    t: "Resposta contextualizada",
    d: "O modelo recebe os conteúdos selecionados e elabora uma resposta relacionada aos documentos e trechos utilizados.",
  },
];

const TECH_CARDS = [
  {
    icon: Search,
    t: "Busca semântica",
    d: "Localiza conteúdos relacionados ao significado da pergunta, ainda que utilizem palavras diferentes.",
  },
  {
    icon: BookOpen,
    t: "Busca textual em português",
    d: "Complementa a análise semântica com termos, expressões e referências específicas dos documentos.",
  },
  {
    icon: Layers,
    t: "Fusão e reranqueamento",
    d: "Combina e reorganiza os resultados para priorizar os trechos mais relevantes.",
  },
  {
    icon: Workflow,
    t: "Orquestração de modelos",
    d: "A plataforma utiliza modelos avançados de inteligência artificial de acordo com o fluxo executado.",
  },
  {
    icon: Database,
    t: "Contexto controlado",
    d: "A resposta é construída a partir dos conteúdos recuperados no acervo selecionado.",
  },
  {
    icon: FileSearch,
    t: "Rastreabilidade",
    d: "Documentos e trechos relacionados permanecem disponíveis para conferência pelo advogado.",
  },
];

const LAYERS = [
  {
    icon: Sparkles,
    t: "Inteligência",
    d: "RAG por caso, consulta documental, análise e produção jurídica.",
    items: ["Assistente por caso", "Consulta aos documentos", "Produção jurídica", "Pareceres"],
  },
  {
    icon: Workflow,
    t: "Operação",
    d: "Casos, documentos, tarefas, agenda, propostas e acompanhamento.",
    items: ["Casos e documentos", "Tarefas e agenda", "Propostas comerciais", "Publicações e equipe"],
  },
  {
    icon: ShieldCheck,
    t: "Governança",
    d: "Usuários, permissões, modelos, consumo, orçamento e custos estimados.",
    items: ["Usuários e permissões", "Modelos utilizados", "Tokens e custos estimados", "Orçamento mensal"],
  },
];

function LandingPage() {
  const { user } = useAuth();
  const primaryTo = user ? "/painel" : "/entrar";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <JurisMindMark size={28} context={JURISMIND_CONTEXT.inlineLight} />
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              JurisMind AI
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#tecnologia" className="hover:text-foreground">
              Tecnologia
            </a>
            <a href="#evidencia" className="hover:text-foreground">
              Rastreabilidade
            </a>
            <a href="#plataforma" className="hover:text-foreground">
              Plataforma
            </a>
            <a href="#governanca" className="hover:text-foreground">
              Governança
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild>
                <Link to="/painel">Abrir painel</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/entrar">Entrar</Link>
                </Button>
                <Button asChild>
                  <Link to="/entrar">Testar grátis por 30 dias</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 25%, oklch(0.86 0.16 195) 0, transparent 42%), radial-gradient(circle at 85% 75%, oklch(0.65 0.16 220) 0, transparent 45%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
                <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />A camada de
                inteligência jurídica do escritório
              </div>
              <h1 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl">
                A inteligência jurídica do seu escritório começa nos próprios documentos.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">
                O JurisMind transforma processos, contratos, pareceres e demais documentos de cada
                caso em uma base de conhecimento consultável por IA — conectada à produção
                jurídica, à operação e à governança do escritório.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  asChild
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Link to={primaryTo}>
                    {user ? "Abrir painel" : "Testar grátis por 30 dias"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <a href="#tecnologia">Conhecer a tecnologia</a>
                </Button>
              </div>

              <p className="mt-6 max-w-xl text-sm text-primary-foreground/70">
                Não apenas converse com uma IA. Trabalhe com uma inteligência construída sobre o
                contexto real de cada caso.
              </p>
            </div>

            {/* Composição visual: caso → documentos → pergunta → trechos → resposta → produção */}
            <div className="relative rounded-3xl border border-primary-foreground/20 bg-primary/40 p-5 shadow-2xl backdrop-blur">
              <div className="rounded-2xl border border-primary-foreground/15 bg-primary/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                  Caso
                </p>
                <p className="mt-1 font-heading text-base font-bold">
                  Construtora X — atraso na entrega da obra
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {["Contrato de empreitada", "Notificações extrajudiciais", "Laudo de vistoria", "Contestação"].map(
                    (d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1 rounded-md border border-primary-foreground/20 bg-primary/50 px-2 py-1 text-primary-foreground/80"
                      >
                        <FileText className="h-3 w-3 text-accent" />
                        {d}
                      </span>
                    ),
                  )}
                </div>
              </div>

              <div className="my-2 flex justify-center">
                <ArrowDown className="h-4 w-4 text-accent" />
              </div>

              <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                  Pergunta do advogado
                </p>
                <p className="mt-1 text-sm">
                  Quais justificativas foram apresentadas para o atraso da obra?
                </p>
              </div>

              <div className="my-2 flex justify-center">
                <ArrowDown className="h-4 w-4 text-accent" />
              </div>

              <div className="space-y-2">
                {[
                  {
                    doc: "Contestação",
                    tr: "“…o atraso decorreu de chuvas atípicas registradas no período…”",
                  },
                  {
                    doc: "Laudo de vistoria",
                    tr: "“…paralisação por indisponibilidade de insumos entre março e maio…”",
                  },
                ].map((t) => (
                  <div
                    key={t.doc}
                    className="rounded-xl border border-primary-foreground/15 bg-primary/50 p-3"
                  >
                    <p className="flex items-center gap-2 text-[11px] font-semibold text-accent">
                      <Quote className="h-3 w-3" />
                      Trecho recuperado · {t.doc}
                    </p>
                    <p className="mt-1 text-xs text-primary-foreground/80">{t.tr}</p>
                  </div>
                ))}
              </div>

              <div className="my-2 flex justify-center">
                <ArrowDown className="h-4 w-4 text-accent" />
              </div>

              <div className="rounded-2xl border border-primary-foreground/15 bg-primary/60 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                  Resposta contextualizada
                </p>
                <p className="mt-1 text-xs text-primary-foreground/85">
                  As justificativas identificadas nos documentos selecionados envolvem condições
                  climáticas atípicas e indisponibilidade de insumos, com os trechos e documentos
                  relacionados disponíveis para conferência.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-primary-foreground/70">
                  <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-1 text-accent">
                    <ListChecks className="h-3 w-3" /> Usar na produção jurídica
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary-foreground/20 px-2 py-1">
                    <FileSearch className="h-3 w-3" /> Conferir documentos utilizados
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESE */}
        <section className="border-b bg-card">
          <div className="mx-auto max-w-4xl px-4 py-12 text-center">
            <p className="font-heading text-xl font-bold leading-snug text-foreground md:text-2xl">
              GPT e Gemini são modelos de inteligência artificial. O JurisMind transforma essa
              tecnologia em inteligência jurídica aplicada aos casos e documentos do seu escritório.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Uma IA genérica conhece o mundo. O JurisMind trabalha sobre os documentos, os casos e
              o conhecimento do seu escritório.
            </p>
          </div>
        </section>

        {/* CONTRASTE */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Por que não usar apenas uma IA genérica?
            </h2>
            <p className="mt-3 text-muted-foreground">
              A comparação não é com um plano corporativo de terceiros, e sim com o uso isolado de
              uma IA generalista no dia a dia do escritório.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border bg-muted/30 p-6">
              <h3 className="font-heading text-lg font-bold text-foreground">
                IA generalista utilizada isoladamente
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                {[
                  "Interação concentrada em conversas.",
                  "Contexto fornecido manualmente pelo advogado.",
                  "Documentos e informações separados da gestão do caso.",
                  "Ausência de fluxo jurídico operacional integrado.",
                  "Dificuldade de controlar o uso por equipe, caso e funcionalidade.",
                  "Conhecimento produzido sem integração automática à rotina do escritório.",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <X className="h-3 w-3" />
                    </span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-accent/40 bg-accent/5 p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold text-foreground">JurisMind</h3>
              <ul className="mt-5 space-y-3 text-sm text-foreground/90">
                {[
                  "Inteligência organizada por caso.",
                  "Documentos processados e transformados em base consultável.",
                  "Recuperação automática dos conteúdos relevantes.",
                  "Busca semântica e textual combinadas.",
                  "Respostas relacionadas aos documentos e trechos utilizados.",
                  "Produção jurídica conectada ao contexto documental.",
                  "Gestão de usuários, permissões, consumo e custos de IA.",
                  "Integração com casos, documentos, tarefas, agenda e propostas.",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* TECNOLOGIA — RAG */}
        <section id="tecnologia" className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Arquitetura avançada de RAG
              </div>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                RAG jurídico de última geração para compreender o contexto de cada caso.
              </h2>
              <p className="mt-4 text-muted-foreground">
                O JurisMind não depende apenas da memória geral de um modelo de IA. A plataforma
                localiza, combina e prioriza informações existentes nos documentos selecionados
                antes de construir a resposta.
              </p>
              <p className="mt-3 text-sm text-foreground/80">
                <strong className="font-semibold">RAG</strong> é a tecnologia que permite à
                inteligência artificial consultar uma base documental antes de responder.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {RAG_STEPS.map((s) => (
                <div key={s.n} className="rounded-2xl border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <IconBox icon={s.icon} size="md" />
                    <span className="font-heading text-sm font-bold text-muted-foreground">
                      {s.n}
                    </span>
                  </div>
                  <h3 className="mt-4 font-heading text-base font-bold uppercase tracking-wide text-foreground">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEMONSTRAÇÃO */}
        <section id="evidencia" className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Da pergunta à evidência documental.
              </h2>
              <p className="mt-4 text-muted-foreground">
                O advogado não recebe apenas um texto produzido por IA. Recebe uma análise
                relacionada ao acervo documental selecionado para aquele caso.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-foreground/90">
                {[
                  "Pesquisa nos documentos vinculados ao caso.",
                  "Recuperação dos trechos mais relevantes.",
                  "Identificação dos documentos relacionados.",
                  "Organização da resposta a partir do contexto recuperado.",
                  "Conferência da base documental utilizada pelo advogado.",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Pergunta
                </p>
                <p className="mt-1 font-heading text-base font-bold text-foreground">
                  Quais justificativas foram apresentadas para o atraso da obra?
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { t: "Busca semântica", d: "significado da pergunta" },
                  { t: "Busca textual", d: "termos em português" },
                  { t: "Fusão e reranqueamento", d: "prioriza trechos" },
                ].map((c) => (
                  <div key={c.t} className="rounded-xl border bg-background p-3">
                    <p className="text-xs font-semibold text-foreground">{c.t}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{c.d}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-3">
                {[
                  {
                    doc: "Contestação",
                    tr: "“…o atraso decorreu de chuvas atípicas registradas no período…”",
                  },
                  {
                    doc: "Laudo de vistoria",
                    tr: "“…paralisação por indisponibilidade de insumos entre março e maio…”",
                  },
                  {
                    doc: "Notificação extrajudicial",
                    tr: "“…solicitação de novo cronograma apresentada pela contratada…”",
                  },
                ].map((t) => (
                  <div key={t.doc} className="rounded-xl border bg-background p-3">
                    <p className="flex items-center gap-2 text-[11px] font-semibold text-accent">
                      <FileText className="h-3 w-3" />
                      {t.doc} · trecho recuperado
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.tr}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                  Resposta organizada
                </p>
                <p className="mt-1 text-sm text-foreground/90">
                  Análise construída a partir dos trechos acima, com os documentos relacionados
                  disponíveis para conferência e reutilização na produção jurídica.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* MEMÓRIA DO ESCRITÓRIO */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                O conhecimento deixa de ficar preso em arquivos e conversas.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Casos, documentos e análises passam a compor uma estrutura de conhecimento que pode
                ser consultada e utilizada no trabalho jurídico, respeitando os acessos definidos na
                plataforma.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Reaproveitamento do conhecimento documental.",
                "Redução do tempo gasto procurando informações.",
                "Maior consistência na análise.",
                "Continuidade do trabalho entre profissionais.",
                "Organização do histórico de cada caso.",
              ].map((b) => (
                <div key={b} className="rounded-2xl border bg-card p-4 text-sm text-foreground/90">
                  <Check className="mb-2 h-4 w-4 text-accent" />
                  {b}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TECNOLOGIA DE PONTA */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Tecnologia avançada, aplicada ao trabalho jurídico real.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TECH_CARDS.map((c) => (
              <div key={c.t} className="rounded-2xl border bg-card p-5">
                <IconBox icon={c.icon} size="md" />
                <h3 className="mt-4 font-heading text-base font-bold uppercase tracking-wide text-foreground">
                  {c.t}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PLATAFORMA */}
        <section id="plataforma" className="border-y bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                Inteligência documental conectada à operação do escritório.
              </h2>
              <p className="mt-4 text-primary-foreground/80">
                O diferencial não termina na resposta da IA. A inteligência documental se conecta à
                gestão de casos, aos documentos, à produção jurídica, aos pareceres, às propostas
                comerciais, às tarefas, à agenda, às publicações, à equipe e ao controle de consumo
                e custos de IA.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {LAYERS.map((l) => {
                const Icon = l.icon;
                return (
                  <div
                    key={l.t}
                    className="rounded-2xl border border-primary-foreground/15 bg-primary/40 p-6"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 font-heading text-lg font-bold uppercase tracking-wide">
                      {l.t}
                    </h3>
                    <p className="mt-2 text-sm text-primary-foreground/75">{l.d}</p>
                    <ul className="mt-4 space-y-2 text-sm text-primary-foreground/85">
                      {l.items.map((i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          {i}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <p className="mt-8 text-center text-xs text-primary-foreground/60">
              O módulo de marketing jurídico está disponível como funcionalidade complementar.
            </p>
          </div>
        </section>

        {/* GOVERNANÇA */}
        <section id="governanca" className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                <ShieldCheck className="h-3.5 w-3.5" />
                Governança
              </div>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                A adoção da IA sob o controle do escritório.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Utilizar inteligência artificial profissionalmente exige mais do que acesso a um
                chatbot. O escritório precisa compreender como a tecnologia está sendo utilizada,
                por quem e com qual impacto operacional.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Users, t: "Usuários e permissões" },
                { icon: Gauge, t: "Consumo por usuário" },
                { icon: Workflow, t: "Modelos utilizados" },
                { icon: Layers, t: "Tokens processados" },
                { icon: Scale, t: "Custos estimados" },
                { icon: ShieldCheck, t: "Orçamento mensal" },
                { icon: ListChecks, t: "Histórico de uso da IA" },
              ].map((g) => {
                const Icon = g.icon;
                return (
                  <div
                    key={g.t}
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm font-medium text-foreground"
                  >
                    <Icon className="h-4 w-4 text-accent" />
                    {g.t}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* TESTE GRATUITO */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Experimente a diferença entre conversar com uma IA e trabalhar com uma inteligência
              jurídica.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Durante 30 dias, utilize o JurisMind para organizar um caso, incluir documentos, fazer
              consultas sobre o conteúdo e conhecer os recursos de produção, operação e governança.
            </p>
            <Button size="lg" asChild className="mt-8">
              <Link to={primaryTo}>
                {user ? "Abrir painel" : "Começar meu teste gratuito"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-4 text-sm text-muted-foreground">
              30 dias para avaliar o JurisMind no contexto real do seu escritório.
            </p>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Os modelos de IA são o começo. O diferencial está em como o escritório os utiliza.
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              Transforme documentos, casos e conhecimento jurídico em uma inteligência organizada,
              consultável e integrada ao trabalho da equipe.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                asChild
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Link to={primaryTo}>
                  {user ? "Abrir painel" : "Testar grátis por 30 dias"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link to="/entrar">Entrar na plataforma</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} B2B | JurisMind AI. A camada de inteligência jurídica do seu
          escritório.
        </div>
      </footer>
    </div>
  );
}
