import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Minus,
  Search,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getOrCreateCaseConversation,
  getOrCreateDM,
  listConversationParticipants,
} from "@/lib/conversations.functions";
import { ConversationView } from "@/components/chat/conversation-view";
import { useAuth } from "@/hooks/use-auth";

type OpenChat = {
  key: string;
  conversationId: string;
  title: string;
  subtitle?: string;
  initials: string;
};

export function FloatingTeamChat({ caseId }: { caseId: string }) {
  const { user } = useAuth();
  const myId = user?.id ?? "";

  const getCaseConvFn = useServerFn(getOrCreateCaseConversation);
  const getDMFn = useServerFn(getOrCreateDM);
  const listPartsFn = useServerFn(listConversationParticipants);

  const [listOpen, setListOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [minimized, setMinimized] = useState<OpenChat[]>([]);

  const { data: caseConv } = useQuery({
    queryKey: ["case-conversation", caseId],
    queryFn: () => getCaseConvFn({ data: { case_id: caseId } }),
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["case-conversation-participants", caseConv?.id],
    enabled: !!caseConv?.id,
    queryFn: () =>
      listPartsFn({ data: { conversation_id: caseConv!.id } }),
  });

  const others = useMemo(
    () =>
      participants
        .filter((p) => p.id !== myId)
        .filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()),
        ),
    [participants, myId, search],
  );

  const openChat = (chat: OpenChat) => {
    setMinimized((prev) => prev.filter((c) => c.key !== chat.key));
    setOpenChats((prev) => {
      if (prev.some((c) => c.key === chat.key)) return prev;
      return [...prev, chat];
    });
    setListOpen(false);
  };

  const openCase = () => {
    if (!caseConv) return;
    openChat({
      key: `case-${caseConv.id}`,
      conversationId: caseConv.id,
      title: "Equipe do caso",
      subtitle: "Conversa entre membros",
      initials: "EQ",
    });
  };

  const openDM = async (other: { id: string; name: string }) => {
    try {
      const conv = await getDMFn({ data: { other_user_id: other.id } });
      if (!conv) return;
      openChat({
        key: `dm-${conv.id}`,
        conversationId: conv.id,
        title: other.name,
        subtitle: "Mensagem direta",
        initials: initialsOf(other.name),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const minimizeChat = (key: string) => {
    setOpenChats((prev) => {
      const c = prev.find((x) => x.key === key);
      if (c) setMinimized((m) => (m.some((x) => x.key === key) ? m : [...m, c]));
      return prev.filter((x) => x.key !== key);
    });
  };

  const closeChat = (key: string) => {
    setOpenChats((prev) => prev.filter((x) => x.key !== key));
    setMinimized((prev) => prev.filter((x) => x.key !== key));
  };

  return (
    <>
      {/* Open chat windows */}
      <div className="fixed bottom-24 right-6 z-50 flex flex-row-reverse items-end gap-3 pointer-events-none">
        {openChats.map((chat) => (
          <div
            key={chat.key}
            className="pointer-events-auto w-[360px] h-[520px] rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 slide-in-from-bottom-4 duration-200"
          >
            <div className="flex items-center justify-between border-b bg-primary px-3 py-2 text-primary-foreground">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-semibold">
                  {chat.initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{chat.title}</p>
                  {chat.subtitle && (
                    <p className="truncate text-[11px] opacity-80">
                      {chat.subtitle}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => minimizeChat(chat.key)}
                  aria-label="Minimizar"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => closeChat(chat.key)}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ConversationView
                conversationId={chat.conversationId}
                subtitle={chat.subtitle}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Collaborators panel */}
      {listOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 max-h-[520px] rounded-xl border bg-card shadow-2xl flex flex-col animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" />
              Colaboradores
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setListOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
            <button
              onClick={openCase}
              disabled={!caseConv}
              className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-secondary disabled:opacity-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Equipe do caso</p>
                <p className="truncate text-xs text-muted-foreground">
                  Conversa em grupo do caso
                </p>
              </div>
            </button>
            {others.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum colaborador encontrado.
              </p>
            ) : (
              others.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openDM(p)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-secondary"
                >
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                    {initialsOf(p.name)}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Iniciar conversa direta
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bottom-right button + minimized chat heads */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <div className="flex flex-col-reverse items-end gap-2">
          <TooltipProvider delayDuration={100}>
            {minimized.map((chat) => (
              <Tooltip key={chat.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => openChat(chat)}
                    className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
                  >
                    <span className="text-xs font-semibold">
                      {chat.initials}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{chat.title}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setListOpen((v) => !v)}
          aria-label="Abrir chat da equipe"
        >
          {listOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </Button>
      </div>
    </>
  );
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
