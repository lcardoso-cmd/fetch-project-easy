import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createTask,
  listTasks,
  updateTaskStatus,
  type TaskStatus,
} from "@/lib/tasks.functions";
import { getCases } from "@/lib/cases.functions";
import { listTeamMembers } from "@/lib/team.functions";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";
import { TaskKanban } from "@/components/tasks/task-kanban";

export const Route = createFileRoute("/_authenticated/tarefas")({
  component: MyTasksPage,
});

function MyTasksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const casesFn = useServerFn(getCases);
  const teamFn = useServerFn(listTeamMembers);
  const createFn = useServerFn(createTask);
  const updateStatusFn = useServerFn(updateTaskStatus);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: () => listFn({ data: { status: "all" } }),
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: () => casesFn(),
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => teamFn(),
  });

  const assignees = team
    .filter((m) => m.member_user_id)
    .map((m) => ({ id: m.member_user_id as string, name: m.name }));

  const kanbanCases = cases.map((c) => ({ id: c.id, title: c.title }));

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    const previous = qc.getQueryData<typeof tasks>(["tasks", "all"]);
    qc.setQueryData<typeof tasks>(["tasks", "all"], (old) =>
      (old ?? []).map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
    try {
      await updateStatusFn({ data: { id: taskId, status: newStatus } });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      qc.setQueryData(["tasks", "all"], previous);
      toast.error(e instanceof Error ? e.message : "Erro ao mover tarefa");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Minhas Tarefas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste os cartões entre as colunas para atualizar o status.
          </p>
        </div>
        <AddTaskDialog
          assignees={assignees}
          cases={kanbanCases}
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
          <CardTitle>Quadro de Tarefas</CardTitle>
          <CardDescription>
            {tasks.length}{" "}
            {tasks.length === 1 ? "tarefa" : "tarefas"} no total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="space-y-2 py-12 text-center text-muted-foreground">
              <p className="font-semibold">Nenhuma tarefa encontrada!</p>
              <p className="text-sm">
                Crie sua primeira tarefa clicando em "Nova tarefa".
              </p>
            </div>
          ) : (
            <TaskKanban
              tasks={tasks}
              cases={kanbanCases}
              assignees={assignees}
              onStatusChange={handleStatusChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
