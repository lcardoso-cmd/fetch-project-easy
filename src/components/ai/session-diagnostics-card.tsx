import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bolt,
  Loader2,
  RefreshCw,
  Scissors,
  ShieldAlert,
  Sparkles,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listRecentSessions,
  getSessionEvents,
  type SessionSummary,
  type SessionEventRow,
} from "@/lib/ai-session-log.functions";

/**
 * Painel de diagnóstico de sessões de IA. Mostra últimas sessões com marcadores
 * de cache/truncamento/fallback e permite abrir o log detalhado de cada uma.
 */
export function SessionDiagnosticsCard() {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const sessions = useQuery({
    queryKey: ["ai-recent-sessions"],
    queryFn: () => listRecentSessions({ data: { limit: 15 } }),
    refetchOnWindowFocus: false,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Diagnóstico por sessão
            </CardTitle>
            <CardDescription>
              Cache hit/miss, truncamento de contexto e fallback de modelo para entender por que
              a resposta demorou ou mudou.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => sessions.refetch()}
            disabled={sessions.isFetching}
          >
            {sessions.isFetching ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!sessions.data || sessions.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma sessão registrada ainda. Faça uma pergunta ao Jurismind para gerar eventos.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {sessions.data.map((s) => (
              <SessionRow key={s.session_id} session={s} onOpen={setOpenSessionId} />
            ))}
          </ul>
        )}
      </CardContent>

      <SessionDetailDialog
        sessionId={openSessionId}
        onClose={() => setOpenSessionId(null)}
      />
    </Card>
  );
}

function SessionRow({
  session,
  onOpen,
}: {
  session: SessionSummary;
  onOpen: (id: string) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted-foreground">
            {session.session_id.slice(0, 8)}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="truncate">{session.feature ?? "chat"}</span>
          {session.last_model && (
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {session.last_model}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {session.cache_hit && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> cache hit
            </Badge>
          )}
          {session.had_truncation && (
            <Badge variant="secondary" className="gap-1">
              <Scissors className="h-3 w-3" /> truncado
            </Badge>
          )}
          {session.had_fallback && (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="h-3 w-3" /> fallback
            </Badge>
          )}
          {session.latency_ms != null && (
            <Badge variant="outline" className="gap-1">
              <Timer className="h-3 w-3" /> {formatLatency(session.latency_ms)}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDate(session.started_at)}
          </span>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onOpen(session.session_id)}>
        Ver log
      </Button>
    </li>
  );
}

function SessionDetailDialog({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const events = useQuery({
    queryKey: ["ai-session-events", sessionId],
    queryFn: () => getSessionEvents({ data: { session_id: sessionId! } }),
    enabled: Boolean(sessionId),
  });

  return (
    <Dialog open={Boolean(sessionId)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bolt className="h-4 w-4" /> Log da sessão
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{sessionId}</DialogDescription>
        </DialogHeader>
        {events.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos…
          </div>
        ) : !events.data || events.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem eventos para esta sessão.</p>
        ) : (
          <ol className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {events.data.map((ev) => (
              <EventRow key={ev.id} event={ev} />
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventRow({ event }: { event: SessionEventRow }) {
  const meta = eventMeta(event.event_type);
  return (
    <li className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex h-5 items-center rounded px-1.5 text-2xs font-medium uppercase ${meta.color}`}>
            {event.event_type}
          </span>
          {event.model && <span className="font-mono text-xs">{event.model}</span>}
          {event.fallback_model && (
            <span className="font-mono text-xs">→ {event.fallback_model}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
      </div>
      {(event.reason ||
        event.latency_ms != null ||
        event.messages_truncated != null ||
        event.chars_before != null) && (
        <div className="mt-1 text-xs text-muted-foreground">
          {event.reason && <div>{event.reason}</div>}
          {event.latency_ms != null && <div>latência: {formatLatency(event.latency_ms)}</div>}
          {event.messages_truncated != null && event.messages_truncated > 0 && (
            <div>
              {event.messages_truncated} mensagem(ns) removida(s) · {event.chars_before} →{" "}
              {event.chars_after} caracteres
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function eventMeta(type: string): { color: string } {
  switch (type) {
    case "cache_hit":
      return { color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
    case "cache_miss":
      return { color: "bg-muted text-muted-foreground" };
    case "context_truncated":
      return { color: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
    case "fallback":
      return { color: "bg-red-500/15 text-red-700 dark:text-red-300" };
    case "chat_finish":
      return { color: "bg-sky-500/15 text-sky-700 dark:text-sky-300" };
    default:
      return { color: "bg-muted text-muted-foreground" };
  }
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
