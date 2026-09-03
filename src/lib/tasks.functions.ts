import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";

export const TASK_STATUSES = [
  "pending",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  in_review: "Em revisão",
  blocked: "Com pendências",
  done: "Concluída",
};

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const TaskInput = z.object({
  case_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(300),
  description: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  status: z.enum(TASK_STATUSES).default("pending"),
  due_date: z.string().optional().nullable(),
  assigned_to_user_id: z.string().uuid().optional().nullable(),
});

const TASK_COLUMNS =
  "id, title, description, status, priority, due_date, completed_at, case_id, assigned_to_user_id, created_at, position";

export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        case_id: z.string().uuid().optional(),
        status: z.enum([...TASK_STATUSES, "all"]).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("organization_id", context.organizationId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (data.case_id) q = q.eq("case_id", data.case_id);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => TaskInput.parse(i))
  .handler(async ({ data, context }) => {
    // Nova tarefa vai para o topo da coluna correspondente.
    const { data: first } = await context.supabase
      .from("tasks")
      .select("position")
      .eq("organization_id", context.organizationId)
      .eq("status", data.status)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    const position = (first?.position ?? 1) - 1;

    const { data: row, error } = await context.supabase
      .from("tasks")
      .insert({
        ...data,
        position,
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
      })
      .select(TASK_COLUMNS)
      .single();
    if (error) throw error;
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid() })
      .merge(TaskInput.partial())
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { id, ...updates } = data;
    const patch: {
      title?: string;
      description?: string | null;
      priority?: string;
      due_date?: string | null;
      assigned_to_user_id?: string | null;
      case_id?: string | null;
      status?: string;
      completed_at?: string | null;
    } = {};
    if (updates.title !== undefined) patch['title'] = updates.title;
    if (updates.description !== undefined)
      patch['description'] = updates.description || null;
    if (updates.priority !== undefined) patch['priority'] = updates.priority;
    if (updates.due_date !== undefined) patch['due_date'] = updates.due_date || null;
    if (updates.assigned_to_user_id !== undefined)
      patch['assigned_to_user_id'] = updates.assigned_to_user_id || null;
    if (updates.case_id !== undefined) patch['case_id'] = updates.case_id || null;
    if (updates.status !== undefined) {
      patch['status'] = updates.status;
      patch['completed_at'] =
        updates.status === "done" ? new Date().toISOString() : null;
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    return { ok: true };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({
        status: data.done ? "done" : "pending",
        completed_at: data.done ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    return { ok: true };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(TASK_STATUSES) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .update({
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Persiste a ordenação de uma coluna do quadro. Recebe a lista completa de IDs
 * na nova ordem e o status de destino; o escopo é sempre a organização ativa.
 */
export const reorderTasks = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.enum(TASK_STATUSES),
        ordered_ids: z.array(z.string().uuid()).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    for (let index = 0; index < data.ordered_ids.length; index += 1) {
      const id = data.ordered_ids[index]!;
      const { error } = await context.supabase
        .from("tasks")
        .update({
          position: index + 1,
          status: data.status,
          completed_at: data.status === "done" ? new Date().toISOString() : null,
        })
        .eq("id", id)
        .eq("organization_id", context.organizationId);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    return { ok: true };
  });
