import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CalendarDays, ExternalLink, Trash2 } from "lucide-react";
import { EVENT_TYPE_LABEL } from "@/components/work/add-event-dialog";

export type UnifiedEvent = {
  id: string;
  /** id real no banco (apenas para eventos locais) */
  localId?: string;
  title: string;
  description: string | null;
  starts_at: string;
  event_type?: string;
  case_id?: string | null;
  source: "local" | "google" | "outlook";
  html_link?: string | null;
};

const SOURCE_LABEL: Record<UnifiedEvent["source"], string> = {
  local: "JurisMind",
  google: "Google Agenda",
  outlook: "Outlook",
};

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Lista de compromissos agrupada por dia. Somente leitura para agendas externas. */
export function AgendaPanel({
  events,
  caseTitle,
  onDelete,
  emptyTitle = "Nenhum compromisso no período",
  emptyDescription,
}: {
  events: UnifiedEvent[];
  caseTitle: (id: string | null | undefined) => string | null;
  onDelete?: (id: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (events.length === 0) {
    return (
      <EmptyState icon={CalendarDays} title={emptyTitle} description={emptyDescription} />
    );
  }

  const groups = new Map<string, UnifiedEvent[]>();
  for (const ev of [...events].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const key = dayLabel(ev.starts_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-2 text-sm font-medium capitalize text-muted-foreground">{day}</h3>
          <ul className="divide-y divide-border border-y border-border ">
            {list.map((ev) => {
              const title = caseTitle(ev.case_id);
              return (
                <li key={ev.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {new Date(ev.starts_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words">{ev.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {ev.event_type && (
                        <Badge variant="secondary" className="text-xs">
                          {EVENT_TYPE_LABEL[ev.event_type] ?? ev.event_type}
                        </Badge>
                      )}
                      <span className="text-xs">{SOURCE_LABEL[ev.source]}</span>
                      {ev.case_id && title && (
                        <>
                          <span aria-hidden>·</span>
                          <Link
                            to="/assistencias/$caseId"
                            params={{ caseId: ev.case_id }}
                            className="underline"
                          >
                            {title}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  {ev.html_link && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={ev.html_link} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" /> Abrir
                      </a>
                    </Button>
                  )}
                  {ev.source === "local" && onDelete && ev.localId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Excluir ${ev.title}`}
                      onClick={() => onDelete(ev.localId!)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
