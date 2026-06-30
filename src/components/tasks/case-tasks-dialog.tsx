import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, deleteTask, listTasks, toggleTask } from "@/lib/tasks.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ListTodo, Loader2, Plus, Trash2 } from "lucide-react";

export function CaseTasksDialog({
  caseId,
  caseTitle,
  trigger,
}: {
  caseId: string;
  caseTitle: string;
  trigger?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const createFn = useServerFn(createTask);
  const toggleFn = useServerFn(toggleTask);
  const deleteFn = useServerFn(deleteTask);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", caseId],
    queryFn: () => listFn({ data: { case_id: caseId, status: "all" } }),
  });

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await createFn({
        data: { case_id: caseId, title: newTitle.trim(), priority: "medium" },
      });
      setNewTitle("");
      await qc.invalidateQueries({ queryKey: ["tasks", caseId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", caseId] });

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full">
            <ListTodo className="mr-2 h-4 w-4" /> Gerenciar tarefas do caso
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tarefas do caso</DialogTitle>
          <DialogDescription>{caseTitle}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Nova tarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button onClick={add} disabled={adding || !newTitle.trim()}>
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        <ScrollArea className="max-h-96">
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma tarefa para este caso.
            </p>
          ) : (
            <ul className="divide-y">
              {tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="flex items-start gap-2">
                    <Checkbox
                      className="mt-0.5"
                      checked={t.status === "done"}
                      onCheckedChange={async (c) => {
                        await toggleFn({
                          data: { id: t.id, done: Boolean(c) },
                        });
                        refresh();
                      }}
                    />
                    <div>
                      <p
                        className={`text-sm ${
                          t.status === "done"
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {t.title}
                      </p>
                      {t.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Prazo:{" "}
                          {new Date(t.due_date).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await deleteFn({ data: { id: t.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
