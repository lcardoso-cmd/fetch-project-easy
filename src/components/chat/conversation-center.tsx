import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyConversations,
  getOrCreateDM,
  getOrCreateGeneralConversation,
  searchMessages,
} from "@/lib/conversations.functions";
import { listOrgMembers } from "@/lib/organization.functions";
import { ConversationView } from "@/components/chat/conversation-view";
import { conversationLabel, initialsOf } from "@/lib/conversation-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderKanban,
  Hash,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type Conv = {
  id: string;
  kind: "general" | "case" | "dm";
  case_id: string | null;
  case_title: string | null;
  title: string | null;
  other_name: string | null;
  participant_user_ids: string[];
  last_message_at: string;
  last_message_preview: string;
  unread: number;
};

type Tab = "general" | "case" | "dm";

/**
 * Central de conversas reutilizada pela página `/conversas` e pelo
 * drawer do cabeçalho — mesmos dados, mesmos componentes.
 */
export function ConversationCenter({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const listFn = useServerFn(listMyConversations);
  const getDMFn = useServerFn(getOrCreateDM);
  const getGeneralFn = useServerFn(getOrCreateGeneralConversation);
  const searchFn = useServerFn(searchMessages);

  const { data: convsRaw = [], isLoading } = useQuery({
    queryKey: ["my-conversations"],
    queryFn: () => listFn(),
  });
  const convs = convsRaw as unknown as Conv[];

  const [tab, setTab] = useState<Tab>("general");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newDmOpen, setNewDmOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [showList, setShowList] = useState(true);

  // Garante o canal geral da organização na primeira visita
  useEffect(() => {
    getGeneralFn()
      .then(() => qc.invalidateQueries({ queryKey: ["my-conversations"] }))
      .catch(() => {});
  }, [getGeneralFn, qc]);

  const filtered = useMemo(() => convs.filter((c) => c.kind === tab), [convs, tab]);

  useEffect(() => {
    if (filtered.length === 0) {
      setActiveId(null);
      return;
    }
    if (!activeId || !filtered.some((c) => c.id === activeId)) {
      setActiveId(filtered[0]!.id);
    }
  }, [filtered, activeId]);

  // Realtime global para contadores de não lidas
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => qc.invalidateQueries({ queryKey: ["my-conversations"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const debounced = useDebounced(term, 350);
  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ["message-search", debounced],
    queryFn: () => searchFn({ data: { query: debounced } }),
    enabled: debounced.trim().length >= 2,
  });

  const active = convs.find((c) => c.id === activeId) ?? null;

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: "general", label: "Geral", icon: <Hash className="h-4 w-4" /> },
    { key: "case", label: "Casos", icon: <FolderKanban className="h-4 w-4" /> },
    { key: "dm", label: "Diretas", icon: <Users className="h-4 w-4" /> },
  ];

  const unreadByTab = (k: Tab) =>
    convs.filter((c) => c.kind === k).reduce((sum, c) => sum + c.unread, 0);

  return (
    <div
      className={cn(
        "grid min-h-0 gap-0 overflow-hidden rounded-2xl border bg-card",
        compact ? "h-full grid-cols-1" : "h-full grid-cols-1 lg:grid-cols-[320px,1fr]",
      )}
    >
      {/* Lista */}
      <div
        className={cn(
          "flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r",
          !compact && !showList && "hidden lg:flex",
          compact && !showList && "hidden",
        )}
      >
        <div className="flex border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setActiveId(null);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-sm font-medium",
                tab === t.key
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.icon}
              {t.label}
              {unreadByTab(t.key) > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
                  {unreadByTab(t.key)}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Pesquisar mensagens"
              aria-label="Pesquisar mensagens"
              className="pl-8 text-sm"
            />
            {term && (
              <button
                type="button"
                aria-label="Limpar pesquisa"
                onClick={() => setTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {debounced.trim().length >= 2 ? (
            <div>
              <div className="flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground">
                Resultados {searching && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              {results.length === 0 && !searching ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nenhuma mensagem encontrada para “{debounced}”.
                </p>
              ) : (
                <ul>
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const conv = convs.find((c) => c.id === r.conversation_id);
                          if (conv) setTab(conv.kind);
                          setActiveId(r.conversation_id);
                          setTerm("");
                          setShowList(compact ? false : true);
                        }}
                        className="w-full border-b px-4 py-3 text-left hover:bg-muted/40"
                      >
                        <p className="text-sm font-medium text-foreground">{r.author_name}</p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{r.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {tab === "general"
                ? "O canal geral aparece aqui assim que a organização estiver ativa."
                : tab === "case"
                  ? "Abra um caso para iniciar a conversa da equipe."
                  : "Nenhuma mensagem direta ainda."}
            </p>
          ) : (
            <ul>
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(c.id);
                      if (compact) setShowList(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 border-b px-4 py-3 text-left hover:bg-muted/40",
                      activeId === c.id && "bg-muted/60",
                    )}
                  >
                    <div className="mt-0.5 rounded-md bg-muted p-2">
                      {c.kind === "general" ? (
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      ) : c.kind === "case" ? (
                        <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {conversationLabel(c)}
                        </span>
                        {c.unread > 0 && (
                          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
                            {c.unread}
                          </span>
                        )}
                      </div>
                      {c.last_message_preview && (
                        <p className="truncate text-sm text-muted-foreground">
                          {c.last_message_preview}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.last_message_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t p-2">
          <Button size="sm" variant="outline" className="w-full" onClick={() => setNewDmOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nova mensagem direta
          </Button>
        </div>
      </div>

      {/* Conversa ativa */}
      <div
        className={cn(
          "flex min-h-0 flex-col p-2 sm:p-3",
          compact && showList && "hidden",
          !compact && !showList && "flex",
        )}
      >
        {compact && active && (
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 self-start"
            onClick={() => setShowList(true)}
          >
            ← Conversas
          </Button>
        )}
        {active ? (
          <>
            <div className="min-h-0 flex-1">
              <ConversationView
                conversationId={active.id}
                title={conversationLabel(active)}
                subtitle={
                  active.kind === "general"
                    ? "Todos os integrantes da organização"
                    : active.kind === "case"
                      ? "Equipe com acesso ao caso"
                      : "Mensagem direta"
                }
              />
            </div>
            {active.kind === "case" && active.case_id && (
              <Link
                to="/cases/$caseId"
                params={{ caseId: active.case_id }}
                className="mt-2 text-xs text-muted-foreground underline"
              >
                Abrir o caso completo
              </Link>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            Selecione uma conversa para começar.
          </div>
        )}
      </div>

      <NewDMDialog
        open={newDmOpen}
        onClose={() => setNewDmOpen(false)}
        onCreated={(id) => {
          setTab("dm");
          setActiveId(id);
          setNewDmOpen(false);
          if (compact) setShowList(false);
          qc.invalidateQueries({ queryKey: ["my-conversations"] });
        }}
        getDM={(otherId) => getDMFn({ data: { other_user_id: otherId } })}
      />
    </div>
  );
}

function useDebounced(value: string, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function NewDMDialog({
  open,
  onClose,
  onCreated,
  getDM,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  getDM: (otherUserId: string) => Promise<{ id: string } | null>;
}) {
  const { user } = useAuth();
  const listMembersFn = useServerFn(listOrgMembers);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["org-members"],
    queryFn: () => listMembersFn(),
    enabled: open,
  });
  const others = members.filter((m) => m.id !== user?.id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova mensagem direta</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : others.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você é a única pessoa ativa na organização. Convide integrantes em Administração →
            Equipe para conversar por mensagem direta.
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {others.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={async () => {
                    setBusyId(m.id);
                    try {
                      const conv = await getDM(m.id);
                      if (conv) onCreated(conv.id);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Falha ao abrir conversa");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initialsOf(m.name)}
                    </span>
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.role_label}</span>
                    </span>
                  </span>
                  {busyId === m.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
