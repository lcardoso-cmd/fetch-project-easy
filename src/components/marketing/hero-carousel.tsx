import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Gauge,
  Layers,
  Pause,
  Play,
  Presentation,
  Quote,
  Scale,
  ShieldCheck,
  Workflow,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { cn } from "@/lib/utils";

const INTERVAL_MS = 6000;

interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  visual: ReactNode;
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-primary-foreground/20 bg-primary/60 p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Slide 1 — console do caso (mesmo conteúdo fictício determinístico). */
function CaseConsoleVisual() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading text-base font-bold text-primary-foreground">
          Reclamação Trabalhista — Maria Silva
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/50 bg-accent/15 px-2.5 py-1 text-sm font-semibold text-accent">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Fontes prontas
        </span>
      </div>
      <ul className="space-y-1.5">
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
      <div className="flex justify-center">
        <ArrowDown className="h-4 w-4 text-accent" aria-hidden />
      </div>
      <Panel className="border-accent/50 bg-accent/15">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Comando do advogado
        </p>
        <p className="mt-1 text-base font-medium text-primary-foreground">
          “Compare os cartões de ponto com os recibos e mostre a diferença.”
        </p>
      </Panel>
      <Panel className="bg-primary/70">
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
            <p key={e.r} className="flex items-start gap-2 text-sm text-primary-foreground/85">
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-semibold text-accent">[{e.r}]</span> {e.d}
              </span>
            </p>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function FlowVisual() {
  const steps = [
    { t: "Localizar", d: "o trecho exato nos autos" },
    { t: "Organizar", d: "prova, prazos e responsáveis" },
    { t: "Produzir", d: "peça, planilha e apresentação" },
    { t: "Apresentar", d: "ao cliente e ao juízo" },
    { t: "Conduzir", d: "tarefas e prazos da equipe" },
  ];
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li
          key={s.t}
          className="flex items-center gap-3 rounded-xl border border-primary-foreground/20 bg-primary/60 px-3 py-2.5"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-sm font-bold text-accent">
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-base font-semibold text-primary-foreground">
              {s.t}
            </span>
            <span className="block text-sm text-primary-foreground/80">{s.d}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function DeliverablesVisual() {
  const items = [
    { icon: Layers, t: "Análise", d: "com o trecho citado" },
    { icon: FileText, t: "Peça jurídica", d: "pronta em Word" },
    { icon: FileSpreadsheet, t: "Planilha", d: "cálculos em Excel" },
    { icon: Presentation, t: "Apresentação", d: "slides 16:9" },
  ];
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map((it) => (
        <div
          key={it.t}
          className="rounded-xl border border-primary-foreground/20 bg-primary/60 p-3.5"
        >
          <it.icon className="h-5 w-5 text-accent" aria-hidden />
          <p className="mt-2 font-heading text-base font-semibold text-primary-foreground">
            {it.t}
          </p>
          <p className="text-sm text-primary-foreground/80">{it.d}</p>
        </div>
      ))}
    </div>
  );
}

function IntelligenceVisual() {
  return (
    <div className="space-y-2.5">
      <Panel>
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">Pergunta</p>
        <p className="mt-1 text-base text-primary-foreground">
          “Existe cláusula de exclusividade no contrato?”
        </p>
      </Panel>
      <Panel className="bg-primary/70">
        <p className="text-base leading-relaxed text-primary-foreground">
          Sim. A cláusula 8.2 veda a prestação de serviços a concorrentes durante a vigência [F1].
        </p>
        <p className="mt-3 flex items-start gap-2 border-t border-primary-foreground/20 pt-2 text-sm text-primary-foreground/85">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
          <span>
            <span className="font-semibold text-accent">[F1]</span> Contrato de prestação de
            serviços · p. 7, cláusula 8.2
          </span>
        </p>
      </Panel>
      <p className="text-sm text-primary-foreground/80">
        Cada resposta abre o documento na página citada. Sem fonte, sem afirmação.
      </p>
    </div>
  );
}

function JurisprudenceVisual() {
  const sources = ["stj.jus.br", "tst.jus.br", "stf.jus.br"];
  return (
    <div className="space-y-2.5">
      <Panel className="bg-primary/70">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
          <Scale className="h-4 w-4" aria-hidden />
          Jurisprudência oficial
        </p>
        <p className="mt-2 text-base leading-relaxed text-primary-foreground">
          Entendimento consolidado sobre horas extras e cartões de ponto britânicos [J1], aplicado
          ao contexto dos autos.
        </p>
      </Panel>
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <span
            key={s}
            className="rounded-full border border-accent/50 bg-accent/15 px-3 py-1 text-sm font-semibold text-accent"
          >
            {s}
          </span>
        ))}
      </div>
      <p className="text-sm text-primary-foreground/80">
        Referências dos autos <span className="font-semibold text-accent">[F]</span> e de tribunais{" "}
        <span className="font-semibold text-accent">[J]</span> sempre separadas.
      </p>
    </div>
  );
}

function GovernanceVisual() {
  const items = [
    { icon: ShieldCheck, t: "Acesso por caso", d: "quem vê o quê é definido pelo escritório" },
    { icon: Gauge, t: "Consumo visível", d: "custo de IA por organização e por usuário" },
    { icon: Workflow, t: "Trilha de auditoria", d: "quem pediu, quando e com qual fonte" },
  ];
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li
          key={it.t}
          className="flex items-start gap-3 rounded-xl border border-primary-foreground/20 bg-primary/60 p-3.5"
        >
          <it.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <span>
            <span className="block font-heading text-base font-semibold text-primary-foreground">
              {it.t}
            </span>
            <span className="block text-sm text-primary-foreground/80">{it.d}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const SLIDES: Slide[] = [
  {
    id: "console",
    eyebrow: "Console do caso",
    title: "Uma pergunta, uma resposta com fonte",
    description: "Os documentos do caso respondem — com o trecho exato que sustenta a afirmação.",
    href: "#entregas",
    visual: <CaseConsoleVisual />,
  },
  {
    id: "fluxo",
    eyebrow: "Fluxo único",
    title: "Localizar, organizar, produzir, apresentar, conduzir",
    description: "Todo o trabalho do caso em uma sequência só, sem recomeçar a conversa.",
    href: "#fluxo",
    visual: <FlowVisual />,
  },
  {
    id: "entregas",
    eyebrow: "Entregas reais",
    title: "Análise, peça, planilha e apresentação",
    description: "Arquivos prontos para baixar em Word, Excel e PowerPoint.",
    href: "#entregas",
    visual: <DeliverablesVisual />,
  },
  {
    id: "inteligencia",
    eyebrow: "Inteligência sobre os autos",
    title: "Respostas ancoradas nos seus documentos",
    description: "Cada afirmação aponta o documento e a página de origem.",
    href: "#inteligencia",
    visual: <IntelligenceVisual />,
  },
  {
    id: "jurisprudencia",
    eyebrow: "Fontes oficiais",
    title: "Jurisprudência de tribunais, não de palpite",
    description: "Consulta em domínios oficiais, com referência sempre identificada.",
    href: "#jurisprudencia",
    visual: <JurisprudenceVisual />,
  },
  {
    id: "governanca",
    eyebrow: "Governança",
    title: "Controle, custo e rastreabilidade",
    description: "O escritório enxerga quem usou, para quê e quanto custou.",
    href: "#plataforma",
    visual: <GovernanceVisual />,
  },
];

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const startedRef = useRef<number>(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setPlaying(false);
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex(((i % SLIDES.length) + SLIDES.length) % SLIDES.length);
    setProgress(0);
    startedRef.current = Date.now();
  }, []);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (!playing) return;
    startedRef.current = Date.now() - progress * INTERVAL_MS;
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedRef.current;
      if (elapsed >= INTERVAL_MS) {
        setIndex((i) => (i + 1) % SLIDES.length);
        setProgress(0);
        startedRef.current = Date.now();
      } else {
        setProgress(elapsed / INTERVAL_MS);
      }
    }, 80);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index]);

  const current = SLIDES[index]!;
  const label = useMemo(
    () => `Slide ${index + 1} de ${SLIDES.length}: ${current.title}`,
    [index, current.title],
  );

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Destaques do JurisMind"
      className="relative rounded-3xl border border-primary-foreground/25 bg-primary/40 p-4 shadow-2xl backdrop-blur sm:p-5"
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
      onFocusCapture={() => setPlaying(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          next();
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          prev();
        }
      }}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
          <JurisMindMark size={16} context={JURISMIND_CONTEXT.inlineDark} />
          {current.eyebrow}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Destaque anterior"
            onClick={prev}
            className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={playing ? "Pausar carrossel" : "Retomar carrossel"}
            aria-pressed={!playing}
            onClick={() => setPlaying((p) => !p)}
            className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
          >
            {playing ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Próximo destaque"
            onClick={next}
            className="h-9 w-9 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-primary-foreground/15">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div aria-live="polite" className="sr-only">
        {label}
      </div>

      <div className="relative mt-3 min-h-[600px] sm:min-h-[620px]">
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${SLIDES.length}: ${s.title}`}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-all duration-500 ease-out",
              i === index
                ? "translate-x-0 opacity-100"
                : "pointer-events-none translate-x-2 opacity-0",
            )}
          >
            <a
              href={s.href}
              className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
              tabIndex={i === index ? 0 : -1}
            >
              <h2 className="font-heading text-xl font-bold leading-tight text-primary-foreground">
                {s.title}
              </h2>
              <p className="mt-1 text-base text-primary-foreground/85">{s.description}</p>
            </a>
            <div className="mt-3">{s.visual}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Ir para o destaque ${i + 1}: ${s.title}`}
            aria-current={i === index}
            className={cn(
              "h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              i === index ? "w-6 bg-accent" : "w-2.5 bg-primary-foreground/35",
            )}
          />
        ))}
      </div>
    </section>
  );
}
