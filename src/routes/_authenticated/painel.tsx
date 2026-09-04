import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  BrainCircuit,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderKanban,
  Loader2,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { getCases } from "@/lib/cases.functions";
import { createTask, toggleTask } from "@/lib/tasks.functions";
import { listOrgMembers } from "@/lib/organization.functions";
import { forceIndexNow } from "@/lib/index-jobs.functions";
import { getCockpit, type CockpitData } from "@/lib/cockpit.functions";
import { normalizeTitle, type PriorityItem } from "@/lib/cockpit/cockpit-core";
import { AddTaskDialog } from "@/components/tasks/add-task-dialog";
import { AddEventDialog } from "@/components/work/add-event-dialog";
import { useAccess } from "@/hooks/use-access";
import { routeRuleFor } from "@/lib/route-permissions";
import { cn } from "@/lib/utils";

const RETURN_STORAGE_KEY = "jm.accessReturn";

export const Route = createFileRoute("/_authenticated/painel")({
  validateSearch: (s) =>
    z
      .object({
        next: z.string().optional(),
        escopo: z.enum(["meu", "escritorio"]).optional(),
        foco: z.enum(["tudo", "prazos", "tarefas", "documentos"]).optional(),
      })
      .parse(s),
  component: HomePage,
});

function dateLabel(iso: string | null, withTime = true) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 86400000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = withTime
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "";
  if (sameDay) return time ? `Hoje, ${time}` : "Hoje";
  if (isTomorrow) return time ? `Amanhã, ${time}` : "Amanhã";
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return time ? `${date}, ${time}` : date;
}

const KIND_LABEL: Record<PriorityItem["kind"], string> = {
  task: "Tarefa",
  event: "Prazo",
  document: "Documento",
};

const KIND_ICON = {
  task: ClipboardList,
  event: CalendarClock,
  document: FileText,
} as const;

const STATE_TEXT: Record<PriorityItem["state"], string> = {
  overdue: "Atrasado",
  today: "Hoje",
  failed: "Falha na leitura",
  upcoming: "Próximo",
  processing: "Em leitura",
  open: "Aberto",
};

function HomePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { next, escopo, foco } = Route.useSearch();
  const { hasOrgPermission, hasPlatformRole, isLoading: accessLoading } = useAccess();

  const pendingReturn =
    next ??
    (typeof window !== "undefined"
      ? (sessionStorage.getItem(RETURN_STORAGE_KEY) ?? undefined)
      : undefined);
  const pendingRule = pendingReturn ? routeRuleFor(pendingReturn) : null;
  const allowsPending = pendingRule
    ? "permission" in pendingRule
      ? hasOrgPermission(pendingRule.permission)
      : hasPlatformRole(pendingRule.platformRole)
    : true;
  const canReturn = !!pendingReturn && (!pendingRule || (!accessLoading && allowsPending));

  useEffect(() => {
    if (!pendingReturn || accessLoading) return;
    if (pendingRule && !allowsPending) return;
    try {
      sessionStorage.removeItem(RETURN_STORAGE_KEY);
    } catch {
      /* noop */
    }
    navigate({ to: pendingReturn, replace: true });
  }, [pendingReturn, pendingRule, allowsPending, accessLoading, navigate]);

  const scope = escopo === "escritorio" ? "org" : "mine";
  const filter = foco ?? "tudo";

  const cockpitFn = useServerFn(getCockpit);
  const getCasesFn = useServerFn(getCases);
  const teamFn = useServerFn(listOrgMembers);
  const toggleTaskFn = useServerFn(toggleTask);
  const createTaskFn = useServerFn(createTask);
  const reprocessFn = useServerFn(forceIndexNow);

  const cockpitQuery = useQuery<CockpitData>({
    queryKey: ["cockpit", scope],
    queryFn: () => cockpitFn({ data: { scope } }),
    refetchInterval: 30_000,
  });
  const data = cockpitQuery.data;

  const { data: cases = [] } = useQuery({ queryKey: ["cases"], queryFn: () => getCasesFn() });
  const { data: team = [] } = useQuery({ queryKey: ["org-members"], queryFn: () => teamFn() });

  const assignees = useMemo(() => team.map((m) => ({ id: m.id, name: m.name })), [team]);
  const caseOptions = useMemo(
    () => cases.map((c) => ({ id: c.id, title: c.title })),
    [cases],
  );

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["cockpit"] });
    void qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const setScope = (value: "mine" | "org") =>
    navigate({
      to: "/painel",
      search: (prev) => ({ ...prev, escopo: value === "org" ? "escritorio" : "meu" }),
      replace: true,
    });

  const setFilter = (value: "tudo" | "prazos" | "tarefas" | "documentos") =>
    navigate({ to: "/painel", search: (prev) => ({ ...prev, foco: value }), replace: true });

  // Visão do escritório só existe quando o servidor confirma a permissão.
  const canViewOrg = data?.canViewOrganization ?? false;
  useEffect(() => {
    if (data && escopo === "escritorio" && !data.canViewOrganization) {
      navigate({ to: "/painel", search: (prev) => ({ ...prev, escopo: "meu" }), replace: true });
    }
  }, [data, escopo, navigate]);

  const priorities = (data?.priorities ?? []).filter((p) => {
    if (filter === "tudo") return true;
    if (filter === "prazos") return p.kind === "event";
    if (filter === "tarefas") return p.kind === "task";
    return p.kind === "document";
  });

  const completeTask = async (item: PriorityItem) => {
    const id = item.id.replace(/^task-/, "");
    try {
      await toggleTaskFn({ data: { id, done: true } });
      refresh();
      toast.success("Tarefa concluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir");
    }
  };

  const reprocess = async (documentId: string) => {
    try {
      await reprocessFn({ data: { document_id: documentId } });
      toast.success("Documento recolocado na fila de leitura");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível reprocessar");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      {pendingReturn && !canReturn ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div>
            <p className="font-medium">Aguardando liberação de acesso</p>
            <p className="text-muted-foreground">
              Assim que o administrador liberar, retornaremos para{" "}
              <code className="rounded bg-muted px-1 py-0.5">{pendingReturn}</code>.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: pendingReturn })}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <PageHeader
        title="Início"
        subtitle="Prioridades, prazos e andamento do seu trabalho."
        actions={
          <Button asChild className="min-h-10">
            <Link to="/assistente">
              <BrainCircuit className="mr-2 h-4 w-4" /> Perguntar à JurisMind
            </Link>
          </Button>
        }
      />

      {/* Ações secundárias + escopo */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="min-h-10" asChild>
          <Link to="/assistencias/nova">
            <Plus className="mr-2 h-4 w-4" /> Novo caso
          </Link>
        </Button>
        <UploadCasePicker cases={caseOptions} />
        <AddTaskDialog
          assignees={assignees}
          cases={caseOptions}
          onCreate={async (p) => {
            try {
              await createTaskFn({
                data: {
                  title: p.title,
                  status: p.status,
                  due_date: p.due_date,
                  assigned_to_user_id: p.assigned_to_user_id,
                  case_id: p.case_id ?? null,
                  priority: "medium",
                },
              });
              refresh();
              toast.success("Tarefa criada");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
            }
          }}
        >
          <Button variant="outline" size="sm" className="min-h-10">
            <ClipboardCheck className="mr-2 h-4 w-4" /> Criar tarefa
          </Button>
        </AddTaskDialog>
        <AddEventDialog cases={caseOptions}>
          <Button variant="outline" size="sm" className="min-h-10">
            <CalendarPlus className="mr-2 h-4 w-4" /> Criar evento
          </Button>
        </AddEventDialog>

        {canViewOrg ? (
          <div
            role="group"
            aria-label="Escopo do painel"
            className="ml-auto flex rounded-md border border-border p-0.5"
          >
            <button
              type="button"
              onClick={() => setScope("mine")}
              aria-pressed={scope === "mine"}
              className={cn(
                "min-h-9 rounded-[5px] px-3 text-sm font-medium",
                scope === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Meu trabalho
            </button>
            <button
              type="button"
              onClick={() => setScope("org")}
              aria-pressed={scope === "org"}
              className={cn(
                "min-h-9 rounded-[5px] px-3 text-sm font-medium",
                scope === "org" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              Escritório
            </button>
          </div>
        ) : null}
      </div>

      {cockpitQuery.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Não foi possível carregar o painel.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => cockpitQuery.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {/* Indicadores */}
      {cockpitQuery.isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicator
            label="Prazos de hoje"
            value={data.indicators.deadlinesToday}
            icon={CalendarClock}
            tone={data.indicators.deadlinesToday > 0 ? "attention" : "neutral"}
            onClick={() => setFilter("prazos")}
          />
          <Indicator
            label="Tarefas atrasadas"
            value={data.indicators.overdueTasks}
            icon={AlertTriangle}
            tone={data.indicators.overdueTasks > 0 ? "danger" : "neutral"}
            onClick={() => setFilter("tarefas")}
          />
          <Indicator
            label="Tarefas abertas"
            value={data.indicators.openTasks}
            icon={ClipboardList}
            tone="neutral"
            to="/tarefas"
            search={{ tab: "tarefas" as const }}
          />
          <Indicator
            label="Documentos com falha"
            value={data.indicators.failedDocuments}
            icon={FileText}
            tone={data.indicators.failedDocuments > 0 ? "danger" : "neutral"}
            onClick={() => setFilter("documentos")}
          />
        </div>
      )}

      {/* Prioridades + Agenda */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-section-title">Prioridades</h2>
            <div role="group" aria-label="Filtrar prioridades" className="flex flex-wrap gap-1">
              {(["tudo", "prazos", "tarefas", "documentos"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={cn(
                    "min-h-9 rounded-md border px-3 text-sm font-medium capitalize",
                    filter === f
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {cockpitQuery.isLoading || !data ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : priorities.length === 0 ? (
            <p className="rounded-lg border border-border bg-card px-4 py-3 text-base text-muted-foreground">
              Nenhuma pendência urgente no momento.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {priorities.map((item) => {
                const Icon = KIND_ICON[item.kind];
                const danger = item.state === "overdue" || item.state === "failed";
                return (
                  <li key={item.id} className="flex flex-wrap items-start gap-3 p-4">
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        danger ? "text-destructive" : "text-muted-foreground",
                      )}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium [overflow-wrap:anywhere]">
                        {item.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        <span>{KIND_LABEL[item.kind]}</span>
                        <span
                          className={cn("font-medium", danger ? "text-destructive" : undefined)}
                        >
                          · {STATE_TEXT[item.state]}
                        </span>
                        {item.at ? <span>· {dateLabel(item.at, item.kind !== "task")}</span> : null}
                        {item.caseId && item.caseTitle ? (
                          <>
                            <span aria-hidden>·</span>
                            <Link
                              to="/assistencias/$caseId"
                              params={{ caseId: item.caseId }}
                              className="underline underline-offset-2"
                            >
                              {normalizeTitle(item.caseTitle)}
                            </Link>
                          </>
                        ) : null}
                        {item.clientName ? <span>· {item.clientName}</span> : null}
                        {scope === "org" && item.ownerName ? (
                          <span>· {item.ownerName}</span>
                        ) : null}
                      </div>
                      {item.reason ? (
                        <p className="mt-1 text-sm text-destructive [overflow-wrap:anywhere]">
                          {item.reason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {item.kind === "task" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-10"
                          onClick={() => void completeTask(item)}
                        >
                          Concluir
                        </Button>
                      ) : null}
                      {item.kind === "document" && item.state === "failed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-10"
                          onClick={() => void reprocess(item.id.replace(/^document-/, ""))}
                        >
                          Reprocessar
                        </Button>
                      ) : null}
                      {item.kind === "event" ? (
                        <Button size="sm" variant="outline" className="min-h-10" asChild>
                          <Link to="/tarefas" search={{ tab: "agenda" }}>
                            Ver compromisso
                          </Link>
                        </Button>
                      ) : null}
                      {item.caseId ? (
                        <Button size="sm" variant="ghost" className="min-h-10" asChild>
                          <Link to="/assistencias/$caseId" params={{ caseId: item.caseId }}>
                            Abrir caso
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-section-title">Próximos 7 dias</h2>
            <Button variant="ghost" size="sm" className="min-h-10" asChild>
              <Link to="/tarefas" search={{ tab: "agenda" }}>
                Ver agenda completa
              </Link>
            </Button>
          </div>
          {cockpitQuery.isLoading || !data ? (
            <Skeleton className="h-40 w-full rounded-lg" />
          ) : data.agenda.length === 0 ? (
            <p className="rounded-lg border border-border bg-card px-4 py-3 text-base text-muted-foreground">
              Nenhum compromisso nos próximos 7 dias.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {data.agenda.slice(0, 12).map((a) => (
                <li key={a.id} className="p-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {dateLabel(a.at, !a.allDayish)}
                  </p>
                  <p className="mt-0.5 text-base font-medium [overflow-wrap:anywhere]">
                    {a.title}
                  </p>
                  {a.caseId && a.caseTitle ? (
                    <Link
                      to="/assistencias/$caseId"
                      params={{ caseId: a.caseId }}
                      className="mt-0.5 block text-sm text-muted-foreground underline underline-offset-2"
                    >
                      {normalizeTitle(a.caseTitle)}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Processamento — só aparece quando há trabalho ou falha */}
      {data && (data.processing.failed.length > 0 ||
        data.processing.running > 0 ||
        data.processing.queued > 0) ? (
        <section className="space-y-3">
          <h2 className="font-heading text-section-title">Processamento</h2>
          {data.processing.failed.length > 0 ? (
            <ul className="divide-y divide-destructive/20 rounded-lg border border-destructive/40 bg-destructive/5">
              {data.processing.failed.map((f) => (
                <li key={f.documentId} className="flex flex-wrap items-center gap-3 p-4">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium [overflow-wrap:anywhere]">{f.filename}</p>
                    <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {f.caseTitle ? normalizeTitle(f.caseTitle) : "Sem caso vinculado"}
                      {f.reason ? ` · ${f.reason}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => void reprocess(f.documentId)}
                  >
                    Reprocessar
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-base text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {data.processing.running} em leitura · {data.processing.queued} na fila
            </p>
          )}
        </section>
      ) : null}

      {/* Casos em andamento */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-section-title">Casos em andamento</h2>
          <Button variant="ghost" size="sm" className="min-h-10" asChild>
            <Link to="/assistencias">Ver todos os casos</Link>
          </Button>
        </div>
        {cockpitQuery.isLoading || !data ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : data.cases.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-base text-muted-foreground">
              Nenhum caso ativo {scope === "mine" ? "atribuído a você" : "no escritório"}.
            </p>
            <Button size="sm" className="min-h-10" asChild>
              <Link to="/assistencias/nova">
                <FolderKanban className="mr-2 h-4 w-4" /> Criar caso
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {data.cases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/assistencias/$caseId"
                    params={{ caseId: c.id }}
                    className="text-base font-medium underline-offset-2 hover:underline [overflow-wrap:anywhere]"
                  >
                    {normalizeTitle(c.title)}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    {c.clientName ? <span>{c.clientName}</span> : null}
                    {scope === "org" && c.ownerName ? <span>· {c.ownerName}</span> : null}
                    {c.nextDeadlineAt ? <span>· Próximo prazo {dateLabel(c.nextDeadlineAt)}</span> : null}
                    {c.openTasks > 0 ? <span>· {c.openTasks} pendência(s)</span> : null}
                    {c.lastActivityAt ? (
                      <span>· Atividade {dateLabel(c.lastActivityAt, false)}</span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.overdueTasks > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        {c.overdueTasks} atrasada(s)
                      </Badge>
                    ) : null}
                    {c.failedDocuments > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        {c.failedDocuments} documento(s) com falha
                      </Badge>
                    ) : null}
                    {c.processingDocuments > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {c.processingDocuments} em leitura
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="min-h-10" asChild>
                    <Link to="/assistencias/$caseId" params={{ caseId: c.id }}>
                      Abrir caso
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" className="min-h-10" asChild>
                    <Link
                      to="/assistencias/$caseId"
                      params={{ caseId: c.id }}
                      search={{ tab: "jurismind" }}
                    >
                      <BrainCircuit className="mr-2 h-4 w-4" /> Analisar
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documentos recentes (não é um feed de auditoria) */}
      {data && data.recentDocuments.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-section-title">Documentos recentes</h2>
            <Button variant="ghost" size="sm" className="min-h-10" asChild>
              <Link to="/documentos">Ver biblioteca</Link>
            </Button>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {data.recentDocuments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                {d.status === "ready" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium [overflow-wrap:anywhere]">{d.filename}</p>
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {d.authorName ? `${d.authorName} · ` : ""}
                    {d.caseTitle ? `${normalizeTitle(d.caseTitle)} · ` : ""}
                    {dateLabel(d.createdAt)}
                  </p>
                </div>
                {d.caseId ? (
                  <Button size="sm" variant="ghost" className="min-h-10" asChild>
                    <Link
                      to="/assistencias/$caseId"
                      params={{ caseId: d.caseId }}
                      search={{ tab: "documentos" }}
                    >
                      Abrir
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Indicator({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
  to,
  search,
}: {
  label: string;
  value: number;
  icon: typeof CalendarClock;
  tone: "neutral" | "attention" | "danger";
  onClick?: () => void;
  to?: "/tarefas";
  search?: { tab: "tarefas" };
}) {
  const content = (
    <>
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </span>
      <span
        className={cn(
          "font-heading text-2xl leading-none",
          tone === "danger" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </span>
    </>
  );
  const classes = cn(
    "flex min-h-[76px] w-full flex-col items-start justify-between gap-2 rounded-lg border p-4 text-left transition-colors",
    tone === "danger"
      ? "border-destructive/40 bg-destructive/5"
      : tone === "attention"
        ? "border-primary/40 bg-primary/5"
        : "border-border bg-card hover:bg-muted/50",
  );

  if (to) {
    return (
      <Link to={to} search={search} className={classes} aria-label={`${label}: ${value}`}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} aria-label={`${label}: ${value}`}>
      {content}
    </button>
  );
}

/**
 * "Enviar documentos" precisa saber para qual caso o arquivo vai.
 * Aqui o usuário escolhe o caso e segue para a aba real de documentos dele.
 */
function UploadCasePicker({ cases }: { cases: Array<{ id: string; title: string }> }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const filtered = cases.filter((c) =>
    c.title.toLocaleLowerCase("pt-BR").includes(term.toLocaleLowerCase("pt-BR")),
  );

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-10" onClick={() => setOpen(true)}>
        <Upload className="mr-2 h-4 w-4" /> Enviar documentos
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar documentos</DialogTitle>
            <DialogDescription>
              Escolha o caso que vai receber os arquivos. Você segue direto para o envio.
            </DialogDescription>
          </DialogHeader>
          {cases.length === 0 ? (
            <div className="space-y-3">
              <p className="text-base text-muted-foreground">
                Você ainda não tem casos. Crie um caso para enviar documentos.
              </p>
              <Button className="min-h-10" asChild onClick={() => setOpen(false)}>
                <Link to="/assistencias/nova">
                  <Plus className="mr-2 h-4 w-4" /> Criar novo caso
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar caso pelo nome"
                aria-label="Buscar caso"
              />
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {filtered.slice(0, 40).map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/assistencias/$caseId"
                      params={{ caseId: c.id }}
                      search={{ tab: "documentos" }}
                      onClick={() => setOpen(false)}
                      className="block min-h-11 px-3 py-3 text-base hover:bg-muted"
                    >
                      {normalizeTitle(c.title)}
                    </Link>
                  </li>
                ))}
                {filtered.length === 0 ? (
                  <li className="px-3 py-3 text-base text-muted-foreground">
                    Nenhum caso encontrado.
                  </li>
                ) : null}
              </ul>
              <Button variant="outline" className="min-h-10 w-full" asChild onClick={() => setOpen(false)}>
                <Link to="/assistencias/nova">
                  <Plus className="mr-2 h-4 w-4" /> Criar novo caso
                </Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
