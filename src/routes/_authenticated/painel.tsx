import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { FolderKanban, FileText, CalendarClock, RotateCcw } from "lucide-react";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { getCases } from "@/lib/cases.functions";
import { listAllDocuments } from "@/lib/documents.functions";
import { listEvents } from "@/lib/events.functions";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useCapabilities } from "@/hooks/use-capabilities";
import { requiredCapabilityForPath } from "@/lib/route-capabilities";

const RETURN_STORAGE_KEY = "jm.accessReturn";

export const Route = createFileRoute("/_authenticated/painel")({
  validateSearch: (s) =>
    z.object({ next: z.string().optional() }).parse(s),
  component: DashboardPage,
});


function DashboardPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { has, isLoading: capsLoading } = useCapabilities();

  // Resolve retorno: prioriza `?next=` do query; caso contrário, o valor persistido.
  const pendingReturn =
    next ??
    (typeof window !== "undefined"
      ? sessionStorage.getItem(RETURN_STORAGE_KEY) ?? undefined
      : undefined);

  const pendingCap = pendingReturn ? requiredCapabilityForPath(pendingReturn) : null;
  const canReturn =
    !!pendingReturn && (!pendingCap || (!capsLoading && has(pendingCap)));

  // Se o usuário já tem a permissão do destino pendente, redireciona imediatamente.
  useEffect(() => {
    if (!pendingReturn || capsLoading) return;
    if (pendingCap && !has(pendingCap)) return;
    try {
      sessionStorage.removeItem(RETURN_STORAGE_KEY);
    } catch {
      /* noop */
    }
    navigate({ to: pendingReturn, replace: true });
  }, [pendingReturn, pendingCap, capsLoading, has, navigate]);

  const getCasesFn = useServerFn(getCases);
  const listDocsFn = useServerFn(listAllDocuments);
  const listEventsFn = useServerFn(listEvents);
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCasesFn(),
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["documents-all"],
    queryFn: () => listDocsFn(),
  });
  const in7 = new Date(Date.now() + 7 * 86400_000).toISOString();
  const today = new Date().toISOString();
  const { data: upcoming = [] } = useQuery({
    queryKey: ["events", "upcoming-7"],
    queryFn: () => listEventsFn({ data: { from: today, to: in7 } }),
  });

  const totalCases = cases.length;
  const activeCases = cases.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-6">
      {pendingReturn && !canReturn ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div>
            <p className="font-medium">Aguardando liberação de acesso</p>
            <p className="text-muted-foreground">
              Assim que o administrador liberar, retornaremos para{" "}
              <code className="rounded bg-muted px-1 py-0.5">{pendingReturn}</code>.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: pendingReturn })}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <PageHeader
        title="Painel de Controle"
        subtitle="Visão geral dos seus casos, documentos e prazos."
      />


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Casos</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "—" : totalCases}</div>
            <p className="text-xs text-muted-foreground">{activeCases} casos ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{docs.length}</div>
            <p className="text-xs text-muted-foreground">Total carregado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazos próximos</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcoming.length}</div>
            <p className="text-xs text-muted-foreground">Próximos 7 dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="font-heading">Visão Geral</CardTitle>
            <CardDescription>
              Acompanhe o progresso e as atividades recentes da sua equipe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cases.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="Nenhum caso ainda"
                description="Comece criando seu primeiro caso."
                action={
                  <Button asChild size="sm">
                    <Link to="/assistencias">Ir para Casos</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/10">
                {cases.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      {c.client_name && (
                        <p className="text-xs text-muted-foreground truncate">{c.client_name}</p>
                      )}
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/assistencias/$caseId" params={{ caseId: c.id }}>Abrir</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <JurisMindMark size={18} context={JURISMIND_CONTEXT.inlineLight} />
              Assistente JurisMind
            </CardTitle>
            <CardDescription>
              Pergunte sobre seus documentos com JurisMind e citações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/assistente">Abrir assistente</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
