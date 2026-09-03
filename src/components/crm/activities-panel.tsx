import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/empty-state";
import {
  ACTIVITY_KIND_LABELS,
  ACTIVITY_STATUSES,
  ACTIVITY_STATUS_LABELS,
  type ActivityKind,
  type ActivityStatus,
} from "@/lib/crm-schema";
import { deleteActivity, listActivities } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";
import { ActivityFormDialog, type ActivityRow } from "./activity-form-dialog";

const PAGE_SIZE = 25;

export function ActivitiesPanel({
  members,
  canWrite,
  onOpenOpportunity,
}: {
  members: OrgMember[];
  canWrite: boolean;
  onOpenOpportunity: (id: string) => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listActivities);
  const remove = useServerFn(deleteActivity);
  const [status, setStatus] = useState<ActivityStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [removing, setRemoving] = useState<ActivityRow | null>(null);

  const query = useQuery({
    queryKey: ["crm-activities", status, page],
    queryFn: () =>
      list({ data: { status, limit: PAGE_SIZE, offset: page * PAGE_SIZE } }),
  });

  const rows = (query.data?.rows ?? []) as ActivityRow[];
  const total = query.data?.total ?? 0;

  async function confirmRemove() {
    if (!removing) return;
    try {
      await remove({ data: { id: removing.id } });
      toast.success("Atividade excluída.");
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: ["crm-activities"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="act-filter" className="text-xs">
            Situação
          </Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(0);
              setStatus(v as ActivityStatus | "all");
            }}
          >
            <SelectTrigger id="act-filter" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {ACTIVITY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ACTIVITY_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Nova atividade
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando atividades…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {(query.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nenhuma atividade registrada"
          description="Registre ligações, reuniões e consultas para manter o histórico comercial."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id} className="rounded border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ACTIVITY_KIND_LABELS[(a.kind as ActivityKind) ?? "note"]}
                    {a.activity_at
                      ? ` · ${new Date(a.activity_at).toLocaleString("pt-BR")}`
                      : ""}
                    {a.due_at
                      ? ` · prazo ${new Date(a.due_at).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "done" ? "default" : "secondary"}>
                    {ACTIVITY_STATUS_LABELS[(a.status as ActivityStatus) ?? "open"]}
                  </Badge>
                  {a.opportunity_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onOpenOpportunity(a.opportunity_id!)}
                    >
                      Oportunidade
                    </Button>
                  )}
                  {canWrite && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${a.title}`}
                        onClick={() => {
                          setEditing(a);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Excluir ${a.title}`}
                        onClick={() => setRemoving(a)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {a.outcome && <p className="mt-2">{a.outcome}</p>}
              {a.next_step && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Próximo passo: {a.next_step}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <ActivityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        members={members}
        activity={editing}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ["crm-activities"] });
          void qc.invalidateQueries({ queryKey: ["crm-overview"] });
        }}
      />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade</AlertDialogTitle>
            <AlertDialogDescription>
              O registro será removido do histórico comercial. Tarefas e compromissos
              criados a partir dela permanecem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmRemove()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
