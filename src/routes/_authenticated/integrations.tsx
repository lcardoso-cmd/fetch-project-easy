import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Puzzle, HardDrive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Integrações</h1>
        <p className="mt-1 text-muted-foreground">
          Conecte serviços externos ao seu JurisMind.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <HardDrive className="h-5 w-5" /> Google Drive
            </CardTitle>
            <CardDescription>
              Importe documentos do seu Drive para os casos. Requer configuração OAuth — será habilitado na Onda 6.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Puzzle className="h-5 w-5" /> Outras integrações
            </CardTitle>
            <CardDescription>
              Gamma.app, monitoramento processual e mais.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    </div>
  );
}
