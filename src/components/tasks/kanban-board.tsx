import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO, differenceInHours, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";
import { GripVertical, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  TASK_PRIORITY_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks.functions";
import { EditTaskDialog, type TaskFormValues } from "./edit-task-dialog";

export type KanbanTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  description?: string | null;
  priority?: string | null;
  assigned_to_user_id?: string | null;
  case_id?: string | null;
  position?: number | null;
};

export type Assignee = { id: string; name: string };
export type KanbanCase = { id: string; title: string };

function dueBorder(dueDate: string | null, status: string): string {
  if (status === "done") return "border-l-emerald-500/60";
  if (!dueDate) return "border-l-transparent";
  const hours = differenceInHours(parseISO(dueDate), new Date());
  if (hours < 0) return "border-l-destructive";
  if (hours <= 6) return "border-l-amber-500";
  return "border-l-transparent";
}

function isOverdue(task: KanbanTask) {
  return (
    task.status !== "done" &&
    !!task.due_date &&
    isBefore(parseISO(task.due_date), new Date())
  );
}

function TaskCard({
  task,
  assignees,
  cases,
  onEdit,
  onDelete,
}: {
  task: KanbanTask;
  assignees: Assignee[];
  cases: KanbanCase[];
  onEdit: (task: KanbanTask) => void;
  onDelete: (task: KanbanTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", status: task.status } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const assignee = assignees.find((a) => a.id === task.assigned_to_user_id) ?? null;
  const caseInfo = cases.find((c) => c.id === task.case_id) ?? null;
  const priority = (task.priority ?? "medium") as TaskPriority;

  return (
    <div ref={setNodeRef} style={style} className="mb-3">
      <Card className={cn("border-l-4", dueBorder(task.due_date, task.status))}>
        <CardContent className="space-y-2 p-3">
          <div className="flex items-start gap-2">
            <button
              type="button"
              aria-label={`Mover tarefa ${task.title}`}
              className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <p className="flex-1 text-sm font-semibold leading-tight">{task.title}</p>
            <div className="flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Editar tarefa"
                onClick={() => onEdit(task)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label="Excluir tarefa"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {task.description ? (
            <p className="line-clamp-2 text-[0.8125rem] text-muted-foreground">
              {task.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[0.75rem]">
              {TASK_PRIORITY_LABEL[priority] ?? "Média"}
            </Badge>
            {isOverdue(task) && (
              <Badge variant="destructive" className="text-[0.75rem]">
                Atrasada
              </Badge>
            )}
          </div>

          {caseInfo && (
            <Link
              to="/assistencias/$caseId"
              params={{ caseId: caseInfo.id }}
              className="block truncate text-[0.8125rem] text-primary hover:underline"
            >
              {caseInfo.title}
            </Link>
          )}

          <div className="space-y-1 text-[0.8125rem] text-muted-foreground">
            {task.due_date && (
              <div>
                Prazo:{" "}
                {format(parseISO(task.due_date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
            {assignee && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[0.625rem]">
                    {assignee.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{assignee.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Column({
  status,
  tasks,
  assignees,
  cases,
  onEdit,
  onDelete,
}: {
  status: TaskStatus;
  tasks: KanbanTask[];
  assignees: Assignee[];
  cases: KanbanCase[];
  onEdit: (task: KanbanTask) => void;
  onDelete: (task: KanbanTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: "container", status },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-[240px] flex-col rounded-lg border bg-muted/40 p-3 transition-colors",
        isOver && "bg-muted/70 ring-2 ring-primary/40",
      )}
    >
      <h3 className="mb-3 text-center text-sm font-semibold">
        {TASK_STATUS_LABEL[status]}{" "}
        <span className="text-muted-foreground">({tasks.length})</span>
      </h3>
      <div className="-mr-1 flex-1 overflow-y-auto pr-1">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="min-h-[80px]">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                assignees={assignees}
                cases={cases}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {tasks.length === 0 && (
              <div className="flex h-20 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/20 px-2 text-center text-[0.8125rem] text-muted-foreground">
                Nenhuma tarefa aqui. Arraste um cartão para esta coluna.
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  assignees = [],
  cases = [],
  onReorder,
  onEdit,
  onDelete,
  canEdit = true,
}: {
  tasks: KanbanTask[];
  assignees?: Assignee[];
  cases?: KanbanCase[];
  /** Persiste a coluna e a ordem completa dos cartões. Deve lançar erro em falha. */
  onReorder: (status: TaskStatus, orderedIds: string[]) => Promise<void>;
  onEdit: (id: string, values: TaskFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canEdit?: boolean;
}) {
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => setLocalTasks(tasks), [tasks]);
  const [editing, setEditing] = useState<KanbanTask | null>(null);
  const [deleting, setDeleting] = useState<KanbanTask | null>(null);
  const [removing, setRemoving] = useState(false);

  const grouped = useMemo(() => {
    const g = Object.fromEntries(TASK_STATUSES.map((s) => [s, [] as KanbanTask[]])) as Record<
      TaskStatus,
      KanbanTask[]
    >;
    localTasks.forEach((t) => {
      const s = (TASK_STATUSES as readonly string[]).includes(t.status)
        ? (t.status as TaskStatus)
        : "pending";
      g[s].push(t);
    });
    TASK_STATUSES.forEach((s) => {
      g[s].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    });
    return g;
  }, [localTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !canEdit) return;
    const activeTask = localTasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    const targetStatus =
      over.data.current?.type === "container"
        ? (over.id as TaskStatus)
        : ((localTasks.find((t) => t.id === over.id)?.status ?? activeTask.status) as TaskStatus);

    const snapshot = localTasks;
    const column = grouped[targetStatus].filter((t) => t.id !== activeTask.id);
    const overIndex = column.findIndex((t) => t.id === over.id);
    const insertAt = overIndex === -1 ? column.length : overIndex;
    const sameColumn = activeTask.status === targetStatus;

    let orderedIds: string[];
    if (sameColumn) {
      const ids = grouped[targetStatus].map((t) => t.id);
      const from = ids.indexOf(activeTask.id);
      const to = overIndex === -1 ? ids.length - 1 : ids.indexOf(over.id as string);
      if (from === to) return;
      orderedIds = arrayMove(ids, from, to);
    } else {
      const ids = column.map((t) => t.id);
      ids.splice(insertAt, 0, activeTask.id);
      orderedIds = ids;
    }

    // Atualização otimista
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === activeTask.id
          ? { ...t, status: targetStatus, position: orderedIds.indexOf(t.id) + 1 }
          : orderedIds.includes(t.id)
            ? { ...t, position: orderedIds.indexOf(t.id) + 1 }
            : t,
      ),
    );

    try {
      await onReorder(targetStatus, orderedIds);
    } catch {
      setLocalTasks(snapshot); // rollback
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {TASK_STATUSES.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={grouped[s]}
              assignees={assignees}
              cases={cases}
              onEdit={setEditing}
              onDelete={setDeleting}
            />
          ))}
        </div>
      </DndContext>

      <EditTaskDialog
        task={editing}
        assignees={assignees}
        cases={cases}
        onClose={() => setEditing(null)}
        onSave={onEdit}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa “{deleting?.title}” será removida definitivamente. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleting) return;
                setRemoving(true);
                try {
                  await onDelete(deleting.id);
                  setDeleting(null);
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {removing ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
