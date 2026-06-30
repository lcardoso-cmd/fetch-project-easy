import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getCases, deleteCase } from "@/lib/cases.functions";
import { Plus, Trash2, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cases")({
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

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este caso?")) return;
    await deleteCaseFn({ data: { id } });
    await queryClient.invalidateQueries({ queryKey: ["cases"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Casos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie seus processos e clientes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/cases/bulk" })}>
            <Upload className="mr-2 h-4 w-4" />
            Upload em lote
          </Button>
          <Button onClick={() => navigate({ to: "/cases/new" })}>
            <Plus className="mr-2 h-4 w-4" />
            Novo caso
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">Nenhum caso cadastrado ainda.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/cases/new" })}>
            Criar primeiro caso
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((caseItem) => (
            <Card key={caseItem.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="font-heading text-lg">{caseItem.title}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(caseItem.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {caseItem.client_name && (
                  <CardDescription>Cliente: {caseItem.client_name}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {caseItem.description && (
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-3">{caseItem.description}</p>
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/cases/$caseId" params={{ caseId: caseItem.id }}>Abrir caso</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
