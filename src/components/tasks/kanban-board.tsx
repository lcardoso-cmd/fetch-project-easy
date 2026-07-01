import { useMemo, useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, TASK_STATUS_LABEL, type TaskStatus } from "@/lib/tasks.functions";

export type KanbanTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to_user_id?: string | null;
  case_id?: string | null;
};

export type Assignee = { id: string; name: string };

function dueBorder(dueDate: string | null, status: string): string {
  if (status === "done") return "border-l-transparent";
  if (!dueDate) return "border-l-transparent";
  const hours = differenceInHours(parseISO(dueDate), new Date());
  if (hours < 0) return "border-l-destructive";
  if (hours <= 2) return "border-l-destructive/80";
  if (hours <= 6) return "border-l-yellow-500";
  return "border-l-transparent";
}

function TaskCard({
  task,
  assignees,
  onOpen,
}: {
  task: KanbanTask;
  assignees: Assignee[];
  onOpen?: (task: KanbanTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", status: task.status } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const assignee = assignees.find((a) => a.id === task.assigned_to_user_id);
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        onClick={() => onOpen?.(task)}
        className={cn(
          "mb-3 cursor-grab border-l-4 active:cursor-grabbing",
          dueBorder(task.due_date, task.status),
        )}
      >
        <CardContent className="space-y-2 p-3">
          <p className="text-sm font-semibold leading-tight">{task.title}</p>
          {task.due_date && (
            <p className="text-xs text-muted-foreground">
              Prazo:{" "}
              {format(parseISO(task.due_date), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          {assignee && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">
                  {assignee.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span>{assignee.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Column({
  status,
  tasks,
  assignees,
  onOpen,
}: {
  status: TaskStatus;
  tasks: KanbanTask[];
  assignees: Assignee[];
  onOpen?: (task: KanbanTask) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status, data: { type: "container" } });
  return (
    <div ref={setNodeRef} className="flex h-full flex-col rounded-lg bg-muted/50 p-3">
      <h3 className="mb-3 text-center text-sm font-semibold">
        {TASK_STATUS_LABEL[status]} ({tasks.length})
      </h3>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[100px] flex-grow">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} assignees={assignees} onOpen={onOpen} />
          ))}
          {tasks.length === 0 && (
            <div className="flex h-20 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/20">
              <p className="text-center text-xs text-muted-foreground">
                Arraste tarefas para cá
              </p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function DeleteZone() {
  const { setNodeRef, isOver } = useDroppable({ id: "__delete__" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-4 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-destructive/50 bg-destructive/10 p-3 text-destructive transition-colors",
        isOver && "bg-destructive/25",
      )}
    >
      <Trash2 className="h-6 w-6" />
      <p className="text-sm font-semibold">Solte aqui para excluir</p>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  assignees = [],
  onStatusChange,
  onDelete,
  onOpen,
}: {
  tasks: KanbanTask[];
  assignees?: Assignee[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete?: (id: string) => void;
  onOpen?: (task: KanbanTask) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => setLocalTasks(tasks), [tasks]);

  const grouped = useMemo(() => {
    const g: Record<TaskStatus, KanbanTask[]> = {
      pending: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    localTasks.forEach((t) => {
      const s = (TASK_STATUSES.includes(t.status as TaskStatus)
        ? t.status
        : "pending") as TaskStatus;
      g[s].push(t);
    });
    return g;
  }, [localTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === "task") setDragging(true);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(false);
    const { active, over } = e;
    if (!over) return;
    if (over.id === "__delete__") {
      onDelete?.(String(active.id));
      return;
    }
    const activeTask = localTasks.find((t) => t.id === active.id);
    if (!activeTask) return;
    let newStatus = activeTask.status as TaskStatus;
    if (over.data.current?.type === "container") {
      newStatus = over.id as TaskStatus;
    } else {
      const overTask = localTasks.find((t) => t.id === over.id);
      if (overTask) newStatus = overTask.status as TaskStatus;
    }
    if (activeTask.status !== newStatus) {
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === activeTask.id ? { ...t, status: newStatus } : t)),
      );
      onStatusChange(activeTask.id, newStatus);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TASK_STATUSES.map((s) => (
          <Column
            key={s}
            status={s}
            tasks={grouped[s]}
            assignees={assignees}
            onOpen={onOpen}
          />
        ))}
      </div>
      {dragging && onDelete && <DeleteZone />}
    </DndContext>
  );
}
