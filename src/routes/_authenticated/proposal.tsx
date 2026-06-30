import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Handshake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/proposal")({
  component: ProposalPage,
});

function ProposalPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Proposta Comercial</h1>
        <p className="mt-1 text-muted-foreground">
          Gere propostas comerciais personalizadas com IA.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Handshake className="h-5 w-5" /> Em breve
          </CardTitle>
          <CardDescription>
            Gerador será adicionado na Onda 4 (módulos de IA).
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
