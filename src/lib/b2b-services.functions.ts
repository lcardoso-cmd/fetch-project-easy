import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const B2B_REQUEST_STATUSES = [
  "novo",
  "em_analise",
  "proposta_enviada",
  "aceita",
  "recusada",
  "cancelada",
] as const;
export type B2bRequestStatus = (typeof B2B_REQUEST_STATUSES)[number];

export const B2B_REQUEST_STATUS_LABEL: Record<B2bRequestStatus, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  proposta_enviada: "Proposta enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export const B2B_URGENCY_LABEL = {
  normal: "Normal",
  alta: "Alta",
  critica: "Crítica",
} as const;

export type B2bServiceCatalogItem = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  active: boolean;
};

export type B2bServiceRequest = {
  id: string;
  requester_user_id: string;
  case_id: string | null;
  service_slug: string;
  title: string;
  description: string;
  urgency: "normal" | "alta" | "critica";
  desired_deadline: string | null;
  contact_email: string;
  contact_phone: string | null;
  status: B2bRequestStatus;
  created_at: string;
  updated_at: string;
};

export type B2bEventPayload = {
  from?: string;
  to?: string;
  text?: string;
  file_name?: string;
  visibility?: string;
  service_slug?: string;
};

export type B2bServiceRequestEvent = {
  id: string;
  request_id: string;
  author_user_id: string | null;
  kind: "status_change" | "note_public" | "note_internal" | "attachment" | "created";
  payload: B2bEventPayload;
  created_at: string;
};

export type B2bServiceRequestAttachment = {
  id: string;
  request_id: string;
  uploaded_by_user_id: string;
  visibility: "client" | "internal";
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

// ============= Catalog =============

export const listB2bCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("b2b_service_catalog")
      .select("slug, title, description, icon, sort_order, active")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as B2bServiceCatalogItem[];
  });

// ============= Requests =============

const CreateSchema = z.object({
  service_slug: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(8000),
  urgency: z.enum(["normal", "alta", "critica"]).default("normal"),
  desired_deadline: z.string().nullable().optional(),
  contact_email: z.string().email().max(200),
  contact_phone: z.string().max(60).nullable().optional(),
  case_id: z.string().uuid().nullable().optional(),
});

export const createB2bRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("b2b_service_requests")
      .insert({
        requester_user_id: context.userId,
        service_slug: data.service_slug,
        title: data.title,
        description: data.description,
        urgency: data.urgency,
        desired_deadline: data.desired_deadline ?? null,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone ?? null,
        case_id: data.case_id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("b2b_service_request_events").insert({
      request_id: row.id,
      author_user_id: context.userId,
      kind: "created",
      payload: { service_slug: data.service_slug },
    });
    return row as B2bServiceRequest;
  });

export const listMyB2bRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("b2b_service_requests")
      .select("*")
      .eq("requester_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as B2bServiceRequest[];
  });

export const listAllB2bRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        status: z.enum(B2B_REQUEST_STATUSES).optional(),
        search: z.string().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("b2b_service_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as B2bServiceRequest[];
  });

export const getB2bRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const [reqRes, eventsRes, attRes] = await Promise.all([
      context.supabase.from("b2b_service_requests").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("b2b_service_request_events")
        .select("*")
        .eq("request_id", data.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("b2b_service_request_attachments")
        .select("*")
        .eq("request_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (reqRes.error) throw new Error(reqRes.error.message);
    if (!reqRes.data) throw new Error("Solicitação não encontrada");
    return {
      request: reqRes.data as B2bServiceRequest,
      events: ((eventsRes.data ?? []) as B2bServiceRequestEvent[]),
      attachments: ((attRes.data ?? []) as B2bServiceRequestAttachment[]),
    };
  });

export const updateB2bRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(B2B_REQUEST_STATUSES),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: before, error: selErr } = await context.supabase
      .from("b2b_service_requests")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!before) throw new Error("Solicitação não encontrada");

    const { error } = await context.supabase
      .from("b2b_service_requests")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("b2b_service_request_events").insert({
      request_id: data.id,
      author_user_id: context.userId,
      kind: "status_change",
      payload: { from: before.status, to: data.status },
    });
    return { ok: true };
  });

export const addB2bRequestNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        text: z.string().trim().min(1).max(4000),
        visibility: z.enum(["public", "internal"]).default("public"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("b2b_service_request_events").insert({
      request_id: data.request_id,
      author_user_id: context.userId,
      kind: data.visibility === "internal" ? "note_internal" : "note_public",
      payload: { text: data.text },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Attachments =============

const RegisterAttSchema = z.object({
  request_id: z.string().uuid(),
  file_name: z.string().min(1).max(300),
  storage_path: z.string().min(1),
  mime_type: z.string().max(160).nullable().optional(),
  size_bytes: z.number().int().nonnegative().nullable().optional(),
  visibility: z.enum(["client", "internal"]).default("client"),
});

export const registerB2bAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RegisterAttSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("b2b_service_request_attachments")
      .insert({
        request_id: data.request_id,
        uploaded_by_user_id: context.userId,
        file_name: data.file_name,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        visibility: data.visibility,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("b2b_service_request_events").insert({
      request_id: data.request_id,
      author_user_id: context.userId,
      kind: "attachment",
      payload: { file_name: data.file_name, visibility: data.visibility },
    });
    return row as B2bServiceRequestAttachment;
  });

export const deleteB2bAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: att } = await context.supabase
      .from("b2b_service_request_attachments")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    if (att?.storage_path) {
      await context.supabase.storage.from("documents").remove([att.storage_path]);
    }
    const { error } = await context.supabase
      .from("b2b_service_request_attachments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getB2bAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: att, error } = await context.supabase
      .from("b2b_service_request_attachments")
      .select("storage_path, file_name")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!att) throw new Error("Anexo não encontrado");
    const { data: signed, error: signErr } = await context.supabase.storage
      .from("documents")
      .createSignedUrl(att.storage_path, 60 * 10);
    if (signErr) throw new Error(signErr.message);
    return { url: signed.signedUrl, file_name: att.file_name };
  });
