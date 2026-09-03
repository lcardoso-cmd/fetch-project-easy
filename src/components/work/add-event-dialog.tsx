import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createEvent } from "@/lib/events.functions";

export const EVENT_TYPE_LABEL: Record<string, string> = {
  deadline: "Prazo",
  hearing: "Audiência",
  meeting: "Reunião",
  task: "Tarefa",
};

/** Criação de prazo/compromisso. Reutiliza a função de servidor existente. */
export function AddEventDialog({
  children,
  cases = [],
  defaultCaseId,
}: {
  children: React.ReactNode;
  cases?: { id: string; title: string }[];
  defaultCaseId?: string;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createEvent);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    starts_at: "",
    event_type: "deadline" as "deadline" | "hearing" | "meeting" | "task",
    case_id: defaultCaseId ?? "",
  });

  const submit = async () => {
    if (!form.title.trim() || !form.starts_at) {
      toast.error("Preencha título e data");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          title: form.title.trim(),
          description: form.description || null,
          starts_at: new Date(form.starts_at).toISOString(),
          event_type: form.event_type,
          case_id: form.case_id || null,
          all_day: false,
        },
      });
      await qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Compromisso criado");
      setOpen(false);
      setForm({
        title: "",
        description: "",
        starts_at: "",
        event_type: "deadline",
        case_id: defaultCaseId ?? "",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo prazo ou compromisso</DialogTitle>
          <DialogDescription className="text-sm">
            Registre prazos, audiências e reuniões da sua agenda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm">Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: Prazo para contestação"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Data e hora</Label>
            <Input
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Tipo</Label>
            <Select
              value={form.event_type}
              onValueChange={(v) =>
                setForm({ ...form, event_type: v as typeof form.event_type })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_LABEL).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cases.length > 0 && !defaultCaseId && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-sm">Caso (opcional)</Label>
              <Select
                value={form.case_id || "none"}
                onValueChange={(v) => setForm({ ...form, case_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem caso" />
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm">Observações (opcional)</Label>
            <Textarea
              rows={3}
              className="text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
