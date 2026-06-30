import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  component: MyTasksPage,
});

function MyTasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Minhas Tarefas</h1>
        <p className="mt-1 text-muted-foreground">
          Tarefas pendentes atribuídas a você.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Em breve
          </CardTitle>
          <CardDescription>
            Quadro Kanban de tarefas pessoais será adicionado na próxima onda.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
