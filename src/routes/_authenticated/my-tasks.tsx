import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listTasks, createTask, toggleTask, deleteTask } from "@/lib/tasks.functions";
import { getCases } from "@/lib/cases.functions";
import { ClipboardCheck, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  component: MyTasksPage,
});

const PRIORITY: Record<string, { label: string; cls: string }> = {
  low: { label: "Baixa", cls: "bg-muted text-foreground" },
  medium: { label: "Média", cls: "bg-primary/10 text-primary" },
  high: { label: "Alta", cls: "bg-primary/20 text-primary" },
  urgent: { label: "Urgente", cls: "bg-destructive/15 text-destructive" },
};

function MyTasksPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const toggleFn = useServerFn(toggleTask);
  const deleteFn = useServerFn(deleteTask);
  const getCasesFn = useServerFn(getCases);

  const [filter, setFilter] = useState<"pending" | "done" | "all">("pending");
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", filter],
    queryFn: () => listFn({ data: { status: filter } }),
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCasesFn(),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    due_date: "",
    case_id: "",
  });

  const submit = async () => {
    if (!form.title) {
      toast.error("Informe o título");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          title: form.title,
          description: form.description || null,
          priority: form.priority,
          due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
          case_id: form.case_id || null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      setOpen(false);
      setForm({ title: "", description: "", priority: "medium", due_date: "", case_id: "" });
      toast.success("Tarefa criada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (id: string, done: boolean) => {
    await toggleFn({ data: { id, done } });
    await qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir tarefa?")) return;
    await deleteFn({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const caseTitle = (id: string | null) => (id ? cases.find((c) => c.id === id)?.title : null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Minhas Tarefas</h1>
          <p className="mt-1 text-muted-foreground">Tarefas pendentes e concluídas.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="done">Concluídas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setOpen((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nova tarefa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as typeof form.priority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prazo</Label>
              <Input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Caso (opcional)</Label>
              <Select
                value={form.case_id || "none"}
                onValueChange={(v) => setForm({ ...form, case_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : tasks.length === 0 ? (
            <div className="p-10 text-center">
              <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-muted-foreground">Nenhuma tarefa.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {tasks.map((t) => {
                const overdue =
                  t.due_date && t.status === "pending" && new Date(t.due_date) < new Date();
                return (
                  <li key={t.id} className="flex items-start gap-3 p-4">
                    <Checkbox
                      checked={t.status === "done"}
                      onCheckedChange={(c) => onToggle(t.id, Boolean(c))}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`font-medium ${
                            t.status === "done" ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {t.title}
                        </p>
                        <Badge className={PRIORITY[t.priority]?.cls ?? ""}>
                          {PRIORITY[t.priority]?.label ?? t.priority}
                        </Badge>
                        {overdue && <Badge variant="destructive">Atrasada</Badge>}
                      </div>
                      {t.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.due_date &&
                          `Prazo: ${new Date(t.due_date).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`}
                        {t.case_id && caseTitle(t.case_id) && (
                          <>
                            {t.due_date ? " · " : ""}
                            <Link
                              to="/cases/$caseId"
                              params={{ caseId: t.case_id }}
                              className="underline"
                            >
                              {caseTitle(t.case_id)}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(t.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
