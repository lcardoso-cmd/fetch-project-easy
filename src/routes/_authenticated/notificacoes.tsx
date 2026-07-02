import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  listNotifications,
  markMentionRead,
  markAllMentionsRead,
  type NotificationItem,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AtSign, CheckCheck, ClipboardList, FolderOpen, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

type Filter = "all" | "unread" | "mentions" | "tasks" | "cases" | "direct";

function NotificationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markOneFn = useServerFn(markMentionRead);
  const markAllFn = useServerFn(markAllMentionsRead);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
  });

  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (filter === "unread") return !n.read;
      if (filter === "mentions") return n.kind === "mention";
      if (filter === "tasks") return n.kind === "task";
      if (filter === "cases") return !!n.case_id;
      if (filter === "direct") return n.kind === "mention" && !n.case_id;
      return true;
    });
  }, [items, filter]);

  const selected = filtered.find((n) => n.id === selectedId) ?? filtered[0] ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications"] });

  const markRead = async (n: NotificationItem) => {
    if (n.kind === "mention" && !n.read) {
      await markOneFn({ data: { mention_id: n.id } });
      refresh();
    }
  };

  const markAll = async () => {
    await markAllFn();
    refresh();
  };

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "Todas", count: items.length },
    { id: "unread", label: "Não lidas", count: items.filter((i) => !i.read).length },
    { id: "mentions", label: "Menções" },
    { id: "tasks", label: "Tarefas" },
    { id: "cases", label: "Por caso" },
    { id: "direct", label: "Diretas" },
  ];

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notificações</h1>
          <p className="text-sm text-muted-foreground">
            {data?.unread ?? 0} não lidas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAll}>
          <CheckCheck className="mr-2 h-4 w-4" />
          Marcar todas como lidas
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
            {typeof f.count === "number" && (
              <Badge variant="secondary" className="ml-2">
                {f.count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[360px_1fr]">
        <div className="overflow-y-auto rounded-2xl border bg-card">
          {filtered.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <Inbox className="h-8 w-8" />
              Nenhuma notificação
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((n) => (
                <li key={`${n.kind}-${n.id}`}>
                  <button
                    onClick={() => {
                      setSelectedId(n.id);
                      markRead(n);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-accent",
                      selected?.id === n.id && "bg-accent",
                      !n.read && "font-medium",
                    )}
                  >
                    <div className="mt-0.5 text-muted-foreground">
                      {n.kind === "mention" ? (
                        <AtSign className="h-4 w-4" />
                      ) : (
                        <ClipboardList className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm">
                          {n.kind === "mention" ? n.author_name : n.title}
                        </span>
                        {!n.read && (
                          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {n.kind === "mention" ? n.preview : `Tarefa: ${n.status}`}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="overflow-y-auto rounded-2xl border bg-card p-6">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Selecione uma notificação
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selected.kind === "mention" ? (
                  <AtSign className="h-5 w-5 text-primary" />
                ) : (
                  <ClipboardList className="h-5 w-5 text-primary" />
                )}
                <h2 className="text-lg font-semibold">
                  {selected.kind === "mention"
                    ? `Menção de ${selected.author_name}`
                    : selected.title}
                </h2>
                {!selected.read && <Badge>Não lida</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(selected.created_at).toLocaleString("pt-BR")}
              </p>

              {selected.kind === "mention" ? (
                <div className="rounded-md border bg-muted/30 p-4 text-sm whitespace-pre-wrap">
                  {selected.preview || "(sem conteúdo)"}
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div>
                    Status: <Badge variant="secondary">{selected.status}</Badge>
                  </div>
                  {selected.due_date && (
                    <div>
                      Vencimento:{" "}
                      {new Date(selected.due_date).toLocaleDateString("pt-BR")}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {selected.case_id && (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: selected.case_id }}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Abrir caso
                    </Link>
                  </Button>
                )}
                {selected.kind === "mention" && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/inbox">Ir para a conversa</Link>
                  </Button>
                )}
                {selected.kind === "task" && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/my-tasks">Ver tarefas</Link>
                  </Button>
                )}
                {selected.kind === "mention" && !selected.read && (
                  <Button size="sm" onClick={() => markRead(selected)}>
                    Marcar como lida
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
