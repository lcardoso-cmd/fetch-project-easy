import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, X } from "lucide-react";
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
import { CalendarDays, Plus, Trash2, Loader2, ExternalLink, Link2, Mail, RefreshCw, ListFilter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listEvents, createEvent, deleteEvent } from "@/lib/events.functions";
import { getCases } from "@/lib/cases.functions";
import {
  getGoogleAuthUrl,
  getGoogleConnection,
  disconnectGoogle,
  setGoogleActive,
  setGoogleSyncWindow,
  listGoogleCalendarEvents,
  listGoogleCalendars,
  setGoogleSelectedCalendars,
} from "@/lib/google.functions";
import {
  getOutlookAuthUrl,
  getOutlookConnection,
  disconnectOutlook,
  setOutlookActive,
  setOutlookSyncWindow,
  listOutlookCalendarEvents,
  listOutlookCalendars,
  setOutlookSelectedCalendars,
} from "@/lib/outlook.functions";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const calendarSearchSchema = z.object({
  google: z.enum(["success", "error"]).optional(),
  outlook: z.enum(["success", "error"]).optional(),
  msg: z.string().optional(),
  detail: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/agenda")({
  validateSearch: calendarSearchSchema,
  component: CalendarPage,
});

const OAUTH_ERROR_HINTS: Record<string, string> = {
  redirect_uri_mismatch:
    "A URL de retorno registrada no provedor não bate com a que o app enviou. Copie a URL de callback (ex.: https://SEU_DOMÍNIO/api/public/google/callback) e adicione em 'Authorized redirect URIs' no Google Cloud Console (ou em Redirect URIs no Azure/Entra).",
  access_denied: "Você cancelou o consentimento ou o provedor bloqueou o app.",
  invalid_client: "Client ID/Secret inválidos ou não correspondem ao ambiente.",
  invalid_scope: "Um dos escopos solicitados não é permitido pela configuração do app OAuth.",
  unauthorized_client: "Este client não está autorizado a usar o tipo de grant solicitado.",
  admin_policy_enforced: "Uma política de administrador do workspace está bloqueando o acesso.",
  server_misconfigured: "Faltam credenciais OAuth no servidor. Configure GOOGLE_OAUTH_CLIENT_ID/SECRET ou MICROSOFT_*.",
  no_refresh_token: "O provedor não devolveu refresh_token — remova o acesso do app na conta e conecte novamente.",
  token_exchange_failed: "Falha ao trocar o código por tokens; verifique client_secret e redirect_uri.",
  invalid_state: "State de OAuth inválido ou expirado. Tente conectar novamente.",
  state_expired: "State de OAuth expirado. Tente conectar novamente.",
  missing_code_or_state: "Retorno do provedor sem code/state. Tente novamente.",
  save_failed: "Falha ao salvar a conexão no banco.",
};



const TYPE_LABEL: Record<string, string> = {
  deadline: "Prazo",
  hearing: "Audiência",
  meeting: "Reunião",
  task: "Tarefa",
};

function CalendarPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/calendar" });
  const listFn = useServerFn(listEvents);
  const createFn = useServerFn(createEvent);
  const deleteFn = useServerFn(deleteEvent);
  const getCasesFn = useServerFn(getCases);

  const [dismissedOAuth, setDismissedOAuth] = useState(false);
  const oauthBanner = useMemo(() => {
    if (dismissedOAuth) return null;
    const provider = search.google
      ? "google"
      : search.outlook
        ? "outlook"
        : null;
    if (!provider) return null;
    const status = provider === "google" ? search.google : search.outlook;
    const providerLabel = provider === "google" ? "Google" : "Outlook";
    const code = search.msg ?? "";
    const detail = search.detail ?? "";
    const hint = code ? OAUTH_ERROR_HINTS[code] : undefined;
    const callbackHost = typeof window !== "undefined" ? window.location.origin : "";
    const callbackUrl =
      provider === "google"
        ? `${callbackHost}/api/public/google/callback`
        : `${callbackHost}/api/public/outlook/callback`;
    return { provider, providerLabel, status, code, detail, hint, callbackUrl };
  }, [search, dismissedOAuth]);

  useEffect(() => {
    if (!search.google && !search.outlook) return;
    if (search.google === "success" || search.outlook === "success") {
      toast.success(
        `${search.google ? "Google" : "Outlook"} conectado com sucesso`,
      );
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
      // clear params but keep the user on /calendar
      navigate({
        to: "/calendar",
        search: {},
        replace: true,
      });
      return;
    }
    // For errors, keep the params so the inline banner renders; user dismisses.
    setDismissedOAuth(false);
  }, [search.google, search.outlook, qc, navigate]);

  const dismissOAuthBanner = () => {
    setDismissedOAuth(true);
    navigate({ to: "/calendar", search: {}, replace: true });
  };



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
  const listGCals = useServerFn(listGoogleCalendars);
  const setGCals = useServerFn(setGoogleSelectedCalendars);

  const { data: gConn } = useQuery({
    queryKey: ["google-connection"],
    queryFn: () => getGConn(),
  });
  const setGSync = useServerFn(setGoogleSyncWindow);
  const [syncMode, setSyncMode] = useState<"preset" | "custom">("preset");
  const [syncDays, setSyncDays] = useState<number>(90);
  const [customEndDate, setCustomEndDate] = useState<string>(() =>
    new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [prefsHydrated, setPrefsHydrated] = useState(false);

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
  const listOCals = useServerFn(listOutlookCalendars);
  const setOCals = useServerFn(setOutlookSelectedCalendars);

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

  const setOSync = useServerFn(setOutlookSyncWindow);

  // Hydrate window prefs from whichever connection exists (prefer Google)
  useEffect(() => {
    if (prefsHydrated) return;
    const src = gConn ?? oConn;
    if (!src) return;
    if (src.sync_end_date) {
      setSyncMode("custom");
      setCustomEndDate(src.sync_end_date);
    } else {
      setSyncMode("preset");
    }
    if (src.sync_window_days) setSyncDays(src.sync_window_days);
    setPrefsHydrated(true);
  }, [gConn, oConn, prefsHydrated]);

  const persistWindow = async (days: number, endDate: string | null) => {
    const ops: Promise<unknown>[] = [];
    if (gConn) ops.push(setGSync({ data: { sync_window_days: days, sync_end_date: endDate } }));
    if (oConn) ops.push(setOSync({ data: { sync_window_days: days, sync_end_date: endDate } }));
    if (ops.length === 0) return;
    try {
      await Promise.all(ops);
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar janela");
    }
  };

  const syncNowMut = useMutation({
    mutationFn: async () => {
      await qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
      await qc.invalidateQueries({ queryKey: ["outlook-calendar-events"] });
      await qc.invalidateQueries({ queryKey: ["google-connection"] });
      await qc.invalidateQueries({ queryKey: ["outlook-connection"] });
      await qc.refetchQueries({ queryKey: ["google-calendar-events", rangeKey] });
      await qc.refetchQueries({ queryKey: ["outlook-calendar-events", rangeKey] });
      await qc.refetchQueries({ queryKey: ["google-connection"] });
      await qc.refetchQueries({ queryKey: ["outlook-connection"] });
    },
    onSuccess: () => toast.success("Agendas sincronizadas"),
    onError: () => toast.error("Falha ao sincronizar agendas"),
  });

  const syncGoogleMut = useMutation({
    mutationFn: async () => {
      const r = await listGCal({ data: { timeMax: syncTimeMax() } });
      if (r && "error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      qc.setQueryData(["google-calendar-events", rangeKey], r);
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      toast.success("Google Agenda atualizado");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao atualizar Google"),
  });

  const syncOutlookMut = useMutation({
    mutationFn: async () => {
      const r = await listOCal({ data: { timeMax: syncTimeMax() } });
      if (r && "error" in r && r.error) throw new Error(r.error);
      return r;
    },
    onSuccess: (r) => {
      qc.setQueryData(["outlook-calendar-events", rangeKey], r);
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
      toast.success("Outlook Agenda atualizado");
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao atualizar Outlook"),
  });

  const { data: gCalsList } = useQuery({
    queryKey: ["google-calendars"],
    queryFn: () => listGCals(),
    enabled: !!gConn,
  });
  const { data: oCalsList } = useQuery({
    queryKey: ["outlook-calendars"],
    queryFn: () => listOCals(),
    enabled: !!oConn,
  });

  const setGCalsMut = useMutation({
    mutationFn: (ids: string[] | null) => setGCals({ data: { calendar_ids: ids } }),
    onSuccess: () => {
      toast.success("Calendários do Google atualizados");
      qc.invalidateQueries({ queryKey: ["google-connection"] });
      qc.invalidateQueries({ queryKey: ["google-calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });
  const setOCalsMut = useMutation({
    mutationFn: (ids: string[] | null) => setOCals({ data: { calendar_ids: ids } }),
    onSuccess: () => {
      toast.success("Calendários do Outlook atualizados");
      qc.invalidateQueries({ queryKey: ["outlook-connection"] });
      qc.invalidateQueries({ queryKey: ["outlook-calendar-events"] });
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao salvar"),
  });

  const isGCalSelected = (id: string, primary: boolean) => {
    const sel = gConn?.selected_calendar_ids;
    if (!sel || sel.length === 0) return primary;
    return sel.includes(id);
  };
  const isOCalSelected = (id: string, primary: boolean) => {
    const sel = oConn?.selected_calendar_ids;
    if (!sel || sel.length === 0) return primary;
    return sel.includes(id);
  };
  const toggleGCalendar = (id: string, checked: boolean) => {
    const cals = gCalsList?.calendars ?? [];
    const base = gConn?.selected_calendar_ids && gConn.selected_calendar_ids.length > 0
      ? gConn.selected_calendar_ids
      : cals.filter((c) => c.primary).map((c) => c.id);
    const next = checked
      ? Array.from(new Set([...base, id]))
      : base.filter((x) => x !== id);
    setGCalsMut.mutate(next.length > 0 ? next : null);
  };
  const toggleOCalendar = (id: string, checked: boolean) => {
    const cals = oCalsList?.calendars ?? [];
    const base = oConn?.selected_calendar_ids && oConn.selected_calendar_ids.length > 0
      ? oConn.selected_calendar_ids
      : cals.filter((c) => c.primary).map((c) => c.id);
    const next = checked
      ? Array.from(new Set([...base, id]))
      : base.filter((x) => x !== id);
    setOCalsMut.mutate(next.length > 0 ? next : null);
  };


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
                value={syncMode === "custom" ? "custom" : String(syncDays)}
                onValueChange={(v) => {
                  if (v === "custom") {
                    setSyncMode("custom");
                    void persistWindow(syncDays, customEndDate || null);
                    return;
                  }
                  const n = Number(v);
                  setSyncMode("preset");
                  setSyncDays(n);
                  void persistWindow(n, null);
                }}
              >
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Próximos 30 dias</SelectItem>
                  <SelectItem value="90">Próximos 90 dias</SelectItem>
                  <SelectItem value="180">Próximos 180 dias</SelectItem>
                  <SelectItem value="365">Próximo ano</SelectItem>
                  <SelectItem value="custom">Personalizado…</SelectItem>
                </SelectContent>
              </Select>
              {syncMode === "custom" && (
                <Input
                  type="date"
                  className="h-8 w-[160px]"
                  min={new Date(Date.now() + 24 * 3600 * 1000)
                    .toISOString()
                    .slice(0, 10)}
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    if (e.target.value) void persistWindow(syncDays, e.target.value);
                  }}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {oauthBanner && oauthBanner.status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between gap-2">
                <span>
                  Erro ao conectar {oauthBanner.providerLabel}
                  {oauthBanner.code ? ` — ${oauthBanner.code}` : ""}
                </span>
                <button
                  type="button"
                  onClick={dismissOAuthBanner}
                  className="text-xs opacity-70 hover:opacity-100"
                  aria-label="Dispensar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </AlertTitle>
              <AlertDescription className="space-y-2 text-xs">
                {oauthBanner.detail && (
                  <p className="break-words">
                    <span className="font-medium">Detalhe do provedor:</span>{" "}
                    {oauthBanner.detail}
                  </p>
                )}
                {oauthBanner.hint && <p>{oauthBanner.hint}</p>}
                {oauthBanner.code === "redirect_uri_mismatch" && (
                  <p className="break-all">
                    <span className="font-medium">URL de callback esperada:</span>{" "}
                    <code className="rounded bg-black/10 px-1 py-0.5">
                      {oauthBanner.callbackUrl}
                    </code>
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 md:grid-cols-2">


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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ListFilter className="mr-1.5 h-3.5 w-3.5" />
                        Calendários ({(gConn.selected_calendar_ids?.length) || (gCalsList?.calendars ?? []).filter((c) => c.primary).length || "padrão"})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-2">
                      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        Escolha quais calendários sincronizar
                      </p>
                      <div className="max-h-64 overflow-auto">
                        {!gCalsList ? (
                          <p className="p-2 text-xs text-muted-foreground">Carregando…</p>
                        ) : (gCalsList.calendars ?? []).length === 0 ? (
                          <p className="p-2 text-xs text-muted-foreground">Nenhum calendário encontrado.</p>
                        ) : (
                          gCalsList.calendars.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                            >
                              <Checkbox
                                checked={isGCalSelected(c.id, c.primary)}
                                onCheckedChange={(v) => toggleGCalendar(c.id, Boolean(v))}
                              />
                              {c.color && (
                                <span
                                  className="inline-block h-3 w-3 rounded-sm border"
                                  style={{ backgroundColor: c.color }}
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate">{c.summary}</span>
                              {c.primary && (
                                <span className="text-[10px] text-muted-foreground">principal</span>
                              )}
                            </label>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncGoogleMut.mutate()}
                    disabled={syncGoogleMut.isPending}
                  >
                    {syncGoogleMut.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Atualizar agora
                  </Button>
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ListFilter className="mr-1.5 h-3.5 w-3.5" />
                        Calendários ({(oConn.selected_calendar_ids?.length) || (oCalsList?.calendars ?? []).filter((c) => c.primary).length || "padrão"})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-2">
                      <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                        Escolha quais calendários sincronizar
                      </p>
                      <div className="max-h-64 overflow-auto">
                        {!oCalsList ? (
                          <p className="p-2 text-xs text-muted-foreground">Carregando…</p>
                        ) : (oCalsList.calendars ?? []).length === 0 ? (
                          <p className="p-2 text-xs text-muted-foreground">Nenhum calendário encontrado.</p>
                        ) : (
                          oCalsList.calendars.map((c) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                            >
                              <Checkbox
                                checked={isOCalSelected(c.id, c.primary)}
                                onCheckedChange={(v) => toggleOCalendar(c.id, Boolean(v))}
                              />
                              {c.color && (
                                <span
                                  className="inline-block h-3 w-3 rounded-sm border"
                                  style={{ backgroundColor: c.color }}
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate">{c.summary}</span>
                              {c.primary && (
                                <span className="text-[10px] text-muted-foreground">principal</span>
                              )}
                            </label>
                          ))
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncOutlookMut.mutate()}
                    disabled={syncOutlookMut.isPending}
                  >
                    {syncOutlookMut.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Atualizar agora
                  </Button>
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
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
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
