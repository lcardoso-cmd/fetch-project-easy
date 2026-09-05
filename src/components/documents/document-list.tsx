import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteDocument } from "@/lib/documents.functions";
import {
  cancelIndexJob,
  forceIndexNow,
  listIndexJobs,
  resumeStalledCaseJobs,
  type IndexJobView,
} from "@/lib/index-jobs.functions";
import { indexDocument } from "@/lib/rag.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  describeReadingStage,
  isResuming,
  readingProgressPercent,
} from "@/lib/documents/reading-eta";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  ScanText,
  XCircle,
  Trash2,
} from "lucide-react";
import { ConfirmActionButton } from "./confirm-action-button";
import { UploadDialog } from "./upload-dialog";
import { DocumentAuditDialog } from "./document-audit-dialog";

export interface DocItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number | null;
  processing_status: string;
  created_at: string | null;
  split_group_id?: string | null;
  part_index?: number | null;
  part_count?: number | null;
  page_offset?: number | null;
  page_count?: number | null;
}

function formatBytes(b: number | null) {
  if (!b) return "—";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/** Documento já consultável pelo JurisMind (inclui leitura parcial). */
function isDocUsable(status: string | null | undefined): boolean {
  return status === "ready" || Boolean(status?.startsWith("partial"));
}

const STAGE_LABEL: Record<string, string> = {
  download: "baixando o arquivo",
  parse: "abrindo o arquivo",
  extracting_text: "lendo o texto",
  text_extraction: "lendo o texto",
  verifying_text: "confirmando a camada textual",
  ocr_processing: "lendo imagens (OCR)",
  ocr: "lendo imagens (OCR)",
  chunking: "dividindo em trechos",
  embedding: "preparando para busca",
  analyzing: "analisando",
  done: "concluído",
};

/** Explica em português o que está de fato acontecendo com o documento. */
function jobDetail(job: IndexJobView | undefined): string | null {
  if (!job) return null;
  if (job.status === "running") {
    const stage = job.stage ? (STAGE_LABEL[job.stage] ?? job.stage) : "processando";
    const pages = job.pages ? ` — ${job.pages} páginas` : "";
    if (job.stalled)
      return `A leitura começou (${stage}) mas parou de responder. Use "Processar agora".`;
    const warning = job.step_warning ? ` ${job.step_warning}` : "";
    return `Sendo lido agora: ${stage}${pages}.${warning}`;
  }
  if (job.status === "queued") {
    const warning = job.step_warning ? ` ${job.step_warning}` : "";
    if (isResuming(job)) {
      const action =
        job.stage === "verifying_text"
          ? "página(s) verificadas antes do OCR"
          : "página(s) concluídas";
      return `Progresso salvo: ${job.pages_done} de ${job.pages_total ?? "?"} ${action}. Aguardando a próxima execução.${warning}`;
    }
    if (job.queue_position === 1)
      return `É o próximo da fila. A leitura começa em instantes.${warning}`;
    if (job.queue_position && job.queue_position > 1)
      return `Na fila: há ${job.queue_position - 1} documento(s) sendo lido(s) antes deste.${warning}`;
    return `Na fila do servidor.${warning}`;
  }
  if (job.status === "paused")
    return "Leitura pausada por limite da IA. Verifique os créditos e tente de novo.";
  if (job.status === "error")
    return `Falhou após ${job.attempt_count} tentativa(s): ${
      job.last_error_message ?? job.step_warning ?? "erro no processamento"
    }`;
  return null;
}

function StatusCell({
  status,
  job,
  onRetry,
  retrying,
  onForce,
  forcing,
  onCancel,
  cancelling,
}: {
  status: string;
  job?: IndexJobView;
  onRetry: () => void;
  retrying: boolean;
  onForce: () => void;
  forcing: boolean;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const isError = status.startsWith("error") || job?.status === "error" || job?.status === "paused";
  const isEmpty = status === "empty";
  const isPartial = status.startsWith("partial");
  const canRetry = isError || isEmpty;
  const detail = jobDetail(job);
  const canForce = status !== "ready" && !isPartial && !isEmpty && status !== "cancelled";
  const inProgress =
    status !== "ready" &&
    status !== "cancelled" &&
    !isPartial &&
    !isEmpty &&
    !status.startsWith("error") &&
    job?.status !== "error";
  const isQueuedOnly =
    status === "queued" || status === "pending" || (!!job && job.status === "queued");
  // Um job sem heartbeat recente não está mais executando: precisa permitir retomada.
  const isRunningNow = inProgress && !isQueuedOnly && !job?.stalled;
  const pct = readingProgressPercent(job, status);
  const stageInfo = describeReadingStage(job, status);

  const map: Record<string, { icon: typeof Clock; color: string; label: string; hint: string }> = {
    queued: {
      icon: Clock,
      color: "text-muted-foreground",
      label: "Na fila",
      hint: "O documento foi recebido e está aguardando a vez de ser lido. Isso pode levar alguns minutos em arquivos grandes.",
    },
    pending: {
      icon: Clock,
      color: "text-muted-foreground",
      label: "Na fila",
      hint: "O documento foi recebido e está aguardando a vez de ser lido.",
    },
    extracting_text: {
      icon: BrainCircuit,
      color: "text-primary animate-pulse",
      label: "Lendo o texto",
      hint: "Estamos extraindo o texto das páginas do arquivo.",
    },
    ocr_processing: {
      icon: BrainCircuit,
      color: "text-primary animate-pulse",
      label: "Lendo imagens (OCR)",
      hint: "O arquivo é digitalizado; estamos reconhecendo o texto das imagens.",
    },
    analyzing: {
      icon: BrainCircuit,
      color: "text-primary animate-pulse",
      label: "Analisando",
      hint: "Organizando o conteúdo para consulta.",
    },
    processing: {
      icon: BrainCircuit,
      color: "text-primary animate-pulse",
      label: "Processando",
      hint: "O documento está sendo preparado para consulta.",
    },
    cancelled: {
      icon: XCircle,
      color: "text-muted-foreground",
      label: "Cancelado",
      hint: 'A leitura deste documento foi cancelada. Use "Processar agora" para retomar quando quiser.',
    },
    ready: {
      icon: CheckCircle,
      color: "text-emerald-500",
      label: "Pronto",
      hint: "Documento pronto para ser consultado pelo JurisMind.",
    },
    empty: {
      icon: AlertTriangle,
      color: "text-amber-500",
      label: "Sem texto",
      hint: 'Nenhum texto foi extraído. Tente reindexar ou use "Reprocessar com visão (OCR)".',
    },
  };
  const info = job?.stalled
    ? {
        icon: AlertTriangle,
        color: "text-amber-500",
        label: "Processamento interrompido",
        hint: 'O servidor deixou de atualizar este documento. Use "Processar agora" para retomar do último ponto salvo.',
      }
    : isError
      ? {
          icon: AlertCircle,
          color: "text-destructive",
          label: "Erro",
          hint:
            job?.last_error_message ||
            status.replace(/^error:\s*/, "") ||
            "Falha ao processar o documento.",
        }
      : isPartial
        ? {
            icon: AlertTriangle,
            color: "text-amber-500",
            label: "Pronto (parcial)",
            hint: status.replace(/^partial:\s*/, ""),
          }
        : isResuming(job)
          ? {
              icon: Clock,
              color: "text-muted-foreground",
              label: "Continuação na fila",
              hint: "O progresso já realizado foi salvo e a próxima execução continuará do mesmo ponto.",
            }
          : (map[status] ?? {
              icon: Clock,
              color: "text-muted-foreground",
              label: "Processando",
              hint: "O documento está sendo preparado para consulta.",
            });
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
          <TooltipContent className="max-w-xs">
            <p className="text-xs">{info.hint}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {status !== "ready" && status !== "cancelled" && !isPartial && pct !== null && (
        <div className="w-full max-w-[260px]">
          <Progress value={pct} className="h-1.5" aria-label={`Progresso da leitura: ${pct}%`} />
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-foreground">
              {stageInfo?.title ?? "Processando"}
            </span>
            <span className="text-xs text-muted-foreground">{pct}%</span>
          </div>
          {stageInfo && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
              {stageInfo.description}
            </p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
            {stageInfo?.eta ?? "Tempo restante ainda sendo calculado"}
          </p>
        </div>
      )}
      {status !== "ready" && (
        <span className="max-w-[240px] text-xs leading-snug text-muted-foreground">
          {detail ?? info.hint}
        </span>
      )}

      {(inProgress || canForce || status === "cancelled") && (
        <div className="flex flex-wrap items-center gap-2">
          {inProgress && (
            <ConfirmActionButton
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              icon={<XCircle className="mr-1 h-3 w-3" />}
              label="Cancelar leitura"
              ariaLabel="Cancelar a leitura deste documento"
              loading={cancelling}
              onConfirm={onCancel}
              title="Cancelar a leitura deste documento?"
              description="A leitura em andamento será interrompida. Os outros documentos continuam sendo lidos normalmente e você pode retomar este depois."
              confirmLabel="Cancelar leitura"
            />
          )}

          {(canForce || status === "cancelled") && (
            <ConfirmActionButton
              variant="outline"
              className="h-7 text-xs"
              icon={<Play className="mr-1 h-3 w-3" />}
              label={status === "cancelled" ? "Retomar leitura" : "Processar agora"}
              ariaLabel={
                status === "cancelled"
                  ? "Retomar a leitura deste documento"
                  : "Processar este documento agora"
              }
              loading={forcing}
              disabled={isRunningNow}
              disabledHint="Este documento já está sendo lido agora."
              onConfirm={onForce}
              title={
                status === "cancelled"
                  ? "Retomar a leitura deste documento?"
                  : "Processar este documento agora?"
              }
              description="A leitura deste documento passa à frente na fila e começa imediatamente. Isso pode deixar os outros documentos um pouco mais lentos."
              confirmLabel={status === "cancelled" ? "Retomar leitura" : "Processar agora"}
            />
          )}
        </div>
      )}

      {canRetry && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs"
          onClick={onRetry}
          disabled={retrying}
          aria-label={isError ? "Reindexar documento" : "Tentar extrair novamente"}
        >
          {retrying ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3 w-3" />
          )}
          {isError ? "Reindexar" : "Tentar novamente"}
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
  const jobsFn = useServerFn(listIndexJobs);
  const forceFn = useServerFn(forceIndexNow);
  const cancelFn = useServerFn(cancelIndexJob);
  const resumeStalledFn = useServerFn(resumeStalledCaseJobs);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [visionId, setVisionId] = useState<string | null>(null);
  const [forcingId, setForcingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [resumingStalled, setResumingStalled] = useState(false);

  const pending = documents.some(
    (d) => !isDocUsable(d.processing_status) && d.processing_status !== "cancelled",
  );
  const jobsQuery = useQuery({
    queryKey: ["index-jobs", caseId],
    queryFn: () => jobsFn({ data: { case_id: caseId } }),
    enabled: documents.length > 0,
    refetchInterval: pending ? 6_000 : false,
  });
  const jobs = new Map((jobsQuery.data?.jobs ?? []).map((j) => [j.document_id, j] as const));
  const stalledCount = (jobsQuery.data?.jobs ?? []).filter((job) => job.stalled).length;

  // Cada leitura do andamento também atualiza a lista de documentos.
  const jobsSignature = (jobsQuery.data?.jobs ?? [])
    .map((j) => `${j.document_id}:${j.status}:${j.stage ?? ""}`)
    .join("|");
  useEffect(() => {
    if (!jobsSignature) return;
    void queryClient.invalidateQueries({ queryKey: ["documents", caseId] });
  }, [jobsSignature, caseId, queryClient]);

  const onForce = async (id: string) => {
    setForcingId(id);
    try {
      await forceFn({ data: { document_id: id } });
      toast.success("Leitura reiniciada agora — o andamento aparece aqui.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setForcingId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["index-jobs", caseId] }),
      ]);
    }
  };

  const onCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await cancelFn({ data: { document_id: id } });
      toast.success("Leitura cancelada. Os outros documentos seguem normalmente.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCancellingId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["index-jobs", caseId] }),
      ]);
    }
  };

  const onResumeStalled = async () => {
    setResumingStalled(true);
    try {
      const result = await resumeStalledFn({ data: { case_id: caseId } });
      toast.success(
        result.resumed > 0
          ? `${result.resumed} leitura(s) retomada(s) do último ponto salvo.`
          : "Nenhuma leitura interrompida foi encontrada.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setResumingStalled(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents", caseId] }),
        queryClient.invalidateQueries({ queryKey: ["index-jobs", caseId] }),
      ]);
    }
  };

  const onRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await indexFn({ data: { document_id: id } });
      toast.success(
        res.queued
          ? "Documento grande: a leitura continua no servidor e o status é atualizado aqui."
          : `Reprocessado: ${res.chunks} trechos`,
      );
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
        res.queued
          ? "Documento grande: a leitura por imagem continua no servidor."
          : `Leitura por imagem concluída: ${res.chunks} trechos (${res.vision_chunks} de imagem)`,
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

  const readyCount = documents.filter((d) => isDocUsable(d.processing_status)).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Documentos do Caso
          </CardTitle>
          <CardDescription>
            {documents.length} arquivo(s) — {readyCount} pronto(s) para o chat. Marque os que devem
            ser usados nas perguntas.
          </CardDescription>
          {readyCount > 0 && (
            <div className="mt-2 flex gap-2 text-xs">
              <Button variant="link" size="sm" className="h-auto p-0" onClick={onSelectAll}>
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
        <div className="flex items-center gap-2">
          {stalledCount > 0 && (
            <ConfirmActionButton
              variant="outline"
              icon={<RefreshCw className="mr-1 h-4 w-4" />}
              label={`Retomar ${stalledCount} interrompido${stalledCount === 1 ? "" : "s"}`}
              ariaLabel="Retomar leituras interrompidas"
              loading={resumingStalled}
              onConfirm={onResumeStalled}
              title="Retomar as leituras interrompidas?"
              description="O progresso já salvo será preservado. Os documentos voltarão à fila e a leitura continuará do último ponto concluído."
              confirmLabel="Retomar leituras"
            />
          )}
          <DocumentAuditDialog caseId={caseId} />
          <UploadDialog
            caseId={caseId}
            existingDocuments={documents.map((d) => ({ id: d.id, filename: d.filename }))}
          />
        </div>
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
                  const ready = isDocUsable(d.processing_status);
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
                          <div className="min-w-0">
                            <span className="block truncate">{d.filename}</span>
                            {d.part_index && d.part_count ? (
                              <span className="block text-xs font-normal text-muted-foreground">
                                Parte {d.part_index} de {d.part_count}
                                {d.page_count
                                  ? ` · páginas ${(d.page_offset ?? 0) + 1}–${(d.page_offset ?? 0) + d.page_count}`
                                  : ""}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatBytes(d.file_size)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {d.created_at ? new Date(d.created_at).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusCell
                          status={d.processing_status}
                          job={jobs.get(d.id)}
                          onRetry={() => onRetry(d.id)}
                          retrying={retryingId === d.id}
                          onForce={() => onForce(d.id)}
                          forcing={forcingId === d.id}
                          onCancel={() => onCancel(d.id)}
                          cancelling={cancellingId === d.id}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {(d.processing_status.startsWith("error") ||
                            d.processing_status === "empty") && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    disabled={retryingId === d.id}
                                    onClick={() => onRetry(d.id)}
                                    aria-label={`Reindexar ${d.filename}`}
                                  >
                                    {retryingId === d.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <RefreshCw className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Solicitar reindexação</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-primary"
                                  disabled={visionId === d.id}
                                  onClick={() => onVision(d.id, d.filename)}
                                  aria-label={`Usar OCR no documento ${d.filename}`}
                                >
                                  {visionId === d.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ScanText className="h-4 w-4" />
                                  )}
                                  <span className="hidden xl:inline">Usar OCR</span>
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
                            aria-label={`Excluir documento ${d.filename}`}
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
