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
  FileCheck2,
  BarChart3,
  Puzzle,
  Building2,
  Library,
  Gauge,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { useAuth } from "@/hooks/use-auth";

import slide01 from "@/assets/deck/slide-01.jpg.asset.json";
import slide02 from "@/assets/deck/slide-02.jpg.asset.json";
import slide03 from "@/assets/deck/slide-03.jpg.asset.json";
import slide04 from "@/assets/deck/slide-04.jpg.asset.json";
import slide05 from "@/assets/deck/slide-05.jpg.asset.json";
import slide06 from "@/assets/deck/slide-06.jpg.asset.json";
import slide07 from "@/assets/deck/slide-07.jpg.asset.json";
import slide08 from "@/assets/deck/slide-08.jpg.asset.json";
import slide09 from "@/assets/deck/slide-09.jpg.asset.json";
import slide10 from "@/assets/deck/slide-10.jpg.asset.json";
import slide11 from "@/assets/deck/slide-11.jpg.asset.json";
import slide13 from "@/assets/deck/slide-13.jpg.asset.json";
import slide14 from "@/assets/deck/slide-14.jpg.asset.json";
import slide15 from "@/assets/deck/slide-15.jpg.asset.json";
import slide16 from "@/assets/deck/slide-16.jpg.asset.json";

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

type DeckSection = {
  eyebrow?: string;
  title: string;
  lead: string;
  bullets: string[];
  image: { url: string };
  imageAlt: string;
  reverse?: boolean;
  icon: typeof Sparkles;
};

const DECK_SECTIONS: DeckSection[] = [
  {
    eyebrow: "O problema",
    title: "O desafio do escritório moderno",
    lead: "Tarefas repetitivas, ferramentas fragmentadas e IA sem governança reduzem escala e controle jurídico.",
    bullets: [
      "Propostas, pareceres, pesquisa e marketing consomem horas de trabalho não faturável.",
      "Word, Excel, WhatsApp e IA genérica criam fluxos desconectados e sem rastreabilidade.",
      "Falta visibilidade de custo, permissões e histórico por usuário ou equipe.",
    ],
    image: slide02,
    imageAlt: "Quatro desafios do escritório: retrabalho, fragmentação, baixa governança e perda de escala.",
    icon: Scale,
  },
  {
    eyebrow: "A solução",
    title: "Uma plataforma completa para o escritório jurídico",
    lead: "Do primeiro contato com o cliente até a entrega jurídica: tudo integrado, sem trocar de ferramenta.",
    bullets: [
      "Captação — propostas inteligentes com dados do cliente e versionamento.",
      "Produção — petições, contestações, recursos e manifestações com IA e padrão institucional.",
      "Acompanhamento — agenda, publicações monitoradas e notificações centralizadas.",
      "Governança — permissões, auditoria e controle do consumo de IA.",
    ],
    image: slide03,
    imageAlt: "Quatro pilares da plataforma JurisMind: Captação, Produção, Acompanhamento e Governança.",
    reverse: true,
    icon: Sparkles,
  },
  {
    eyebrow: "Fluxo",
    title: "Fluxo ponta a ponta",
    lead: "Um único sistema acompanha o caso desde a proposta até o acompanhamento processual.",
    bullets: [
      "01 · Capte — proposta comercial inteligente.",
      "02 · Trabalhe — RAG por caso e produção jurídica.",
      "03 · Entregue — DOCX/PDF com marca do escritório.",
      "04 · Acompanhe — agenda e publicações monitoradas.",
    ],
    image: slide04,
    imageAlt: "Quatro etapas do fluxo JurisMind: Capte, Trabalhe, Entregue e Acompanhe.",
    icon: Workflow,
  },
  {
    eyebrow: "Assistente por caso",
    title: "Assistente JurisMind por caso",
    lead: "RAG híbrido dedicado ao processo para responder com contexto e citação das fontes.",
    bullets: [
      "Pergunte sobre peças, contratos, documentos e fatos do caso.",
      "Receba respostas citando trechos, páginas e documentos utilizados.",
      "Gere resumo executivo, cronologia e organização automática do dossiê.",
    ],
    image: slide05,
    imageAlt: "Chat do Assistente JurisMind mostrando resposta com fontes citadas.",
    reverse: true,
    icon: Sparkles,
  },
  {
    eyebrow: "Produção jurídica",
    title: "Produção jurídica assistida",
    lead: "Produção assistida com padrão institucional, velocidade e rastreabilidade.",
    bullets: [
      "Petições, contestações, recursos, réplicas e manifestações.",
      "Editor profissional com reaproveitamento de conteúdo e templates.",
      "Exportação em DOCX/PDF com identidade visual do escritório.",
    ],
    image: slide06,
    imageAlt: "Preview de peça jurídica com blocos de fatos, direito e pedidos exportáveis em DOCX e PDF.",
    icon: FileText,
  },
  {
    eyebrow: "Comercial",
    title: "Proposta comercial em minutos",
    lead: "Captação mais rápida, apresentação profissional e conversão direta em caso.",
    bullets: [
      "Geração de propostas a partir dos documentos do cliente.",
      "Versionamento com diff e histórico de alterações.",
      "Compartilhamento seguro por link e exportação em Word/PDF.",
      "Conversão da proposta em caso com um clique.",
    ],
    image: slide07,
    imageAlt: "Editor de proposta comercial com versões, cliente e exportação em PDF.",
    reverse: true,
    icon: Handshake,
  },
  {
    eyebrow: "Marketing",
    title: "Marketing jurídico com IA",
    lead: "Conteúdo institucional com texto, arte e distribuição em um fluxo simples.",
    bullets: [
      "Posts para LinkedIn, Instagram e blog a partir de briefing.",
      "Artes 16:9 e 9:16 com padrão visual sóbrio.",
      "Download em PNG, envio por WhatsApp e edição no próprio editor.",
    ],
    image: slide08,
    imageAlt: "Fluxo de marketing jurídico com post institucional e arte 16:9 gerada.",
    icon: Megaphone,
  },
  {
    eyebrow: "Documentos",
    title: "Documentos e biblioteca do escritório",
    lead: "Base documental organizada para alimentar a IA com segurança e rastreabilidade.",
    bullets: [
      "Upload com preview, auditoria e associação a casos ou propostas.",
      "OCR e leitura de PDFs para estruturar contexto do RAG.",
      "Biblioteca reutilizável do escritório para manter padrão institucional.",
    ],
    image: slide09,
    imageAlt: "Recursos de documentos: upload e preview, leitura inteligente, base contextual e auditoria.",
    reverse: true,
    icon: Library,
  },
  {
    eyebrow: "Publicações",
    title: "Publicações monitoradas e movimentações processuais",
    lead: "Acompanhe intimações, eventos e atualizações por processo, OAB e advogado.",
    bullets: [
      "Monitoramento centralizado por responsável, caso e prioridade.",
      "Eventos processuais organizados em painel único.",
      "Mais previsibilidade operacional e menor risco de perda de prazo.",
    ],
    image: slide10,
    imageAlt: "Painel de publicações com KPIs de processos, OABs e advogados monitorados.",
    icon: FileSearch,
  },
  {
    eyebrow: "Agenda",
    title: "Agenda integrada e operação conectada",
    lead: "Prazos, audiências, compromissos e rotina da equipe em uma única visão.",
    bullets: [
      "Sincronização com Google Agenda e Microsoft Outlook.",
      "Kanban de tarefas por caso, equipe e responsável.",
      "Inbox de notificações para prazos, eventos e atualizações.",
    ],
    image: slide11,
    imageAlt: "Agenda semanal com prazos, audiências e sincronização com Google e Outlook.",
    reverse: true,
    icon: CalendarDays,
  },
  {
    eyebrow: "Governança",
    title: "Governança, segurança e controle",
    lead: "Adoção de IA com rastreabilidade, permissões e visibilidade operacional.",
    bullets: [
      "Capacidades granulares por perfil, área e rota.",
      "Auditoria das ações realizadas na plataforma.",
      "Compartilhamento seguro e controle de acesso por token.",
      "Mais confiança para escritórios médios e grandes.",
    ],
    image: slide13,
    imageAlt: "Cards de governança: permissões, auditoria, segurança RLS e tokens.",
    icon: ShieldCheck,
  },
  {
    eyebrow: "Custo",
    title: "Consumo de IA e orçamento",
    lead: "Controle financeiro nativo para uso responsável da IA por escritório, equipe e usuário.",
    bullets: [
      "Budget mensal com alertas de consumo.",
      "Log de modelo, tokens, créditos e custo estimado por interação.",
      "Cache de respostas para reduzir custo e padronizar recorrências.",
    ],
    image: slide14,
    imageAlt: "Painel de consumo de IA com budget, tokens, cache e gráfico de consumo transparente.",
    reverse: true,
    icon: BarChart3,
  },
  {
    eyebrow: "Arquitetura",
    title: "Integrações e arquitetura",
    lead: "Conectado ao dia a dia do escritório, com arquitetura preparada para escala.",
    bullets: [
      "Google Agenda, Microsoft Outlook e OAuth.",
      "Exportação nativa para Word, PDF, Excel e PPTX.",
      "Autenticação, RLS, server functions e sanitização de HTML gerado por IA.",
    ],
    image: slide15,
    imageAlt: "Grade de integrações: Google, Outlook, DOCX/PDF, Excel/PPTX, voz e equipe.",
    icon: Puzzle,
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
        {/* Hero — usa a capa do deck como referência visual */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, oklch(0.86 0.16 195) 0, transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.65 0.16 220) 0, transparent 40%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-24">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
                <JurisMindMark size={14} context={JURISMIND_CONTEXT.inlineDark} />
                Deck executivo · Para advogados e escritórios de advocacia
              </div>
              <h1 className="font-heading text-5xl font-extrabold tracking-tight md:text-6xl">
                IA jurídica para advogados,
                <br />
                com governança e rastreabilidade.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">
                Plataforma SaaS para escritórios que precisam produzir peças, acompanhar processos
                e organizar o comercial com a segurança de uma IA jurídica auditável.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
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
                  <a href="#deck">Ver o deck completo</a>
                </Button>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm">
                {[
                  { n: "1", t: "Seguro e confiável", s: "Dados protegidos" },
                  { n: "2", t: "IA jurídica avançada", s: "RAG com fontes citadas" },
                  { n: "3", t: "Mais produtividade", s: "Menos tempo, mais resultado" },
                ].map((k) => (
                  <div key={k.n} className="rounded-lg border border-primary-foreground/15 p-3">
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-accent/60 text-[10px]">
                        {k.n}
                      </span>
                      {k.t}
                    </dt>
                    <dd className="mt-1 text-primary-foreground/70">{k.s}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-primary-foreground/20 bg-primary/40 shadow-2xl">
                <img
                  src={slide01.url}
                  alt="Capa do deck B2B | JurisMind AI — IA jurídica para advogados."
                  className="w-full"
                  loading="eager"
                />
              </div>
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

        {/* Deck sections */}
        <section id="deck" className="mx-auto max-w-6xl px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              Deck executivo
            </div>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Tudo o que o JurisMind AI entrega ao seu escritório
            </h2>
            <p className="mt-3 text-muted-foreground">
              A apresentação institucional, capítulo a capítulo. Cada bloco reúne os recursos e os
              resultados esperados por área.
            </p>
          </div>

          <div className="mt-14 space-y-20">
            {DECK_SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <article
                  key={s.title}
                  className={`grid gap-10 lg:grid-cols-2 lg:items-center ${
                    s.reverse ? "lg:[&>div:first-child]:order-2" : ""
                  }`}
                >
                  <div>
                    {s.eyebrow && (
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                        <Icon className="h-3.5 w-3.5" />
                        {s.eyebrow}
                      </div>
                    )}
                    <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                      {s.title}
                    </h3>
                    <p className="mt-3 text-muted-foreground">{s.lead}</p>
                    <ul className="mt-6 space-y-3">
                      {s.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-3 text-sm text-foreground/90">
                          <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                            <FileCheck2 className="h-3 w-3" />
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <img
                      src={s.image.url}
                      alt={s.imageAlt}
                      className="w-full"
                      loading="lazy"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Diferenciais — slide 16 */}
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
                JurisMind AI unifica captação, produção e acompanhamento em um único fluxo jurídico
                inteligente.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  n: "1",
                  t: "Vertical jurídico brasileiro",
                  d: "Feito para advogados e escritórios de advocacia.",
                },
                {
                  n: "2",
                  t: "RAG por caso",
                  d: "Respostas com fontes citadas e contexto documental.",
                },
                {
                  n: "3",
                  t: "Governança nativa",
                  d: "Permissões, auditoria e consumo de IA por escritório.",
                },
                {
                  n: "4",
                  t: "Fluxo completo",
                  d: "Da proposta à entrega e ao acompanhamento processual.",
                },
              ].map((c) => (
                <div
                  key={c.n}
                  className="rounded-2xl border border-primary-foreground/15 bg-primary/40 p-5"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-bold text-accent-foreground">
                    {c.n}
                  </span>
                  <h3 className="mt-4 font-heading text-lg font-bold">{c.t}</h3>
                  <p className="mt-2 text-sm text-primary-foreground/70">{c.d}</p>
                </div>
              ))}
            </div>

            <p className="mt-10 text-center font-heading text-lg text-accent">
              Mais produtividade, mais padrão e mais confiança para crescer.
            </p>

            <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-primary-foreground/20 shadow-2xl">
              <img
                src={slide16.url}
                alt="Slide de fechamento do deck com os quatro diferenciais do JurisMind AI."
                className="w-full"
                loading="lazy"
              />
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
              Crie sua conta gratuita, suba seus primeiros documentos e converse com o B2B |
              JurisMind AI.
            </p>
            <Button size="lg" asChild className="mt-6">
              <Link to={user ? "/painel" : "/entrar"}>
                {user ? "Abrir painel" : "Criar conta grátis"}{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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
