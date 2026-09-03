import { useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  BrainCircuit,
  CalendarPlus,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Loader2,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { getCases } from "@/lib/cases.functions";
import { listAllDocuments } from "@/lib/documents.functions";
import { listEvents } from "@/lib/events.functions";
import { createTask, listTasks, toggleTask } from "@/lib/tasks.functions";
import { listTeamMembers } from "@/lib/team.functions";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";
import { AddEventDialog } from "@/components/work/add-event-dialog";
import { AgendaPanel, type UnifiedEvent } from "@/components/work/agenda-panel";
import { useCapabilities } from "@/hooks/use-capabilities";
import { requiredCapabilityForPath } from "@/lib/route-capabilities";

const RETURN_STORAGE_KEY = "jm.accessReturn";

export const Route = createFileRoute("/_authenticated/painel")({
  validateSearch: (s) => z.object({ next: z.string().optional() }).parse(s),
  component: HomePage,
});

type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  case_id: string | null;
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { next } = Route.useSearch();
  const { has, isLoading: capsLoading } = useCapabilities();

  const pendingReturn =
    next ??
    (typeof window !== "undefined"
      ? (sessionStorage.getItem(RETURN_STORAGE_KEY) ?? undefined)
      : undefined);
  const pendingCap = pendingReturn ? requiredCapabilityForPath(pendingReturn) : null;
  const canReturn = !!pendingReturn && (!pendingCap || (!capsLoading && has(pendingCap)));

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
  const listTasksFn = useServerFn(listTasks);
  const toggleTaskFn = useServerFn(toggleTask);
  const createTaskFn = useServerFn(createTask);
  const teamFn = useServerFn(listTeamMembers);

  const { data: cases = [] } = useQuery({ queryKey: ["cases"], queryFn: () => getCasesFn() });
  const { data: docs = [] } = useQuery({
    queryKey: ["documents-all"],
    queryFn: () => listDocsFn(),
    refetchInterval: 15000,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events", "all"],
    queryFn: () => listEventsFn({ data: {} }),
  });
  const { data: rawTasks = [] } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: () => listTasksFn({ data: { status: "all" } }),
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => teamFn(),
  });

  const tasks = rawTasks as unknown as Task[];
  const assignees = team
    .filter((m) => m.member_user_id)
    .map((m) => ({ id: m.member_user_id as string, name: m.name }));
  const caseOptions = cases.map((c) => ({ id: c.id, title: c.title }));
  const caseTitle = (id: string | null | undefined) =>
    id ? (cases.find((c) => c.id === id)?.title ?? null) : null;

  const now = new Date();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const unified: UnifiedEvent[] = useMemo(
    () =>
      events.map((e) => ({
        id: `local-${e.id}`,
        localId: e.id,
        title: e.title,
        description: e.description ?? null,
        starts_at: e.starts_at,
        event_type: e.event_type,
        case_id: e.case_id,
        source: "local" as const,
      })),
    [events],
  );

  const todayEvents = unified.filter((e) => {
    const d = new Date(e.starts_at);
    return d >= todayStart && d <= todayEnd;
  });
  const upcomingEvents = unified
    .filter((e) => new Date(e.starts_at) > todayEnd)
    .slice(0, 6);

  const openTasks = tasks.filter((t) => t.status !== "done");
  const overdueTasks = openTasks.filter((t) => t.due_date && new Date(t.due_date) < now);
  const pendingTasks = openTasks
    .filter((t) => !t.due_date || new Date(t.due_date) >= now)
    .slice(0, 6);

  const processingDocs = docs.filter(
    (d) => d.processing_status !== "ready" && d.processing_status !== "error",
  );
  const failedDocs = docs.filter((d) => d.processing_status === "error");
  const recentCases = cases.slice(0, 5);
  const recentDocs = docs.slice(0, 5);

  const TaskRows = ({ items, empty }: { items: Task[]; empty: string }) =>
    items.length === 0 ? (
      <p className="py-3 text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="divide-y divide-black/5 border-y border-black/5 dark:divide-white/10 dark:border-white/10">
        {items.map((t) => {
          const title = caseTitle(t.case_id);
          const overdue = t.due_date && new Date(t.due_date) < now;
          return (
            <li key={t.id} className="flex items-start gap-3 py-3">
              <Checkbox
                className="mt-0.5 shrink-0"
                checked={false}
                aria-label={`Concluir ${t.title}`}
                onCheckedChange={async () => {
                  await toggleTaskFn({ data: { id: t.id, done: true } });
                  await qc.invalidateQueries({ queryKey: ["tasks"] });
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">{t.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {t.due_date && (
                    <span className={overdue ? "text-destructive" : undefined}>
                      {new Date(t.due_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  {t.case_id && title && (
                    <>
                      <span aria-hidden>·</span>
                      <Link
                        to="/assistencias/$caseId"
                        params={{ caseId: t.case_id }}
                        className="underline"
                      >
                        {title}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="space-y-8">
      {pendingReturn && !canReturn ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div>
            <p className="font-medium">Aguardando liberação de acesso</p>
            <p className="text-muted-foreground">
              Assim que o administrador liberar, retornaremos para{" "}
              <code className="rounded bg-muted px-1 py-0.5">{pendingReturn}</code>.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: pendingReturn })}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <PageHeader
        title="Início"
        subtitle="O que precisa da sua atenção hoje."
        actions={
          <Button size="sm" asChild>
            <Link to="/assistente">
              <BrainCircuit className="mr-2 h-4 w-4" /> Perguntar à JurisMind
            </Link>
          </Button>
        }
      />

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/assistencias/nova">
            <Plus className="mr-2 h-4 w-4" /> Novo caso
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/assistencias">
            <Upload className="mr-2 h-4 w-4" /> Enviar documentos
          </Link>
        </Button>
        <AddTaskDialog
          assignees={assignees}
          cases={caseOptions}
          onCreate={async (p) => {
            try {
              await createTaskFn({
                data: {
                  title: p.title,
                  status: p.status,
                  due_date: p.due_date,
                  assigned_to_user_id: p.assigned_to_user_id,
                  case_id: p.case_id ?? null,
                  priority: "medium",
                },
              });
              await qc.invalidateQueries({ queryKey: ["tasks"] });
              toast.success("Tarefa criada");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
            }
          }}
        >
          <Button variant="outline" size="sm">
            <ClipboardCheck className="mr-2 h-4 w-4" /> Criar tarefa
          </Button>
        </AddTaskDialog>
        <AddEventDialog cases={caseOptions}>
          <Button variant="outline" size="sm">
            <CalendarPlus className="mr-2 h-4 w-4" /> Criar evento
          </Button>
        </AddEventDialog>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-medium">Prazos de hoje</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tarefas" search={{ tab: "hoje" }}>
                Ver meu trabalho
              </Link>
            </Button>
          </div>
          <AgendaPanel
            events={todayEvents}
            caseTitle={caseTitle}
            emptyTitle="Nenhum prazo para hoje"
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-medium">Próximos prazos</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tarefas" search={{ tab: "prazos" }}>
                Ver prazos
              </Link>
            </Button>
          </div>
          <AgendaPanel
            events={upcomingEvents}
            caseTitle={caseTitle}
            emptyTitle="Nenhum prazo futuro registrado"
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-medium">Tarefas pendentes</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tarefas" search={{ tab: "tarefas" }}>
                Ver tarefas
              </Link>
            </Button>
          </div>
          <TaskRows items={pendingTasks} empty="Nenhuma tarefa pendente." />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-medium">
              Tarefas atrasadas
              {overdueTasks.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {overdueTasks.length}
                </Badge>
              )}
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/tarefas" search={{ tab: "atrasados" }}>
                Ver atrasados
              </Link>
            </Button>
          </div>
          <TaskRows items={overdueTasks.slice(0, 6)} empty="Nada atrasado. Bom trabalho." />
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-medium">Casos recentes</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/assistencias">Ver todos</Link>
            </Button>
          </div>
          {recentCases.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="Nenhum caso ainda"
              description="Comece criando seu primeiro caso."
              action={
                <Button size="sm" asChild>
                  <Link to="/assistencias/nova">Criar caso</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-black/5 border-y border-black/5 dark:divide-white/10 dark:border-white/10">
              {recentCases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      to="/assistencias/$caseId"
                      params={{ caseId: c.id }}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    {c.client_name && (
                      <p className="truncate text-sm text-muted-foreground">{c.client_name}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      to="/assistencias/$caseId"
                      params={{ caseId: c.id }}
                      search={{ tab: "jurismind" }}
                    >
                      <BrainCircuit className="mr-1 h-4 w-4" /> Analisar
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-medium">Documentos</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/documentos">Ver biblioteca</Link>
            </Button>
          </div>
          <ul className="divide-y divide-black/5 border-y border-black/5 dark:divide-white/10 dark:border-white/10">
            <li className="flex items-center gap-3 py-3 text-sm">
              <Loader2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">Em processamento</span>
              <span className="font-medium tabular-nums">{processingDocs.length}</span>
            </li>
            <li className="flex items-center gap-3 py-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <span className="flex-1">Com falha no processamento</span>
              <span className="font-medium tabular-nums">{failedDocs.length}</span>
            </li>
          </ul>
          {failedDocs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Abra o caso do documento para reprocessar os arquivos com falha.
            </p>
          )}
        </section>

        <section className="space-y-3 lg:col-span-2">
          <h2 className="font-heading text-base font-medium">Atividades recentes</h2>
          {recentDocs.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <ul className="divide-y divide-black/5 border-y border-black/5 dark:divide-white/10 dark:border-white/10">
              {recentDocs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 break-words">
                    {d.filename}
                    {caseTitle(d.case_id) ? (
                      <span className="text-muted-foreground"> — {caseTitle(d.case_id)}</span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(d.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
