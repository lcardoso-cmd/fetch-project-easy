import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { updateCrmSettings } from "@/lib/crm.functions";

export type CrmSettingsData = {
  sources: string[];
  practice_areas: string[];
  loss_reasons: string[];
  default_currency: string;
  default_validity_days: number;
  proposal_prefix: string;
};

function toText(list: string[]): string {
  return list.join("\n");
}

function fromText(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/\n|;/)
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}

export function CrmSettingsDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CrmSettingsData;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateCrmSettings);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sources: "",
    practice_areas: "",
    loss_reasons: "",
    default_currency: "BRL",
    default_validity_days: 15,
    proposal_prefix: "PROP",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      sources: toText(settings.sources ?? []),
      practice_areas: toText(settings.practice_areas ?? []),
      loss_reasons: toText(settings.loss_reasons ?? []),
      default_currency: settings.default_currency ?? "BRL",
      default_validity_days: settings.default_validity_days ?? 15,
      proposal_prefix: settings.proposal_prefix ?? "PROP",
    });
  }, [open, settings]);

  async function save() {
    setSaving(true);
    try {
      await update({
        data: {
          sources: fromText(form.sources),
          practice_areas: fromText(form.practice_areas),
          loss_reasons: fromText(form.loss_reasons),
          default_currency: form.default_currency.trim().toUpperCase(),
          default_validity_days: Number(form.default_validity_days),
          proposal_prefix: form.proposal_prefix.trim().toUpperCase(),
        },
      });
      toast.success("Configurações comerciais atualizadas.");
      void qc.invalidateQueries({ queryKey: ["crm-settings"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações comerciais</DialogTitle>
          <DialogDescription>
            Listas usadas pelos formulários da organização. Um item por linha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="set-sources">Origens</Label>
            <Textarea
              id="set-sources"
              rows={4}
              value={form.sources}
              onChange={(e) => setForm((f) => ({ ...f, sources: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="set-areas">Áreas de atuação</Label>
            <Textarea
              id="set-areas"
              rows={4}
              value={form.practice_areas}
              onChange={(e) => setForm((f) => ({ ...f, practice_areas: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="set-loss">Motivos de perda</Label>
            <Textarea
              id="set-loss"
              rows={4}
              value={form.loss_reasons}
              onChange={(e) => setForm((f) => ({ ...f, loss_reasons: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="set-currency">Moeda</Label>
              <Input
                id="set-currency"
                maxLength={3}
                value={form.default_currency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_currency: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="set-validity">Validade (dias)</Label>
              <Input
                id="set-validity"
                type="number"
                min={1}
                max={365}
                value={form.default_validity_days}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_validity_days: Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="set-prefix">Prefixo</Label>
              <Input
                id="set-prefix"
                maxLength={12}
                value={form.proposal_prefix}
                onChange={(e) =>
                  setForm((f) => ({ ...f, proposal_prefix: e.target.value }))
                }
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
