import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  MessageSquare,
  Library,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";

const TRIAL_SEARCH = { modo: "cadastro", origem: "trial30" } as const;

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "JurisMind AI — Inteligência jurídica sobre os documentos do seu caso" },
      {
        name: "description",
        content:
          "O JurisMind consulta os documentos de cada caso antes de responder, conectando inteligência artificial, produção jurídica e gestão do escritório. Teste grátis por 30 dias.",
      },
      {
        property: "og:title",
        content: "JurisMind AI — Inteligência jurídica sobre os documentos do seu caso",
      },
      {
        property: "og:description",
        content:
          "Mais contexto para a IA. Mais controle para o advogado. O JurisMind consulta os documentos do caso antes de responder.",
      },
      { property: "og:url", content: "https://b2bjurismind.lovable.app/" },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "JurisMind AI — Inteligência jurídica sobre seus documentos",
      },
      {
        name: "twitter:description",
        content:
          "O JurisMind localiza os trechos relevantes nos documentos do caso antes de a IA responder.",
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

const FLOW = [
  {
    icon: Library,
    n: "01",
    t: "Documentos do caso",
    d: "Contratos, petições, laudos, pareceres e demais documentos são reunidos no contexto correto.",
  },
  {
    icon: MessageSquare,
    n: "02",
    t: "Pergunta do advogado",
    d: "O advogado pergunta o que precisa localizar, compreender ou analisar.",
  },
  {
    icon: Search,
    n: "03",
    t: "Busca dos trechos relevantes",
    d: "O JurisMind procura nos documentos os conteúdos mais relacionados à pergunta.",
  },
  {
    icon: FileSearch,
    n: "04",
    t: "Resposta com base documental",
    d: "A IA recebe os trechos encontrados e elabora uma resposta que pode ser conferida pelo advogado.",
  },
];

const TECH = [
  {
    icon: Sparkles,
    t: "Busca por significado",
    d: "Encontra conteúdos relacionados à ideia da pergunta, mesmo quando utilizam palavras diferentes.",
  },
  {
    icon: BookOpen,
    t: "Busca textual em português",
    d: "Identifica termos, nomes, expressões e referências específicas.",
  },
  {
    icon: Layers,
    t: "Combinação dos resultados",
    d: "Reúne os diferentes resultados e prioriza os trechos mais relacionados.",
  },
  {
    icon: Workflow,
    t: "Reavaliação do contexto",
    d: "Nos modos avançados, a pergunta e os resultados podem ser refinados antes da resposta.",
  },
];

const BENEFITS = [
  {
    icon: Search,
    t: "Encontre mais rápido",
    d: "Localize informações relevantes sem pesquisar manualmente documento por documento.",
  },
  {
    icon: FileText,
    t: "Analise com mais contexto",
    d: "Utilize o conteúdo do próprio caso na preparação de análises e minutas.",
  },
  {
    icon: Library,
    t: "Preserve o conhecimento",
    d: "Mantenha documentos e informações organizados para continuidade do trabalho da equipe.",
  },
  {
    icon: Gauge,
    t: "Adote IA com controle",
    d: "Acompanhe usuários, modelos, consumo e custos estimados.",
  },
];

const LAYERS = [
  {
    icon: Sparkles,
    t: "Inteligência",
    d: "Consulta documental por caso, análise e produção jurídica.",
  },
  {
    icon: Workflow,
    t: "Operação",
    d: "Casos, documentos, tarefas, agenda, propostas e publicações.",
  },
  {
    icon: ShieldCheck,
    t: "Governança",
    d: "Usuários, permissões, modelos, consumo e custos estimados.",
  },
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
      <a href="#como-funciona">Ver como funciona</a>
    </Button>
  );
}

/**
 * Demonstração pública com casos FICTÍCIOS.
 * Cada resposta traz referências [F1]/[F2] ligadas ao trecho de origem,
 * que é a forma como o produto entrega rastreabilidade.
 */
const DEMOS = [
  {
    id: "civel",
    label: "Cível",
    docs: ["Contrato de prestação de serviços", "Notificação extrajudicial", "Contestação"],
    question: "O contrato permite a rescisão sem multa? Em que prazo?",
    excerpts: [
      {
        ref: "F1",
        doc: "Contrato de prestação de serviços",
        where: "p. 7 · Cláusula 12.2",
        text: "“Qualquer das partes poderá rescindir o presente contrato imotivadamente, mediante aviso prévio escrito de 60 (sessenta) dias, hipótese em que não haverá incidência de multa.”",
      },
      {
        ref: "F2",
        doc: "Notificação extrajudicial",
        where: "p. 1",
        text: "“Comunicamos a rescisão do contrato com efeitos imediatos, a partir do recebimento desta notificação.”",
      },
    ],
    answer: [
      "Sim, a rescisão sem multa é possível, mas depende de aviso prévio escrito de 60 dias [F1].",
      "A notificação enviada declarou efeitos imediatos [F2], o que não observa esse prazo. Na prática, isso abre discussão sobre indenização equivalente ao período de aviso não cumprido.",
    ],
    caveat:
      "O acervo não traz comprovante de recebimento da notificação; a data de início do prazo ainda precisa ser confirmada.",
  },
  {
    id: "trabalhista",
    label: "Trabalhista",
    docs: ["Cartões de ponto", "Contrato de trabalho", "Recibos de pagamento"],
    question: "Há registro de horas extras não pagas no período?",
    excerpts: [
      {
        ref: "F1",
        doc: "Cartões de ponto",
        where: "planilha Março/2024 · linhas 12-38",
        text: "“Jornada registrada: 09h00 às 19h40, com intervalo de 30 minutos, em 14 dias do mês.”",
      },
      {
        ref: "F2",
        doc: "Recibos de pagamento",
        where: "p. 2 · verba 0031",
        text: "“Horas extras 50%: 6,00 horas.”",
      },
    ],
    answer: [
      "Os cartões de ponto indicam jornada média superior à contratual em 14 dias do mês [F1].",
      "O recibo do mesmo período remunera apenas 6 horas extras [F2], abaixo do total registrado. Há, portanto, diferença aparente a apurar.",
    ],
    caveat:
      "Faltam no acervo os cartões de abril e maio; o cálculo consolidado do período depende desses documentos.",
  },
  {
    id: "empresarial",
    label: "Empresarial",
    docs: ["Acordo de sócios", "Ata de reunião", "Estatuto social"],
    question: "A venda de quotas a terceiro exige aprovação dos demais sócios?",
    excerpts: [
      {
        ref: "F1",
        doc: "Acordo de sócios",
        where: "p. 4 · Cláusula 8",
        text: "“A transferência de quotas a terceiros fica condicionada ao direito de preferência dos demais sócios, exercível em 30 dias.”",
      },
      {
        ref: "F2",
        doc: "Ata de reunião",
        where: "p. 2",
        text: "“Os sócios deliberaram, por unanimidade, dispensar a preferência na operação em análise.”",
      },
    ],
    answer: [
      "Como regra, sim: a venda a terceiro depende do direito de preferência dos demais sócios, com prazo de 30 dias [F1].",
      "Para a operação específica tratada em reunião, houve dispensa unânime da preferência [F2], o que afasta a exigência apenas naquele caso.",
    ],
    caveat: "Casos fictícios, criados para demonstrar o formato da resposta e das referências.",
  },
] as const;

function DemoPanel() {
  const [active, setActive] = useState<(typeof DEMOS)[number]["id"]>(DEMOS[0].id);
  const demo = DEMOS.find((d) => d.id === active) ?? DEMOS[0];

  return (
    <div className="relative rounded-3xl border border-primary-foreground/25 bg-primary/40 p-4 shadow-2xl backdrop-blur sm:p-5">
      <div
        role="tablist"
        aria-label="Áreas de exemplo"
        className="grid grid-cols-3 gap-1 rounded-xl border border-primary-foreground/20 bg-primary/60 p-1"
      >
        {DEMOS.map((d) => (
          <button
            key={d.id}
            role="tab"
            type="button"
            aria-selected={active === d.id}
            onClick={() => setActive(d.id)}
            className={`rounded-lg px-2 py-2 text-sm font-semibold transition ${
              active === d.id
                ? "bg-accent text-accent-foreground"
                : "text-primary-foreground/85 hover:bg-primary-foreground/10"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-2xl border border-primary-foreground/20 bg-primary/60 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Documentos do caso
        </p>
        <ul className="mt-2 space-y-2">
          {demo.docs.map((d) => (
            <li
              key={d}
              className="flex items-center gap-2 rounded-md border border-primary-foreground/25 bg-primary/50 px-2.5 py-1.5 text-sm text-primary-foreground/90"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1 truncate">{d}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="my-2 flex justify-center">
        <ArrowDown className="h-4 w-4 text-accent" aria-hidden />
      </div>

      <div className="rounded-2xl border border-accent/50 bg-accent/15 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Pergunta</p>
        <p className="mt-1 text-base font-medium text-primary-foreground">{demo.question}</p>
      </div>

      <div className="my-2 flex justify-center">
        <ArrowDown className="h-4 w-4 text-accent" aria-hidden />
      </div>

      <div className="space-y-2">
        {demo.excerpts.map((e) => (
          <div
            key={e.ref}
            className="rounded-xl border border-primary-foreground/20 bg-primary/50 p-3"
          >
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-accent">
              <Quote className="h-3.5 w-3.5 shrink-0" aria-hidden />[{e.ref}] {e.doc}
              <span className="font-normal text-primary-foreground/70">· {e.where}</span>
            </p>
            <p className="mt-1 text-base leading-relaxed text-primary-foreground/90">{e.text}</p>
          </div>
        ))}
      </div>

      <div className="my-2 flex justify-center">
        <ArrowDown className="h-4 w-4 text-accent" aria-hidden />
      </div>

      <div className="rounded-2xl border border-primary-foreground/20 bg-primary/70 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Resposta do JurisMind
        </p>
        {demo.answer.map((paragraph) => (
          <p
            key={paragraph}
            className="mt-2 text-base leading-relaxed text-primary-foreground"
          >
            {paragraph}
          </p>
        ))}
        <p className="mt-3 border-t border-primary-foreground/20 pt-2 text-sm text-primary-foreground/80">
          <span className="font-semibold text-accent">O que falta: </span>
          {demo.caveat}
        </p>
      </div>

      <p className="mt-3 text-sm text-primary-foreground/75">
        Exemplos fictícios. As referências [F1] e [F2] apontam o trecho exato de origem — no produto,
        cada uma abre o documento na página citada.
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
            <a href="#como-funciona" className="hover:text-foreground">
              Como funciona
            </a>
            <a href="#beneficios" className="hover:text-foreground">
              Benefícios
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
                <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />A camada de
                inteligência jurídica do escritório
              </div>
              <h1 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl">
                A inteligência jurídica do seu escritório começa nos próprios documentos.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-primary-foreground/90">
                O JurisMind consulta os documentos de cada caso antes de responder, conectando
                inteligência artificial, produção jurídica e gestão do escritório.
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

            <DemoPanel />
          </div>
        </section>

        {/* 2 · FLUXO VISUAL (RAG explicado) */}
        <section id="como-funciona" className="border-b bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Antes de responder, o JurisMind consulta os documentos do caso.
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                É isso que transforma uma IA genérica em uma inteligência jurídica contextualizada.
              </p>
            </div>

            <ol className="mt-10 grid gap-4 lg:grid-cols-4">
              {FLOW.map((s) => (
                <li
                  key={s.n}
                  className="relative rounded-2xl border bg-background p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                      <s.icon className="h-4 w-4" />
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

            <div className="mt-10 rounded-2xl border border-accent/40 bg-accent/5 p-6 md:p-8">
              <p className="font-heading text-xl font-bold text-foreground">
                O nome dessa tecnologia é RAG.
              </p>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
                RAG permite que a inteligência artificial consulte uma base documental antes de
                responder. No JurisMind, essa base é formada pelos documentos selecionados para cada
                caso.
              </p>
              <p className="mt-3 text-base font-medium text-foreground">
                É como permitir que a IA abra e consulte os autos antes de responder ao advogado.
              </p>
            </div>
          </div>
        </section>

        {/* 3 · COMO FUNCIONA POR DENTRO */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Tecnologia avançada por dentro. Simplicidade para o advogado.
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Para localizar os conteúdos mais relevantes, o JurisMind combina diferentes técnicas
              de pesquisa e organização documental.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TECH.map((c) => (
              <div key={c.t} className="rounded-2xl border bg-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <c.icon className="h-4 w-4" />
                </span>
                <h3 className="mt-4 font-heading text-base font-bold text-foreground">{c.t}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{c.d}</p>
              </div>
            ))}
          </div>

          <Accordion type="single" collapsible className="mx-auto mt-8 max-w-3xl">
            <AccordionItem value="termos">
              <AccordionTrigger className="text-base">
                Termos técnicos utilizados nessa etapa
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-base leading-relaxed text-muted-foreground">
                <p>
                  <strong className="text-foreground">Busca híbrida:</strong> uso combinado da busca
                  por significado com a busca textual em português.
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
        </section>

        {/* 4 · CONTRASTE */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Por que não usar apenas uma IA genérica?
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                GPT e Gemini fornecem os modelos de inteligência artificial. O JurisMind organiza
                como essa tecnologia trabalha sobre os casos, os documentos e a operação do
                escritório.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-background p-6">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  IA genérica utilizada isoladamente
                </h3>
                <ul className="mt-5 space-y-3 text-base text-muted-foreground">
                  {[
                    "Contexto inserido manualmente.",
                    "Documentos separados da gestão do caso.",
                    "Conhecimento concentrado em conversas.",
                    "Pouca integração com a operação jurídica.",
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
                <ul className="mt-5 space-y-3 text-base text-foreground">
                  {[
                    "Contexto documental organizado por caso.",
                    "Busca automática dos trechos relevantes.",
                    "Respostas relacionadas aos documentos utilizados.",
                    "Inteligência integrada à produção e à gestão do escritório.",
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
          </div>
        </section>

        {/* 5 · MATERIAIS PRODUZIDOS (demonstração visual) */}
        <section id="materiais" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Veja o que o JurisMind entrega.
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              Análises com fontes, minutas editáveis, planilhas e apresentações — prontas para
              revisar e baixar.
            </p>
          </div>
          <div className="mt-8">
            <OutputShowcase />
          </div>
        </section>


        {/* 6 · PLATAFORMA */}
        <section id="plataforma" className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Inteligência documental conectada à operação do escritório.
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {LAYERS.map((l) => (
                <div key={l.t} className="rounded-2xl border bg-background p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <l.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{l.t}</h3>
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">{l.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7 · CONFIANÇA */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Controle profissional para a utilização da IA.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                O escritório acompanha quem utiliza os recursos de inteligência artificial, os
                modelos acionados, o consumo registrado e os custos estimados.
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
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 text-base font-medium text-foreground"
                >
                  <i.icon className="h-4 w-4 shrink-0 text-accent" />
                  {i.t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8 · TESTE GRATUITO / CONTINUIDADE */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            {user ? (
              <>
                <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  Continue seu trabalho no JurisMind.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
                  Acesse seus casos, documentos e recursos de inteligência jurídica.
                </p>
                <div className="mt-8 flex justify-center">
                  <OpenDashboardButton className="bg-accent text-accent-foreground hover:bg-accent/90" />
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  Experimente o JurisMind em um caso real do seu escritório.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
                  Crie sua conta, organize um caso, inclua documentos e conheça durante 30 dias a
                  diferença entre conversar com uma IA e trabalhar com inteligência jurídica
                  contextualizada.
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
              Inteligência jurídica construída sobre os documentos de cada caso.
            </p>
            <p className="mt-3 text-base text-muted-foreground">
              Uma solução B2B Consulting.
            </p>
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
                <a href="#como-funciona" className="hover:text-foreground">
                  Como funciona
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
