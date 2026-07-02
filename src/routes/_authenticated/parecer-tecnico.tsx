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
  Inbox,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

const PARECER_PREFILL = {
  service: "parecer-tecnico",
  title: "Parecer Técnico - contratação B2B",
  description:
    "Necessito de parecer técnico elaborado pela B2B Consulting para instruir processo em que o escritório não dispõe de perito próprio.\n\n=== 1. Objetivo ===\n[Descreva em 1-2 frases a pergunta técnica central a ser respondida pelo parecer.]\n\n=== 2. Escopo ===\n- Área do parecer (econômica, contábil, financeira, de engenharia, contratual): \n- Natureza da demanda (cível, trabalhista, tributária, societária, regulatória): \n- Pontos que DEVEM ser analisados: \n- Pontos que estão FORA do escopo: \n\n=== 3. Prazo ===\n- Data-limite desejada para entrega: \n- Prazo judicial vinculado (se houver): \n- Urgência (normal / prioritária / crítica): \n\n=== 4. Contexto do caso ===\n- Partes envolvidas: \n- Fase processual: \n- Quesitos preliminares: \n- Documentos disponíveis (anexar abaixo): \n\n=== 5. Observações adicionais ===\n[Informações extras, restrições de sigilo, contatos preferenciais.]",
} as const;

function ExpertOpinionPage() {
  const listMy = useServerFn(listMyB2bRequests);
  const [pageSize, setPageSize] = useState(5);
  const firstNewItemRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef(0);

  const { data, isPending, isFetching } = useQuery({
    queryKey: ["b2b-my-requests", "parecer-tecnico", pageSize],
    queryFn: () =>
      listMy({ data: { service: "parecer-tecnico", limit: pageSize, offset: 0 } }),
    placeholderData: (prev) => prev,
  });

  const parecerRequests = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = parecerRequests.length < total;

  useEffect(() => {
    if (parecerRequests.length > prevCountRef.current && prevCountRef.current > 0) {
      firstNewItemRef.current?.focus();
    }
    prevCountRef.current = parecerRequests.length;
  }, [parecerRequests.length]);

  function handleLoadMore() {
    setPageSize((n) => n + 5);
  }
  function handleShowLess() {
    setPageSize(5);
    prevCountRef.current = 0;
  }

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
              search={PARECER_PREFILL}
            >

              Contratar Parecer Técnico com a B2B
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Minhas solicitações de Parecer Técnico</CardTitle>
          <CardDescription>
            Acompanhe status, anexos e histórico das solicitações enviadas à B2B.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2" aria-hidden="true">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-3/4" />
            </div>
          ) : parecerRequests.length === 0 ? (
            <div
              role="status"
              className="flex flex-col items-center text-center py-10 px-4 gap-3"
            >
              <div className="rounded-full bg-muted p-3">
                <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Nenhuma solicitação encontrada</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Você ainda não abriu solicitações de Parecer Técnico com a B2B
                  Consulting. Crie uma agora para receber orçamento e acompanhar o
                  andamento por aqui.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                <Button asChild size="sm">
                  <Link to="/contratar-b2b/solicitar" search={PARECER_PREFILL}>
                    Solicitar Parecer Técnico
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/contratar-b2b">Ver catálogo B2B</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Accordion type="multiple" className="w-full">
                {parecerRequests.map((r, idx) => (
                  <AccordionItem key={r.id} value={r.id}>
                    <div
                      ref={idx === prevCountRef.current ? firstNewItemRef : null}
                      tabIndex={-1}
                      className="outline-none"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 w-full pr-2 min-w-0">
                          <div className="min-w-0 flex-1 text-left">
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
                        </div>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent>
                      <RequestPanel requestId={r.id} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <div className="pt-3 flex flex-wrap items-center gap-2">
                <p
                  role="status"
                  aria-live="polite"
                  className="text-xs text-muted-foreground mr-auto"
                >
                  Exibindo {parecerRequests.length} de {total}{" "}
                  {total === 1 ? "solicitação" : "solicitações"}
                </p>
                {hasMore ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={isFetching}
                  >
                    {isFetching ? "Carregando…" : "Carregar mais"}
                  </Button>
                ) : total > 5 ? (
                  <Button variant="ghost" size="sm" onClick={handleShowLess}>
                    Mostrar menos
                  </Button>
                ) : null}
                <Button asChild variant="ghost" size="sm">
                  <Link to="/contratar-b2b">Ver catálogo B2B</Link>
                </Button>
              </div>
            </>
          )}
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

function formatBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function eventIcon(kind: B2bServiceRequestEvent["kind"]) {
  if (kind === "status_change") return <CircleDot className="h-3.5 w-3.5" />;
  if (kind === "attachment") return <Paperclip className="h-3.5 w-3.5" />;
  if (kind === "note_public" || kind === "note_internal")
    return <MessageSquare className="h-3.5 w-3.5" />;
  if (kind === "created") return <FileText className="h-3.5 w-3.5" />;
  return <Clock className="h-3.5 w-3.5" />;
}

function eventLabel(ev: B2bServiceRequestEvent): string {
  if (ev.kind === "status_change") {
    const from = ev.payload.from as B2bRequestStatus | undefined;
    const to = ev.payload.to as B2bRequestStatus | undefined;
    return `Status: ${from ? B2B_REQUEST_STATUS_LABEL[from] : "—"} → ${
      to ? B2B_REQUEST_STATUS_LABEL[to] : "—"
    }`;
  }
  if (ev.kind === "attachment")
    return `Anexo enviado: ${ev.payload.file_name ?? "arquivo"}`;
  if (ev.kind === "note_public") return ev.payload.text ?? "Comentário";
  if (ev.kind === "note_internal")
    return `[Interno] ${ev.payload.text ?? "Nota interna"}`;
  if (ev.kind === "created") return "Solicitação criada";
  return ev.kind;
}

function RequestPanel({ requestId }: { requestId: string }) {
  const getReq = useServerFn(getB2bRequest);
  const getAttUrl = useServerFn(getB2bAttachmentUrl);
  const { data, isLoading } = useQuery({
    queryKey: ["b2b-request", requestId],
    queryFn: () => getReq({ data: { id: requestId } }),
  });

  if (isLoading || !data) {
    return (
      <p className="text-sm text-muted-foreground py-2">Carregando detalhes…</p>
    );
  }

  const { request, events, attachments } = data;
  const visibleAtt = attachments.filter((a) => a.visibility === "client");
  const visibleEvents = events.filter((e) => e.kind !== "note_internal");

  async function openAttachment(id: string) {
    try {
      const { url } = await getAttUrl({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="rounded-md border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Descrição
        </p>
        <p className="text-sm whitespace-pre-wrap line-clamp-6">
          {request.description}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Anexos ({visibleAtt.length})
        </p>
        {visibleAtt.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
        ) : (
          <ul className="space-y-1.5">
            {visibleAtt.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">{a.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatBytes(a.size_bytes)} ·{" "}
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openAttachment(a.id)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Histórico ({visibleEvents.length})
        </p>
        {visibleEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem eventos.</p>
        ) : (
          <ol className="relative border-l pl-4 space-y-3">
            {visibleEvents.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[21px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background border text-muted-foreground">
                  {eventIcon(ev.kind)}
                </span>
                <p className="text-sm">{eventLabel(ev)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(ev.created_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="pt-1">
        <Button asChild size="sm" variant="outline">
          <Link
            to="/contratar-b2b/$requestId"
            params={{ requestId: request.id }}
          >
            Abrir solicitação completa
            <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
