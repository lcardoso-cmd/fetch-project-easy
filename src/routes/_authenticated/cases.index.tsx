import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCases, deleteCase } from "@/lib/cases.functions";
import { Plus, Trash2, Upload, Scale, Gavel, Search } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import {
  labelsForMatter,
  labelsForPractice,
  MATTER_KIND_LABELS,
  type MatterKind,
} from "@/lib/practice-labels";

export const Route = createFileRoute("/_authenticated/cases/")({
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {isLawyer ? "Casos" : `${profileLabels.entityPlural} e casos`}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie seus processos, perícias e assistências em um único lugar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/cases/bulk" })}>
            <Upload className="mr-2 h-4 w-4" />
            Upload em lote
          </Button>
          <Button onClick={() => navigate({ to: "/cases/new" })}>
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

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
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">
            {cases.length === 0
              ? "Nenhum caso cadastrado ainda."
              : "Nenhum resultado para este filtro."}
          </p>
          {cases.length === 0 && (
            <Button className="mt-4" onClick={() => navigate({ to: "/cases/new" })}>
              Criar primeiro
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((caseItem) => {
            const kind =
              ((caseItem as { matter_kind?: string | null }).matter_kind as MatterKind) ??
              "processo";
            const Icon = ICON_BY_KIND[kind] ?? Scale;
            const labels = labelsForMatter(kind);
            return (
              <Card key={caseItem.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className="h-4 w-4 mt-1 text-muted-foreground shrink-0" />
                      <CardTitle className="font-heading text-lg truncate">
                        {caseItem.title}
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(caseItem.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      {labels.shortBadge}
                    </Badge>
                    {caseItem.client_name && (
                      <CardDescription className="m-0">
                        {labels.clientLabel}: {caseItem.client_name}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {caseItem.description && (
                    <p className="mb-4 text-sm text-muted-foreground line-clamp-3">
                      {caseItem.description}
                    </p>
                  )}
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/cases/$caseId" params={{ caseId: caseItem.id }}>
                      Abrir
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
