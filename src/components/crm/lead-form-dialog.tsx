import { useEffect, useMemo, useState } from "react";
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
  DUPLICATE_REASON_LABELS,
  LEAD_KINDS,
  LEAD_KIND_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type DuplicateMatch,
  type LeadKind,
  type LeadStatus,
} from "@/lib/crm-schema";
import { checkLeadDuplicates, createLead, updateLead } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";

export type LeadRow = {
  id: string;
  kind: string;
  name: string;
  trade_name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  source: string | null;
  status: string;
  owner_user_id: string | null;
  notes: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: LeadRow | null;
  members: OrgMember[];
  sources: string[];
  onSaved: () => void;
};

const EMPTY = {
  kind: "person" as LeadKind,
  name: "",
  trade_name: "",
  document: "",
  email: "",
  phone: "",
  whatsapp: "",
  city: "",
  state: "",
  address: "",
  source: "",
  status: "lead" as LeadStatus,
  owner_user_id: "",
  notes: "",
};

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  members,
  sources,
  onSaved,
}: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const create = useServerFn(createLead);
  const update = useServerFn(updateLead);
  const checkDup = useServerFn(checkLeadDuplicates);

  useEffect(() => {
    if (!open) return;
    setDuplicates([]);
    setForm(
      lead
        ? {
            kind: (lead.kind as LeadKind) ?? "person",
            name: lead.name ?? "",
            trade_name: lead.trade_name ?? "",
            document: lead.document ?? "",
            email: lead.email ?? "",
            phone: lead.phone ?? "",
            whatsapp: lead.whatsapp ?? "",
            city: lead.city ?? "",
            state: lead.state ?? "",
            address: lead.address ?? "",
            source: lead.source ?? "",
            status: (lead.status as LeadStatus) ?? "lead",
            owner_user_id: lead.owner_user_id ?? "",
            notes: lead.notes ?? "",
          }
        : EMPTY,
    );
  }, [open, lead]);

  // Aviso de possível duplicidade (informativo, nunca bloqueia).
  useEffect(() => {
    if (!open) return;
    const doc = form.document.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!doc && !email && !phone) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(() => {
      void checkDup({
        data: { document: doc, email, phone, ignore_id: lead?.id ?? null },
      })
        .then((res) => setDuplicates(res as DuplicateMatch[]))
        .catch(() => setDuplicates([]));
    }, 600);
    return () => clearTimeout(timer);
  }, [open, form.document, form.email, form.phone, lead?.id, checkDup]);

  const valid = useMemo(() => form.name.trim().length >= 2, [form.name]);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        kind: form.kind,
        name: form.name.trim(),
        trade_name: form.trade_name.trim() || null,
        document: form.document.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        address: form.address.trim() || null,
        source: form.source.trim() || null,
        status: form.status,
        owner_user_id: form.owner_user_id || null,
        notes: form.notes.trim() || null,
      };
      if (lead) await update({ data: { id: lead.id, ...payload } });
      else await create({ data: payload });
      toast.success(lead ? "Cadastro atualizado." : "Potencial cliente cadastrado.");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {lead ? "Editar cadastro" : "Novo potencial cliente"}
          </DialogTitle>
          <DialogDescription>
            Pessoa física ou jurídica. Os dados são usados na verificação de
            conflito e nas propostas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="lead-kind">Tipo</Label>
            <Select
              value={form.kind}
              onValueChange={(v) => setForm((f) => ({ ...f, kind: v as LeadKind }))}
            >
              <SelectTrigger id="lead-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {LEAD_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-status">Situação</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v as LeadStatus }))}
            >
              <SelectTrigger id="lead-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="lead-name">
              {form.kind === "company" ? "Razão social" : "Nome completo"}
            </Label>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          {form.kind === "company" && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="lead-trade">Nome fantasia</Label>
              <Input
                id="lead-trade"
                value={form.trade_name}
                onChange={(e) => setForm((f) => ({ ...f, trade_name: e.target.value }))}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="lead-doc">{form.kind === "company" ? "CNPJ" : "CPF"}</Label>
            <Input
              id="lead-doc"
              value={form.document}
              onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-email">E-mail</Label>
            <Input
              id="lead-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-phone">Telefone</Label>
            <Input
              id="lead-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-whats">WhatsApp</Label>
            <Input
              id="lead-whats"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-city">Cidade</Label>
            <Input
              id="lead-city"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-state">UF</Label>
            <Input
              id="lead-state"
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-source">Origem</Label>
            <Input
              id="lead-source"
              list="crm-sources"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              placeholder="Indicação, site, evento…"
            />
            <datalist id="crm-sources">
              {sources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-owner">Responsável</Label>
            <Select
              value={form.owner_user_id || "none"}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, owner_user_id: v === "none" ? "" : v }))
              }
            >
              <SelectTrigger id="lead-owner">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Eu mesmo</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} · {m.role_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="lead-address">Endereço</Label>
            <Input
              id="lead-address"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="lead-notes">Anotações</Label>
            <Textarea
              id="lead-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        {duplicates.length > 0 && (
          <div
            role="status"
            className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <p className="font-medium">Possível duplicidade</p>
            <ul className="mt-1 space-y-1 text-xs">
              {duplicates.map((d) => (
                <li key={d.id}>
                  {d.name} —{" "}
                  {d.reasons.map((r) => DUPLICATE_REASON_LABELS[r]).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}

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
