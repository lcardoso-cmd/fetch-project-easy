import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Microscope, Briefcase, ArrowRight } from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const assertExpert = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>;
    }).rpc("has_capability", {
      _user_id: context.userId,
      _capability: "expert_opinion",
    });
    if (!data) throw new Error("Sem permissão");
    return { ok: true };
  });

export const Route = createFileRoute("/_authenticated/parecer-tecnico")({
  beforeLoad: async () => {
    try {
      await assertExpert();
    } catch {
      throw redirect({ to: "/painel" });
    }
  },
  component: ExpertOpinionPage,
});

function ExpertOpinionPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight flex items-center gap-2">
          <Microscope className="h-7 w-7 text-primary" /> Parecer Técnico
        </h1>
        <p className="mt-1 text-muted-foreground">
          Área dedicada a peritos para elaborar e exportar pareceres técnicos com o padrão de
          formatação do escritório.
        </p>
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Não tem perito no escritório?
          </CardTitle>
          <CardDescription>
            Contrate a B2B Consulting para elaborar o parecer técnico do seu caso —
            assistência econômica, contábil, financeira ou de engenharia, com o mesmo
            padrão de qualidade e formatação usado no JurisMind.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link
              to="/contratar-b2b/solicitar"
              search={{ service: "parecer-tecnico" }}
            >
              Contratar Parecer Técnico com a B2B
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Em construção</CardTitle>
          <CardDescription>
            O editor de parecer técnico usará o mesmo motor unificado de documentos
            (mesmo DOCX/PDF, margens, fontes e cabeçalho do escritório) já disponível em
            Peças Jurídicas e Proposta Comercial.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Enquanto isso, você pode criar rascunhos em{" "}
            <Link to="/pecas" className="text-primary underline">
              Peças Jurídicas
            </Link>{" "}
            e exportar com o mesmo padrão.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
