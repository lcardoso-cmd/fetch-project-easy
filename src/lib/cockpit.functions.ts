import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";
import {
  buildPriorities,
  computeIndicators,
  rankCases,
  scopeDocuments,
  scopeEvents,
  scopeTasks,
  startOfDay,
  upcomingAgenda,
  type CockpitScope,
  type CoreCase,
  type CoreDocument,
  type CoreEvent,
  type CoreTask,
  type Indicators,
  type PriorityItem,
  type RankedCase,
} from "@/lib/cockpit/cockpit-core";

export interface CockpitData {
  /** Escopo efetivamente aplicado (o servidor rebaixa "org" para "mine" sem permissão). */
  scope: CockpitScope;
  canViewOrganization: boolean;
  userId: string;
  indicators: Indicators;
  priorities: PriorityItem[];
  agenda: ReturnType<typeof upcomingAgenda>;
  cases: RankedCase[];
  processing: {
    running: number;
    queued: number;
    failed: Array<{
      documentId: string;
      filename: string;
      caseId: string | null;
      caseTitle: string | null;
      reason: string | null;
    }>;
  };
  recentDocuments: Array<{
    id: string;
    filename: string;
    caseId: string | null;
    caseTitle: string | null;
    createdAt: string | null;
    authorName: string | null;
    status: string;
  }>;
  generatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Consulta única do cockpit inicial.
 *
 * Tudo é resolvido no servidor: organização ativa (nunca enviada pelo cliente),
 * permissão para a visão do escritório e o cálculo de indicadores/prioridades.
 */
export const getCockpit = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z.object({ scope: z.enum(["mine", "org"]).default("mine") }).parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<CockpitData> => {
    const supabase = context.supabase;
    const orgId = context.organizationId;
    const userId = context.userId;
    const now = new Date();

    // Visão do escritório exige permissão real na organização.
    const { data: canViewAll } = await supabase.rpc("has_org_permission", {
      _organization_id: orgId,
      _user_id: userId,
      _permission: "cases.view_all",
    });
    const canViewOrganization = canViewAll === true;
    const scope: CockpitScope = data.scope === "org" && canViewOrganization ? "org" : "mine";

    const horizonFrom = new Date(startOfDay(now).getTime() - 60 * DAY_MS).toISOString();
    const horizonTo = new Date(now.getTime() + 60 * DAY_MS).toISOString();

    const [casesRes, tasksRes, eventsRes, docsRes, jobsRes, membersRes, accessRes] =
      await Promise.all([
        supabase
          .from("cases")
          .select("id, title, client_name, status, created_at, updated_at, created_by_user_id")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("tasks")
          .select(
            "id, title, status, priority, due_date, case_id, assigned_to_user_id, created_by_user_id, updated_at",
          )
          .eq("organization_id", orgId)
          .neq("status", "done"),
        supabase
          .from("events")
          .select("id, title, starts_at, event_type, case_id, created_by_user_id")
          .eq("organization_id", orgId)
          .gte("starts_at", horizonFrom)
          .lte("starts_at", horizonTo)
          .order("starts_at", { ascending: true }),
        supabase
          .from("documents")
          .select("id, filename, processing_status, case_id, created_at, created_by_user_id")
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("document_index_jobs")
          .select("document_id, status, last_error_message")
          .eq("organization_id", orgId)
          .in("status", ["queued", "running", "error"]),
        supabase
          .from("organization_memberships")
          .select("user_id")
          .eq("organization_id", orgId)
          .eq("status", "active"),
        supabase.from("case_access").select("case_id").eq("user_id", userId),
      ]);

    const err =
      casesRes.error ?? tasksRes.error ?? eventsRes.error ?? docsRes.error ?? membersRes.error;
    if (err) throw err;

    const memberIds = (membersRes.data ?? []).map((m) => m.user_id as string);
    const { data: profiles } = memberIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", memberIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const memberNames: Record<string, string> = {};
    for (const p of profiles ?? []) {
      memberNames[p.id as string] = (p.full_name as string | null) || "Integrante";
    }

    const allCases = (casesRes.data ?? []) as CoreCase[];
    const allTasks = (tasksRes.data ?? []) as CoreTask[];
    const allEvents = (eventsRes.data ?? []) as CoreEvent[];

    const jobs = jobsRes.error ? [] : (jobsRes.data ?? []);
    const errorByDoc = new Map<string, string | null>();
    let running = 0;
    let queued = 0;
    for (const j of jobs) {
      if (j.status === "running") running += 1;
      if (j.status === "queued") queued += 1;
      if (j.status === "error") {
        errorByDoc.set(j.document_id as string, (j.last_error_message as string | null) ?? null);
      }
    }

    const allDocs = ((docsRes.data ?? []) as CoreDocument[]).map((d) => ({
      ...d,
      error_message: errorByDoc.get(d.id) ?? null,
    }));

    const myCaseIds = new Set<string>([
      ...allCases.filter((c) => c.created_by_user_id === userId).map((c) => c.id),
      ...((accessRes.error ? [] : (accessRes.data ?? [])).map((r) => r.case_id as string)),
    ]);

    const tasks = scopeTasks(allTasks, scope, userId);
    const events = scopeEvents(allEvents, scope, userId, myCaseIds);
    const documents = scopeDocuments(allDocs, scope, userId, myCaseIds);
    const cases =
      scope === "org" ? allCases : allCases.filter((c) => myCaseIds.has(c.id));

    const caseTitleById = new Map(allCases.map((c) => [c.id, c.title]));

    const indicators = computeIndicators({ tasks, events, documents, now });
    const priorities = buildPriorities({
      tasks,
      events,
      documents,
      cases: allCases,
      memberNames,
      now,
      limit: 25,
    });
    const agenda = upcomingAgenda({ events, tasks, cases: allCases, now });
    const rankedCases = rankCases({
      cases,
      tasks,
      events,
      documents,
      memberNames,
      now,
      limit: 5,
    });

    const failed = documents
      .filter((d) => d.processing_status === "error" || d.processing_status === "split_failed")
      .slice(0, 6)
      .map((d) => ({
        documentId: d.id,
        filename: d.filename,
        caseId: d.case_id,
        caseTitle: d.case_id ? (caseTitleById.get(d.case_id) ?? null) : null,
        reason: d.error_message ?? null,
      }));

    const recentDocuments = documents.slice(0, 5).map((d) => ({
      id: d.id,
      filename: d.filename,
      caseId: d.case_id,
      caseTitle: d.case_id ? (caseTitleById.get(d.case_id) ?? null) : null,
      createdAt: d.created_at,
      authorName: memberNames[d.created_by_user_id] ?? null,
      status: d.processing_status,
    }));

    return {
      scope,
      canViewOrganization,
      userId,
      indicators,
      priorities,
      agenda,
      cases: rankedCases,
      processing: { running, queued, failed },
      recentDocuments,
      generatedAt: now.toISOString(),
    };
  });
