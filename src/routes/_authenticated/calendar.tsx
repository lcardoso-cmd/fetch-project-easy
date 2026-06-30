import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenda</h1>
        <p className="mt-1 text-muted-foreground">Prazos, audiências e compromissos.</p>
      </div>
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        <p className="text-muted-foreground">Nenhum evento agendado.</p>
      </div>
    </div>
  );
}
