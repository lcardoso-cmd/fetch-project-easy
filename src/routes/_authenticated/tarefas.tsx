import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, PlusCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  createTask,
  listTasks,
  TASK_STATUS_LABEL,
  type TaskStatus,
} from "@/lib/tasks.functions";
import { getCases } from "@/lib/cases.functions";
import { listTeamMembers } from "@/lib/team.functions";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: MyTasksPage,
});

function getDueDateColor(dueDate: string | null, status: string): string {
  if (!dueDate) return "text-muted-foreground";
  if (status === "done") return "text-green-500";
  const hours = differenceInHours(parseISO(dueDate), new Date());
  if (hours < 0) return "text-red-500 font-semibold";
  if (hours <= 2) return "text-red-500";
  if (hours <= 6) return "text-yellow-500";
  return "text-muted-foreground";
}

function statusVariant(s: string): "outline" | "secondary" | "destructive" | "default" {
  if (s === "pending") return "outline";
  if (s === "in_progress") return "secondary";
  if (s === "blocked") return "destructive";
  return "default";
}

function MyTasksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const casesFn = useServerFn(getCases);
  const teamFn = useServerFn(listTeamMembers);
  const createFn = useServerFn(createTask);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: () => listFn({ data: { status: "all" } }),
  });
  const { data: cases = [] } = useQuery({ queryKey: ["cases"], queryFn: () => casesFn() });
  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => teamFn(),
  });

  const assignees = team
    .filter((m) => m.member_user_id)
    .map((m) => ({ id: m.member_user_id as string, name: m.name }));

  const tasksByCase = useMemo(() => {
    const grouped: Record<
      string,
      { caseInfo: { id: string; title: string } | null; tasks: typeof tasks }
    > = {};
    const orphanKey = "__no_case__";
    tasks.forEach((t) => {
      const key = t.case_id ?? orphanKey;
      if (!grouped[key]) {
        const c = cases.find((x) => x.id === t.case_id);
        grouped[key] = {
          caseInfo: c ? { id: c.id, title: c.title } : null,
          tasks: [],
        };
      }
      grouped[key].tasks.push(t);
    });
    return Object.entries(grouped).sort(([, a], [, b]) =>
      (a.caseInfo?.title ?? "").localeCompare(b.caseInfo?.title ?? ""),
    );
  }, [tasks, cases]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Minhas Tarefas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todas as suas tarefas, criadas por você ou atribuídas a você, em um só lugar.
          </p>
        </div>
        <AddTaskDialog
          assignees={assignees}
          cases={cases.map((c) => ({ id: c.id, title: c.title }))}
          onCreate={async (p) => {
            try {
              await createFn({
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
          <Button size="sm" className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Nova tarefa
          </Button>
        </AddTaskDialog>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Visão Geral das Tarefas</CardTitle>
          <CardDescription>
            {tasks.length} {tasks.length === 1 ? "tarefa encontrada" : "tarefas encontradas"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasksByCase.length === 0 ? (
            <div className="space-y-2 py-12 text-center text-muted-foreground">
              <p className="font-semibold">Nenhuma tarefa encontrada!</p>
              <p className="text-sm">
                Crie sua primeira tarefa clicando em "Nova tarefa".
              </p>
            </div>
          ) : (
            <Accordion
              type="multiple"
              defaultValue={tasksByCase.map(([k]) => k)}
              className="w-full"
            >
              {tasksByCase.map(([key, group]) => (
                <AccordionItem value={key} key={key}>
                  <AccordionTrigger className="text-base font-semibold hover:no-underline sm:text-lg">
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
                      <span className="truncate text-left">
                        {group.caseInfo?.title ?? "Sem caso vinculado"}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {group.tasks.length}{" "}
                        {group.tasks.length === 1 ? "tarefa" : "tarefas"}
                      </Badge>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent>
                    {/* Mobile: stacked cards */}
                    <ul className="space-y-2 sm:hidden">
                      {group.tasks.map((t) => {
                        const assignee = assignees.find(
                          (a) => a.id === t.assigned_to_user_id,
                        );
                        return (
                          <li
                            key={t.id}
                            className="rounded-md border bg-card/50 p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1 text-sm font-medium">
                                {group.caseInfo ? (
                                  <Link
                                    to="/assistencias/$caseId"
                                    params={{ caseId: group.caseInfo.id }}
                                    className="text-primary hover:underline break-words"
                                  >
                                    {t.title}
                                  </Link>
                                ) : (
                                  <span className="break-words">{t.title}</span>
                                )}
                              </div>
                              <Badge variant={statusVariant(t.status)} className="shrink-0">
                                {TASK_STATUS_LABEL[t.status as TaskStatus] ?? t.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              {t.due_date ? (
                                <div
                                  className={cn(
                                    "flex items-center gap-1.5",
                                    getDueDateColor(t.due_date, t.status),
                                  )}
                                >
                                  <Clock className="h-3 w-3" />
                                  {format(
                                    parseISO(t.due_date),
                                    "dd/MM/yy 'às' HH:mm",
                                    { locale: ptBR },
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Sem prazo</span>
                              )}
                              {assignee ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[9px]">
                                      {assignee.name.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{assignee.name}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Não atribuído</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Tablet/Desktop: table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tarefa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead>Responsável</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.tasks.map((t) => {
                            const assignee = assignees.find(
                              (a) => a.id === t.assigned_to_user_id,
                            );
                            return (
                              <TableRow key={t.id}>
                                <TableCell className="font-medium">
                                  {group.caseInfo ? (
                                    <Link
                                      to="/assistencias/$caseId"
                                      params={{ caseId: group.caseInfo.id }}
                                      className="text-primary hover:underline"
                                    >
                                      {t.title}
                                    </Link>
                                  ) : (
                                    t.title
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={statusVariant(t.status)}>
                                    {TASK_STATUS_LABEL[t.status as TaskStatus] ?? t.status}
                                  </Badge>
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-xs whitespace-nowrap",
                                    getDueDateColor(t.due_date, t.status),
                                  )}
                                >
                                  {t.due_date ? (
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-3 w-3" />
                                      {format(
                                        parseISO(t.due_date),
                                        "dd/MM/yy 'às' HH:mm",
                                        { locale: ptBR },
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {assignee ? (
                                    <div className="flex items-center gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback>
                                          {assignee.name.charAt(0)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>{assignee.name}</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">
                                      Não atribuído
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>

                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
