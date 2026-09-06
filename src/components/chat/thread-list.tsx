import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, MessageSquarePlus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createThread,
  deleteThread,
  listThreads,
  renameThread,
} from "@/lib/threads.functions";
import { cn } from "@/lib/utils";

/**
 * Histórico de conversas do caso (estilo "projeto" do ChatGPT): lista
 * persistida, criar nova, renomear e excluir. Usada no painel lateral do caso
 * e na tela inteira, sempre sobre as mesmas threads salvas.
 */
export function ThreadList({
  caseId,
  activeThreadId,
  onSelect,
  className,
}: {
  caseId: string;
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const renameFn = useServerFn(renameThread);
  const deleteFn = useServerFn(deleteThread);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const { data: threads = [] } = useQuery({
    queryKey: ["ai-threads", caseId],
    queryFn: () => listFn({ data: { case_id: caseId } }),
    refetchInterval: 15000,
  });

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["ai-threads", caseId] });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { case_id: caseId } }),
    onSuccess: (t) => {
      onSelect(t.id);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao criar conversa"),
  });

  const renameMut = useMutation({
    mutationFn: (v: { id: string; title: string }) => renameFn({ data: v }),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao renomear conversa"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => invalidate(),
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Erro ao excluir conversa"),
  });

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Conversas
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2"
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nova
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">
            Nenhuma conversa ainda. Clique em <b>Nova</b> para começar.
          </p>
        ) : (
          <ul className="space-y-1">
            {threads.map((t) => (
              <li key={t.id}>
                {editingId === t.id ? (
                  <div className="flex items-center gap-1 px-1 py-1">
                    <Input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && draftTitle.trim())
                          renameMut.mutate({ id: t.id, title: draftTitle.trim() });
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      title="Salvar"
                      onClick={() =>
                        draftTitle.trim() &&
                        renameMut.mutate({ id: t.id, title: draftTitle.trim() })
                      }
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      title="Cancelar"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "group flex items-start gap-1 rounded-md px-2 py-1.5 hover:bg-muted",
                      activeThreadId === t.id && "bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(t.id)}
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
                        setEditingId(t.id);
                        setDraftTitle(t.title);
                      }}
                      className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                      title="Renomear"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Excluir conversa "${t.title}"?`))
                          deleteMut.mutate(t.id);
                      }}
                      className="rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
