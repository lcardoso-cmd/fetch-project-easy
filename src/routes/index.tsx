import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Gauge,
  Users,
  Check,
  X,
  Quote,
  BookOpen,
  Scale,
  CalendarClock,
  FileSpreadsheet,
  Presentation,
  CheckCircle2,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { OutputShowcase } from "@/components/marketing/output-showcase";
import { useAuth } from "@/hooks/use-auth";

const TRIAL_SEARCH = { modo: "cadastro", origem: "trial30" } as const;

const SITE = "https://jurismind.b2bconsulting.com.br/";
const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp";
const TITLE = "JurisMind AI — A inteligência operacional de cada caso";
const DESCRIPTION =
  "O JurisMind lê os documentos do caso, localiza o trecho exato, produz peça, planilha e apresentação e conduz o trabalho da equipe. Teste grátis por 30 dias.";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: SITE },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "JurisMind AI",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          url: SITE,
          description: DESCRIPTION,
          publisher: { "@type": "Organization", name: "B2B Consulting" },
        }),
      },
    ],
  }),
});

/** Fluxo único do trabalho no caso — cada etapa existe no produto. */
const FLOW = [
  {
    icon: Search,
    n: "01",
    t: "Localizar",
    d: "O JurisMind lê os documentos do caso e aponta o trecho exato, com página e origem.",
  },
  {
    icon: Layers,
    n: "02",
    t: "Organizar",
    d: "Datas, valores e obrigações viram apuração comparável em planilha.",
  },
  {
    icon: FileText,
    n: "03",
    t: "Produzir",
    d: "Peças e documentos são redigidos com base nos autos e abertos no editor.",
  },
  {
    icon: Presentation,
    n: "04",
    t: "Apresentar",
    d: "O caso é resumido em apresentação executiva para cliente e sócios.",
  },
  {
    icon: CalendarClock,
    n: "05",
    t: "Conduzir",
    d: "Tarefas, prazos e agenda ficam vinculados ao mesmo caso e à equipe.",
  },
];

const TECH = [
  {
    icon: Sparkles,
    t: "Busca por significado",
    d: "Encontra conteúdos relacionados à ideia da pergunta, mesmo quando usam palavras diferentes.",
  },
  {
    icon: BookOpen,
    t: "Busca textual em português",
    d: "Identifica termos, nomes, valores, expressões e referências específicas.",
  },
  {
    icon: Layers,
    t: "Combinação dos resultados",
    d: "Reúne os resultados das duas buscas e prioriza os trechos mais relacionados.",
  },
  {
    icon: Workflow,
    t: "Reavaliação do contexto",
    d: "Nos modos avançados, a pergunta e os trechos podem ser refinados antes da resposta.",
  },
];

const LAYERS = [
  {
    icon: Sparkles,
    t: "Inteligência",
    d: "Consulta documental por caso, análise, produção jurídica e pesquisa de jurisprudência.",
  },
  {
    icon: Workflow,
    t: "Operação",
    d: "Casos, documentos, tarefas, agenda, propostas, comunicação interna e publicações.",
  },
  {
    icon: ShieldCheck,
    t: "Governança",
    d: "Usuários, permissões, modelos, histórico de uso, consumo e custos estimados.",
  },
];

/** Entregáveis reais do produto — cada um existe hoje. */
const DELIVERABLES = [
  { icon: FileSearch, t: "Análise com fontes", d: "Resposta ligada ao trecho de origem no documento." },
  { icon: FileText, t: "Peça jurídica", d: "Minuta editável, exportável em Word e PDF." },
  { icon: FileSpreadsheet, t: "Planilha", d: "Apuração comparativa exportável em Excel." },
  { icon: Presentation, t: "Apresentação", d: "Deck executivo do caso exportável em PowerPoint." },
  { icon: CalendarClock, t: "Tarefa e prazo", d: "Ação vinculada ao caso, à agenda e ao responsável." },
  { icon: Scale, t: "Jurisprudência", d: "Precedentes de sites oficiais de tribunais, com link." },
];

function LoginButton({
  size = "default",
  className,
  variant = "ghost",
  label = "Entrar",
}: {
  size?: "default" | "lg";
  className?: string;
  variant?: "ghost" | "outline" | "default";
  label?: string;
}) {
  return (
    <Button size={size} variant={variant} asChild className={className}>
      <Link to="/entrar">{label}</Link>
    </Button>
  );
}

function TrialSignupButton({
  size = "lg",
  className,
  label = "Testar grátis por 30 dias",
}: {
  size?: "default" | "lg";
  className?: string;
  label?: string;
}) {
  return (
    <Button size={size} asChild className={className}>
      <Link to="/entrar" search={TRIAL_SEARCH}>
        {label}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  );
}

function OpenDashboardButton({
  size = "lg",
  className,
  label = "Abrir meu painel",
}: {
  size?: "default" | "lg";
  className?: string;
  label?: string;
}) {
  return (
    <Button size={size} asChild className={className}>
      <Link to="/painel">
        {label}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  );
}

function LearnMoreButton({ className }: { className?: string }) {
  return (
    <Button size="lg" variant="outline" asChild className={className}>
      <a href="#entregas">Ver o que o JurisMind entrega</a>
    </Button>
  );
}

/**
 * Demonstração compacta do MESMO caso usado em toda a página.
 * Dados FICTÍCIOS e determinísticos: documentos → comando → resposta com [F].
 */
function CaseConsole() {
  return (
    <div className="relative rounded-3xl border border-primary-foreground/25 bg-primary/40 p-4 shadow-2xl backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading text-base font-bold text-primary-foreground">
          Reclamação Trabalhista — Maria Silva
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/15 px-2.5 py-1 text-sm font-semibold text-accent">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Fontes prontas
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {["Cartões de ponto", "Recibos de pagamento", "Contrato de trabalho"].map((d) => (
          <li
            key={d}
            className="flex items-center gap-2 rounded-md border border-primary-foreground/25 bg-primary/55 px-2.5 py-1.5 text-base text-primary-foreground/90"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d}</span>
          </li>
        ))}
      </ul>

      <div className="my-2 flex justify-center">
        <ArrowDown className="h-4 w-4 text-accent" aria-hidden />
      </div>

      <div className="rounded-2xl border border-accent/50 bg-accent/15 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Comando do advogado
        </p>
        <p className="mt-1 text-base font-medium text-primary-foreground">
          “Compare os cartões de ponto com os recibos e mostre a diferença.”
        </p>
      </div>

      <div className="my-2 flex justify-center">
        <ArrowDown className="h-4 w-4 text-accent" aria-hidden />
      </div>

      <div className="rounded-2xl border border-primary-foreground/20 bg-primary/70 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Resposta do JurisMind
        </p>
        <p className="mt-2 text-base leading-relaxed text-primary-foreground">
          Os cartões registram <strong>67h30</strong> de jornada extraordinária entre janeiro e
          março [F1]; os recibos remuneram <strong>20h00</strong> [F2]. Diferença aparente de{" "}
          <strong>47h30</strong>.
        </p>
        <div className="mt-3 space-y-1.5">
          {[
            { r: "F1", d: "Cartões de ponto · Março/2024, linhas 12–38" },
            { r: "F2", d: "Recibos de pagamento · p. 2, verba 0031" },
          ].map((e) => (
            <p
              key={e.r}
              className="flex items-start gap-2 text-sm text-primary-foreground/85"
            >
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-semibold text-accent">[{e.r}]</span> {e.d}
              </span>
            </p>
          ))}
        </div>
        <p className="mt-3 border-t border-primary-foreground/20 pt-2 text-sm text-primary-foreground/80">
          <span className="font-semibold text-accent">O que falta: </span>
          os cartões de abril e maio não estão no acervo.
        </p>
      </div>

      <p className="mt-3 text-sm text-primary-foreground/75">
        Exemplo fictício. No produto, cada referência abre o documento na página citada — e o mesmo
        caso segue em peça, planilha, apresentação e tarefa.
      </p>
    </div>
  );
}

function LandingPage() {
  const { user } = useAuth();

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
          <nav className="hidden items-center gap-6 text-base text-muted-foreground md:flex">
            <a href="#fluxo" className="hover:text-foreground">
              Fluxo do caso
            </a>
            <a href="#entregas" className="hover:text-foreground">
              Entregas
            </a>
            <a href="#inteligencia" className="hover:text-foreground">
              Inteligência
            </a>
            <a href="#jurisprudencia" className="hover:text-foreground">
              Jurisprudência
            </a>
            <a href="#plataforma" className="hover:text-foreground">
              Plataforma
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <OpenDashboardButton size="default" label="Abrir meu painel" />
            ) : (
              <>
                <LoginButton />
                <TrialSignupButton size="default" />
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* 1 · HERO */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 25%, oklch(0.86 0.16 195) 0, transparent 42%), radial-gradient(circle at 85% 75%, oklch(0.65 0.16 220) 0, transparent 45%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-20">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-sm font-semibold text-accent">
                <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />A inteligência
                operacional de cada caso
              </div>
              <h1 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl">
                Do documento à entrega: um só caso, um só fluxo de trabalho.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-primary-foreground/90">
                O JurisMind lê os documentos do caso, mostra o trecho exato que sustenta cada
                afirmação e transforma isso em peça, planilha, apresentação e tarefa da equipe — sem
                recomeçar a conversa a cada pedido.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {user ? (
                  <OpenDashboardButton className="bg-accent text-accent-foreground hover:bg-accent/90" />
                ) : (
                  <TrialSignupButton className="bg-accent text-accent-foreground hover:bg-accent/90" />
                )}
                <LearnMoreButton className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" />
              </div>

              <p className="mt-6 text-base font-medium text-accent">
                Mais contexto para a IA. Mais controle para o advogado.
              </p>
            </div>

            <HeroCarousel />
          </div>
        </section>

        {/* 2 · FLUXO ÚNICO */}
        <section id="fluxo" className="border-b bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                O mesmo caso atravessa cinco etapas, sem trocar de ferramenta.
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Localizar, organizar, produzir, apresentar e conduzir acontecem sobre a mesma base
                documental, dentro do caso.
              </p>
            </div>

            <ol className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {FLOW.map((s) => (
                <li key={s.n} className="rounded-2xl border bg-background p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground dark:text-accent">
                      <s.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="font-heading text-sm font-bold text-muted-foreground">
                      {s.n}
                    </span>
                  </div>
                  <h3 className="mt-4 font-heading text-base font-bold text-foreground">{s.t}</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3 · DEMONSTRAÇÃO DAS ENTREGAS */}
        <section id="entregas" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Escolha uma etapa e veja o resultado.
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Um único caso, cinco entregas. Análise com fontes, planilha, peça, apresentação e a
              tarefa que mantém o trabalho andando.
            </p>
          </div>
          <div className="mt-8">
            <OutputShowcase />
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DELIVERABLES.map((d) => (
              <div key={d.t} className="rounded-2xl border bg-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <d.icon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-foreground">{d.t}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{d.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4 · INTELIGÊNCIA (RAG explicado pelo resultado) */}
        <section id="inteligencia" className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Por que a resposta vem com página e origem.
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Antes de escrever, o JurisMind procura nos documentos do caso os trechos que
                respondem ao pedido — e devolve a referência junto com a resposta.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {TECH.map((c) => (
                <div key={c.t} className="rounded-2xl border bg-background p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <c.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-foreground">{c.t}</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{c.d}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
              <p className="font-heading text-xl font-bold text-foreground">
                O nome dessa tecnologia é RAG.
              </p>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
                RAG permite que a inteligência artificial consulte uma base documental antes de
                responder. No JurisMind, essa base é formada pelos documentos selecionados para cada
                caso — inclusive arquivos longos, digitalizados ou com texto em imagem.
              </p>
              <p className="mt-3 text-base font-medium text-foreground">
                É como permitir que a IA abra e consulte os autos antes de responder ao advogado.
              </p>
            </div>

            <Accordion type="single" collapsible className="mx-auto mt-8 max-w-3xl">
              <AccordionItem value="termos">
                <AccordionTrigger className="text-base">
                  Termos técnicos utilizados nessa etapa
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-base leading-relaxed text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Busca híbrida:</strong> uso combinado da
                    busca por significado com a busca textual em português.
                  </p>
                  <p>
                    <strong className="text-foreground">Fusão:</strong> união dos resultados das
                    diferentes buscas em uma única lista priorizada.
                  </p>
                  <p>
                    <strong className="text-foreground">Reranqueamento:</strong> nova classificação
                    dos trechos encontrados antes de a resposta ser gerada.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* 5 · JURISPRUDÊNCIA */}
        <section id="jurisprudencia" className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-sm font-semibold text-foreground">
                <Scale className="h-4 w-4 text-accent-foreground/90 dark:text-accent" aria-hidden />
                Pesquisa em fontes oficiais
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Jurisprudência com link do tribunal, separada da prova dos autos.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                No chat do caso, o advogado pode pedir precedentes. A pesquisa consulta apenas sites
                oficiais de tribunais (STF, STJ, TST, TSE e tribunais estaduais) e devolve tribunal,
                órgão julgador, data e link para o inteiro teor.
              </p>
              <ul className="mt-5 space-y-3 text-base text-foreground">
                {[
                  "Referências [F] são os documentos do caso; [J] são precedentes externos — nunca se misturam.",
                  "Resultados fora dos domínios oficiais são descartados.",
                  "Se a pesquisa estiver indisponível, o sistema informa em vez de inventar julgados.",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-foreground dark:text-accent">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border bg-card p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Exemplo de retorno (fictício)
              </p>
              <div className="mt-3 space-y-3">
                {[
                  {
                    ref: "J1",
                    court: "STJ",
                    panel: "Terceira Turma",
                    date: "12/03/2024",
                    title: "Responsabilidade objetiva do transportador",
                  },
                  {
                    ref: "J2",
                    court: "TST",
                    panel: "Segunda Turma",
                    date: "20/05/2024",
                    title: "Validade do controle de ponto por exceção",
                  },
                ].map((j) => (
                  <div key={j.ref} className="rounded-xl border bg-background p-3">
                    <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-foreground">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        [{j.ref}]
                      </span>
                      {j.court}
                      <span className="font-normal text-muted-foreground">
                        · {j.panel} · {j.date}
                      </span>
                    </p>
                    <p className="mt-1 text-base text-muted-foreground">{j.title}</p>
                    <p className="mt-1 text-sm font-medium text-primary">
                      Abrir no site oficial do tribunal
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Jurisprudência é apoio argumentativo e deve ser conferida no inteiro teor. Ela não
                substitui a prova dos autos.
              </p>
            </div>
          </div>
        </section>

        {/* 6 · DIFERENCIAÇÃO ESTRUTURAL */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                A diferença não é o modelo. É a estrutura em volta dele.
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                GPT e Gemini fornecem os modelos. O JurisMind define sobre quais documentos eles
                trabalham, o que produzem e como isso volta para a operação do escritório.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-background p-6">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Chat genérico usado isoladamente
                </h3>
                <ul className="mt-5 space-y-3 text-base text-muted-foreground">
                  {[
                    "Contexto colado manualmente a cada conversa.",
                    "Documentos soltos, fora da gestão do caso.",
                    "Resposta sem indicação da página de origem.",
                    "Resultado que não se transforma em tarefa, prazo ou entrega do escritório.",
                  ].map((i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <X className="h-3 w-3" aria-hidden />
                      </span>
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-accent/40 bg-accent/5 p-6 shadow-sm">
                <h3 className="font-heading text-lg font-bold text-foreground">JurisMind</h3>
                <ul className="mt-5 space-y-3 text-base text-foreground">
                  {[
                    "Base documental organizada e indexada por caso.",
                    "Busca automática dos trechos relevantes antes da resposta.",
                    "Referência ao documento e à página que sustentam cada afirmação.",
                    "Peça, planilha, apresentação, tarefa e prazo gerados no mesmo lugar.",
                  ].map((i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-foreground dark:text-accent">
                        <Check className="h-3 w-3" aria-hidden />
                      </span>
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 7 · PLATAFORMA */}
        <section id="plataforma" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Inteligência documental conectada à operação do escritório.
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {LAYERS.map((l) => (
              <div key={l.t} className="rounded-2xl border bg-card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <l.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{l.t}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{l.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 8 · GOVERNANÇA E CONFIANÇA */}
        <section className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div>
                <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  Controle profissional do uso da IA.
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  O escritório acompanha quem utiliza os recursos de inteligência artificial, os
                  modelos acionados, o consumo registrado e os custos estimados, com orçamento
                  mensal por organização.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Users, t: "Usuários e permissões" },
                  { icon: FileSearch, t: "Histórico de utilização da IA" },
                  { icon: Gauge, t: "Tokens e custos estimados" },
                  { icon: ShieldCheck, t: "Orçamento mensal" },
                ].map((i) => (
                  <div
                    key={i.t}
                    className="flex items-center gap-3 rounded-xl border bg-background p-4 text-base font-medium text-foreground"
                  >
                    <i.icon
                      className="h-4 w-4 shrink-0 text-accent-foreground/90 dark:text-accent"
                      aria-hidden
                    />
                    {i.t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 9 · TESTE GRATUITO / CONTINUIDADE */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            {user ? (
              <>
                <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  Continue seu trabalho no JurisMind.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/85">
                  Acesse seus casos, documentos e recursos de inteligência jurídica.
                </p>
                <div className="mt-8 flex justify-center">
                  <OpenDashboardButton className="bg-accent text-accent-foreground hover:bg-accent/90" />
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  Experimente em um caso real do seu escritório.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/85">
                  Crie sua conta, organize um caso, inclua os documentos e veja em 30 dias a
                  diferença entre conversar com uma IA e conduzir o caso com ela.
                </p>
                <div className="mt-8 flex justify-center">
                  <TrialSignupButton
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                    label="Começar meu teste gratuito"
                  />
                </div>
                <p className="mt-4 text-base text-primary-foreground/85">
                  Já possui uma conta?{" "}
                  <Link to="/entrar" className="font-medium underline underline-offset-4">
                    Entrar
                  </Link>
                </p>
                <p className="mt-5 text-base text-primary-foreground/85">
                  Teste gratuito por 30 dias.
                </p>
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <JurisMindMark size={26} context={JURISMIND_CONTEXT.inlineLight} />
              <span className="font-heading text-base font-bold text-foreground">JurisMind AI</span>
            </div>
            <p className="mt-3 text-base text-muted-foreground">
              A inteligência operacional de cada caso, construída sobre os documentos do escritório.
            </p>
            <p className="mt-3 text-base text-muted-foreground">Uma solução B2B Consulting.</p>
          </div>

          <nav className="text-base">
            <p className="font-heading font-bold text-foreground">Plataforma</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {user ? (
                <>
                  <li>
                    <Link to="/painel" className="hover:text-foreground">
                      Abrir painel
                    </Link>
                  </li>
                  <li>
                    <Link to="/configuracoes" className="hover:text-foreground">
                      Minha conta
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link to="/entrar" className="hover:text-foreground">
                      Entrar
                    </Link>
                  </li>
                  <li>
                    <Link to="/entrar" search={TRIAL_SEARCH} className="hover:text-foreground">
                      Criar conta
                    </Link>
                  </li>
                </>
              )}
              <li>
                <a href="#fluxo" className="hover:text-foreground">
                  Fluxo do caso
                </a>
              </li>
              <li>
                <a href="#entregas" className="hover:text-foreground">
                  Entregas
                </a>
              </li>
            </ul>
          </nav>

          <div className="text-base">
            <p className="font-heading font-bold text-foreground">Institucional</p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <Link to="/privacidade" className="hover:text-foreground">
                  Política de privacidade
                </Link>
              </li>
              <li>
                <Link to="/termos" className="hover:text-foreground">
                  Termos de uso
                </Link>
              </li>
              <li>
                <a href="mailto:contato@b2bconsulting.com.br" className="hover:text-foreground">
                  contato@b2bconsulting.com.br
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-muted-foreground">
            © {new Date().getFullYear()} B2B Consulting · JurisMind AI
          </div>
        </div>
      </footer>
    </div>
  );
}
