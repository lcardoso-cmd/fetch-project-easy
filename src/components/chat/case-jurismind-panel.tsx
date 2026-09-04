import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Maximize2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { JurisMindMark, JURISMIND_CONTEXT } from "@/components/brand/jurismind-mark";
import { JurisMindChat } from "@/components/chat/jurismind-chat";
import type { DocItem } from "@/components/documents/document-list";
import { createThread, listThreads } from "@/lib/threads.functions";
import { cn } from "@/lib/utils";

export interface CaseChatInfo {
  title: string;
  client_name: string | null;
  status: string;
  case_number: string | null;
  case_type: string | null;
  jurisdiction: string | null;
  parties: Array<{ role: string; name: string; relation?: string | null }>;
  represented_party: { role: string; name: string } | null;
}

/**
 * Painel lateral do JurisMind AI dentro do caso.
 *
 * Reutiliza o `JurisMindChat` real (mesmas threads persistidas, documentos e
 * seleção do caso). A thread ativa é controlada pelo componente pai, de forma
 * que a conversa iniciada aqui continua disponível na rota de tela inteira
 * (`/assistencias/$caseId/chat?thread=<id>`) e vice-versa.
 */
export function CaseJurisMindPanel({
  caseId,
  caseInfo,
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  open,
  onOpenChange,
  threadId,
  onThreadChange,
  canUpload,
  initialPrompt,
}: {
  caseId: string;
  caseInfo: CaseChatInfo;
  documents: DocItem[];
  selectedDocIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string | null;
  onThreadChange: (id: string | null) => void;
  canUpload: boolean;
  initialPrompt?: string | null;
}) {

  const qc = useQueryClient();
  const navigate = useNavigate();
  const listThreadsFn = useServerFn(listThreads);
  const createThreadFn = useServerFn(createThread);
  const [creating, setCreating] = useState(false);

  // Threads reais do caso: ao abrir sem thread ativa, continua a mais recente.
  const { data: threads = [] } = useQuery({
    queryKey: ["ai-threads", caseId],
    queryFn: () => listThreadsFn({ data: { case_id: caseId } }),
    enabled: open,
  });

  const effectiveThreadId = threadId ?? threads[0]?.id ?? null;

  const createMut = useMutation({
    mutationFn: () => createThreadFn({ data: { case_id: caseId } }),
    onSuccess: (t) => {
      onThreadChange(t.id);
      void qc.invalidateQueries({ queryKey: ["ai-threads", caseId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar conversa"),
    onSettled: () => setCreating(false),
  });

  const docState = useMemo(() => {
    const ready = documents.filter((d) => d.processing_status === "ready").length;
    const failed = documents.filter((d) => d.processing_status === "error" || d.processing_status === "failed").length;
    const processing = documents.length - ready - failed;
    return { ready, failed, processing, total: documents.length };
  }, [documents]);

  const goToDocuments = () => {
    onOpenChange(false);
    void navigate({ to: "/assistencias/$caseId", params: { caseId }, search: { tab: "documentos" } });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-svh w-full max-w-none flex-col gap-0 p-0 sm:w-[80vw] sm:max-w-[1100px] lg:min-w-[720px]"
      >
        {/* ── Cabeçalho fixo ── */}
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background px-4 py-3 pr-14">
          <JurisMindMark size={32} context={JURISMIND_CONTEXT.chat} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate font-heading text-base font-medium">
              JurisMind AI
            </SheetTitle>
            <p className="truncate text-sm text-muted-foreground">
              {caseInfo.title}
              {caseInfo.client_name
                ? ` · ${caseInfo.client_name}`
                : caseInfo.case_number
                  ? ` · ${caseInfo.case_number}`
                  : ""}
            </p>
          </div>
          <DocStateBadge {...docState} />
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreating(true);
                createMut.mutate();
              }}
              disabled={creating || createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="mr-1 h-4 w-4" />
              )}
              Nova conversa
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/assistencias/$caseId/chat"
                params={{ caseId }}
                search={effectiveThreadId ? { thread: effectiveThreadId } : {}}
                onClick={() => onOpenChange(false)}
              >
                <Maximize2 className="mr-1 h-4 w-4" />
                <span className="hidden sm:inline">Abrir em tela inteira</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* ── Estado dos documentos ── */}
        {docState.ready === 0 && (
          <div className="shrink-0 border-b bg-muted/40 px-4 py-3">
            <p className="text-sm text-foreground">
              {docState.processing > 0
                ? `Nenhum documento está pronto para consulta ainda. ${docState.processing} em processamento.`
                : "Nenhum documento está pronto para consulta. Acompanhe o processamento ou envie documentos ao caso."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={goToDocuments}>
                Abrir documentos do caso
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void qc.invalidateQueries({ queryKey: ["documents", caseId] });
                  toast.info("Verificando o processamento dos documentos…");
                }}
              >
                Acompanhar processamento
              </Button>
              {canUpload && (
                <Button variant="ghost" size="sm" onClick={goToDocuments}>
                  Enviar documento
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Corpo: chat real ── */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <JurisMindChat
            fullscreen
            caseId={caseId}
            threadId={effectiveThreadId}
            onThreadCreated={(id) => {
              onThreadChange(id);
              void qc.invalidateQueries({ queryKey: ["ai-threads", caseId] });
            }}
            caseInfo={caseInfo}
            documents={documents}
            selectedDocIds={selectedDocIds}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DocStateBadge({
  ready,
  processing,
  failed,
  total,
}: {
  ready: number;
  processing: number;
  failed: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
        Sem documentos
      </span>
    );
  }
  const items = [
    { n: ready, label: "prontos", icon: CheckCircle2, cls: "text-foreground" },
    { n: processing, label: "processando", icon: Loader2, cls: "text-muted-foreground" },
    { n: failed, label: "com erro", icon: AlertCircle, cls: "text-destructive" },
  ].filter((i) => i.n > 0);

  return (
    <span className="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1 text-xs">
      {items.map(({ n, label, icon: Icon, cls }) => (
        <span key={label} className={cn("flex items-center gap-1", cls)}>
          <Icon className={cn("h-3.5 w-3.5", label === "processando" && "animate-spin")} />
          {n} {label}
        </span>
      ))}
    </span>
  );
}
