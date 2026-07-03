import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getCases, deleteCase } from "@/lib/cases.functions";
import { Plus, Trash2, Upload, Scale, Gavel, Search } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import {
  labelsForMatter,
  labelsForPractice,
  MATTER_KIND_LABELS,
  type MatterKind,
} from "@/lib/practice-labels";

export const Route = createFileRoute("/_authenticated/assistencias/")({
  component: CasesPage,
});

const ICON_BY_KIND = {
  processo: Scale,
  pericia: Gavel,
  assistencia_tecnica: Search,
} as const;

function CasesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const getCasesFn = useServerFn(getCases);
  const deleteCaseFn = useServerFn(deleteCase);
  const { data: profile } = useProfile();
  const practice = (profile?.practice_type ?? null) as
    | "advogado"
    | "perito_judicial"
    | "assistente_tecnico"
    | null;
  const profileLabels = labelsForPractice(practice);
  const isLawyer = !practice || practice === "advogado";

  const [filter, setFilter] = useState<"all" | MatterKind>("all");

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCasesFn(),
  });

  const filtered = cases.filter((c) => {
    if (filter === "all") return true;
    return ((c as { matter_kind?: string | null }).matter_kind ?? "processo") === filter;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este caso?")) return;
    await deleteCaseFn({ data: { id } });
    await queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLawyer ? "Casos" : `${profileLabels.entityPlural} e casos`}
        subtitle="Gerencie seus processos, perícias e assistências em um único lugar."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/assistencias/lote" })}>
              <Upload className="mr-2 h-4 w-4" />
              Upload em lote
            </Button>
            <Button size="sm" onClick={() => navigate({ to: "/assistencias/nova" })}>
              <Plus className="mr-2 h-4 w-4" />
              Novo
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(["all", "processo", "pericia", "assistencia_tecnica"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${
              filter === f
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-muted-foreground hover:border-accent/40"
            }`}
          >
            {f === "all" ? "Todos" : MATTER_KIND_LABELS[f]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Scale}
          title={cases.length === 0 ? "Nenhum caso cadastrado ainda" : "Nenhum resultado para este filtro"}
          action={
            cases.length === 0 ? (
              <Button size="sm" onClick={() => navigate({ to: "/assistencias/nova" })}>
                Criar primeiro
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/10 border-y border-black/5 dark:border-white/10">
          {filtered.map((caseItem) => {
            const kind =
              ((caseItem as { matter_kind?: string | null }).matter_kind as MatterKind) ??
              "processo";
            const Icon = ICON_BY_KIND[kind] ?? Scale;
            const labels = labelsForMatter(kind);
            return (
              <li key={caseItem.id} className="group flex items-center gap-3 py-3">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/assistencias/$caseId"
                    params={{ caseId: caseItem.id }}
                    className="block text-sm font-medium truncate hover:underline"
                  >
                    {caseItem.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {labels.shortBadge}
                    </Badge>
                    {caseItem.client_name && (
                      <span className="truncate">
                        {labels.clientLabel}: {caseItem.client_name}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={() => handleDelete(caseItem.id)}
                  aria-label={`Excluir caso ${caseItem.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
