import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BrainCircuit,
  MessageSquarePlus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { getCase } from "@/lib/cases.functions";
import { listDocuments } from "@/lib/documents.functions";
import {
  createThread,
  deleteThread,
  listThreads,
} from "@/lib/threads.functions";
import { JurisMindChat } from "@/components/chat/jurismind-chat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ thread: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/assistencias/$caseId/chat")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CaseChatFullPage,
});

function CaseChatFullPage() {
  const { caseId } = Route.useParams();
  const { thread: threadFromUrl } = Route.useSearch();

  const qc = useQueryClient();
  const getCaseFn = useServerFn(getCase);
  const listDocsFn = useServerFn(listDocuments);
  const listThreadsFn = useServerFn(listThreads);
  const createThreadFn = useServerFn(createThread);
  const deleteThreadFn = useServerFn(deleteThread);

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

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Seleciona a primeira thread automaticamente
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [threads, activeThreadId]);

  const createMut = useMutation({
    mutationFn: () => createThreadFn({ data: { case_id: caseId } }),
    onSuccess: (t) => {
      setActiveThreadId(t.id);
      void qc.invalidateQueries({ queryKey: ["ai-threads", caseId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao criar conversa"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteThreadFn({ data: { id } }),
    onSuccess: (_r, id) => {
      if (activeThreadId === id) setActiveThreadId(null);
      void qc.invalidateQueries({ queryKey: ["ai-threads", caseId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao excluir conversa"),
  });

  const readyDocIds = useMemo(
    () => docs.filter((d) => d.processing_status === "ready").map((d) => d.id),
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
        <div className="flex min-w-0 items-center gap-2">
          <BrainCircuit className="h-5 w-5 shrink-0 text-primary" />
          <p className="truncate font-semibold">
            JurisMind AI — {caseData.title}
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar de conversas */}
        <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Conversas
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2"
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              <MessageSquarePlus className="h-4 w-4" />
              Nova
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {threads.length === 0 ? (
              <p className="p-3 text-center text-xs text-muted-foreground">
                Nenhuma conversa ainda. Clique em <b>Nova</b> para começar.
              </p>
            ) : (
              <ul className="space-y-1">
                {threads.map((t) => (
                  <li key={t.id}>
                    <div
                      className={cn(
                        "group flex items-start gap-1 rounded-md px-2 py-1.5 hover:bg-muted",
                        activeThreadId === t.id && "bg-muted",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveThreadId(t.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm">{t.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(t.last_message_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Excluir conversa "${t.title}"?`))
                            deleteMut.mutate(t.id);
                        }}
                        className="rounded p-1 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="min-h-0 flex-1 overflow-hidden">
          <JurisMindChat
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
