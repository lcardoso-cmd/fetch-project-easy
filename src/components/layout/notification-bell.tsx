import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, MessageSquare, ClipboardCheck, Loader2, Sparkles, Paperclip } from "lucide-react";
import {
  listNotifications,
  markMentionRead,
  markAllMentionsRead,
  type NotificationItem,
} from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markMentionRead);
  const markAllFn = useServerFn(markAllMentionsRead);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
    enabled: !!user,
  });

  const items = (data?.items ?? []) as NotificationItem[];
  const unread = data?.unread ?? 0;

  // Realtime: invalidate when a mention or task touching this user lands
  useEffect(() => {
    if (!user) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    const channel = supabase
      .channel(`notif:${user.id}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_mentions",
          filter: `mentioned_user_id=eq.${user.id}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          filter: `assigned_to_user_id=eq.${user.id}`,
        },
        invalidate,
      )
      // Eventos B2B: sem coluna de user_id no evento, então filtramos
      // do lado do servidor (listNotifications) e apenas invalidamos aqui.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "b2b_service_request_events" },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  async function handleClickItem(n: NotificationItem) {
    if (n.kind === "mention") {
      try {
        await markFn({ data: { mention_id: n.id } });
      } catch {
        /* noop */
      }
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (n.case_id) {
        navigate({ to: "/assistencias/$caseId", params: { caseId: n.case_id } });
      } else {
        navigate({ to: "/conversas" });
      }
    } else if (n.kind === "task") {
      navigate({ to: "/tarefas" });
    } else {
      // b2b_event → abrir o pedido correspondente
      navigate({
        to: "/contratar-b2b/$requestId",
        params: { requestId: n.request_id },
      });
    }
  }

  async function handleMarkAll() {
    try {
      await markAllFn();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      /* noop */
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nada por aqui ainda.
            </p>
          ) : (
            items.map((n) => (
              <button
                key={`${n.kind}-${n.id}`}
                type="button"
                onClick={() => handleClickItem(n)}
                className={`flex w-full items-start gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted ${
                  !n.read ? "bg-primary/5" : ""
                }`}
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {n.kind === "mention" ? (
                    <MessageSquare className="h-3.5 w-3.5" />
                  ) : (
                    <ClipboardCheck className="h-3.5 w-3.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  {n.kind === "mention" ? (
                    <>
                      <div className="truncate text-xs font-medium">
                        {n.author_name} mencionou você
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">
                        {n.preview || "(mensagem sem texto)"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="truncate text-xs font-medium">
                        Nova tarefa atribuída
                      </div>
                      <div className="line-clamp-2 text-xs text-muted-foreground">{n.title}</div>
                    </>
                  )}
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))
          )}
        </div>
        <div className="border-t px-3 py-2 text-center">
          <Link
            to="/notificacoes"
            className="text-xs font-medium text-primary hover:underline"
          >
            Ver todas as notificações
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
