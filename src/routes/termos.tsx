import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de uso — JurisMind AI" },
      {
        name: "description",
        content:
          "Condições de utilização da plataforma JurisMind AI: contas, responsabilidades do escritório, uso dos recursos de inteligência artificial e teste gratuito.",
      },
      { property: "og:title", content: "Termos de uso — JurisMind AI" },
      {
        property: "og:description",
        content:
          "Condições de utilização da plataforma JurisMind AI, incluindo contas, responsabilidades e recursos de IA.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://b2bjurismind.lovable.app/termos" }],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar à página inicial
        </Link>
        <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Termos de uso
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Objeto</h2>
            <p className="mt-2">
              O JurisMind AI é uma plataforma de inteligência jurídica que organiza casos,
              documentos, produção jurídica e governança de uso de inteligência artificial.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Contas e acessos</h2>
            <p className="mt-2">
              Cada escritório é responsável pelos usuários que cadastra, pelas permissões concedidas
              e pela guarda das credenciais de acesso.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Teste gratuito</h2>
            <p className="mt-2">
              O período de avaliação é de 30 dias a partir da criação da conta e serve para o
              escritório conhecer os recursos da plataforma.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">
              Utilização dos recursos de IA
            </h2>
            <p className="mt-2">
              As respostas geradas pela plataforma são apoio ao trabalho jurídico e não substituem a
              análise profissional do advogado, que permanece responsável pela conferência dos
              documentos e trechos utilizados.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Conteúdo do escritório</h2>
            <p className="mt-2">
              Os documentos e conteúdos enviados permanecem de titularidade do escritório e são
              utilizados para operar as funcionalidades contratadas.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Contato</h2>
            <p className="mt-2">
              Dúvidas sobre estes termos podem ser enviadas para{" "}
              <a className="text-foreground underline" href="mailto:contato@b2bconsulting.com.br">
                contato@b2bconsulting.com.br
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
