import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, FileText, CalendarClock } from "lucide-react";
import { JurisMindMark } from "@/components/brand/jurismind-mark";
import { getCases } from "@/lib/cases.functions";
import { listAllDocuments } from "@/lib/documents.functions";
import { listEvents } from "@/lib/events.functions";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/painel")({
  component: DashboardPage,
});

function DashboardPage() {
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
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold font-heading tracking-tight">Painel de Controle</h2>
      </div>

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
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-medium">Nenhum caso ainda</p>
                <p className="text-sm text-muted-foreground">Comece criando seu primeiro caso.</p>
                <Button asChild className="mt-4">
                  <Link to="/assistencias">Ir para Casos</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {cases.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{c.title}</p>
                      {c.client_name && (
                        <p className="text-xs text-muted-foreground">{c.client_name}</p>
                      )}
                    </div>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/cases/${c.id}`}>Abrir</Link>
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
              <JurisMindMark size={18} context="inline-light" />
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
