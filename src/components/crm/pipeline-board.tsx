import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CRM_PRIORITY_LABELS,
  CRM_STAGES,
  CRM_STAGE_LABELS,
  formatCents,
  type CrmPriority,
  type CrmStage,
} from "@/lib/crm-schema";
import {
  listOpportunities,
  moveOpportunityStage,
  reorderOpportunities,
} from "@/lib/crm.functions";
import type { CrmAccess } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";

type Opp = {
  id: string;
  title: string;
  stage: string;
  priority: string;
  probability: number;
  estimated_value_cents: number;
  currency: string;
  owner_user_id: string | null;
  expected_close_date: string | null;
  lead?: { name: string } | null;
};

type PendingMove = {
  opp: Opp;
  toStage: CrmStage;
  index: number;
};

export function PipelineBoard({
  access,
  members,
  lossReasons,
  onOpen,
}: {
  access: CrmAccess;
  members: OrgMember[];
  lossReasons: string[];
  onOpen: (id: string) => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listOpportunities);
  const move = useServerFn(moveOpportunityStage);
  const reorder = useServerFn(reorderOpportunities);
  const [owner, setOwner] = useState<string>("all");
  const [dragging, setDragging] = useState<Opp | null>(null);
  const [pending, setPending] = useState<PendingMove | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["crm-pipeline", owner],
    queryFn: () =>
      list({
        data: {
          stage: "all",
          owner_user_id: owner === "all" ? undefined : owner,
          limit: 300,
        },
      }),
  });

  const rows = (query.data?.rows ?? []) as Opp[];
  const columns = useMemo(
    () =>
      CRM_STAGES.map((stage) => ({
        stage,
        items: rows.filter((r) => r.stage === stage),
      })),
    [rows],
  );

  async function applyMove(input: PendingMove, extra?: { lost_reason?: string; note?: string; override_conflict?: boolean }) {
    setBusy(true);
    try {
      if (input.opp.stage === input.toStage) {
        await reorder({
          data: { stage: input.toStage, id: input.opp.id, target_index: input.index },
        });
      } else {
        const res = await move({
          data: {
            id: input.opp.id,
            to_stage: input.toStage,
            target_index: input.index,
            lost_reason: extra?.lost_reason ?? null,
            note: extra?.note ?? null,
            override_conflict: extra?.override_conflict ?? false,
          },
        });
        if ((res as { conflict_override?: boolean }).conflict_override) {
          toast.warning("Movimentação registrada com ressalva de conflito na auditoria.");
        }
      }
      setPending(null);
      setLostReason("");
      setNote("");
      setOverride(false);
      await qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
      await qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
      await qc.invalidateQueries({ queryKey: ["crm-overview"] });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível mover.";
      if (/motivo/i.test(message) || /conflito/i.test(message)) {
        setPending(input);
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(stage: CrmStage, index: number) {
    if (!dragging) return;
    const opp = dragging;
    setDragging(null);
    if (!access.manageAll && !access.manageOwn) {
      toast.error("Você não tem permissão para mover oportunidades.");
      return;
    }
    if (stage === "lost" || (stage === "won" && !access.recordOutcome)) {
      setPending({ opp, toStage: stage, index });
      return;
    }
    void applyMove({ opp, toStage: stage, index });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="pipeline-owner" className="text-xs">
            Responsável
          </Label>
          <Select value={owner} onValueChange={setOwner}>
            <SelectTrigger id="pipeline-owner" className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {query.isFetching && (
          <span className="text-xs text-muted-foreground">Atualizando…</span>
        )}
      </div>

      {query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {(query.error as Error).message}
        </p>
      ) : (
        <div className="grid gap-3 overflow-x-auto pb-2 [grid-auto-columns:minmax(260px,1fr)] [grid-auto-flow:column]">
          {columns.map((col) => (
            <section
              key={col.stage}
              className="flex min-h-[220px] flex-col rounded-lg border bg-muted/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.stage, col.items.length)}
              aria-label={CRM_STAGE_LABELS[col.stage]}
            >
              <header className="flex items-center justify-between border-b px-3 py-2">
                <h3 className="text-sm font-semibold">{CRM_STAGE_LABELS[col.stage]}</h3>
                <Badge variant="secondary">{col.items.length}</Badge>
              </header>
              <div className="flex-1 space-y-2 p-2">
                {col.items.length === 0 && (
                  <p className="px-1 py-4 text-xs text-muted-foreground">
                    Nenhuma oportunidade nesta etapa.
                  </p>
                )}
                {col.items.map((opp, index) => (
                  <article
                    key={opp.id}
                    draggable
                    onDragStart={() => setDragging(opp)}
                    onDragEnd={() => setDragging(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.stopPropagation();
                      handleDrop(col.stage, index);
                    }}
                    className="cursor-grab rounded border bg-background p-3 text-sm shadow-sm"
                  >
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => onOpen(opp.id)}
                    >
                      {opp.title}
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {opp.lead?.name ?? "Sem cliente vinculado"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {access.viewValues && (
                        <span className="font-medium">
                          {formatCents(opp.estimated_value_cents, opp.currency)}
                        </span>
                      )}
                      <Badge variant="outline">
                        {CRM_PRIORITY_LABELS[(opp.priority as CrmPriority) ?? "medium"]}
                      </Badge>
                      <span className="text-muted-foreground">{opp.probability}%</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            setLostReason("");
            setNote("");
            setOverride(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.toStage === "lost" ? "Registrar perda" : "Confirmar movimentação"}
            </DialogTitle>
            <DialogDescription>
              {pending?.toStage === "lost"
                ? "Informe o motivo da perda para manter o histórico comercial completo."
                : "Complete as informações exigidas pelas regras do pipeline."}
            </DialogDescription>
          </DialogHeader>

          {pending?.toStage === "lost" && (
            <div className="space-y-2">
              <Label htmlFor="lost-reason">Motivo da perda</Label>
              {lossReasons.length > 0 && (
                <Select value={lostReason} onValueChange={setLostReason}>
                  <SelectTrigger id="lost-reason-select">
                    <SelectValue placeholder="Selecionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {lossReasons.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Textarea
                id="lost-reason"
                rows={3}
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Descreva o motivo"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stage-note">Observação (opcional)</Label>
            <Textarea
              id="stage-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {access.admin && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={override}
                onCheckedChange={(v) => setOverride(v === true)}
              />
              Prosseguir mesmo sem conflito liberado (registra ressalva na auditoria)
            </label>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              disabled={
                busy || (pending?.toStage === "lost" && lostReason.trim().length < 3)
              }
              onClick={() =>
                pending &&
                void applyMove(pending, {
                  lost_reason: lostReason.trim() || undefined,
                  note: note.trim() || undefined,
                  override_conflict: override,
                })
              }
            >
              {busy ? "Salvando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PipelineEmptyHint({ onCreate }: { onCreate: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onCreate}>
      <PlusCircle className="mr-2 h-4 w-4" /> Nova oportunidade
    </Button>
  );
}
