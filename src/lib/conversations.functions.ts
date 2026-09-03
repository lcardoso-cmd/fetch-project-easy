import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";

const AttachmentSchema = z.object({
  path: z.string(),
  filename: z.string(),
  size: z.number().int().nonnegative().optional(),
  mime: z.string().optional(),
});

// Helpers (server-side)
async function assertParticipant(
  supabase: any,
  conversationId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Você não participa desta conversa.");
}

export const listMyConversations = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .handler(async ({ context }) => {
    const { data: parts, error } = await context.supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", context.userId);
    if (error) throw error;
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) return [];

    const { data: convs, error: cErr } = await context.supabase
      .from("conversations")
      .select("*")
      .in("id", ids)
      .order("last_message_at", { ascending: false });
    if (cErr) throw cErr;

    // Hydrate: participants + case title + unread count
    const otherUserIds = new Set<string>();
    const caseIds = new Set<string>();
    for (const c of convs ?? []) {
      if (c.case_id) caseIds.add(c.case_id);
    }

    const { data: allParts } = await context.supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", ids);
    for (const p of allParts ?? []) if (p.user_id !== context.userId) otherUserIds.add(p.user_id);

    const profilesPromise = otherUserIds.size
      ? context.supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", Array.from(otherUserIds))
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> });

    const casesPromise = caseIds.size
      ? context.supabase.from("cases").select("id, title").in("id", Array.from(caseIds))
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> });

    const [{ data: profiles }, { data: cases }] = await Promise.all([
      profilesPromise,
      casesPromise,
    ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const caseMap = new Map((cases ?? []).map((c) => [c.id, c.title]));
    const partsMap = new Map<string, string[]>();
    for (const p of allParts ?? []) {
      const arr = partsMap.get(p.conversation_id) ?? [];
      arr.push(p.user_id);
      partsMap.set(p.conversation_id, arr);
    }
    const lastReadMap = new Map((parts ?? []).map((p) => [p.conversation_id, p.last_read_at]));

    // Unread counts
    const unreadEntries = await Promise.all(
      (convs ?? []).map(async (c) => {
        const lr = lastReadMap.get(c.id) ?? c.created_at;
        const { count } = await context.supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", c.id)
          .gt("created_at", lr)
          .neq("author_id", context.userId);
        return [c.id, count ?? 0] as const;
      }),
    );
    const unreadMap = new Map(unreadEntries);

    return (convs ?? []).map((c) => {
      const memberIds = partsMap.get(c.id) ?? [];
      const otherIds = memberIds.filter((id) => id !== context.userId);
      const otherName =
        c.kind === "dm" && otherIds[0]
          ? profileMap.get(otherIds[0]) ?? "Usuário"
          : null;
      return {
        ...c,
        case_title: c.case_id ? caseMap.get(c.case_id) ?? null : null,
        other_name: otherName,
        participant_user_ids: memberIds,
        unread: unreadMap.get(c.id) ?? 0,
      };
    });
  });

// Find or create the case conversation; auto-add owner + accepted member accounts on the case
export const getOrCreateCaseConversation = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: caseRow, error: cErr } = await context.supabase
      .from("cases")
      .select("id, title")
      .eq("id", data.case_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!caseRow) throw new Error("Caso não encontrado ou sem acesso.");

    // Find or create conversation (use admin to bypass RLS chicken-and-egg:
    // user must be a participant to SELECT, but participants are added after insert)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const existing = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("case_id", data.case_id)
      .eq("kind", "case")
      .maybeSingle();
    let conv = existing.data;
    if (!conv) {
      const ins = await supabaseAdmin
        .from("conversations")
        .insert({
          kind: "case",
          organization_id: context.organizationId,
          case_id: data.case_id,
          title: caseRow.title,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (ins.error) throw ins.error;
      conv = ins.data;
    }

    // Compute desired participants: case owner + accepted invited members
    // (supabaseAdmin already imported above)
    const linkedUserIds = new Set<string>();
    const { data: members } = await supabaseAdmin
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", context.organizationId)
      .eq("status", "active");
    for (const m of members ?? []) linkedUserIds.add(m.user_id);
    // Self is always a participant
    linkedUserIds.add(context.userId);

    // Insert missing participants
    const wanted = Array.from(linkedUserIds);
    const { data: have } = await supabaseAdmin
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", conv.id);
    const haveSet = new Set((have ?? []).map((p) => p.user_id));
    const toAdd = wanted.filter((u) => !haveSet.has(u));
    if (toAdd.length > 0) {
      await supabaseAdmin
        .from("conversation_participants")
        .insert(toAdd.map((u) => ({ conversation_id: conv!.id, organization_id: context.organizationId, user_id: u })));
    }

    return conv;
  });

export const getOrCreateDM = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z.object({ other_user_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.other_user_id === context.userId) throw new Error("Selecione outra pessoa.");

    // Look for existing DM between the two
    const { data: mine } = await context.supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", context.userId);
    const myConvIds = (mine ?? []).map((p) => p.conversation_id);
    let convId: string | null = null;
    if (myConvIds.length > 0) {
      const { data: shared } = await context.supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", data.other_user_id)
        .in("conversation_id", myConvIds);
      const candidates = (shared ?? []).map((s) => s.conversation_id);
      if (candidates.length > 0) {
        const { data: dms } = await context.supabase
          .from("conversations")
          .select("id")
          .eq("kind", "dm")
          .in("id", candidates)
          .limit(1);
        if (dms && dms[0]) convId = dms[0].id;
      }
    }
    if (convId) {
      const { data } = await context.supabase
        .from("conversations")
        .select("*")
        .eq("id", convId)
        .single();
      return data;
    }

    const ins = await context.supabase
      .from("conversations")
      .insert({ kind: "dm", organization_id: context.organizationId, created_by: context.userId })
      .select("*")
      .single();
    if (ins.error) throw ins.error;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("conversation_participants")
      .insert([
        { conversation_id: ins.data.id, organization_id: context.organizationId, user_id: context.userId },
        { conversation_id: ins.data.id, organization_id: context.organizationId, user_id: data.other_user_id },
      ]);
    return ins.data;
  });

export const listConversationParticipants = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z.object({ conversation_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertParticipant(context.supabase, data.conversation_id, context.userId);
    const { data: parts, error } = await context.supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", data.conversation_id);
    if (error) throw error;
    const ids = (parts ?? []).map((p) => p.user_id);
    if (ids.length === 0) return [] as Array<{ id: string; name: string }>;
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    return (profiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name ?? "Usuário",
    }));
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertParticipant(context.supabase, data.conversation_id, context.userId);

    const { data: msgs, error } = await context.supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw error;

    const authorIds = Array.from(new Set((msgs ?? []).map((m) => m.author_id)));
    const { data: profiles } = authorIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", authorIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return (msgs ?? []).map((m) => ({
      ...m,
      author_name: nameMap.get(m.author_id) ?? "Usuário",
    }));
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        body: z.string().max(8000).default(""),
        attachments: z.array(AttachmentSchema).default([]),
        reply_to_id: z.string().uuid().optional().nullable(),
        mention_user_ids: z.array(z.string().uuid()).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertParticipant(context.supabase, data.conversation_id, context.userId);
    if (!data.body.trim() && data.attachments.length === 0) {
      throw new Error("Mensagem vazia.");
    }

    const ins = await context.supabase
      .from("messages")
      .insert({
        conversation_id: data.conversation_id,
        organization_id: context.organizationId,
        author_id: context.userId,
        body: data.body,
        attachments: data.attachments,
        reply_to_id: data.reply_to_id ?? null,
      })
      .select("*")
      .single();
    if (ins.error) throw ins.error;

    if (data.mention_user_ids.length > 0) {
      await context.supabase.from("message_mentions").insert(
        data.mention_user_ids.map((uid) => ({
          message_id: ins.data.id,
          conversation_id: data.conversation_id,
          organization_id: context.organizationId,
          mentioned_user_id: uid,
        })),
      );
    }

    return ins.data;
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", context.userId);
    return { ok: true };
  });

export const uploadConversationAttachment = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        filename: z.string().min(1).max(255),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertParticipant(context.supabase, data.conversation_id, context.userId);
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${context.organizationId}/conversations/${data.conversation_id}/${Date.now()}_${safe}`;
    // Caller uploads the file via the client supabase storage (path returned here)
    return { path };
  });

export const createTaskFromMessage = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        message_id: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional().nullable(),
        due_date: z.string().optional().nullable(),
        assigned_to_user_id: z.string().uuid().optional().nullable(),
        mention_user_ids: z.array(z.string().uuid()).optional().default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("messages")
      .select("id, conversation_id, conversations(case_id)")
      .eq("id", data.message_id)
      .maybeSingle();
    if (error) throw error;
    if (!msg) throw new Error("Mensagem não encontrada.");
    await assertParticipant(context.supabase, msg.conversation_id, context.userId);

    const caseId =
      (msg as unknown as { conversations: { case_id: string | null } | null }).conversations
        ?.case_id ?? null;

    // If assignee not provided, default to first mentioned user (if any)
    const assignee =
      data.assigned_to_user_id ??
      (data.mention_user_ids && data.mention_user_ids.length > 0
        ? data.mention_user_ids[0]
        : null);

    const taskIns = await context.supabase
      .from("tasks")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        case_id: caseId,
        title: data.title,
        description: data.description ?? null,
        due_date: data.due_date ?? null,
        source_message_id: data.message_id,
        assigned_to_user_id: assignee,
      })
      .select("*")
      .single();
    if (taskIns.error) throw taskIns.error;

    await context.supabase
      .from("message_tasks")
      .insert({ message_id: data.message_id, task_id: taskIns.data.id });

    // Notify mentioned users by inserting message_mentions rows on source msg.
    // Authors of the source message will already have their own mentions; we
    // dedupe via UNIQUE(message_id, mentioned_user_id).
    const uniqueMentions = Array.from(new Set(data.mention_user_ids ?? []));
    if (uniqueMentions.length > 0) {
      await context.supabase.from("message_mentions").upsert(
        uniqueMentions.map((uid) => ({
          message_id: data.message_id,
          organization_id: context.organizationId,
          conversation_id: msg.conversation_id,
          mentioned_user_id: uid,
        })),
        { onConflict: "message_id,mentioned_user_id", ignoreDuplicates: true },
      );
    }

    return taskIns.data;
  });

