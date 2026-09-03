import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks.functions";

export type TaskFormValues = {
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assigned_to_user_id: string | null;
  case_id: string | null;
};

type EditableTask = {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  priority?: string | null;
  due_date: string | null;
  assigned_to_user_id?: string | null;
  case_id?: string | null;
};

export function EditTaskDialog({
  task,
  assignees = [],
  cases = [],
  onClose,
  onSave,
}: {
  task: EditableTask | null;
  assignees?: { id: string; name: string }[];
  cases?: { id: string; title: string }[];
  onClose: () => void;
  onSave: (id: string, values: TaskFormValues) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [assignee, setAssignee] = useState("none");
  const [caseId, setCaseId] = useState("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(((task.priority as TaskPriority) ?? "medium") as TaskPriority);
    setStatus(
      ((TASK_STATUSES as readonly string[]).includes(task.status)
        ? task.status
        : "pending") as TaskStatus,
    );
    if (task.due_date) {
      const d = parseISO(task.due_date);
      setDate(format(d, "yyyy-MM-dd"));
      setTime(format(d, "HH:mm"));
    } else {
      setDate("");
      setTime("18:00");
    }
    setAssignee(task.assigned_to_user_id ?? "none");
    setCaseId(task.case_id ?? "none");
  }, [task]);

  const submit = async () => {
    if (!task) return;
    if (!title.trim()) {
      toast.error("Informe o título da tarefa.");
      return;
    }
    let due: string | null = null;
    if (date) {
      const [h, m] = time.split(":").map(Number);
      const d = new Date(`${date}T00:00:00`);
      d.setHours(h ?? 18, m ?? 0, 0, 0);
      due = d.toISOString();
    }
    setBusy(true);
    try {
      await onSave(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status,
        due_date: due,
        assigned_to_user_id: assignee === "none" ? null : assignee,
        case_id: caseId === "none" ? null : caseId,
      });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a tarefa.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(task)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
          <DialogDescription>
            Atualize os dados da tarefa. As alterações são salvas no escritório atual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TASK_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="task-date">Prazo</Label>
              <Input
                id="task-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-time">Hora</Label>
              <Input
                id="task-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          {assignees.length > 0 && (
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {cases.length > 0 && (
            <div className="space-y-2">
              <Label>Caso vinculado</Label>
              <Select value={caseId} onValueChange={setCaseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem caso</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
