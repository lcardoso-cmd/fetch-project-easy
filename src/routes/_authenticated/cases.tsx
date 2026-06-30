import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cases")({
  component: CasesPage,
});

function CasesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Casos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie seus processos e clientes.</p>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">Nenhum caso cadastrado ainda.</p>
      </div>
    </div>
  );
}
