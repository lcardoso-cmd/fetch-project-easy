import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTaskStatus,
} from "@/lib/tasks.functions";
import { listTeamMembers } from "@/lib/team.functions";
import { KanbanBoard, type KanbanTask } from "./kanban-board";
import { AddTaskDialog } from "./add-task-dialog";

export function TaskManager({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTaskStatus);
  const deleteFn = useServerFn(deleteTask);
  const teamFn = useServerFn(listTeamMembers);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "case", caseId],
    queryFn: () => listFn({ data: { case_id: caseId, status: "all" } }),
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => teamFn(),
  });

  const assignees = team
    .filter((m) => m.member_user_id)
    .map((m) => ({ id: m.member_user_id as string, name: m.name }));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Gerenciador de Tarefas</CardTitle>
          <CardDescription>
            Acompanhe o progresso das atividades em um painel Kanban.
          </CardDescription>
        </div>
        <AddTaskDialog
          assignees={assignees}
          defaultCaseId={caseId}
          onCreate={async (payload) => {
            try {
              await createFn({
                data: {
                  case_id: caseId,
                  title: payload.title,
                  status: payload.status,
                  due_date: payload.due_date,
                  assigned_to_user_id: payload.assigned_to_user_id,
                  priority: "medium",
                },
              });
              await invalidate();
              toast.success("Tarefa criada");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao criar");
            }
          }}
        >
          <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
          </Button>
        </AddTaskDialog>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p>Nenhuma tarefa para este caso.</p>
            <p className="text-xs">Clique em "Adicionar Tarefa" para começar.</p>
          </div>
        ) : (
          <KanbanBoard
            tasks={tasks as KanbanTask[]}
            assignees={assignees}
            onStatusChange={async (id, status) => {
              await updateFn({ data: { id, status } });
              await invalidate();
            }}
            onDelete={async (id) => {
              if (!confirm("Excluir esta tarefa?")) return;
              await deleteFn({ data: { id } });
              await invalidate();
              toast.success("Tarefa excluída");
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
