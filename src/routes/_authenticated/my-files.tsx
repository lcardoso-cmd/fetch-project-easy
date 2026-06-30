import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAllDocuments, getDocumentUrl } from "@/lib/documents.functions";
import { getCases } from "@/lib/cases.functions";
import { FileText, Search, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-files")({
  component: MyFilesPage,
});

function MyFilesPage() {
  const listFn = useServerFn(listAllDocuments);
  const urlFn = useServerFn(getDocumentUrl);
  const getCasesFn = useServerFn(getCases);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents-all"],
    queryFn: () => listFn(),
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCasesFn(),
  });

  const [search, setSearch] = useState("");

  const caseTitle = (id: string) => cases.find((c) => c.id === id)?.title ?? "—";

  const filtered = useMemo(
    () =>
      docs.filter((d) =>
        search ? d.filename.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    [docs, search],
  );

  const download = async (id: string, name: string) => {
    try {
      const { url } = await urlFn({ data: { id } });
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.target = "_blank";
      a.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meus Documentos</h1>
        <p className="mt-1 text-muted-foreground">
          Todos os documentos enviados em todos os seus casos.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground">Nenhum documento.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((d) => (
                <li key={d.id} className="flex items-center gap-3 p-4">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{d.filename}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <Link
                        to="/cases/$caseId"
                        params={{ caseId: d.case_id }}
                        className="underline"
                      >
                        {caseTitle(d.case_id)}
                      </Link>
                      <span>·</span>
                      <span>{Math.round((d.file_size ?? 0) / 1024)} KB</span>
                      <span>·</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {d.processing_status}
                      </Badge>
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => download(d.id, d.filename)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
