import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IconBox } from "@/components/ui/icon-box";
import {
  ArrowRight,
  Scale,
  FileText,
  Handshake,
  CalendarDays,
  Megaphone,
  FileSearch,
  Sparkles,
  ShieldCheck,
  Workflow,
  BarChart3,
  Puzzle,
  Building2,
  Library,
  Gauge,
  Download,
  Check,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "B2B | JurisMind AI — IA jurídica com governança para advogados" },
      {
        name: "description",
        content:
          "Plataforma SaaS de IA jurídica para escritórios de advocacia: RAG por caso, produção de peças, propostas comerciais, marketing jurídico, agenda integrada, publicações monitoradas e governança nativa.",
      },
      { property: "og:title", content: "B2B | JurisMind AI — IA jurídica com governança" },
      {
        property: "og:description",
        content:
          "IA jurídica para advogados com RAG por caso, produção assistida, propostas, marketing, agenda, publicações e governança nativa.",
      },
      { property: "og:url", content: "https://b2bjurismind.lovable.app/" },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "B2B | JurisMind AI" },
      {
        name: "twitter:description",
        content:
          "IA jurídica para advogados com RAG por caso, produção assistida, propostas, marketing e governança nativa.",
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

type Feature = {
  icon: typeof Sparkles;
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
};

const FEATURES: Feature[] = [
  {
    icon: Sparkles,
    eyebrow: "Assistente por caso",
    title: "RAG dedicado ao processo",
    lead: "Pergunte sobre peças, contratos e documentos com respostas citando trechos e páginas.",
    bullets: [
      "Resumo executivo e cronologia automática do dossiê.",
      "Fontes citadas em cada resposta.",
      "Organização inteligente da documentação do caso.",
    ],
  },
  {
    icon: FileText,
    eyebrow: "Produção jurídica",
    title: "Peças com padrão institucional",
    lead: "Petições, contestações, recursos e manifestações com editor profissional.",
    bullets: [
      "Templates reutilizáveis do escritório.",
      "Exportação em DOCX e PDF com identidade visual.",
      "Reaproveitamento de blocos entre casos.",
    ],
  },
  {
    icon: Handshake,
    eyebrow: "Comercial",
    title: "Proposta comercial em minutos",
    lead: "Captação rápida com versionamento e conversão direta em caso.",
    bullets: [
      "Geração a partir dos documentos do cliente.",
      "Histórico com diff entre versões.",
      "Compartilhamento seguro por link.",
    ],
  },
  {
    icon: Megaphone,
    eyebrow: "Marketing",
    title: "Marketing jurídico com IA",
    lead: "Texto institucional, arte visual e distribuição no mesmo fluxo.",
    bullets: [
      "Posts para LinkedIn, Instagram e blog.",
      "Artes 16:9 e 9:16 com estética sóbria.",
      "Download em PNG e envio por WhatsApp.",
    ],
  },
  {
    icon: Library,
    eyebrow: "Documentos",
    title: "Biblioteca do escritório",
    lead: "Base documental organizada para alimentar a IA com rastreabilidade.",
    bullets: [
      "Upload com preview e auditoria.",
      "OCR e leitura de PDFs para o RAG.",
      "Padrão institucional reutilizável.",
    ],
  },
  {
    icon: FileSearch,
    eyebrow: "Publicações",
    title: "Publicações e movimentações",
    lead: "Acompanhamento centralizado por processo, OAB e responsável.",
    bullets: [
      "Painel único de eventos processuais.",
      "Priorização por caso e prazo.",
      "Menor risco de perda de prazos.",
    ],
  },
  {
    icon: CalendarDays,
    eyebrow: "Agenda",
    title: "Agenda integrada e operação conectada",
    lead: "Prazos, audiências e tarefas em uma visão só.",
    bullets: [
      "Sincronização com Google e Outlook.",
      "Kanban por caso e responsável.",
      "Inbox de notificações e alertas.",
    ],
  },
  {
    icon: ShieldCheck,
    eyebrow: "Governança",
    title: "Governança, segurança e controle",
    lead: "Adoção de IA com auditoria, permissões e visibilidade.",
    bullets: [
      "Capacidades granulares por perfil e rota.",
      "Auditoria completa das ações.",
      "Compartilhamento seguro com token.",
    ],
  },
  {
    icon: BarChart3,
    eyebrow: "Custo",
    title: "Consumo de IA e orçamento",
    lead: "Controle financeiro nativo para uso responsável da IA.",
    bullets: [
      "Budget mensal com alertas.",
      "Log de modelo, tokens e custo por interação.",
      "Cache de respostas para reduzir gasto.",
    ],
  },
  {
    icon: Puzzle,
    eyebrow: "Arquitetura",
    title: "Integrações e arquitetura",
    lead: "Preparado para o dia a dia do escritório e para escalar.",
    bullets: [
      "Google Agenda, Outlook e OAuth.",
      "Exportação para Word, PDF, Excel e PPTX.",
      "RLS, server functions e sanitização de HTML.",
    ],
  },
];

const FLOW = [
  { n: "01", t: "Capte", d: "Proposta comercial inteligente." },
  { n: "02", t: "Trabalhe", d: "RAG por caso e produção jurídica." },
  { n: "03", t: "Entregue", d: "DOCX/PDF com marca do escritório." },
  { n: "04", t: "Acompanhe", d: "Agenda e publicações monitoradas." },
];

const DIFFERENTIALS = [
  { t: "Vertical jurídico brasileiro", d: "Feito para advogados e escritórios de advocacia." },
  { t: "RAG por caso", d: "Respostas com fontes citadas e contexto documental." },
  { t: "Governança nativa", d: "Permissões, auditoria e consumo de IA por escritório." },
  { t: "Fluxo completo", d: "Da proposta à entrega e ao acompanhamento processual." },
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

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, oklch(0.86 0.16 195) 0, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.65 0.16 220) 0, transparent 40%)",
            }}
          />
          <div className="relative mx-auto max-w-4xl px-4 py-24 text-center lg:py-28">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
              <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />
              Para advogados e escritórios de advocacia
            </div>
            <h1 className="font-heading text-5xl font-extrabold tracking-tight md:text-6xl">
              IA jurídica com governança
              <br className="hidden md:block" /> e rastreabilidade.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-foreground/80">
              Plataforma SaaS para escritórios que produzem peças, acompanham
              processos e organizam o comercial com a segurança de uma IA
              jurídica auditável.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                asChild
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Link to={user ? "/painel" : "/entrar"}>
                  {user ? "Abrir painel" : "Começar agora"}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <a
                  href="/api/public/marketing-deck"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar deck (PDF)
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* Personas */}
        <section className="border-b bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
            {[
              {
                icon: Scale,
                title: "Advogados",
                text: "Petições, contestações, contrarrazões, alegações finais e análise de risco.",
              },
              {
                icon: Building2,
                title: "Escritórios de advocacia",
                text: "Gestão de casos, equipe e clientes com governança e permissões granulares.",
              },
              {
                icon: Handshake,
                title: "Área comercial",
                text: "Propostas comerciais versionadas, conversão em caso e marketing jurídico.",
              },
            ].map((p) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="flex items-start gap-3 rounded-2xl border bg-card p-4"
                >
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

        {/* Fluxo */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              <Workflow className="h-3.5 w-3.5" />
              Fluxo completo
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Do primeiro contato ao acompanhamento processual
            </h2>
            <p className="mt-3 text-muted-foreground">
              Um único sistema conecta captação, produção e acompanhamento.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((f) => (
              <div key={f.n} className="rounded-2xl border bg-card p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-sm font-bold text-accent">
                  {f.n}
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{f.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Recursos */}
        <section className="border-t bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Recursos
              </div>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Tudo o que o JurisMind AI entrega ao seu escritório
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <article
                    key={f.title}
                    className="flex h-full flex-col rounded-2xl border bg-card p-5"
                  >
                    <div className="flex items-center gap-3">
                      <IconBox icon={Icon} size="md" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                        {f.eyebrow}
                      </span>
                    </div>
                    <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">{f.lead}</p>
                    <ul className="mt-4 space-y-2">
                      {f.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex items-start gap-2 text-sm text-foreground/90"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Diferenciais */}
        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
                <Gauge className="h-3.5 w-3.5" />
                Diferenciais
              </div>
              <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
                Escala com controle jurídico
              </h2>
              <p className="mt-3 text-primary-foreground/80">
                Captação, produção e acompanhamento em um único fluxo jurídico
                inteligente.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {DIFFERENTIALS.map((c, i) => (
                <div
                  key={c.t}
                  className="rounded-2xl border border-primary-foreground/15 bg-primary/40 p-5"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold">{c.t}</h3>
                  <p className="mt-2 text-sm text-primary-foreground/70">{c.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final com download do deck */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Pronto para experimentar?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Crie sua conta gratuita, suba seus primeiros documentos e converse
              com o B2B | JurisMind AI. Se preferir uma visão executiva antes,
              baixe o deck institucional.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link to={user ? "/painel" : "/entrar"}>
                  {user ? "Abrir painel" : "Criar conta grátis"}{" "}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a
                  href="/api/public/marketing-deck"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Baixar deck (PDF)
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} B2B | JurisMind AI. Feito para escritórios de advocacia.
        </div>
      </footer>
    </div>
  );
}
