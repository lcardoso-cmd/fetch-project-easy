import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Scale,
  BookOpen,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { PITCH } from "@/lib/marketing/pitch-content";

const SITE = "https://jurismind.b2bconsulting.com.br";
const PATH = "/guia/automatizar-peticoes-juridicas-ia";
const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/Sls90jSFrMa8ECulf4OjLMG7sRB3/social-images/social-1783001247994-LOGO_JURISMIND_16-9.webp";

const TITLE = "Como automatizar petições jurídicas com IA | JurisMind";
const DESCRIPTION =
  "Aprenda como a IA reduz o tempo de produção de petições jurídicas, mantendo o controle do advogado sobre argumentos, fontes e revisão final.";

export const Route = createFileRoute("/guia/automatizar-peticoes-juridicas-ia")({
  component: GuidePage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE}${PATH}` },
      { property: "og:type", content: "article" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: `${SITE}${PATH}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "Como automatizar petições jurídicas com IA",
          description: DESCRIPTION,
          author: { "@type": "Organization", name: "B2B Consulting" },
          publisher: {
            "@type": "Organization",
            name: "JurisMind AI",
            logo: { "@type": "ImageObject", url: OG_IMAGE },
          },
          url: `${SITE}${PATH}`,
          inLanguage: "pt-BR",
          datePublished: "2026-09-05",
          dateModified: "2026-09-05",
        }),
      },
    ],
  }),
});

function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <JurisMindMark size={28} context={JURISMIND_CONTEXT.inline} />
            <span className="font-heading text-base font-bold text-foreground">JurisMind AI</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link to="/entrar" search={{ modo: "cadastro", origem: "guia_peticoes" }}>
              Criar conta
            </Link>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-brand-navy text-brand-on-navy">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-cyan">
              Guia prático
            </p>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight md:text-5xl">
              Como automatizar petições jurídicas com IA
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-brand-on-navy/85">
              Reduza o tempo de produção de peças sem abrir mão da revisão final. Veja como a IA
              pode ajudar a estruturar argumentos, localizar fundamentos nos autos e gerar minutas
              editáveis.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 lg:flex-row lg:flex-nowrap">
              <Button
                asChild
                size="lg"
                className="w-full whitespace-nowrap bg-brand-cyan text-brand-navy hover:bg-brand-cyan/90 lg:w-auto"
              >
                <Link to="/entrar" search={{ modo: "cadastro", origem: "guia_peticoes" }}>
                  Testar no meu escritório <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full whitespace-nowrap border-brand-on-navy/35 bg-transparent text-brand-on-navy hover:bg-brand-on-navy/10 lg:w-auto"
              >
                <Link to="/">Conhecer a plataforma</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Conteúdo */}
        <article className="mx-auto max-w-3xl px-4 py-16">
          <p className="text-lg leading-relaxed text-muted-foreground">
            Escrever petições é uma das tarefas que mais consomem tempo no escritório. A boa notícia
            é que a maior parte desse trabalho pode ser acelerada com inteligência artificial — desde
            que o advogado mantenha o controle sobre a estratégia processual e a revisão final.
          </p>

          <h2 className="mt-12 font-heading text-2xl font-bold text-foreground md:text-3xl">
            O que significa automatizar petições jurídicas?
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Automatizar não é substituir o advogado. É transferir para a IA as etapas repetitivas
            da produção textual:
          </p>
          <ul className="mt-6 space-y-4">
            {[
              "Organizar os fatos a partir dos documentos do caso.",
              "Localizar trechos dos autos que sustentam cada argumento.",
              "Sugerir estrutura de exordial, fundamentação jurídica e pedidos.",
              "Gerar uma minuta editável em formato Word ou PDF.",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-base text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand-cyan" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-12 font-heading text-2xl font-bold text-foreground md:text-3xl">
            Por que usar IA para produzir documentos jurídicos?
          </h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {[
              {
                icon: Clock,
                title: "Ganho de tempo",
                text: "A minuta inicial sai em minutos, não em horas. O advogado passa mais tempo revisando e menos tempo digitando.",
              },
              {
                icon: FileText,
                title: "Base documental",
                text: "A IA consulta os autos antes de escrever, reduzindo o risco de afirmações sem fundamento.",
              },
              {
                icon: ShieldCheck,
                title: "Rastreabilidade",
                text: "Cada afirmação importante pode ser ligada ao trecho de origem, com página e documento.",
              },
              {
                icon: Sparkles,
                title: "Consistência",
                text: "Modelos e padrões do escritório são respeitados em todas as peças geradas.",
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border bg-card p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <card.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{card.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{card.text}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-12 font-heading text-2xl font-bold text-foreground md:text-3xl">
            Passo a passo: como automatizar a petição no JurisMind
          </h2>
          <ol className="mt-6 space-y-6">
            {[
              {
                title: "Crie o caso e suba os documentos",
                text: "Reúna as peças, contratos, notificações e qualquer documento relevante. O sistema indexa o conteúdo para consulta.",
              },
              {
                title: "Peça uma análise ou minuta",
                text: "No chat do caso, solicite a peça desejada: contestação, embargos, execução de sentença, ação de cobrança etc.",
              },
              {
                title: "Revise as fontes citadas",
                text: "A resposta indica os documentos e páginas usados como base. Confira se as referências fazem sentido para a causa.",
              },
              {
                title: "Edite e exporte",
                text: "A minuta abre em editor com formatação profissional. Exporte em .docx ou PDF para os ajustes finais.",
              },
            ].map((step, idx) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="font-heading text-lg font-bold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-base leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2 className="mt-12 font-heading text-2xl font-bold text-foreground md:text-3xl">
            O que a IA não deve fazer sozinha
          </h2>
          <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
              <div>
                <h3 className="font-heading text-lg font-bold text-foreground">
                  A revisão final é sempre do advogado
                </h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  A IA acelera a produção, mas não substitui o juízo crítico sobre a estratégia
                  processual, a análise de risco e a adequação ao caso concreto. Sempre confira
                  datas, valores, nomes, dispositivos legais e jurisprudência citada.
                </p>
              </div>
            </div>
          </div>

          <h2 className="mt-12 font-heading text-2xl font-bold text-foreground md:text-3xl">
            Benefícios práticos para o escritório
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              "Redução do tempo gasto em minutas iniciais.",
              "Menos retrabalho por inconsistências entre documentos.",
              "Maior padronização na linguagem e formatação.",
              "Histórico de peças e argumentos reutilizáveis.",
              "Controle de quem gera o quê e quanto custa.",
              "Respostas baseadas nos autos, não em conhecimento genérico.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-base text-muted-foreground">
                <Scale className="mt-0.5 h-5 w-5 shrink-0 text-accent-foreground/90 dark:text-accent" aria-hidden />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <h2 className="mt-12 font-heading text-2xl font-bold text-foreground md:text-3xl">
            Diferença entre IA genérica e IA conectada aos autos
          </h2>
          <div className="mt-6 overflow-hidden rounded-2xl border">
            <table className="w-full text-left text-base">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 font-heading font-semibold text-foreground">Chat genérico</th>
                  <th className="px-4 py-3 font-heading font-semibold text-foreground">JurisMind</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["Contexto colado manualmente", "Documentos indexados por caso"],
                  ["Resposta sem indicação de fonte", "Referência a página e documento"],
                  ["Não gera entregas do escritório", "Peça, planilha, apresentação e tarefa"],
                  ["Sem controle de uso", "Orçamento, permissões e histórico"],
                ].map(([generic, jurismind]) => (
                  <tr key={generic} className="text-muted-foreground">
                    <td className="px-4 py-3">{generic}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{jurismind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-12 font-heading text-2xl font-bold text-foreground md:text-3xl">
            Comece com um caso real
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            O melhor jeito de testar a automação de petições é usar um caso que você já conhece.
            Suba os documentos, peça uma minuta e compare o resultado com uma peça que você já
            tenha produzido. Em poucos minutos você identifica onde a IA economiza tempo e onde a
            revisão humana ainda é indispensável.
          </p>
        </article>

        {/* CTA final */}
        <section className="border-t bg-card">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Automatize petições sem perder o controle
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Teste o JurisMind por 30 dias e veja como a IA conectada aos seus documentos acelera a
              produção de peças jurídicas.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 lg:flex-row lg:flex-nowrap">
              <Button
                asChild
                size="lg"
                className="w-full whitespace-nowrap bg-brand-cyan text-brand-navy hover:bg-brand-cyan/90 lg:w-auto"
              >
                <Link to="/entrar" search={{ modo: "cadastro", origem: "guia_peticoes" }}>
                  Começar teste gratuito <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full whitespace-nowrap lg:w-auto"
              >
                <Link to="/">Voltar para a homepage</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{PITCH.cta.note}</p>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
          <div className="flex items-center gap-2">
            <JurisMindMark size={24} context={JURISMIND_CONTEXT.inline} />
            <span className="font-heading text-base font-bold text-foreground">JurisMind AI</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Home
            </Link>
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link to="/termos" className="hover:text-foreground">
              Termos
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {PITCH.brand.company}
          </p>
        </div>
      </footer>
    </div>
  );
}
