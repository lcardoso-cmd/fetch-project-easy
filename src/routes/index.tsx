import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Scale, FileText, Calendar, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-heading text-lg font-bold">J</span>
            </div>
            <span className="font-heading text-xl font-bold text-foreground">JurisMind</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight text-foreground">
            Inteligência artificial para a prática jurídica moderna
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            JurisMind combina um RAG avançado para documentos jurídicos com uma agenda inteligente de prazos e compromissos. Tudo para o advogado trabalhar mais rápido e com segurança.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/auth">Criar conta gratuita</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth">Ver demonstração</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <FileText className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-card-foreground">RAG Jurídico</h3>
              <p className="mt-2 text-sm text-muted-foreground">Faça perguntas em linguagem natural sobre petições, contratos e jurisprudência.</p>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <Calendar className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-card-foreground">Agenda Inteligente</h3>
              <p className="mt-2 text-sm text-muted-foreground">A IA identifica prazos e compromissos nos documentos e organiza sua agenda.</p>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <Scale className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-card-foreground">Gestão de Casos</h3>
              <p className="mt-2 text-sm text-muted-foreground">Centralize processos, clientes e documentos em um só lugar.</p>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <MessageSquare className="h-8 w-8 text-primary" />
              <h3 className="mt-4 font-heading text-lg font-semibold text-card-foreground">Assistente IA</h3>
              <p className="mt-2 text-sm text-muted-foreground">Resuma documentos, gere rascunhos e tire dúvidas jurídicas com contexto.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} JurisMind. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
