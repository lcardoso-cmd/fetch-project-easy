import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de privacidade — JurisMind AI" },
      {
        name: "description",
        content:
          "Como o JurisMind AI trata os dados de conta, os documentos enviados e os registros de utilização da inteligência artificial.",
      },
      { property: "og:title", content: "Política de privacidade — JurisMind AI" },
      {
        property: "og:description",
        content: "Tratamento de dados de conta, documentos e registros de uso de IA no JurisMind AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://b2bjurismind.lovable.app/privacidade" }],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar à página inicial
        </Link>
        <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Política de privacidade
        </h1>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Dados tratados</h2>
            <p className="mt-2">
              A plataforma trata dados de cadastro (nome, e-mail e dados do escritório), os
              documentos enviados pelos usuários e os registros técnicos de utilização dos recursos
              de inteligência artificial.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Finalidade</h2>
            <p className="mt-2">
              Os dados são utilizados para autenticação, organização dos casos, consulta documental,
              produção jurídica e controle de consumo de IA pelo próprio escritório.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Acesso</h2>
            <p className="mt-2">
              O acesso aos documentos e casos respeita os usuários, papéis e permissões definidos
              pelo administrador do escritório na plataforma.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Modelos de IA</h2>
            <p className="mt-2">
              O JurisMind utiliza modelos de inteligência artificial de terceiros para gerar
              respostas a partir dos conteúdos recuperados nos documentos selecionados.
            </p>
          </section>
          <section>
            <h2 className="font-heading text-lg font-bold text-foreground">Contato</h2>
            <p className="mt-2">
              Solicitações relacionadas a dados pessoais podem ser enviadas para{" "}
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
