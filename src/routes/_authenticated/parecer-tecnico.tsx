import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Microscope,
  Briefcase,
  ArrowRight,
  ExternalLink,
  Paperclip,
  Clock,
  Download,
  MessageSquare,
  FileText,
  CircleDot,
} from "lucide-react";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  listMyB2bRequests,
  getB2bRequest,
  getB2bAttachmentUrl,
  B2B_REQUEST_STATUS_LABEL,
  type B2bRequestStatus,
  type B2bServiceRequestEvent,
} from "@/lib/b2b-services.functions";

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

function statusVariant(
  s: B2bRequestStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (s === "aceita") return "default";
  if (s === "recusada" || s === "cancelada") return "destructive";
  if (s === "proposta_enviada") return "default";
  return "secondary";
}



function ExpertOpinionPage() {
  const listMy = useServerFn(listMyB2bRequests);
  const { data: requests = [] } = useQuery({
    queryKey: ["b2b-my-requests"],
    queryFn: () => listMy(),
  });
  const parecerRequests = requests
    .filter((r) => r.service_slug === "parecer-tecnico")
    .slice(0, 5);

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
              search={{
                service: "parecer-tecnico",
                title: "Parecer Técnico - contratação B2B",
                description:
                  "Necessito de parecer técnico elaborado pela B2B Consulting para instruir processo em que o escritório não dispõe de perito próprio.\n\nContexto do caso:\n- Natureza da demanda (cível, trabalhista, tributária, societária, regulatória): \n- Área do parecer (econômica, contábil, financeira, de engenharia, contratual): \n- Partes envolvidas: \n- Fase processual e prazo judicial (se houver): \n- Objeto/pergunta técnica a ser respondida: \n- Quesitos preliminares: \n- Documentos disponíveis (anexar abaixo): \n\nObservações adicionais: ",
              }}
            >
              Contratar Parecer Técnico com a B2B
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

        </CardContent>
      </Card>

      {parecerRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Minhas solicitações de Parecer Técnico</CardTitle>
            <CardDescription>
              Últimas solicitações enviadas à B2B para elaboração de parecer técnico.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {parecerRequests.map((r) => (
              <Link
                key={r.id}
                to="/contratar-b2b/$requestId"
                params={{ requestId: r.id }}
                className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-accent transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Badge variant={statusVariant(r.status)}>
                  {B2B_REQUEST_STATUS_LABEL[r.status]}
                </Badge>
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
            <div className="pt-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/contratar-b2b">Ver catálogo B2B</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



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
