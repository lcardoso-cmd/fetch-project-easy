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
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { DeckDownloadButton } from "@/components/marketing/deck-download-button";
import { PITCH } from "@/lib/marketing/pitch-content";
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

/**
 * Ícones por chave. Todo o texto vem de `PITCH` — fonte única compartilhada
 * com a apresentação em PDF (src/lib/marketing/deck-pdf.server.ts).
 */
const FLOW_ICONS: Record<string, typeof Search> = {
  localizar: Search,
  organizar: Layers,
  produzir: FileText,
  apresentar: Presentation,
  conduzir: CalendarClock,
};

const TECH_ICONS: Record<string, typeof Search> = {
  significado: Sparkles,
  textual: BookOpen,
  fusao: Layers,
  rerank: Workflow,
};

const LAYER_ICONS: Record<string, typeof Search> = {
  inteligencia: Sparkles,
  operacao: Workflow,
  governanca: ShieldCheck,
};

const DELIVERABLE_ICONS: Record<string, typeof Search> = {
  analise: FileSearch,
  peca: FileText,
  planilha: FileSpreadsheet,
  apresentacao: Presentation,
  tarefa: CalendarClock,
  jurisprudencia: Scale,
};

const GOVERNANCE_ICONS: Record<string, typeof Search> = {
  usuarios: Users,
  historico: FileSearch,
  tokens: Gauge,
  orcamento: ShieldCheck,
};

const FLOW = PITCH.flow.items.map((i) => ({ ...i, icon: FLOW_ICONS[i.key] ?? Search }));
const TECH = PITCH.intelligence.items.map((i) => ({ ...i, icon: TECH_ICONS[i.key] ?? Sparkles }));
const LAYERS = PITCH.platform.items.map((i) => ({ ...i, icon: LAYER_ICONS[i.key] ?? Layers }));
const DELIVERABLES = PITCH.deliverables.items.map((i) => ({
  ...i,
  icon: DELIVERABLE_ICONS[i.key] ?? FileText,
}));
const GOVERNANCE = PITCH.governance.items.map((i) => ({
  ...i,
  icon: GOVERNANCE_ICONS[i.key] ?? ShieldCheck,
}));

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
    <Button
      size={size}
      variant={variant}
      asChild
      className={`whitespace-nowrap ${className ?? ""}`}
    >
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
    <Button size={size} asChild className={`whitespace-nowrap ${className ?? ""}`}>
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
    <Button size={size} asChild className={`whitespace-nowrap ${className ?? ""}`}>
      <Link to="/painel">
        {label}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Link>
    </Button>
  );
}

function LearnMoreButton({ className }: { className?: string }) {
  return (
    <Button
      size="lg"
      variant="outline"
      asChild
      className={`whitespace-nowrap ${className ?? ""}`}
    >
      <a href="#entregas">Ver o que o JurisMind entrega</a>
    </Button>
  );
}


function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <JurisMindMark size={28} context={JURISMIND_CONTEXT.inline} />
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
          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <OpenDashboardButton size="default" label="Abrir meu painel" />
            ) : (
              <>
                <LoginButton />
                <TrialSignupButton size="default" className="hidden sm:inline-flex" />
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* 1 · HERO */}
        <section className="relative overflow-hidden bg-brand-navy text-brand-on-navy">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 25%, oklch(0.86 0.16 195) 0, transparent 42%), radial-gradient(circle at 85% 75%, oklch(0.65 0.16 220) 0, transparent 45%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-20">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-cyan/15 px-3 py-1 text-sm font-semibold text-brand-cyan">
                <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />
                {PITCH.hero.eyebrow}
              </div>
              <h1 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight md:text-5xl">
                {PITCH.hero.title}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-brand-on-navy/90">
                {PITCH.hero.subtitle}
              </p>

              <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:flex-nowrap [&>*]:w-full lg:[&>*]:w-auto">
                {user ? (
                  <OpenDashboardButton className="bg-brand-cyan text-brand-navy hover:bg-brand-cyan/90" />
                ) : (
                  <TrialSignupButton className="bg-brand-cyan text-brand-navy hover:bg-brand-cyan/90" />
                )}
                <LearnMoreButton className="border-brand-on-navy/35 bg-transparent text-brand-on-navy hover:bg-brand-on-navy/10" />
                <DeckDownloadButton className="border-brand-on-navy/35 bg-transparent text-brand-on-navy hover:bg-brand-on-navy/10" />
              </div>

              <p className="mt-6 text-base font-medium text-brand-cyan">
                {PITCH.hero.highlight}
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
                {PITCH.flow.title}
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                {PITCH.flow.subtitle}
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
              {PITCH.deliverables.title}
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">
              {PITCH.deliverables.subtitle}
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
                {PITCH.intelligence.title}
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                {PITCH.intelligence.subtitle}
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
                {PITCH.intelligence.ragTitle}
              </p>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">
                {PITCH.intelligence.ragBody}
              </p>
              <p className="mt-3 text-base font-medium text-foreground">
                {PITCH.intelligence.ragNote}
              </p>
            </div>

            <Accordion type="single" collapsible className="mx-auto mt-8 max-w-3xl">
              <AccordionItem value="termos">
                <AccordionTrigger className="text-base">
                  Termos técnicos utilizados nessa etapa
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-base leading-relaxed text-muted-foreground">
                  {PITCH.intelligence.glossary.map((g) => (
                    <p key={g.key}>
                      <strong className="text-foreground">{g.t}:</strong> {g.d}
                    </p>
                  ))}
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
                {PITCH.jurisprudence.badge}
              </span>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {PITCH.jurisprudence.title}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {PITCH.jurisprudence.subtitle}
              </p>
              <ul className="mt-5 space-y-3 text-base text-foreground">
                {PITCH.jurisprudence.bullets.map((i) => (
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
                {PITCH.jurisprudence.exampleLabel}
              </p>
              <div className="mt-3 space-y-3">
                {PITCH.jurisprudence.examples.map((j) => (
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
                {PITCH.jurisprudence.disclaimer}
              </p>
            </div>
          </div>
        </section>

        {/* 6 · DIFERENCIAÇÃO ESTRUTURAL */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {PITCH.differentiation.title}
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                {PITCH.differentiation.subtitle}
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border bg-background p-6">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {PITCH.differentiation.genericTitle}
                </h3>
                <ul className="mt-5 space-y-3 text-base text-muted-foreground">
                  {PITCH.differentiation.generic.map((i) => (
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
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {PITCH.differentiation.jurismindTitle}
                </h3>
                <ul className="mt-5 space-y-3 text-base text-foreground">
                  {PITCH.differentiation.jurismind.map((i) => (
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
            {PITCH.platform.title}
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
                  {PITCH.governance.title}
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  {PITCH.governance.subtitle}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {GOVERNANCE.map((i) => (
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
        <section className="bg-brand-navy text-brand-on-navy">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            {user ? (
              <>
                <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  {PITCH.cta.authenticatedTitle}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-brand-on-navy/85">
                  {PITCH.cta.authenticatedSubtitle}
                </p>
                <div className="mt-8 flex flex-col items-center gap-3 lg:flex-row lg:flex-nowrap lg:justify-center [&>*]:w-full lg:[&>*]:w-auto">
                  <OpenDashboardButton className="bg-brand-cyan text-brand-navy hover:bg-brand-cyan/90" />
                  <DeckDownloadButton className="border-brand-on-navy/35 bg-transparent text-brand-on-navy hover:bg-brand-on-navy/10" />
                </div>
              </>
            ) : (
              <>
                <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                  {PITCH.cta.title}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-brand-on-navy/85">
                  {PITCH.cta.subtitle}
                </p>
                <div className="mt-8 flex flex-col items-center gap-3 lg:flex-row lg:flex-nowrap lg:justify-center [&>*]:w-full lg:[&>*]:w-auto">
                  <TrialSignupButton
                    className="bg-brand-cyan text-brand-navy hover:bg-brand-cyan/90"
                    label={PITCH.cta.button}
                  />
                  <DeckDownloadButton className="border-brand-on-navy/35 bg-transparent text-brand-on-navy hover:bg-brand-on-navy/10" />
                </div>
                <p className="mt-4 text-base text-brand-on-navy/85">
                  Já possui uma conta?{" "}
                  <Link to="/entrar" className="font-medium underline underline-offset-4">
                    Entrar
                  </Link>
                </p>
                <p className="mt-5 text-base text-brand-on-navy/85">
                  {PITCH.cta.note}
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
              {PITCH.footer.about}
            </p>
            <p className="mt-3 text-base text-muted-foreground">{PITCH.footer.company}</p>
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
