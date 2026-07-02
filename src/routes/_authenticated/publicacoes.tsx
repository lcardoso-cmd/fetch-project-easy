import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSearch } from "lucide-react";

export const Route = createFileRoute("/_authenticated/publicacoes")({
  component: MonitoringPage,
});

function MonitoringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Publicações</h1>
        <p className="mt-1 text-muted-foreground">
          Monitoramento de publicações e andamentos processuais.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <FileSearch className="h-5 w-5" /> Em breve
          </CardTitle>
          <CardDescription>
            Integração com fontes de publicações será configurada conforme a fonte de dados escolhida.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
