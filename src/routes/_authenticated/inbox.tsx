import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyConversations,
  getOrCreateDM,
} from "@/lib/conversations.functions";
import { listTeamMembers } from "@/lib/team.functions";
import { ConversationView } from "@/components/chat/conversation-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FolderKanban, MessageSquare, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: InboxPage,
});

type Conv = {
  id: string;
  kind: "case" | "dm";
  case_id: string | null;
  case_title: string | null;
  title: string | null;
  other_name: string | null;
  participant_user_ids: string[];
  last_message_at: string;
  unread: number;
};

function InboxPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyConversations);
  const getDMFn = useServerFn(getOrCreateDM);
  const listTeamFn = useServerFn(listTeamMembers);
  const { user } = useAuth();

  const { data: convsRaw = [] } = useQuery({
    queryKey: ["my-conversations"],
    queryFn: () => listFn(),
  });
  const convs = convsRaw as unknown as Conv[];

  const [tab, setTab] = useState<"case" | "dm">("case");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newDmOpen, setNewDmOpen] = useState(false);

  const filtered = useMemo(() => convs.filter((c) => c.kind === tab), [convs, tab]);

  useEffect(() => {
    if (!activeId && filtered[0]) setActiveId(filtered[0].id);
  }, [filtered, activeId]);

  // Subscribe to new messages globally to bump unread counts
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

  const active = convs.find((c) => c.id === activeId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Conversas</h1>
          <p className="mt-1 text-muted-foreground">
            Chat interno da equipe — por caso ou mensagem direta.
          </p>
        </div>
        <Button onClick={() => setNewDmOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova mensagem direta
        </Button>
      </div>

      <div className="grid h-[calc(100vh-14rem)] grid-cols-[320px,1fr] gap-4 rounded-2xl border bg-card">
        <div className="flex flex-col border-r">
          <div className="flex border-b">
            <TabBtn active={tab === "case"} onClick={() => setTab("case")} icon={<FolderKanban className="h-4 w-4" />}>
              Casos
            </TabBtn>
            <TabBtn active={tab === "dm"} onClick={() => setTab("dm")} icon={<Users className="h-4 w-4" />}>
              Diretas
            </TabBtn>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {tab === "case"
                  ? "Abra um caso para iniciar a conversa da equipe."
                  : "Nenhuma mensagem direta ainda."}
              </p>
            ) : (
              <ul>
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        "flex w-full items-start gap-3 border-b px-4 py-3 text-left hover:bg-muted/40",
                        activeId === c.id && "bg-muted/60",
                      )}
                    >
                      <div className="mt-0.5 rounded-md bg-muted p-2">
                        {c.kind === "case" ? (
                          <FolderKanban className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {c.kind === "case" ? c.case_title ?? "Caso" : c.other_name ?? "Conversa"}
                          </span>
                          {c.unread > 0 && (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                              {c.unread}
                            </span>
                          )}
                        </div>
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
        </div>

        <div className="p-3">
          {active ? (
            <ConversationView
              conversationId={active.id}
              title={
                active.kind === "case"
                  ? active.case_title ?? "Caso"
                  : active.other_name ?? "Mensagem direta"
              }
              subtitle={
                active.kind === "case" && active.case_id
                  ? "Conversa do caso"
                  : "Mensagem direta"
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          )}
        </div>
      </div>

      <NewDMDialog
        open={newDmOpen}
        onClose={() => setNewDmOpen(false)}
        listTeamFn={listTeamFn}
        getDMFn={getDMFn}
        onCreated={(id) => {
          setTab("dm");
          setActiveId(id);
          setNewDmOpen(false);
          qc.invalidateQueries({ queryKey: ["my-conversations"] });
        }}
      />

      {active?.kind === "case" && active.case_id && (
        <div className="text-xs text-muted-foreground">
          <Link to="/cases/$caseId" params={{ caseId: active.case_id }} className="underline">
            Abrir caso completo
          </Link>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium",
        active ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function NewDMDialog({
  open,
  onClose,
  listTeamFn,
  getDMFn,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  listTeamFn: ReturnType<typeof useServerFn<typeof listTeamMembers>>;
  getDMFn: ReturnType<typeof useServerFn<typeof getOrCreateDM>>;
  onCreated: (id: string) => void;
}) {
  const { data: team = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => listTeamFn(),
    enabled: open,
  });
  const linked = team.filter((m) => m.member_user_id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova mensagem direta</DialogTitle>
        </DialogHeader>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum membro da equipe tem conta vinculada ainda. Convide-os em Configurações → Equipe.
          </p>
        ) : (
          <ul className="space-y-1">
            {linked.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={async () => {
                    const conv = await getDMFn({
                      data: { other_user_id: m.member_user_id! },
                    });
                    if (conv) onCreated(conv.id);
                  }}
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/50"
                >
                  <span>
                    <span className="font-medium">{m.name}</span>
                    {m.role && <span className="ml-2 text-xs text-muted-foreground">{m.role}</span>}
                  </span>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
