import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_LABELS,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  type ActivityKind,
  type ActivityStatus,
} from "@/lib/crm-schema";
import { createActivity, listOpportunities, updateActivity } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";

export type ActivityRow = {
  id: string;
  opportunity_id: string | null;
  lead_id: string | null;
  kind: string;
  title: string;
  description: string | null;
  activity_at: string | null;
  due_at: string | null;
  status: string;
  outcome: string | null;
  next_step: string | null;
  owner_user_id: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: OrgMember[];
  activity?: ActivityRow | null;
  defaultOpportunityId?: string;
  onSaved: () => void;
};

function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ActivityFormDialog({
  open,
  onOpenChange,
  members,
  activity,
  defaultOpportunityId,
  onSaved,
}: Props) {
  const create = useServerFn(createActivity);
  const update = useServerFn(updateActivity);
  const listOpps = useServerFn(listOpportunities);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    opportunity_id: "",
    kind: "call" as ActivityKind,
    title: "",
    description: "",
    activity_at: "",
    due_at: "",
    status: "open" as ActivityStatus,
    outcome: "",
    next_step: "",
    owner_user_id: "",
    create_task: false,
    create_event: false,
  });

  const opps = useQuery({
    queryKey: ["crm-opps-options"],
    queryFn: () => listOpps({ data: { stage: "open", limit: 200 } }),
    enabled: open && !defaultOpportunityId,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      opportunity_id: activity?.opportunity_id ?? defaultOpportunityId ?? "",
      kind: (activity?.kind as ActivityKind) ?? "call",
      title: activity?.title ?? "",
      description: activity?.description ?? "",
      activity_at: toLocalInput(activity?.activity_at) || toLocalInput(new Date().toISOString()),
      due_at: toLocalInput(activity?.due_at),
      status: (activity?.status as ActivityStatus) ?? "open",
      outcome: activity?.outcome ?? "",
      next_step: activity?.next_step ?? "",
      owner_user_id: activity?.owner_user_id ?? "",
      create_task: false,
      create_event: false,
    });
  }, [open, activity, defaultOpportunityId]);

  async function save() {
    setSaving(true);
    try {
      const base = {
        kind: form.kind,
        title: form.title.trim(),
        description: form.description.trim() || null,
        activity_at: form.activity_at ? new Date(form.activity_at).toISOString() : null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        status: form.status,
        outcome: form.outcome.trim() || null,
        next_step: form.next_step.trim() || null,
      };
      if (activity) {
        await update({ data: { id: activity.id, ...base } });
      } else {
        await create({
          data: {
            ...base,
            opportunity_id: form.opportunity_id || null,
            owner_user_id: form.owner_user_id || null,
            create_task: form.create_task,
            create_event: form.create_event,
          },
        });
      }
      toast.success(activity ? "Atividade atualizada." : "Atividade registrada.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const oppRows = (opps.data?.rows ?? []) as { id: string; title: string }[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{activity ? "Editar atividade" : "Nova atividade"}</DialogTitle>
          <DialogDescription>
            Reuniões, ligações e consultas ficam registradas no histórico comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!defaultOpportunityId && !activity && (
            <div className="space-y-1">
              <Label htmlFor="act-opp">Oportunidade</Label>
              <Select
                value={form.opportunity_id || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, opportunity_id: v === "none" ? "" : v }))
                }
              >
                <SelectTrigger id="act-opp">
                  <SelectValue placeholder="Sem vínculo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {oppRows.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="act-kind">Tipo</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v as ActivityKind }))}
              >
                <SelectTrigger id="act-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ACTIVITY_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="act-status">Situação</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v as ActivityStatus }))}
              >
                <SelectTrigger id="act-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ACTIVITY_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="act-title">Título</Label>
            <Input
              id="act-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="act-when">Data/hora</Label>
              <Input
                id="act-when"
                type="datetime-local"
                value={form.activity_at}
                onChange={(e) => setForm((f) => ({ ...f, activity_at: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="act-due">Prazo</Label>
              <Input
                id="act-due"
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="act-desc">Descrição</Label>
            <Textarea
              id="act-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="act-outcome">Resultado</Label>
            <Textarea
              id="act-outcome"
              rows={2}
              value={form.outcome}
              onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="act-next">Próximo passo</Label>
            <Input
              id="act-next"
              value={form.next_step}
              onChange={(e) => setForm((f) => ({ ...f, next_step: e.target.value }))}
            />
          </div>

          {!activity && (
            <>
              <div className="space-y-1">
                <Label htmlFor="act-owner">Responsável</Label>
                <Select
                  value={form.owner_user_id || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, owner_user_id: v === "none" ? "" : v }))
                  }
                >
                  <SelectTrigger id="act-owner">
                    <SelectValue placeholder="Eu mesmo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Eu mesmo</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.create_task}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, create_task: v === true }))}
                />
                Criar tarefa vinculada em Meu trabalho
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.create_event}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, create_event: v === true }))}
                />
                Criar compromisso na agenda
              </label>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void save()}
            disabled={saving || form.title.trim().length < 2}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
