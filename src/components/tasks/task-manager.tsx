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
  reorderTasks,
  updateTask,
} from "@/lib/tasks.functions";
import { listOrgMembers } from "@/lib/organization.functions";
import { KanbanBoard, type KanbanTask } from "./kanban-board";
import { AddTaskDialog } from "./add-task-dialog";

export function TaskManager({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const updateFn = useServerFn(updateTask);
  const reorderFn = useServerFn(reorderTasks);
  const deleteFn = useServerFn(deleteTask);
  const membersFn = useServerFn(listOrgMembers);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "case", caseId],
    queryFn: () => listFn({ data: { case_id: caseId, status: "all" } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["org-members"],
    queryFn: () => membersFn(),
  });

  const assignees = members.map((m) => ({ id: m.id, name: m.name }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Tarefas do caso</CardTitle>
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
              toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
            }
          }}
        >
          <Button size="sm">
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar tarefa
          </Button>
        </AddTaskDialog>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <p>Nenhuma tarefa para este caso.</p>
            <p className="text-[0.875rem]">
              Clique em “Adicionar tarefa” para começar.
            </p>
          </div>
        ) : (
          <KanbanBoard
            tasks={tasks as KanbanTask[]}
            assignees={assignees}
            onReorder={async (status, orderedIds) => {
              try {
                await reorderFn({ data: { status, ordered_ids: orderedIds } });
                await invalidate();
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Não foi possível mover a tarefa",
                );
                throw e;
              }
            }}
            onEdit={async (id, values) => {
              await updateFn({ data: { id, ...values } });
              await invalidate();
              toast.success("Tarefa atualizada");
            }}
            onDelete={async (id) => {
              try {
                await deleteFn({ data: { id } });
                await invalidate();
                toast.success("Tarefa excluída");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao excluir tarefa");
              }
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}
