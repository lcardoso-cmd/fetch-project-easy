import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { format, parseISO, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskStatus,
} from "@/lib/tasks.functions";

export interface KanbanTask {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assigned_to_user_id: string | null;
  case_id: string | null;
}

export interface KanbanCase {
  id: string;
  title: string;
}

export interface KanbanAssignee {
  id: string;
  name: string;
}

interface Props {
  tasks: KanbanTask[];
  cases: KanbanCase[];
  assignees: KanbanAssignee[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

function borderColor(dueDate: string | null, status: string) {
  if (status === "done") return "border-l-green-500/60";
  if (!dueDate) return "border-l-transparent";
  const hours = differenceInHours(parseISO(dueDate), new Date());
  if (hours < 0) return "border-l-red-500";
  if (hours <= 2) return "border-l-red-500/80";
  if (hours <= 6) return "border-l-yellow-500/80";
  return "border-l-transparent";
}

function TaskCard({
  task,
  caseInfo,
  assignee,
}: {
  task: KanbanTask;
  caseInfo: KanbanCase | null;
  assignee: KanbanAssignee | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: "task", status: task.status } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className={cn(
          "mb-3 cursor-grab border-l-4 shadow-sm active:cursor-grabbing",
          borderColor(task.due_date, task.status),
        )}
      >
        <CardContent className="space-y-2 p-3">
          <p className="text-sm font-semibold leading-tight">{task.title}</p>
          {caseInfo && (
            <Link
              to="/assistencias/$caseId"
              params={{ caseId: caseInfo.id }}
              className="block truncate text-xs text-primary hover:underline"
              onPointerDown={(e) => e.stopPropagation()}
            >
              Caso: {caseInfo.title}
            </Link>
          )}
          <div className="space-y-1 text-xs text-muted-foreground">
            {task.due_date && (
              <div>
                <span className="font-medium">Prazo: </span>
                {format(parseISO(task.due_date), "dd/MM/yy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </div>
            )}
            {assignee && (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarFallback className="text-[8px]">
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

function KanbanColumn({
  status,
  tasks,
  cases,
  assignees,
}: {
  status: TaskStatus;
  tasks: KanbanTask[];
  cases: KanbanCase[];
  assignees: KanbanAssignee[];
}) {
  const { setNodeRef, isOver } = useSortable({
    id: status,
    data: { type: "container" },
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
          <div className="min-h-[80px] space-y-0">
            {tasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                caseInfo={cases.find((c) => c.id === t.case_id) ?? null}
                assignee={
                  assignees.find((a) => a.id === t.assigned_to_user_id) ?? null
                }
              />
            ))}
            {tasks.length === 0 && (
              <div className="flex h-20 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/20 text-xs text-muted-foreground">
                Arraste tarefas para cá
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export function TaskKanban({ tasks, cases, assignees, onStatusChange }: Props) {
  const columns = useMemo(() => {
    const grouped: Record<TaskStatus, KanbanTask[]> = {
      pending: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    tasks.forEach((t) => {
      if ((TASK_STATUSES as readonly string[]).includes(t.status)) {
        grouped[t.status as TaskStatus].push(t);
      }
    });
    return grouped;
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    let newStatus = activeTask.status as TaskStatus;
    if (over.data.current?.type === "container") {
      newStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) newStatus = overTask.status as TaskStatus;
    }
    if (activeTask.status !== newStatus) {
      onStatusChange(activeTask.id, newStatus);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((s) => (
          <KanbanColumn
            key={s}
            status={s}
            tasks={columns[s]}
            cases={cases}
            assignees={assignees}
          />
        ))}
      </div>
    </DndContext>
  );
}
