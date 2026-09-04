import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { CalendarPlus, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import {
  createTask,
  deleteTask,
  listTasks,
  reorderTasks,
  updateTask,
  toggleTask,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskStatus,
} from "@/lib/tasks.functions";
import { listEvents, deleteEvent } from "@/lib/events.functions";
import { getCases } from "@/lib/cases.functions";
import { listOrgMembers } from "@/lib/organization.functions";
import { listGoogleCalendarEvents } from "@/lib/google.functions";
import { listOutlookCalendarEvents } from "@/lib/outlook.functions";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { AddEventDialog } from "@/components/work/add-event-dialog";
import { AgendaPanel, type UnifiedEvent } from "@/components/work/agenda-panel";
import { ClipboardCheck } from "lucide-react";

const searchSchema = z.object({
  tab: z.enum(["hoje", "tarefas", "prazos", "agenda", "atrasados"]).optional(),
});

export const Route = createFileRoute("/_authenticated/tarefas")({
  validateSearch: (s) => searchSchema.parse(s),
  component: MyWorkPage,
});

type Task = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  case_id: string | null;
  assigned_to_user_id: string | null;
};

const PERIODS = [
  { value: "7", label: "Próximos 7 dias" },
  { value: "30", label: "Próximos 30 dias" },
  { value: "90", label: "Próximos 90 dias" },
  { value: "all", label: "Todo o período" },
] as const;

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

function MyWorkPage() {
  const qc = useQueryClient();
  const { tab } = Route.useSearch();

  const listTasksFn = useServerFn(listTasks);
  const listEventsFn = useServerFn(listEvents);
  const casesFn = useServerFn(getCases);
  const teamFn = useServerFn(listOrgMembers);
  const updateTaskFn = useServerFn(updateTask);
  const reorderTasksFn = useServerFn(reorderTasks);
  const deleteTaskFn = useServerFn(deleteTask);
  const createTaskFn = useServerFn(createTask);
  const toggleTaskFn = useServerFn(toggleTask);
  const deleteEventFn = useServerFn(deleteEvent);
  const gCalFn = useServerFn(listGoogleCalendarEvents);
  const oCalFn = useServerFn(listOutlookCalendarEvents);

  const [caseFilter, setCaseFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["value"]>("30");

  const { data: rawTasks = [] } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: () => listTasksFn({ data: { status: "all" } }),
  });
  const tasks = rawTasks as unknown as Task[];
  const { data: events = [] } = useQuery({
    queryKey: ["events", "all"],
    queryFn: () => listEventsFn({ data: {} }),
  });
  const { data: cases = [] } = useQuery({ queryKey: ["cases"], queryFn: () => casesFn() });
  const { data: team = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: () => teamFn(),
  });

  const windowStart = startOfToday();
  const windowEnd = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() + Number(period));
    d.setHours(23, 59, 59, 999);
    return d;
  }, [period]);

  const { data: gCal } = useQuery({
    queryKey: ["google-calendar-events", period],
    queryFn: () =>
      gCalFn({
        data: {
          timeMin: windowStart.toISOString(),
          timeMax: (windowEnd ?? new Date(Date.now() + 365 * 86400_000)).toISOString(),
        },
      }),
  });
  const { data: oCal } = useQuery({
    queryKey: ["outlook-calendar-events", period],
    queryFn: () =>
      oCalFn({
        data: {
          timeMin: windowStart.toISOString(),
          timeMax: (windowEnd ?? new Date(Date.now() + 365 * 86400_000)).toISOString(),
        },
      }),
  });

  const assignees = team.map((m) => ({ id: m.id, name: m.name }));
  const kanbanCases = cases.map((c) => ({ id: c.id, title: c.title }));
  const caseTitle = (id: string | null | undefined) =>
    id ? (cases.find((c) => c.id === id)?.title ?? null) : null;

  const inPeriod = (iso: string) => {
    const d = new Date(iso);
    if (windowEnd && d > windowEnd) return false;
    return true;
  };

  const filteredTasks = useMemo(
    () =>
      tasks.filter((t) => {
        if (caseFilter !== "all" && t.case_id !== caseFilter) return false;
        if (assigneeFilter !== "all" && t.assigned_to_user_id !== assigneeFilter) return false;
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (t.due_date && !inPeriod(t.due_date) && t.status !== "done") return false;
        return true;
      }),
    [tasks, caseFilter, assigneeFilter, statusFilter, windowEnd],
  );

  const unifiedEvents: UnifiedEvent[] = useMemo(() => {
    const local: UnifiedEvent[] = events
      .filter((e) => (caseFilter === "all" ? true : e.case_id === caseFilter))
      .filter((e) => inPeriod(e.starts_at))
      .map((e) => ({
        id: `local-${e.id}`,
        localId: e.id,
        title: e.title,
        description: e.description ?? null,
        starts_at: e.starts_at,
        event_type: e.event_type,
        case_id: e.case_id,
        source: "local" as const,
      }));
    const external: UnifiedEvent[] =
      caseFilter === "all"
        ? [
            ...((gCal?.events ?? []) as Array<{
              id: string;
              title: string;
              description: string | null;
              starts_at: string;
              html_link?: string | null;
            }>).map((e) => ({
              id: `gcal-${e.id}`,
              title: e.title,
              description: e.description,
              starts_at: e.starts_at,
              source: "google" as const,
              html_link: e.html_link ?? null,
            })),
            ...((oCal?.events ?? []) as Array<{
              id: string;
              title: string;
              description: string | null;
              starts_at: string;
              html_link?: string | null;
            }>).map((e) => ({
              id: `ocal-${e.id}`,
              title: e.title,
              description: e.description,
              starts_at: e.starts_at,
              source: "outlook" as const,
              html_link: e.html_link ?? null,
            })),
          ]
        : [];
    return [...local, ...external];
  }, [events, gCal, oCal, caseFilter, windowEnd]);

  const now = new Date();
  const todayEnd = endOfToday();
  const todayStart = startOfToday();

  const todayEvents = unifiedEvents.filter((e) => {
    const d = new Date(e.starts_at);
    return d >= todayStart && d <= todayEnd;
  });
  const upcomingEvents = unifiedEvents.filter((e) => new Date(e.starts_at) > todayEnd);
  const deadlineEvents = unifiedEvents.filter(
    (e) => e.source === "local" && e.event_type === "deadline",
  );
  const overdueEvents = unifiedEvents.filter(
    (e) => e.source === "local" && new Date(e.starts_at) < todayStart,
  );

  const openTasks = filteredTasks.filter((t) => t.status !== "done");
  const todayTasks = openTasks.filter(
    (t) => t.due_date && new Date(t.due_date) >= todayStart && new Date(t.due_date) <= todayEnd,
  );
  const overdueTasks = openTasks.filter((t) => t.due_date && new Date(t.due_date) < now);


  const removeEvent = async (id: string) => {
    await deleteEventFn({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["events"] });
    toast.success("Compromisso excluído");
  };

  const TaskRows = ({ items, empty }: { items: Task[]; empty: string }) =>
    items.length === 0 ? (
      <EmptyState icon={ClipboardCheck} title={empty} />
    ) : (
      <ul className="divide-y divide-black/5 border-y border-black/5 dark:divide-white/10 dark:border-white/10">
        {items.map((t) => {
          const title = caseTitle(t.case_id);
          const overdue = t.due_date && new Date(t.due_date) < now && t.status !== "done";
          return (
            <li key={t.id} className="flex items-start gap-3 py-3">
              <Checkbox
                className="mt-0.5 shrink-0"
                checked={t.status === "done"}
                aria-label={`Concluir ${t.title}`}
                onCheckedChange={async (c) => {
                  await toggleTaskFn({ data: { id: t.id, done: Boolean(c) } });
                  await qc.invalidateQueries({ queryKey: ["tasks"] });
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium break-words ${
                    t.status === "done" ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {t.title}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary" className="text-xs">
                    {TASK_STATUS_LABEL[t.status as TaskStatus] ?? t.status}
                  </Badge>
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
    <div className="space-y-6">
      <PageHeader
        title="Meu trabalho"
        subtitle="Tarefas, prazos e compromissos reunidos em um só lugar."
        actions={
          <>
            <AddEventDialog cases={kanbanCases}>
              <Button variant="outline" size="sm">
                <CalendarPlus className="mr-2 h-4 w-4" /> Novo compromisso
              </Button>
            </AddEventDialog>
            <AddTaskDialog
              assignees={assignees}
              cases={kanbanCases}
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
                  toast.error(e instanceof Error ? e.message : "Erro");
                }
              }}
            >
              <Button size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Nova tarefa
              </Button>
            </AddTaskDialog>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Caso</Label>
          <Select value={caseFilter} onValueChange={setCaseFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os casos</SelectItem>
              {kanbanCases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Responsável</Label>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Período</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Status da tarefa</Label>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue={tab ?? "hoje"} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="hoje" className="text-sm">
            Hoje
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="text-sm">
            Tarefas
          </TabsTrigger>
          <TabsTrigger value="prazos" className="text-sm">
            Prazos
          </TabsTrigger>
          <TabsTrigger value="agenda" className="text-sm">
            Agenda
          </TabsTrigger>
          <TabsTrigger value="atrasados" className="text-sm">
            Atrasados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-heading text-base font-medium">Compromissos de hoje</h2>
            <AgendaPanel
              events={todayEvents}
              caseTitle={caseTitle}
              onDelete={removeEvent}
              emptyTitle="Nenhum compromisso hoje"
            />
          </section>
          {overdueTasks.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-heading text-base font-medium text-destructive">Tarefas atrasadas</h2>
              <TaskRows items={overdueTasks} empty="Nenhuma tarefa atrasada" />
            </section>
          )}
          <section className="space-y-3">
            <h2 className="font-heading text-base font-medium">Tarefas de hoje</h2>
            <TaskRows items={todayTasks} empty="Nenhuma tarefa com prazo para hoje" />
          </section>
          <section className="space-y-3">
            <h2 className="font-heading text-base font-medium">Próximos compromissos</h2>
            <AgendaPanel
              events={upcomingEvents.slice(0, 10)}
              caseTitle={caseTitle}
              onDelete={removeEvent}
              emptyTitle="Nada agendado no período"
            />
          </section>
        </TabsContent>

        <TabsContent value="tarefas">
          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nenhuma tarefa encontrada"
              description="Ajuste os filtros ou crie uma nova tarefa."
            />
          ) : (
            <KanbanBoard
              tasks={filteredTasks as never}
              cases={kanbanCases}
              assignees={assignees}
              onReorder={async (status, orderedIds) => {
                try {
                  await reorderTasksFn({
                    data: { status, ordered_ids: orderedIds },
                  });
                  await qc.invalidateQueries({ queryKey: ["tasks"] });
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Erro ao mover tarefa",
                  );
                  throw e;
                }
              }}
              onEdit={async (id, values) => {
                await updateTaskFn({ data: { id, ...values } });
                await qc.invalidateQueries({ queryKey: ["tasks"] });
                toast.success("Tarefa atualizada");
              }}
              onDelete={async (id) => {
                try {
                  await deleteTaskFn({ data: { id } });
                  await qc.invalidateQueries({ queryKey: ["tasks"] });
                  toast.success("Tarefa excluída");
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Erro ao excluir tarefa",
                  );
                }
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="prazos">
          <AgendaPanel
            events={deadlineEvents}
            caseTitle={caseTitle}
            onDelete={removeEvent}
            emptyTitle="Nenhum prazo registrado no período"
          />
        </TabsContent>

        <TabsContent value="agenda">
          <AgendaPanel
            events={unifiedEvents}
            caseTitle={caseTitle}
            onDelete={removeEvent}
            emptyTitle="Nenhum compromisso no período"
            emptyDescription="Compromissos sincronizados das agendas conectadas também aparecem aqui."
          />
        </TabsContent>

        <TabsContent value="atrasados" className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-heading text-base font-medium">Tarefas atrasadas</h2>
            <TaskRows items={overdueTasks} empty="Nenhuma tarefa atrasada" />
          </section>
          <section className="space-y-3">
            <h2 className="font-heading text-base font-medium">Compromissos vencidos</h2>
            <AgendaPanel
              events={overdueEvents}
              caseTitle={caseTitle}
              onDelete={removeEvent}
              emptyTitle="Nenhum compromisso vencido"
            />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
