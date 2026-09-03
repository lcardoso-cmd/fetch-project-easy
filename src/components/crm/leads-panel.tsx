import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PlusCircle, Search, Trash2, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LEAD_KIND_LABELS, LEAD_STATUS_LABELS, type LeadKind, type LeadStatus } from "@/lib/crm-schema";
import { deleteLead, listLeads } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";
import { LeadFormDialog, type LeadRow } from "./lead-form-dialog";
import { LeadDetailSheet } from "./lead-detail-sheet";

const PAGE_SIZE = 25;

export function LeadsPanel({
  members,
  sources,
  canWrite,
}: {
  members: OrgMember[];
  sources: string[];
  canWrite: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [kind, setKind] = useState<LeadKind | "all">("all");
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeadRow | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<LeadRow | null>(null);

  const qc = useQueryClient();
  const list = useServerFn(listLeads);
  const remove = useServerFn(deleteLead);

  const query = useQuery({
    queryKey: ["crm-leads", search, status, kind, page],
    queryFn: () =>
      list({
        data: {
          search: search.trim() || undefined,
          status,
          kind,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
  });

  const rows = (query.data?.rows ?? []) as LeadRow[];
  const total = query.data?.total ?? 0;

  async function confirmRemove() {
    if (!removing) return;
    try {
      await remove({ data: { id: removing.id } });
      toast.success("Cadastro excluído.");
      setRemoving(null);
      void qc.invalidateQueries({ queryKey: ["crm-leads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="lead-search" className="text-xs">
            Buscar por nome, documento, e-mail ou telefone
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="lead-search"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              placeholder="Ex.: Construtora Alfa"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lead-filter-status" className="text-xs">
            Situação
          </Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setPage(0);
              setStatus(v as LeadStatus | "all");
            }}
          >
            <SelectTrigger id="lead-filter-status" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(LEAD_STATUS_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="lead-filter-kind" className="text-xs">
            Tipo
          </Label>
          <Select
            value={kind}
            onValueChange={(v) => {
              setPage(0);
              setKind(v as LeadKind | "all");
            }}
          >
            <SelectTrigger id="lead-filter-kind" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(LEAD_KIND_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canWrite && (
          <div className="flex items-end">
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Novo
            </Button>
          </div>
        )}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando cadastros…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {(query.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum potencial cliente encontrado"
          description={
            search || status !== "all" || kind !== "all"
              ? "Ajuste a busca ou os filtros para ver outros cadastros."
              : "Cadastre o primeiro potencial cliente para começar o pipeline."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Contato</th>
                <th className="px-3 py-2 font-medium">Origem</th>
                <th className="px-3 py-2 font-medium">Situação</th>
                <th className="px-3 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => setDetailId(row.id)}
                    >
                      {row.name}
                    </button>
                    {row.trade_name && (
                      <p className="text-xs text-muted-foreground">{row.trade_name}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {LEAD_KIND_LABELS[(row.kind as LeadKind) ?? "person"]}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.email || row.phone || "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.source || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={row.status === "client" ? "default" : "secondary"}>
                      {LEAD_STATUS_LABELS[(row.status as LeadStatus) ?? "lead"]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Editar ${row.name}`}
                            onClick={() => {
                              setEditing(row);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Excluir ${row.name}`}
                            onClick={() => setRemoving(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      <LeadFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={editing}
        members={members}
        sources={sources}
        onSaved={() => void qc.invalidateQueries({ queryKey: ["crm-leads"] })}
      />

      <LeadDetailSheet
        leadId={detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        canWrite={canWrite}
      />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cadastro</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} será removido definitivamente. Cadastros com
              oportunidades vinculadas não podem ser excluídos — marque como inativo.
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
