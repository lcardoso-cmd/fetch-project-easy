import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BrainCircuit, History } from "lucide-react";
import { z } from "zod";

import { getCase } from "@/lib/cases.functions";
import { listDocuments } from "@/lib/documents.functions";
import { ensureThread, listThreads } from "@/lib/threads.functions";
import { JurisMindChat } from "@/components/chat/jurismind-chat";
import { ThreadList } from "@/components/chat/thread-list";
import { useAccess } from "@/hooks/use-access";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { isDocUsable } from "@/lib/documents/usable";

const searchSchema = z.object({ thread: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/assistencias/$caseId/chat")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CaseChatFullPage,
});

function CaseChatFullPage() {
  const { caseId } = Route.useParams();
  const { thread: threadFromUrl } = Route.useSearch();
  const navigate = useNavigate();

  const qc = useQueryClient();
  const getCaseFn = useServerFn(getCase);
  const listDocsFn = useServerFn(listDocuments);
  const listThreadsFn = useServerFn(listThreads);
  const ensureThreadFn = useServerFn(ensureThread);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { hasOrgPermission, isLoading: accessLoading } = useAccess();
  const canUseAi = hasOrgPermission("ai.use");

  const { data: caseData } = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCaseFn({ data: { id: caseId } }),
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["documents", caseId],
    queryFn: () => listDocsFn({ data: { case_id: caseId } }),
    refetchInterval: 5000,
  });
  const { data: threads = [] } = useQuery({
    queryKey: ["ai-threads", caseId],
    queryFn: () => listThreadsFn({ data: { case_id: caseId } }),
    refetchInterval: 15000,
  });

  // A conversa ativa vive no endereço da página: recarregar ou voltar mantém
  // exatamente a mesma conversa persistida.
  const activeThreadId = threadFromUrl ?? null;
  const setActiveThreadId = useCallback(
    (id: string | null) => {
      void navigate({
        to: "/assistencias/$caseId/chat",
        params: { caseId },
        search: id ? { thread: id } : {},
        replace: true,
      });
    },
    [navigate, caseId],
  );

  // Sem conversa no endereço: continua a mais recente ou cria uma.
  const ensuringRef = useRef(false);
  useEffect(() => {
    if (activeThreadId || ensuringRef.current) return;
    if (threads.length > 0) {
      setActiveThreadId(threads[0].id);
      return;
    }
    ensuringRef.current = true;
    void (async () => {
      try {
        const t = await ensureThreadFn({ data: { case_id: caseId } });
        setActiveThreadId(t.id);
        void qc.invalidateQueries({ queryKey: ["ai-threads", caseId] });
      } catch {
        // silencioso: o envio ainda cria a conversa no servidor
      } finally {
        ensuringRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId, threads, caseId]);

  const readyDocIds = useMemo(
    () => docs.filter((d) => isDocUsable(d.processing_status)).map((d) => d.id),
    [docs],
  );
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) =>
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectAll = () => setSelectedDocIds(new Set(readyDocIds));
  const deselectAll = () => setSelectedDocIds(new Set());

  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = readyDocIds.filter((id) => !seen.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current.add(id));
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((id) => next.add(id));
      return next;
    });
  }, [readyDocIds]);

  if (!accessLoading && !canUseAi) {
    return (
      <div className="space-y-3 p-6">
        <p className="font-medium">Sem acesso ao JurisMind AI</p>
        <p className="text-sm text-muted-foreground">
          Seu perfil não possui a permissão para usar o assistente de IA. Fale com o
          administrador do escritório.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/assistencias/$caseId" params={{ caseId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao caso
          </Link>
        </Button>
      </div>
    );
  }

  if (!caseData) {
    return <p className="p-6 text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="flex h-[calc(100svh-4.5rem)] min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/assistencias/$caseId" params={{ caseId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao caso
          </Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BrainCircuit className="h-5 w-5 shrink-0 text-primary" />
          <p className="truncate font-semibold">
            JurisMind AI — {caseData.title}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 2xl:hidden"
          onClick={() => setHistoryOpen(true)}
        >
          <History className="mr-1 h-4 w-4" />
          Conversas
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Histórico de conversas do caso */}
        <ThreadList
          caseId={caseId}
          activeThreadId={activeThreadId}
          onSelect={setActiveThreadId}
          className="hidden w-64 shrink-0 border-r bg-muted/30 2xl:flex"
        />

        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
            <SheetTitle className="border-b px-4 py-3 text-base">
              Conversas do caso
            </SheetTitle>
            <ThreadList
              caseId={caseId}
              activeThreadId={activeThreadId}
              onSelect={(id) => {
                setActiveThreadId(id);
                setHistoryOpen(false);
              }}
              className="h-[calc(100svh-3.5rem)]"
            />
          </SheetContent>
        </Sheet>


        <div className="min-h-0 flex-1 overflow-hidden">
          <JurisMindChat
            key={activeThreadId ?? "new-conversation"}
            fullscreen
            caseId={caseId}
            threadId={activeThreadId}
            onThreadCreated={(id) => {
              setActiveThreadId(id);
              void qc.invalidateQueries({ queryKey: ["ai-threads", caseId] });
            }}
            caseInfo={{
              title: caseData.title,
              client_name: caseData.client_name,
              status: caseData.status,
              case_number: caseData.case_number,
              case_type: caseData.case_type,
              jurisdiction: caseData.jurisdiction,
              parties: (caseData.parties ?? []) as Array<{
                role: string;
                name: string;
                relation?: string | null;
              }>,
              represented_party: (caseData.represented_party ?? null) as {
                role: string;
                name: string;
              } | null,
            }}
            documents={docs}
            selectedDocIds={selectedDocIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
        </div>
      </div>
    </div>
  );
}
