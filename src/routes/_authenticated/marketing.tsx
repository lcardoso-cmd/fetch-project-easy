import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingPage,
});

function MarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Marketing</h1>
        <p className="mt-1 text-muted-foreground">
          Assistente especializado em marketing jurídico.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Em breve
          </CardTitle>
          <CardDescription>
            Chat de marketing será adicionado na Onda 4 (módulos de IA).
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
