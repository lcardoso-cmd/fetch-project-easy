import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileArchive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-files")({
  component: MyFilesPage,
});

function MyFilesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-heading tracking-tight">Meus Documentos</h1>
        <p className="mt-1 text-muted-foreground">
          Todos os documentos enviados em todos os seus casos.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <FileArchive className="h-5 w-5" /> Em breve
          </CardTitle>
          <CardDescription>
            Listagem global e busca por documentos será adicionada na próxima onda.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
