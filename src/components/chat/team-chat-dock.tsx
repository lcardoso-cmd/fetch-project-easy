import { useCallback, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { useQuery as useRQ, useQueryClient } from "@tanstack/react-query";
import { Minus, X, Users, Hash, MessageSquare, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getOrCreateCaseConversation,
  getOrCreateDM,
  getOrCreateGeneralConversation,
  listChatContacts,
} from "@/lib/conversations.functions";
import { initialsOf } from "@/lib/conversation-utils";
import { ConversationView } from "@/components/chat/conversation-view";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";

type ChatWindow = {
  key: string;
  conversationId: string;
  title: string;
  subtitle?: string;
  initials: string;
  unread?: number;
};

/** Extrai o id do caso da rota atual, quando estamos no workspace de um caso. */
function useCurrentCaseId(): string | undefined {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const m = pathname.match(/^\/(?:assistencias|cases)\/([0-9a-f-]{36})/i);
  return m?.[1];
}

/**
 * Barra lateral direita de chat (estilo Bitrix24): círculos com as pessoas da
 * organização; ao clicar, a conversa entra deslizando pela direita. Vários
 * chats podem ficar abertos lado a lado, minimizados ou fechados.
 */
export function TeamChatDock() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const caseId = useCurrentCaseId();
  const queryClient = useQueryClient();

  const contactsFn = useServerFn(listChatContacts);
  const dmFn = useServerFn(getOrCreateDM);
  const generalFn = useServerFn(getOrCreateGeneralConversation);
  const caseConvFn = useServerFn(getOrCreateCaseConversation);

  const [open, setOpen] = useState<ChatWindow[]>([]);
  const [minimized, setMinimized] = useState<ChatWindow[]>([]);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [stripOpen, setStripOpen] = useState(false);

  const { data: contacts = [] } = useRQ({
    queryKey: ["chat-contacts"],
    queryFn: () => contactsFn(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? contacts.filter((c) => c.name.toLowerCase().includes(term))
      : contacts;
    return searching || isMobile ? list : list.slice(0, 8);
  }, [contacts, search, searching, isMobile]);

  const focus = useCallback((win: ChatWindow) => {
    setMinimized((prev) => prev.filter((c) => c.key !== win.key));
    setOpen((prev) => (prev.some((c) => c.key === win.key) ? prev : [...prev, win]));
    setStripOpen(false);
    setSearching(false);
    setSearch("");
    queryClient.invalidateQueries({ queryKey: ["chat-contacts"] });
    queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
  }, [queryClient]);

  const openDM = async (contact: { user_id: string; name: string }) => {
    try {
      const conv = await dmFn({ data: { other_user_id: contact.user_id } });
      if (!conv) return;
      focus({
        key: `dm-${conv.id}`,
        conversationId: conv.id,
        title: contact.name,
        subtitle: "Mensagem direta",
        initials: initialsOf(contact.name),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const openGeneral = async () => {
    try {
      const conv = await generalFn();
      if (!conv) return;
      focus({
        key: `general-${conv.id}`,
        conversationId: conv.id,
        title: "Canal geral",
        subtitle: "Todo o escritório",
        initials: "#",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const openCase = async () => {
    if (!caseId) return;
    try {
      const conv = await caseConvFn({ data: { case_id: caseId } });
      if (!conv) return;
      focus({
        key: `case-${conv.id}`,
        conversationId: conv.id,
        title: "Equipe do caso",
        subtitle: "Conversa entre membros",
        initials: "EQ",
      });
    } catch (e) {
      console.error(e);
    }
  };

  const minimize = (key: string) =>
    setOpen((prev) => {
      const win = prev.find((c) => c.key === key);
      if (win) setMinimized((m) => (m.some((x) => x.key === key) ? m : [...m, win]));
      return prev.filter((c) => c.key !== key);
    });

  const close = (key: string) => {
    setOpen((prev) => prev.filter((c) => c.key !== key));
    setMinimized((prev) => prev.filter((c) => c.key !== key));
  };

  if (!user) return null;

  const railWidth = isMobile ? 0 : 56;

  return (
    <>
      {/* Janelas de conversa: entram deslizando pela direita */}
      <div
        className="pointer-events-none fixed bottom-0 z-40 flex flex-row-reverse items-end gap-3 p-0 sm:bottom-4 sm:gap-3"
        style={{ right: railWidth + (isMobile ? 0 : 12) }}
      >
        {open.map((win) => (
          <div
            key={win.key}
            className="pointer-events-auto flex h-[100dvh] w-screen flex-col overflow-hidden border border-border bg-background shadow-2xl duration-200 animate-in slide-in-from-right-8 fade-in-0 sm:h-[520px] sm:w-[360px] sm:rounded-xl"
          >
            <div className="flex h-12 items-center justify-between gap-2 border-b border-white/[0.14] bg-primary px-3 text-primary-foreground">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/20 text-[13px] font-semibold">
                  {win.initials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{win.title}</span>
                  {win.subtitle && (
                    <span className="block truncate text-[12px] text-primary-foreground/80">
                      {win.subtitle}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex shrink-0 items-center">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 text-primary-foreground hover:bg-primary-foreground/20 sm:h-8 sm:w-8"
                  onClick={() => minimize(win.key)}
                  aria-label={`Minimizar conversa com ${win.title}`}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-11 w-11 text-primary-foreground hover:bg-primary-foreground/20 sm:h-8 sm:w-8"
                  onClick={() => close(win.key)}
                  aria-label={`Fechar conversa com ${win.title}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ConversationView conversationId={win.conversationId} subtitle={win.subtitle} />
            </div>
          </div>
        ))}
      </div>

      {/* Barra de círculos */}
      {isMobile ? (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
          {stripOpen && (
            <div className="max-h-[50dvh] w-[288px] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl duration-200 animate-in slide-in-from-right-4 fade-in-0">
              <RailList
                contacts={visible}
                caseId={caseId}
                onGeneral={openGeneral}
                onCase={openCase}
                onContact={openDM}
                layout="list"
              />
            </div>
          )}
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => setStripOpen((v) => !v)}
            aria-label="Abrir chat da equipe"
          >
            {stripOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
          </Button>
        </div>
      ) : (
        <aside
          aria-label="Chat da equipe"
          className="fixed right-0 top-0 z-50 hidden h-dvh w-14 flex-col items-center gap-2 border-l border-white/[0.12] bg-[hsl(var(--sidebar-background,222_100%_11%))] py-3 lg:flex"
          style={{ backgroundColor: "#000038" }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSearching((v) => !v)}
                aria-label="Buscar colaborador"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.14] text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
              >
                <Search className="h-[17px] w-[17px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Buscar colaborador</TooltipContent>
          </Tooltip>

          <div className="sidebar-scroll flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto">
            <RailList
              contacts={visible}
              caseId={caseId}
              onGeneral={openGeneral}
              onCase={openCase}
              onContact={openDM}
              layout="rail"
            />
          </div>

          {minimized.length > 0 && (
            <div className="flex w-full flex-col items-center gap-2 border-t border-white/[0.12] pt-2">
              {minimized.map((win) => (
                <Tooltip key={win.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => focus(win)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.14] text-[12px] font-semibold text-white ring-1 ring-[#00FFFF]/60 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
                      aria-label={`Reabrir conversa com ${win.title}`}
                    >
                      {win.initials}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{win.title}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* Busca de colaboradores (desktop) */}
      {searching && !isMobile && (
        <div className="fixed right-16 top-3 z-50 hidden w-72 rounded-xl border border-border bg-card p-3 shadow-2xl duration-150 animate-in slide-in-from-right-4 fade-in-0 lg:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar colaborador..."
              className="pl-8 text-[14px]"
            />
          </div>
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">
                Nenhum colaborador encontrado.
              </p>
            ) : (
              visible.map((c) => (
                <button
                  key={c.user_id}
                  type="button"
                  onClick={() => openDM(c)}
                  className="flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-secondary"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[12px] font-semibold">
                    {initialsOf(c.name)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{c.name}</span>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[12px] font-semibold text-primary-foreground">
                      {c.unread > 9 ? "9+" : c.unread}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

type Contact = {
  user_id: string;
  name: string;
  conversation_id: string | null;
  unread: number;
  last_message_at: string | null;
};

function RailList({
  contacts,
  caseId,
  onGeneral,
  onCase,
  onContact,
  layout,
}: {
  contacts: Contact[];
  caseId?: string;
  onGeneral: () => void;
  onCase: () => void;
  onContact: (c: Contact) => void;
  layout: "rail" | "list";
}) {
  if (layout === "list") {
    return (
      <div className="space-y-1">
        <Row label="Canal geral" hint="Todo o escritório" initials="#" onClick={onGeneral} />
        {caseId && (
          <Row label="Equipe do caso" hint="Membros deste caso" initials="EQ" onClick={onCase} />
        )}
        {contacts.map((c) => (
          <Row
            key={c.user_id}
            label={c.name}
            hint="Mensagem direta"
            initials={initialsOf(c.name)}
            unread={c.unread}
            onClick={() => onContact(c)}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <RailButton label="Canal geral" onClick={onGeneral}>
        <Hash className="h-[17px] w-[17px]" />
      </RailButton>
      {caseId && (
        <RailButton label="Equipe do caso" onClick={onCase}>
          <Users className="h-[17px] w-[17px]" />
        </RailButton>
      )}
      <span aria-hidden="true" className="my-1 h-px w-6 bg-white/[0.12]" />
      {contacts.map((c) => (
        <RailButton
          key={c.user_id}
          label={c.name}
          unread={c.unread}
          online
          onClick={() => onContact(c)}
        >
          <span className="text-[12px] font-semibold">{initialsOf(c.name)}</span>
        </RailButton>
      ))}
    </>
  );
}

function RailButton({
  label,
  unread = 0,
  online,
  onClick,
  children,
}: {
  label: string;
  unread?: number;
  online?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={`Abrir conversa: ${label}`}
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white transition-colors hover:bg-white/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]"
        >
          {children}
          {online && (
            <span
              aria-hidden="true"
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#000038] bg-emerald-400"
            />
          )}
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00FFFF] px-1 text-[11px] font-bold text-[#000038]">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">
        {label}
        {unread > 0 ? ` · ${unread} não lida(s)` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

function Row({
  label,
  hint,
  initials,
  unread = 0,
  onClick,
}: {
  label: string;
  hint: string;
  initials: string;
  unread?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-secondary"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-[12px] font-semibold">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-foreground">{label}</span>
        <span className="block truncate text-[13px] text-muted-foreground">{hint}</span>
      </span>
      {unread > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-[12px] font-semibold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
