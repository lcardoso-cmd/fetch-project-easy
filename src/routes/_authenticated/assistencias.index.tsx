import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getCases, deleteCase } from "@/lib/cases.functions";
import { Plus, Trash2, Upload, Scale } from "lucide-react";

export const Route = createFileRoute("/_authenticated/assistencias/")({
  component: CasesPage,
});

function CasesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const getCasesFn = useServerFn(getCases);
  const deleteCaseFn = useServerFn(deleteCase);
  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCasesFn(),
  });

  const filtered = cases;

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este caso?")) return;
    await deleteCaseFn({ data: { id } });
    await queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Casos"
        subtitle="Gerencie os casos, processos, documentos, prazos e responsáveis do escritório"
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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nenhum caso cadastrado ainda"
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
            return (
              <li key={caseItem.id} className="group flex items-center gap-3 py-3">
                <Scale className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/assistencias/$caseId"
                    params={{ caseId: caseItem.id }}
                    className="block text-sm font-medium truncate hover:underline"
                  >
                    {caseItem.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    {caseItem.client_name && (
                      <span className="truncate">Cliente: {caseItem.client_name}</span>
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
