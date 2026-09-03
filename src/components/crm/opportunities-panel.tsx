import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, Briefcase, Pencil, PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import {
  CRM_STAGES,
  CRM_STAGE_LABELS,
  formatCents,
  type CrmStage,
} from "@/lib/crm-schema";
import { archiveOpportunity, listOpportunities, type CrmAccess } from "@/lib/crm.functions";
import type { OrgMember } from "@/lib/organization.functions";
import type { OpportunityRow } from "./opportunity-form-dialog";

const PAGE_SIZE = 25;

export function OpportunitiesPanel({
  access,
  members,
  onOpen,
  onEdit,
  onCreate,
}: {
  access: CrmAccess;
  members: OrgMember[];
  onOpen: (id: string) => void;
  onEdit: (row: OpportunityRow) => void;
  onCreate: () => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listOpportunities);
  const archive = useServerFn(archiveOpportunity);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<CrmStage | "all" | "open">("open");
  const [owner, setOwner] = useState("all");
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["crm-opportunities", search, stage, owner, page],
    queryFn: () =>
      list({
        data: {
          search: search.trim() || undefined,
          stage,
          owner_user_id: owner === "all" ? undefined : owner,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        },
      }),
  });

  const rows = (query.data?.rows ?? []) as (OpportunityRow & {
    lead?: { name: string } | null;
  })[];
  const total = query.data?.total ?? 0;

  async function doArchive(id: string) {
    try {
      await archive({ data: { id, archived: true } });
      toast.success("Oportunidade arquivada.");
      void qc.invalidateQueries({ queryKey: ["crm-opportunities"] });
      void qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível arquivar.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="opp-search" className="text-xs">
            Buscar
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="opp-search"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              placeholder="Título ou descrição"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="opp-stage-filter" className="text-xs">
            Etapa
          </Label>
          <Select
            value={stage}
            onValueChange={(v) => {
              setPage(0);
              setStage(v as CrmStage | "all" | "open");
            }}
          >
            <SelectTrigger id="opp-stage-filter" className="w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Em andamento</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
              {CRM_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CRM_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="opp-owner-filter" className="text-xs">
            Responsável
          </Label>
          <Select
            value={owner}
            onValueChange={(v) => {
              setPage(0);
              setOwner(v);
            }}
          >
            <SelectTrigger id="opp-owner-filter" className="w-[190px]">
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
        <div className="flex items-end">
          <Button onClick={onCreate}>
            <PlusCircle className="mr-2 h-4 w-4" /> Nova
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando oportunidades…</p>
      ) : query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {(query.error as Error).message}
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nenhuma oportunidade encontrada"
          description="Crie a primeira oportunidade a partir de um potencial cliente."
        />
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Oportunidade</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Etapa</th>
                {access.viewValues && <th className="px-3 py-2 font-medium">Valor</th>}
                <th className="px-3 py-2 font-medium">Fechamento</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <button
                      className="text-left font-medium hover:underline"
                      onClick={() => onOpen(row.id)}
                    >
                      {row.title}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.lead?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">
                      {CRM_STAGE_LABELS[(row.stage as CrmStage) ?? "new_contact"]}
                    </Badge>
                  </td>
                  {access.viewValues && (
                    <td className="px-3 py-2">
                      {formatCents(row.estimated_value_cents, row.currency)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.expected_close_date ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${row.title}`}
                        onClick={() => onEdit(row)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Arquivar ${row.title}`}
                        onClick={() => void doArchive(row.id)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
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
    </div>
  );
}
