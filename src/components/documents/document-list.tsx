import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { deleteDocument } from "@/lib/documents.functions";
import { indexDocument } from "@/lib/rag.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { UploadDialog } from "./upload-dialog";
import { DocumentAuditDialog } from "./document-audit-dialog";

export interface DocItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number | null;
  processing_status: string;
  created_at: string | null;
}

function formatBytes(b: number | null) {
  if (!b) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function StatusCell({
  status,
  onRetry,
  retrying,
}: {
  status: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const isError = status.startsWith("error");
  const map: Record<
    string,
    { icon: typeof Clock; color: string; label: string }
  > = {
    pending: { icon: Clock, color: "text-muted-foreground", label: "Na fila" },
    processing: { icon: BrainCircuit, color: "text-primary animate-pulse", label: "Indexando" },
    ready: { icon: CheckCircle, color: "text-emerald-500", label: "Pronto" },
    empty: { icon: AlertTriangle, color: "text-amber-500", label: "Sem texto" },
  };
  const info = isError
    ? { icon: AlertCircle, color: "text-destructive", label: "Erro" }
    : map[status] ?? { icon: Clock, color: "text-muted-foreground", label: status };
  const Icon = info.icon;
  return (
    <div className="flex flex-col items-start gap-1.5">
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${info.color}`} />
              <span className="text-xs">{info.label}</span>
            </div>
          </TooltipTrigger>
          {isError && (
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{status.replace(/^error:\s*/, "")}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      {isError && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs"
          onClick={onRetry}
          disabled={retrying}
        >
          {retrying ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3 w-3" />
          )}
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function DocumentList({
  caseId,
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: {
  caseId: string;
  documents: DocItem[];
  selectedDocIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}) {
  const queryClient = useQueryClient();
  const deleteFn = useServerFn(deleteDocument);
  const indexFn = useServerFn(indexDocument);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [visionId, setVisionId] = useState<string | null>(null);

  const onRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await indexFn({ data: { document_id: id } });
      toast.success(`Reprocessado: ${res.chunks ?? 0} trechos`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRetryingId(null);
      await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
    }
  };

  const onVision = async (id: string, name: string) => {
    if (
      !confirm(
        `Reprocessar "${name}" usando visão (OCR multimodal)?\n\nRecomendado para PDFs escaneados ou com pouco texto extraível. Pode levar alguns segundos e consumir mais créditos.`,
      )
    )
      return;
    setVisionId(id);
    try {
      const res = await indexFn({ data: { document_id: id, force_vision: true } });
      toast.success(
        `Visão concluída: ${res.chunks ?? 0} trechos (${res.vision_chunks ?? 0} de visão)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setVisionId(null);
      await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Esta ação é permanente.`)) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Documento excluído");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      await queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
    }
  };

  const readyCount = documents.filter((d) => d.processing_status === "ready").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Documentos do Caso
          </CardTitle>
          <CardDescription>
            {documents.length} arquivo(s) — {readyCount} pronto(s) para o chat.
            Marque os que devem ser usados nas perguntas.
          </CardDescription>
          {readyCount > 0 && (
            <div className="mt-2 flex gap-2 text-xs">
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={onSelectAll}
              >
                Marcar todos
              </Button>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-muted-foreground"
                onClick={onDeselectAll}
              >
                Desmarcar todos
              </Button>
            </div>
          )}
        </div>
        <UploadDialog
          caseId={caseId}
          existingDocuments={documents.map((d) => ({ id: d.id, filename: d.filename }))}
        />
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum documento ainda. Clique em "Carregar" para começar.
          </p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Tamanho</TableHead>
                  <TableHead className="hidden md:table-cell">Enviado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((d) => {
                  const ready = d.processing_status === "ready";
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDocIds.has(d.id)}
                          disabled={!ready}
                          onCheckedChange={() => onToggleSelect(d.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{d.filename}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatBytes(d.file_size)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {d.created_at
                          ? new Date(d.created_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusCell
                          status={d.processing_status}
                          onRetry={() => onRetry(d.id)}
                          retrying={retryingId === d.id}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  disabled={visionId === d.id}
                                  onClick={() => onVision(d.id, d.filename)}
                                >
                                  {visionId === d.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Reprocessar com visão (OCR)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(d.id, d.filename)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
