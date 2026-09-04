import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAllDocuments, getDocumentUrl } from "@/lib/documents.functions";
import { getCases } from "@/lib/cases.functions";
import { FileText, Search, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documentos")({
  component: LibraryPage,
});

/** Status de processamento em linguagem compreensível. */
const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  pending: "Na fila",
  extracting_text: "Lendo o texto",
  ocr_processing: "Lendo imagens (OCR)",
  analyzing: "Analisando",
  processing: "Processando",
  ready: "Pronto para consulta",
  error: "Falha no processamento",
  failed: "Falha no processamento",
  cancelled: "Leitura cancelada",
  empty: "Sem conteúdo",
  no_content: "Sem conteúdo",
};

const STATUS_FILTERS = [
  { value: "all", label: "Todos os status" },
  { value: "processing", label: "Processando" },
  { value: "ready", label: "Pronto para consulta" },
  { value: "error", label: "Falha no processamento" },
  { value: "empty", label: "Sem conteúdo" },
] as const;

function statusGroup(raw: string): "processing" | "ready" | "error" | "empty" {
  if (raw === "ready") return "ready";
  if (raw === "error" || raw === "failed") return "error";
  if (raw === "empty" || raw === "no_content" || raw === "cancelled") return "empty";
  return "processing";
}

function formatSize(bytes: number | null | undefined) {
  const b = bytes ?? 0;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

function formatType(fileType: string | null | undefined, filename: string) {
  const ext = filename.includes(".") ? filename.split(".").pop()!.toUpperCase() : null;
  if (ext && ext.length <= 5) return ext;
  return fileType ?? "Arquivo";
}

function LibraryPage() {
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
  const [caseFilter, setCaseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const caseOf = (id: string) => cases.find((c) => c.id === id);

  const filtered = useMemo(
    () =>
      docs.filter((d) => {
        if (search && !d.filename.toLowerCase().includes(search.toLowerCase())) return false;
        if (caseFilter !== "all" && d.case_id !== caseFilter) return false;
        if (statusFilter !== "all" && statusGroup(d.processing_status) !== statusFilter)
          return false;
        return true;
      }),
    [docs, search, caseFilter, statusFilter],
  );

  const openDoc = async (id: string, name: string, download: boolean) => {
    try {
      const { url } = await urlFn({ data: { id } });
      const a = document.createElement("a");
      a.href = url;
      if (download) a.download = name;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.click();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir o documento");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Biblioteca"
        subtitle="Todos os documentos do escritório aos quais você tem acesso."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do arquivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Caso</Label>
          <Select value={caseFilter} onValueChange={setCaseFilter}>
            <SelectTrigger aria-label="Filtrar por caso">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os casos</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={docs.length === 0 ? "Nenhum documento enviado ainda" : "Nenhum resultado"}
          description={
            docs.length === 0
              ? "Envie documentos dentro de um caso para que fiquem disponíveis aqui."
              : "Ajuste a busca ou os filtros."
          }
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border ">
          {filtered.map((d) => {
            const c = caseOf(d.case_id);
            const group = statusGroup(d.processing_status);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{d.filename}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge
                      variant={group === "error" ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {STATUS_LABEL[d.processing_status] ?? "Processando"}
                    </Badge>
                    <span>{formatType(d.file_type, d.filename)}</span>
                    <span aria-hidden>·</span>
                    <span>{formatSize(d.file_size)}</span>
                    {c && (
                      <>
                        <span aria-hidden>·</span>
                        <Link
                          to="/assistencias/$caseId"
                          params={{ caseId: d.case_id }}
                          className="underline"
                        >
                          {c.title}
                        </Link>
                      </>
                    )}
                    {c?.client_name && (
                      <>
                        <span aria-hidden>·</span>
                        <span>Cliente: {c.client_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDoc(d.id, d.filename, false)}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" /> Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Baixar ${d.filename}`}
                    onClick={() => openDoc(d.id, d.filename, true)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
