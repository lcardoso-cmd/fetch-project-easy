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
  href: string;
  visual: ReactNode;
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-navy-foreground/20 bg-brand-navy/60 p-4",
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
        <p className="font-heading text-base font-bold text-brand-on-navy">
          Reclamação Trabalhista — Maria Silva
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-cyan/50 bg-brand-cyan/15 px-2.5 py-1 text-sm font-semibold text-brand-cyan">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Fontes prontas
        </span>
      </div>
      <ul className="space-y-1.5">
        {["Cartões de ponto", "Recibos de pagamento", "Contrato de trabalho"].map((d) => (
          <li
            key={d}
            className="flex items-center gap-2 rounded-md border border-brand-navy-foreground/25 bg-brand-navy/55 px-2.5 py-1.5 text-base text-brand-on-navy/90"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-brand-cyan" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-center">
        <ArrowDown className="h-4 w-4 text-brand-cyan" aria-hidden />
      </div>
      <Panel className="border-brand-cyan/50 bg-brand-cyan/15">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-cyan">
          Comando do advogado
        </p>
        <p className="mt-1 text-base font-medium text-brand-on-navy">
          “Compare os cartões de ponto com os recibos e mostre a diferença.”
        </p>
      </Panel>
      <Panel className="bg-brand-navy/70">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-cyan">
          Resposta do JurisMind
        </p>
        <p className="mt-2 text-base leading-relaxed text-brand-on-navy">
          Os cartões registram <strong>67h30</strong> de jornada extraordinária entre janeiro e
          março [F1]; os recibos remuneram <strong>20h00</strong> [F2]. Diferença aparente de{" "}
          <strong>47h30</strong>.
        </p>
        <div className="mt-3 space-y-1.5">
          {[
            { r: "F1", d: "Cartões de ponto · Março/2024, linhas 12–38" },
            { r: "F2", d: "Recibos de pagamento · p. 2, verba 0031" },
          ].map((e) => (
            <p key={e.r} className="flex items-start gap-2 text-sm text-brand-on-navy/85">
              <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-cyan" aria-hidden />
              <span>
                <span className="font-semibold text-brand-cyan">[{e.r}]</span> {e.d}
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
          className="flex items-center gap-3 rounded-xl border border-brand-navy-foreground/20 bg-brand-navy/60 px-3 py-2.5"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-cyan/50 bg-brand-cyan/15 text-sm font-bold text-brand-cyan">
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block font-heading text-base font-semibold text-brand-on-navy">
              {s.t}
            </span>
            <span className="block text-sm text-brand-on-navy/80">{s.d}</span>
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
          className="rounded-xl border border-brand-navy-foreground/20 bg-brand-navy/60 p-3.5"
        >
          <it.icon className="h-5 w-5 text-brand-cyan" aria-hidden />
          <p className="mt-2 font-heading text-base font-semibold text-brand-on-navy">
            {it.t}
          </p>
          <p className="text-sm text-brand-on-navy/80">{it.d}</p>
        </div>
      ))}
    </div>
  );
}

function IntelligenceVisual() {
  return (
    <div className="space-y-2.5">
      <Panel>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-cyan">Pergunta</p>
        <p className="mt-1 text-base text-brand-on-navy">
          “Existe cláusula de exclusividade no contrato?”
        </p>
      </Panel>
      <Panel className="bg-brand-navy/70">
        <p className="text-base leading-relaxed text-brand-on-navy">
          Sim. A cláusula 8.2 veda a prestação de serviços a concorrentes durante a vigência [F1].
        </p>
        <p className="mt-3 flex items-start gap-2 border-t border-brand-navy-foreground/20 pt-2 text-sm text-brand-on-navy/85">
          <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-cyan" aria-hidden />
          <span>
            <span className="font-semibold text-brand-cyan">[F1]</span> Contrato de prestação de
            serviços · p. 7, cláusula 8.2
          </span>
        </p>
      </Panel>
      <p className="text-sm text-brand-on-navy/80">
        Cada resposta abre o documento na página citada. Sem fonte, sem afirmação.
      </p>
    </div>
  );
}

function JurisprudenceVisual() {
  const sources = ["stj.jus.br", "tst.jus.br", "stf.jus.br"];
  return (
    <div className="space-y-2.5">
      <Panel className="bg-brand-navy/70">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-cyan">
          <Scale className="h-4 w-4" aria-hidden />
          Jurisprudência oficial
        </p>
        <p className="mt-2 text-base leading-relaxed text-brand-on-navy">
          Entendimento consolidado sobre horas extras e cartões de ponto britânicos [J1], aplicado
          ao contexto dos autos.
        </p>
      </Panel>
      <div className="flex flex-wrap gap-2">
        {sources.map((s) => (
          <span
            key={s}
            className="rounded-full border border-brand-cyan/50 bg-brand-cyan/15 px-3 py-1 text-sm font-semibold text-brand-cyan"
          >
            {s}
          </span>
        ))}
      </div>
      <p className="text-sm text-brand-on-navy/80">
        Referências dos autos <span className="font-semibold text-brand-cyan">[F]</span> e de tribunais{" "}
        <span className="font-semibold text-brand-cyan">[J]</span> sempre separadas.
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
          className="flex items-start gap-3 rounded-xl border border-brand-navy-foreground/20 bg-brand-navy/60 p-3.5"
        >
          <it.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-cyan" aria-hidden />
          <span>
            <span className="block font-heading text-base font-semibold text-brand-on-navy">
              {it.t}
            </span>
            <span className="block text-sm text-brand-on-navy/80">{it.d}</span>
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
    href: "#entregas",
    visual: <CaseConsoleVisual />,
  },
  {
    id: "fluxo",
    eyebrow: "Fluxo único",
    title: "Localizar, organizar, produzir, apresentar, conduzir",
    href: "#fluxo",
    visual: <FlowVisual />,
  },
  {
    id: "entregas",
    eyebrow: "Entregas reais",
    title: "Análise, peça, planilha e apresentação",
    href: "#entregas",
    visual: <DeliverablesVisual />,
  },
  {
    id: "inteligencia",
    eyebrow: "Inteligência sobre os autos",
    title: "Respostas ancoradas nos seus documentos",
    href: "#inteligencia",
    visual: <IntelligenceVisual />,
  },
  {
    id: "jurisprudencia",
    eyebrow: "Fontes oficiais",
    title: "Jurisprudência de tribunais, não de palpite",
    href: "#jurisprudencia",
    visual: <JurisprudenceVisual />,
  },
  {
    id: "governanca",
    eyebrow: "Governança",
    title: "Controle, custo e rastreabilidade",
    href: "#plataforma",
    visual: <GovernanceVisual />,
  },
];

/**
 * Hero em tela cheia no esquema de carrossel: os visuais ocupam o fundo,
 * o texto institucional fica sobreposto no canto inferior esquerdo
 * (children), com pontos de navegação ao centro e controles no topo.
 */
export function HeroCarousel({ children }: { children?: ReactNode }) {
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
      className="relative min-h-[calc(100svh-4rem)] overflow-hidden bg-brand-navy text-brand-on-navy"
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
      {/* Slides em tela cheia — visual como fundo */}
      <div className="absolute inset-0">
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${SLIDES.length}: ${s.title}`}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-all duration-700 ease-out",
              i === index
                ? "translate-x-0 opacity-100"
                : "pointer-events-none translate-x-4 opacity-0",
            )}
          >
            {/* Brilho de marca atrás do visual */}
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 18% 22%, oklch(0.86 0.16 195) 0, transparent 42%), radial-gradient(circle at 85% 72%, oklch(0.65 0.16 220) 0, transparent 45%)",
              }}
            />
            <div className="mx-auto flex h-full max-w-6xl items-start justify-end px-4 pt-16 sm:pt-20 lg:items-center lg:pt-0">
              <a
                href={s.href}
                tabIndex={i === index ? 0 : -1}
                aria-label={s.title}
                className="pointer-events-none block w-full max-w-xl opacity-70 outline-none transition-opacity hover:opacity-90 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent sm:opacity-80 lg:pointer-events-auto lg:opacity-100"
              >
                <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-cyan/15 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-brand-cyan">
                  <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />
                  {s.eyebrow}
                </span>
                {s.visual}
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Véu de legibilidade para o texto sobreposto */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-navy via-brand-navy/60 to-brand-navy/20 lg:bg-gradient-to-r lg:from-brand-navy lg:via-brand-navy/75 lg:to-brand-navy/10"
        aria-hidden
      />

      {/* Barra de progresso do slide atual */}
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-navy-foreground/15">
        <div
          className="h-full bg-brand-cyan transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      {/* Controles */}
      <div className="absolute right-4 top-4 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Destaque anterior"
          onClick={prev}
          className="h-9 w-9 text-brand-on-navy hover:bg-brand-navy-foreground/10"
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
          className="h-9 w-9 text-brand-on-navy hover:bg-brand-navy-foreground/10"
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
          className="h-9 w-9 text-brand-on-navy hover:bg-brand-navy-foreground/10"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div aria-live="polite" className="sr-only">
        {label}
      </div>

      {/* Texto institucional sobreposto — canto inferior esquerdo */}
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col justify-end px-4 pb-16 pt-24 lg:pb-20">
        <div className="max-w-2xl">{children}</div>
      </div>

      {/* Pontos de navegação ao centro, sobre a base do hero */}
      <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Ir para o destaque ${i + 1}: ${s.title}`}
            aria-current={i === index}
            className={cn(
              "h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              i === index ? "w-6 bg-brand-cyan" : "w-2.5 bg-brand-navy-foreground/35",
            )}
          />
        ))}
      </div>
    </section>
  );
}
