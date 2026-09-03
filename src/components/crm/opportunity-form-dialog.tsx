import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CRM_PRIORITIES,
  CRM_PRIORITY_LABELS,
  CRM_STAGES,
  CRM_STAGE_LABELS,
  parseAmountToCents,
  type CrmPriority,
  type CrmStage,
} from "@/lib/crm-schema";
import { createOpportunity, listLeads, updateOpportunity } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";

export type OpportunityRow = {
  id: string;
  title: string;
  description: string | null;
  lead_id: string | null;
  stage: string;
  priority: string;
  probability: number;
  estimated_value_cents: number;
  currency: string;
  expected_close_date: string | null;
  practice_area: string | null;
  source: string | null;
  owner_user_id: string | null;
  next_activity_at: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: OpportunityRow | null;
  members: OrgMember[];
  settings: { sources: string[]; practice_areas: string[]; default_currency: string };
  canSeeValues: boolean;
  onSaved: () => void;
};

export function OpportunityFormDialog({
  open,
  onOpenChange,
  opportunity,
  members,
  settings,
  canSeeValues,
  onSaved,
}: Props) {
  const create = useServerFn(createOpportunity);
  const update = useServerFn(updateOpportunity);
  const leadsFn = useServerFn(listLeads);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    lead_id: "",
    stage: "new_contact" as CrmStage,
    priority: "medium" as CrmPriority,
    probability: 20,
    amount: "",
    expected_close_date: "",
    practice_area: "",
    source: "",
    owner_user_id: "",
    next_activity_at: "",
  });

  const leads = useQuery({
    queryKey: ["crm-leads-options"],
    queryFn: () => leadsFn({ data: { limit: 200 } }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: opportunity?.title ?? "",
      description: opportunity?.description ?? "",
      lead_id: opportunity?.lead_id ?? "",
      stage: (opportunity?.stage as CrmStage) ?? "new_contact",
      priority: (opportunity?.priority as CrmPriority) ?? "medium",
      probability: opportunity?.probability ?? 20,
      amount: opportunity
        ? (opportunity.estimated_value_cents / 100).toFixed(2).replace(".", ",")
        : "",
      expected_close_date: opportunity?.expected_close_date ?? "",
      practice_area: opportunity?.practice_area ?? "",
      source: opportunity?.source ?? "",
      owner_user_id: opportunity?.owner_user_id ?? "",
      next_activity_at: opportunity?.next_activity_at
        ? opportunity.next_activity_at.slice(0, 16)
        : "",
    });
  }, [open, opportunity]);

  const valid = useMemo(() => form.title.trim().length >= 3, [form.title]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        lead_id: form.lead_id || null,
        stage: form.stage,
        priority: form.priority,
        probability: Number(form.probability) || 0,
        estimated_value_cents: parseAmountToCents(form.amount),
        currency: settings.default_currency || "BRL",
        expected_close_date: form.expected_close_date || null,
        practice_area: form.practice_area.trim() || null,
        source: form.source.trim() || null,
        owner_user_id: form.owner_user_id || null,
        next_activity_at: form.next_activity_at
          ? new Date(form.next_activity_at).toISOString()
          : null,
      };
      if (opportunity) await update({ data: { id: opportunity.id, ...payload } });
      else await create({ data: payload });
      toast.success(opportunity ? "Oportunidade atualizada." : "Oportunidade criada.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const leadRows = (leads.data?.rows ?? []) as { id: string; name: string }[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{opportunity ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          <DialogDescription>
            A oportunidade organiza a negociação até a conversão em caso.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="opp-title">Título</Label>
            <Input
              id="opp-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex.: Consultoria contratual — Construtora Alfa"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="opp-lead">Potencial cliente</Label>
            <Select
              value={form.lead_id || "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, lead_id: v === "none" ? "" : v }))}
            >
              <SelectTrigger id="opp-lead">
                <SelectValue placeholder="Sem vínculo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo</SelectItem>
                {leadRows.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="opp-stage">Etapa</Label>
            <Select
              value={form.stage}
              onValueChange={(v) => setForm((f) => ({ ...f, stage: v as CrmStage }))}
            >
              <SelectTrigger id="opp-stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_STAGES.filter((s) => s !== "won" && s !== "lost").map((s) => (
                  <SelectItem key={s} value={s}>
                    {CRM_STAGE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="opp-priority">Prioridade</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm((f) => ({ ...f, priority: v as CrmPriority }))}
            >
              <SelectTrigger id="opp-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRM_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {CRM_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="opp-prob">Probabilidade (%)</Label>
            <Input
              id="opp-prob"
              type="number"
              min={0}
              max={100}
              value={form.probability}
              onChange={(e) =>
                setForm((f) => ({ ...f, probability: Number(e.target.value) }))
              }
            />
          </div>
          {canSeeValues && (
            <div className="space-y-1">
              <Label htmlFor="opp-amount">Valor estimado</Label>
              <Input
                id="opp-amount"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="opp-close">Fechamento previsto</Label>
            <Input
              id="opp-close"
              type="date"
              value={form.expected_close_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, expected_close_date: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="opp-area">Área</Label>
            <Input
              id="opp-area"
              list="crm-areas"
              value={form.practice_area}
              onChange={(e) => setForm((f) => ({ ...f, practice_area: e.target.value }))}
            />
            <datalist id="crm-areas">
              {settings.practice_areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="opp-source">Origem</Label>
            <Input
              id="opp-source"
              list="crm-opp-sources"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            />
            <datalist id="crm-opp-sources">
              {settings.sources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="opp-owner">Responsável</Label>
            <Select
              value={form.owner_user_id || "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, owner_user_id: v === "none" ? "" : v }))
              }
            >
              <SelectTrigger id="opp-owner">
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
          <div className="space-y-1">
            <Label htmlFor="opp-next">Próxima interação</Label>
            <Input
              id="opp-next"
              type="datetime-local"
              value={form.next_activity_at}
              onChange={(e) =>
                setForm((f) => ({ ...f, next_activity_at: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="opp-desc">Descrição</Label>
            <Textarea
              id="opp-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={!valid || saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
