/**
 * Regras puras do cockpit inicial (painel autenticado).
 *
 * Todo o cálculo de indicadores, priorização e ordenação de casos vive aqui,
 * sem dependência de rede ou React, para poder ser testado isoladamente e
 * reutilizado pelo servidor.
 */

export type CockpitScope = "mine" | "org";

export interface CoreTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  case_id: string | null;
  assigned_to_user_id: string | null;
  created_by_user_id: string;
  updated_at: string | null;
}

export interface CoreEvent {
  id: string;
  title: string;
  starts_at: string;
  event_type: string;
  case_id: string | null;
  created_by_user_id: string;
}

export interface CoreDocument {
  id: string;
  filename: string;
  processing_status: string;
  case_id: string | null;
  created_at: string | null;
  created_by_user_id: string;
  error_message?: string | null;
}

export interface CoreCase {
  id: string;
  title: string;
  client_name: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
}

export interface Indicators {
  deadlinesToday: number;
  overdueTasks: number;
  openTasks: number;
  failedDocuments: number;
}

export type PriorityKind = "task" | "event" | "document";

export interface PriorityItem {
  id: string;
  kind: PriorityKind;
  title: string;
  caseId: string | null;
  caseTitle: string | null;
  clientName: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  /** ISO da data/hora relevante (vencimento, início do evento, envio). */
  at: string | null;
  state: "overdue" | "today" | "failed" | "upcoming" | "processing" | "open";
  priority: string | null;
  reason: string | null;
  score: number;
  updatedAt: string | null;
}

export interface RankedCase {
  id: string;
  title: string;
  clientName: string | null;
  ownerName: string | null;
  nextDeadlineAt: string | null;
  openTasks: number;
  overdueTasks: number;
  processingDocuments: number;
  failedDocuments: number;
  lastActivityAt: string | null;
  score: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isSameDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return d >= startOfDay(ref) && d <= endOfDay(ref);
}

export function isOpenTask(t: CoreTask): boolean {
  return t.status !== "done";
}

export function isOverdueTask(t: CoreTask, now: Date): boolean {
  if (!isOpenTask(t) || !t.due_date) return false;
  return new Date(t.due_date).getTime() < startOfDay(now).getTime();
}

export function isDueTodayTask(t: CoreTask, now: Date): boolean {
  return isOpenTask(t) && !!t.due_date && isSameDay(t.due_date, now);
}

export function isFailedDocument(d: CoreDocument): boolean {
  return d.processing_status === "error" || d.processing_status === "split_failed";
}

export function isProcessingDocument(d: CoreDocument): boolean {
  return (
    d.processing_status !== "ready" &&
    d.processing_status !== "error" &&
    d.processing_status !== "split_failed"
  );
}

/** Filtra por relação com o usuário quando o escopo é "meu trabalho". */
export function scopeTasks(tasks: CoreTask[], scope: CockpitScope, userId: string): CoreTask[] {
  if (scope === "org") return tasks;
  return tasks.filter(
    (t) =>
      t.assigned_to_user_id === userId ||
      (!t.assigned_to_user_id && t.created_by_user_id === userId),
  );
}

export function scopeEvents(
  events: CoreEvent[],
  scope: CockpitScope,
  userId: string,
  myCaseIds: ReadonlySet<string>,
): CoreEvent[] {
  if (scope === "org") return events;
  return events.filter(
    (e) => e.created_by_user_id === userId || (e.case_id ? myCaseIds.has(e.case_id) : false),
  );
}

export function scopeDocuments(
  docs: CoreDocument[],
  scope: CockpitScope,
  userId: string,
  myCaseIds: ReadonlySet<string>,
): CoreDocument[] {
  if (scope === "org") return docs;
  return docs.filter(
    (d) => d.created_by_user_id === userId || (d.case_id ? myCaseIds.has(d.case_id) : false),
  );
}

export function computeIndicators(input: {
  tasks: CoreTask[];
  events: CoreEvent[];
  documents: CoreDocument[];
  now: Date;
}): Indicators {
  const { tasks, events, documents, now } = input;
  const open = tasks.filter(isOpenTask);
  return {
    deadlinesToday:
      events.filter((e) => isSameDay(e.starts_at, now)).length +
      open.filter((t) => isDueTodayTask(t, now)).length,
    overdueTasks: open.filter((t) => isOverdueTask(t, now)).length,
    openTasks: open.length,
    failedDocuments: documents.filter(isFailedDocument).length,
  };
}

const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/**
 * Criticidade (maior = mais urgente):
 * 100 tarefa atrasada · 90 documento com falha · 80 prazo/tarefa de hoje
 * 50 vencimento nos próximos 7 dias · 20 processamento em curso · 10 aberto
 */
function stateScore(state: PriorityItem["state"]): number {
  switch (state) {
    case "overdue":
      return 100;
    case "failed":
      return 90;
    case "today":
      return 80;
    case "upcoming":
      return 50;
    case "processing":
      return 20;
    default:
      return 10;
  }
}

export function buildPriorities(input: {
  tasks: CoreTask[];
  events: CoreEvent[];
  documents: CoreDocument[];
  cases: CoreCase[];
  memberNames: Record<string, string>;
  now: Date;
  limit?: number;
}): PriorityItem[] {
  const { tasks, events, documents, cases, memberNames, now } = input;
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const soon = new Date(now.getTime() + 7 * DAY_MS);

  const meta = (caseId: string | null) => {
    const c = caseId ? caseById.get(caseId) : undefined;
    return { caseTitle: c?.title ?? null, clientName: c?.client_name ?? null };
  };

  const items: PriorityItem[] = [];

  for (const t of tasks.filter(isOpenTask)) {
    let state: PriorityItem["state"] = "open";
    if (isOverdueTask(t, now)) state = "overdue";
    else if (isDueTodayTask(t, now)) state = "today";
    else if (t.due_date && new Date(t.due_date) <= soon) state = "upcoming";
    else if (t.priority === "urgent" || t.priority === "high") state = "open";
    else continue;

    items.push({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title,
      caseId: t.case_id,
      ...meta(t.case_id),
      ownerUserId: t.assigned_to_user_id,
      ownerName: t.assigned_to_user_id ? (memberNames[t.assigned_to_user_id] ?? null) : null,
      at: t.due_date,
      state,
      priority: t.priority,
      reason: null,
      score: stateScore(state) + PRIORITY_WEIGHT[t.priority] * 0.5,
      updatedAt: t.updated_at,
    });
  }

  for (const e of events) {
    const at = new Date(e.starts_at);
    let state: PriorityItem["state"];
    if (at < startOfDay(now)) state = "overdue";
    else if (isSameDay(e.starts_at, now)) state = "today";
    else if (at <= soon) state = "upcoming";
    else continue;

    items.push({
      id: `event-${e.id}`,
      kind: "event",
      title: e.title,
      caseId: e.case_id,
      ...meta(e.case_id),
      ownerUserId: e.created_by_user_id,
      ownerName: memberNames[e.created_by_user_id] ?? null,
      at: e.starts_at,
      state,
      priority: null,
      reason: null,
      score: stateScore(state) + 0.4,
      updatedAt: e.starts_at,
    });
  }

  for (const d of documents) {
    if (!isFailedDocument(d) && !isProcessingDocument(d)) continue;
    const failed = isFailedDocument(d);
    const state: PriorityItem["state"] = failed ? "failed" : "processing";
    items.push({
      id: `document-${d.id}`,
      kind: "document",
      title: d.filename,
      caseId: d.case_id,
      ...meta(d.case_id),
      ownerUserId: d.created_by_user_id,
      ownerName: memberNames[d.created_by_user_id] ?? null,
      at: d.created_at,
      state,
      priority: null,
      reason: d.error_message ?? null,
      score: stateScore(state),
      updatedAt: d.created_at,
    });
  }

  items.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const at = a.at ? new Date(a.at).getTime() : Number.POSITIVE_INFINITY;
    const bt = b.at ? new Date(b.at).getTime() : Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    const au = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bu = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bu - au;
  });

  return typeof input.limit === "number" ? items.slice(0, input.limit) : items;
}

/** Ordena casos por sinal operacional real, não pela ordem da consulta. */
export function rankCases(input: {
  cases: CoreCase[];
  tasks: CoreTask[];
  events: CoreEvent[];
  documents: CoreDocument[];
  memberNames: Record<string, string>;
  now: Date;
  limit?: number;
}): RankedCase[] {
  const { cases, tasks, events, documents, memberNames, now } = input;
  const soon = new Date(now.getTime() + 7 * DAY_MS);

  const ranked = cases
    .filter((c) => c.status === "active")
    .map<RankedCase>((c) => {
      const caseTasks = tasks.filter((t) => t.case_id === c.id && isOpenTask(t));
      const overdue = caseTasks.filter((t) => isOverdueTask(t, now)).length;
      const caseEvents = events
        .filter((e) => e.case_id === c.id && new Date(e.starts_at) >= startOfDay(now))
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      const nextDeadlineAt = caseEvents[0]?.starts_at ?? null;
      const caseDocs = documents.filter((d) => d.case_id === c.id);
      const processing = caseDocs.filter(isProcessingDocument).length;
      const failed = caseDocs.filter(isFailedDocument).length;
      const lastDoc = caseDocs
        .map((d) => d.created_at)
        .filter((x): x is string => !!x)
        .sort()
        .at(-1) ?? null;
      const lastActivityAt =
        [c.updated_at, lastDoc].filter((x): x is string => !!x).sort().at(-1) ?? null;

      let score = 0;
      if (overdue > 0) score += 100 + Math.min(overdue, 5);
      if (failed > 0) score += 80;
      if (nextDeadlineAt && new Date(nextDeadlineAt) <= soon) score += 60;
      if (processing > 0) score += 30;
      if (caseTasks.length > 0) score += 10;
      if (lastActivityAt && now.getTime() - new Date(lastActivityAt).getTime() < 3 * DAY_MS) {
        score += 5;
      }

      return {
        id: c.id,
        title: c.title,
        clientName: c.client_name,
        ownerName: memberNames[c.created_by_user_id] ?? null,
        nextDeadlineAt,
        openTasks: caseTasks.length,
        overdueTasks: overdue,
        processingDocuments: processing,
        failedDocuments: failed,
        lastActivityAt,
        score,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const at = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bt = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return bt - at;
    });

  return typeof input.limit === "number" ? ranked.slice(0, input.limit) : ranked;
}

/** Agenda dos próximos 7 dias (hoje incluído), cronológica. */
export function upcomingAgenda(input: {
  events: CoreEvent[];
  tasks: CoreTask[];
  cases: CoreCase[];
  now: Date;
}): Array<{
  id: string;
  kind: PriorityKind;
  title: string;
  at: string;
  caseId: string | null;
  caseTitle: string | null;
  allDayish: boolean;
}> {
  const { events, tasks, cases, now } = input;
  const from = startOfDay(now).getTime();
  const to = endOfDay(new Date(now.getTime() + 6 * DAY_MS)).getTime();
  const caseById = new Map(cases.map((c) => [c.id, c]));

  const fromEvents = events
    .filter((e) => {
      const t = new Date(e.starts_at).getTime();
      return t >= from && t <= to;
    })
    .map((e) => ({
      id: `event-${e.id}`,
      kind: "event" as const,
      title: e.title,
      at: e.starts_at,
      caseId: e.case_id,
      caseTitle: e.case_id ? (caseById.get(e.case_id)?.title ?? null) : null,
      allDayish: false,
    }));

  const fromTasks = tasks
    .filter((t) => {
      if (!isOpenTask(t) || !t.due_date) return false;
      const d = new Date(t.due_date).getTime();
      return d >= from && d <= to;
    })
    .map((t) => ({
      id: `task-${t.id}`,
      kind: "task" as const,
      title: t.title,
      at: t.due_date as string,
      caseId: t.case_id,
      caseTitle: t.case_id ? (caseById.get(t.case_id)?.title ?? null) : null,
      allDayish: true,
    }));

  return [...fromEvents, ...fromTasks].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

/** Normaliza títulos gritados (TUDO EM CAIXA ALTA) apenas na apresentação. */
export function normalizeTitle(title: string): string {
  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 4) return title;
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "").length;
  if (upper / letters.length < 0.85) return title;
  return title
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|[\s(["'\-/])(\p{L})/gu, (_m, p1: string, p2: string) => p1 + p2.toLocaleUpperCase("pt-BR"));
}
