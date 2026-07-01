import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Plus, Trash2, Loader2, ExternalLink, Link2, Mail, RefreshCw } from "lucide-react";
import { listEvents, createEvent, deleteEvent } from "@/lib/events.functions";
import { getCases } from "@/lib/cases.functions";
import {
  getGoogleAuthUrl,
  getGoogleConnection,
  disconnectGoogle,
  setGoogleActive,
  listGoogleCalendarEvents,
} from "@/lib/google.functions";
import {
  getOutlookAuthUrl,
  getOutlookConnection,
  disconnectOutlook,
  setOutlookActive,
  listOutlookCalendarEvents,
} from "@/lib/outlook.functions";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

const TYPE_LABEL: Record<string, string> = {
  deadline: "Prazo",
  hearing: "Audiência",
  meeting: "Reunião",
  task: "Tarefa",
};

function CalendarPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEvents);
  const createFn = useServerFn(createEvent);
  const deleteFn = useServerFn(deleteEvent);
  const getCasesFn = useServerFn(getCases);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => listFn({ data: {} }),
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["cases"],
    queryFn: () => getCasesFn(),
  });

  // External calendars — Google
  const getGConn = useServerFn(getGoogleConnection);
  const getGUrl = useServerFn(getGoogleAuthUrl);
  const disconnectG = useServerFn(disconnectGoogle);
  const setGActive = useServerFn(setGoogleActive);
  const listGCal = useServerFn(listGoogleCalendarEvents);

  const { data: gConn } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => getGConn(),
  });
  const [syncMode, setSyncMode] = useState<"preset" | "custom">(() => {
    if (typeof window === "undefined") return "preset";
    return window.localStorage.getItem("calendar-sync-mode") === "custom"
      ? "custom"
      : "preset";
  });
  const [syncDays, setSyncDays] = useState<number>(() => {
    if (typeof window === "undefined") return 90;
    const v = Number(window.localStorage.getItem("calendar-sync-days"));
    return v === 30 || v === 90 || v === 180 || v === 365 ? v : 90;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const saved = window.localStorage.getItem("calendar-sync-custom-end");
    if (saved) return saved;
    // default: 90 days ahead
    return new Date(Date.now() + 90 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
  });

  const effectiveEndMs = () => {
    if (syncMode === "custom" && customEndDate) {
      // end of the selected day
      const d = new Date(customEndDate + "T23:59:59");
      const ms = d.getTime();
      return Number.isFinite(ms) && ms > Date.now()
        ? ms
        : Date.now() + syncDays * 24 * 3600 * 1000;
    }
    return Date.now() + syncDays * 24 * 3600 * 1000;
  };
  const syncTimeMax = () => new Date(effectiveEndMs()).toISOString();
  const syncRangeLabel = () => {
    const end = new Date(effectiveEndMs());
    const endStr = end.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    if (syncMode === "custom") return `De hoje até ${endStr}`;
    return `Próximos ${syncDays} dias até ${endStr}`;
  };
  const formatLastSync = (iso: string | null | undefined) => {
    if (!iso) return "Nunca sincronizada";
    const d = new Date(iso);
    const date = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Última sincronização: ${date}, ${time}`;
  };

  const rangeKey =
    syncMode === "custom" ? `custom:${customEndDate}` : `days:${syncDays}`;

  const { data: gCal } = useQuery({
    queryKey: ["google-calendar-events", rangeKey],
    queryFn: () => listGCal({ data: { timeMax: syncTimeMax() } }),
    enabled: !!gConn && gConn.is_active !== false,
  });


  const connectGoogleMut = useMutation({
    mutationFn: async () => getGUrl({ data: { origin: window.location.origin } }),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao conectar"),
  });
  const disconnectGoogleMut = useMutation({
    mutationFn: () => disconnectG(),
    onSuccess: () => {
      toast.success("Google Agenda removido");
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });
  const toggleGoogleMut = useMutation({
    mutationFn: (active: boolean) => setGActive({ data: { active } }),
    onSuccess: (_r, active) => {
      toast.success(active ? "Google Agenda ativado" : "Google Agenda desativado");
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
  });

  // External calendars — Outlook (Microsoft)
  const getOConn = useServerFn(getOutlookConnection);
  const getOUrl = useServerFn(getOutlookAuthUrl);
  const disconnectO = useServerFn(disconnectOutlook);
  const setOActive = useServerFn(setOutlookActive);
  const listOCal = useServerFn(listOutlookCalendarEvents);

  const { data: oConn } = useQuery({
    queryKey: ["outlook-connection"],
    queryFn: () => getOConn(),
  });
  const { data: oCal } = useQuery({
    queryKey: ["outlook-calendar-events", rangeKey],
    queryFn: () => listOCal({ data: { timeMax: syncTimeMax() } }),
    enabled: !!oConn && oConn.is_active !== false,
  });

  const connectOutlookMut = useMutation({
    mutationFn: async () => getOUrl({ data: { origin: window.location.origin } }),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao conectar"),
  });
  const disconnectOutlookMut = useMutation({
    mutationFn: () => disconnectO(),
    onSuccess: () => {
      toast.success("Outlook Agenda removido");
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
      qc.invalidateQueries({ queryKey: ["outlook-calendar-events"] });
    },
  });
  const toggleOutlookMut = useMutation({
    mutationFn: (active: boolean) => setOActive({ data: { active } }),
    onSuccess: (_r, active) => {
      toast.success(active ? "Outlook Agenda ativado" : "Outlook Agenda desativado");
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
      qc.invalidateQueries({ queryKey: ["outlook-calendar-events"] });
    },
  });

  const syncNowMut = useMutation({
    mutationFn: async () => {
      await qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
      await qc.invalidateQueries({ queryKey: ["outlook-calendar-events"] });
      await qc.invalidateQueries({ queryKey: ["google-connection"] });
      await qc.invalidateQueries({ queryKey: ["outlook-connection"] });
      // Refetch active calendar queries immediately
      await qc.refetchQueries({ queryKey: ["google-calendar-events", rangeKey] });
      await qc.refetchQueries({ queryKey: ["outlook-calendar-events", rangeKey] });
      await qc.refetchQueries({ queryKey: ["google-connection"] });
      await qc.refetchQueries({ queryKey: ["outlook-connection"] });
    },
    onSuccess: () => toast.success("Agendas sincronizadas"),
    onError: () => toast.error("Falha ao sincronizar agendas"),
  });

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    starts_at: "",
    event_type: "deadline" as "deadline" | "hearing" | "meeting" | "task",
    case_id: "",
  });

  const submit = async () => {
    if (!form.title || !form.starts_at) {
      toast.error("Preencha título e data");
      return;
    }
    setBusy(true);
    try {
      await createFn({
        data: {
          title: form.title,
          description: form.description || null,
          starts_at: new Date(form.starts_at).toISOString(),
          event_type: form.event_type,
          case_id: form.case_id || null,
          all_day: false,
        },
      });
      await qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento criado");
      setOpen(false);
      setForm({ title: "", description: "", starts_at: "", event_type: "deadline", case_id: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir evento?")) return;
    await deleteFn({ data: { id } });
    await qc.invalidateQueries({ queryKey: ["events"] });
  };

  const caseTitle = (id: string | null) =>
    id ? cases.find((c) => c.id === id)?.title : null;

  type UnifiedEvent = {
    id: string;
    title: string;
    description: string | null;
    starts_at: string;
    event_type?: string;
    case_id?: string | null;
    source: "local" | "google" | "outlook";
    html_link?: string | null;
  };

  const unified: UnifiedEvent[] = [
    ...events.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description ?? null,
      starts_at: e.starts_at,
      event_type: e.event_type,
      case_id: e.case_id,
      source: "local" as const,
    })),
    ...((gCal?.events ?? []).map((e) => ({
      id: `gcal-${e.id}`,
      title: e.title,
      description: e.description,
      starts_at: e.starts_at,
      source: "google" as const,
      html_link: e.html_link,
    })) as UnifiedEvent[]),
    ...((oCal?.events ?? []).map((e) => ({
      id: `ocal-${e.id}`,
      title: e.title,
      description: e.description,
      starts_at: e.starts_at,
      source: "outlook" as const,
      html_link: e.html_link,
    })) as UnifiedEvent[]),
  ].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  // group by day
  const groups = new Map<string, UnifiedEvent[]>();
  for (const ev of unified) {
    const d = new Date(ev.starts_at).toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(ev);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenda</h1>
          <p className="mt-1 text-muted-foreground">Prazos, audiências e compromissos.</p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" /> Novo evento
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5" /> Agendas conectadas
              </CardTitle>
              <CardDescription>
                {syncRangeLabel()}. Sincronize com serviços externos para ver seus compromissos aqui.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => syncNowMut.mutate()}
                disabled={syncNowMut.isPending}
              >
                {syncNowMut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Sincronizar agora
              </Button>
              <Label className="text-xs text-muted-foreground">Janela</Label>
              <Select
                value={String(syncDays)}
                onValueChange={(v) => {
                  const n = Number(v);
                  setSyncDays(n);
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("calendar-sync-days", String(n));
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Próximos 30 dias</SelectItem>
                  <SelectItem value="90">Próximos 90 dias</SelectItem>
                  <SelectItem value="180">Próximos 180 dias</SelectItem>
                  <SelectItem value="365">Próximo ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">

          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">Google Agenda</p>
              {gConn ? (
                <>
                  <p className="truncate text-xs text-muted-foreground">{gConn.google_email}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatLastSync(gConn.last_synced_at)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={gConn.is_active === false ? "secondary" : "default"} className="text-[10px]">
                      {gConn.is_active === false ? "Desativada" : "Ativa"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {gCal?.events?.length ?? 0} evento(s)
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Não conectada</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {gConn ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativa</span>
                    <Switch
                      checked={gConn.is_active !== false}
                      disabled={toggleGoogleMut.isPending}
                      onCheckedChange={(v) => toggleGoogleMut.mutate(v)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Remover conexão com Google Agenda?")) disconnectGoogleMut.mutate();
                    }}
                    disabled={disconnectGoogleMut.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectGoogleMut.mutate()}
                  disabled={connectGoogleMut.isPending}
                >
                  {connectGoogleMut.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Conectar
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-medium">
                <Mail className="h-4 w-4" /> Outlook Agenda
              </p>
              {oConn ? (
                <>
                  <p className="truncate text-xs text-muted-foreground">{oConn.outlook_email}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatLastSync(oConn.last_synced_at)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={oConn.is_active === false ? "secondary" : "default"} className="text-[10px]">
                      {oConn.is_active === false ? "Desativada" : "Ativa"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {oCal?.events?.length ?? 0} evento(s)
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Não conectada</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {oConn ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativa</span>
                    <Switch
                      checked={oConn.is_active !== false}
                      disabled={toggleOutlookMut.isPending}
                      onCheckedChange={(v) => toggleOutlookMut.mutate(v)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm("Remover conexão com Outlook Agenda?")) disconnectOutlookMut.mutate();
                    }}
                    disabled={disconnectOutlookMut.isPending}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remover
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connectOutlookMut.mutate()}
                  disabled={connectOutlookMut.isPending}
                >
                  {connectOutlookMut.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Conectar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>



      {open && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novo evento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Audiência de instrução"
              />
            </div>
            <div className="space-y-1">
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select
                value={form.event_type}
                onValueChange={(v) =>
                  setForm({ ...form, event_type: v as typeof form.event_type })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline">Prazo</SelectItem>
                  <SelectItem value="hearing">Audiência</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="task">Tarefa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Caso (opcional)</Label>
              <Select
                value={form.case_id || "none"}
                onValueChange={(v) => setForm({ ...form, case_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : unified.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Nenhum evento agendado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([day, items]) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="text-base capitalize">{day}</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {items.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {ev.source === "google" ? (
                          <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400">
                            Google
                          </Badge>
                        ) : ev.source === "outlook" ? (
                          <Badge variant="outline" className="border-sky-500/40 text-sky-600 dark:text-sky-400">
                            Outlook
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {ev.event_type ? (TYPE_LABEL[ev.event_type] ?? ev.event_type) : "Evento"}
                          </Badge>
                        )}
                        <p className="font-medium text-foreground">{ev.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(ev.starts_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {ev.case_id && caseTitle(ev.case_id) && (
                          <>
                            {" · "}
                            <Link to="/cases/$caseId" params={{ caseId: ev.case_id }} className="underline">
                              {caseTitle(ev.case_id)}
                            </Link>
                          </>
                        )}
                      </p>
                      {ev.description && (
                        <p className="text-sm text-muted-foreground mt-1">{ev.description}</p>
                      )}
                    </div>
                    {ev.source === "google" || ev.source === "outlook" ? (
                      ev.html_link && (
                        <a
                          href={ev.html_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(ev.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
