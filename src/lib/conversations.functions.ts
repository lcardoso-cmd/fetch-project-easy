import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOrg } from "@/lib/org-middleware";
import {
  attachmentPath,
  CONVERSATION_ATTACHMENT_MAX_BYTES,
  dmKey,
} from "@/lib/conversation-utils";

const AttachmentSchema = z.object({
  path: z.string().min(1),
  filename: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(CONVERSATION_ATTACHMENT_MAX_BYTES).optional(),
  mime: z.string().max(200).optional(),
});

const GENERAL_TITLE = "Canal geral";

/** Exige que o usuário participe da conversa (além da RLS). */
async function assertParticipant(
  supabase: any,
  conversationId: string,
  userId: string,
): Promise<{ id: string; kind: string; case_id: string | null; organization_id: string }> {
  const { data: part, error } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!part) throw new Error("Você não participa desta conversa.");

  const { data: conv, error: cErr } = await supabase
    .from("conversations")
    .select("id, kind, case_id, organization_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!conv) throw new Error("Conversa não encontrada.");
  return conv;
}

/** Garante que a conversa pertence à organização ativa do usuário. */
function assertSameOrg(conv: { organization_id: string }, organizationId: string) {
  if (conv.organization_id !== organizationId) {
    throw new Error("Conversa de outra organização.");
  }
}

/** Membros ativos da organização (via cliente privilegiado, após autorização). */
async function activeMemberIds(admin: any, organizationId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((m: { user_id: string }) => m.user_id);
}

/**
 * Sincroniza participantes de conversas coletivas (canal geral / caso).
 * Adiciona quem deve participar e remove quem perdeu o acesso.
 */
async function syncParticipants(
  admin: any,
  conversationId: string,
  organizationId: string,
  wanted: string[],
): Promise<void> {
  const { data: have } = await admin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId);
  const haveSet = new Set<string>((have ?? []).map((p: { user_id: string }) => p.user_id));
  const wantedSet = new Set(wanted);

  const toAdd = wanted.filter((u) => !haveSet.has(u));
  if (toAdd.length > 0) {
    await admin.from("conversation_participants").insert(
      toAdd.map((u) => ({
        conversation_id: conversationId,
        organization_id: organizationId,
        user_id: u,
      })),
    );
  }
  const toRemove = Array.from(haveSet).filter((u) => !wantedSet.has(u));
  if (toRemove.length > 0) {
    await admin
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .in("user_id", toRemove);
  }
}

// ---------------------------------------------------------------- listagem

export const listMyConversations = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .handler(async ({ context }) => {
    const { data: parts, error } = await context.supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", context.userId)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) return [];

    const { data: convs, error: cErr } = await context.supabase
      .from("conversations")
      .select("*")
      .in("id", ids)
      .eq("organization_id", context.organizationId)
      .order("last_message_at", { ascending: false });
    if (cErr) throw cErr;

    const otherUserIds = new Set<string>();
    const caseIds = new Set<string>();
    for (const c of convs ?? []) if (c.case_id) caseIds.add(c.case_id);

    const { data: allParts } = await context.supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", ids);
    for (const p of allParts ?? []) {
      if (p.user_id !== context.userId) otherUserIds.add(p.user_id);
    }

    const [{ data: profiles }, { data: cases }] = await Promise.all([
      otherUserIds.size
        ? context.supabase.from("profiles").select("id, full_name").in("id", Array.from(otherUserIds))
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
      caseIds.size
        ? context.supabase.from("cases").select("id, title").in("id", Array.from(caseIds))
        : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
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

    // Última mensagem + não lidas
    const meta = await Promise.all(
      (convs ?? []).map(async (c) => {
        const lr = lastReadMap.get(c.id) ?? c.created_at;
        const [{ count }, { data: lastMsg }] = await Promise.all([
          context.supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", c.id)
            .gt("created_at", lr)
            .neq("author_id", context.userId)
            .is("deleted_at", null),
          context.supabase
            .from("messages")
            .select("body, author_id, created_at, deleted_at, attachments")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        return [c.id, { unread: count ?? 0, lastMsg }] as const;
      }),
    );
    const metaMap = new Map(meta);

    return (convs ?? []).map((c) => {
      const memberIds = partsMap.get(c.id) ?? [];
      const otherIds = memberIds.filter((id) => id !== context.userId);
      const otherName =
        c.kind === "dm" && otherIds[0] ? profileMap.get(otherIds[0]) ?? "Usuário" : null;
      const m = metaMap.get(c.id);
      const last = m?.lastMsg as
        | { body: string; deleted_at: string | null; attachments: unknown[] }
        | null
        | undefined;
      return {
        ...c,
        case_title: c.case_id ? caseMap.get(c.case_id) ?? null : null,
        other_name: otherName,
        participant_user_ids: memberIds,
        unread: m?.unread ?? 0,
        last_message_preview: last
          ? last.deleted_at
            ? "Mensagem removida"
            : last.body?.trim() ||
              ((last.attachments as unknown[])?.length ? "Anexo enviado" : "")
          : "",
      };
    });
  });

// ------------------------------------------------ criação/obtenção de conversas

export const getOrCreateGeneralConversation = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Autorização já garantida por requireOrg (membership ativa na organização).
    const existing = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("kind", "general")
      .maybeSingle();

    let conv = existing.data;
    if (!conv) {
      const ins = await supabaseAdmin
        .from("conversations")
        .insert({
          kind: "general",
          organization_id: context.organizationId,
          title: GENERAL_TITLE,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (ins.error) {
        // corrida entre duas sessões: relê o canal existente
        const again = await supabaseAdmin
          .from("conversations")
          .select("*")
          .eq("organization_id", context.organizationId)
          .eq("kind", "general")
          .maybeSingle();
        if (!again.data) throw ins.error;
        conv = again.data;
      } else {
        conv = ins.data;
      }
    }

    const members = await activeMemberIds(supabaseAdmin, context.organizationId);
    await syncParticipants(supabaseAdmin, conv!.id, context.organizationId, members);
    return conv;
  });

export const getOrCreateCaseConversation = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ case_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Acesso ao caso é validado pela RLS do usuário (user_can_access_case).
    const { data: caseRow, error: cErr } = await context.supabase
      .from("cases")
      .select("id, title, organization_id")
      .eq("id", data.case_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!caseRow) throw new Error("Caso não encontrado ou sem acesso.");
    if (caseRow.organization_id !== context.organizationId) {
      throw new Error("Caso de outra organização.");
    }

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
      if (ins.error) {
        const again = await supabaseAdmin
          .from("conversations")
          .select("*")
          .eq("case_id", data.case_id)
          .eq("kind", "case")
          .maybeSingle();
        if (!again.data) throw ins.error;
        conv = again.data;
      } else {
        conv = ins.data;
      }
    }

    // Participantes = membros ativos que realmente têm acesso ao caso.
    const members = await activeMemberIds(supabaseAdmin, context.organizationId);
    const allowed: string[] = [];
    for (const uid of members) {
      const { data: can } = await supabaseAdmin.rpc("user_can_access_case", {
        _case_id: data.case_id,
        _user_id: uid,
      });
      if (can === true) allowed.push(uid);
    }
    if (!allowed.includes(context.userId)) allowed.push(context.userId);
    await syncParticipants(supabaseAdmin, conv!.id, context.organizationId, allowed);

    return conv;
  });

export const getOrCreateDM = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ other_user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.other_user_id === context.userId) throw new Error("Selecione outra pessoa.");

    // O destinatário precisa ser membro ativo da MESMA organização.
    const { data: membership, error: mErr } = await context.supabase
      .from("organization_memberships")
      .select("user_id")
      .eq("organization_id", context.organizationId)
      .eq("user_id", data.other_user_id)
      .eq("status", "active")
      .maybeSingle();
    if (mErr) throw mErr;
    if (!membership) throw new Error("Pessoa não faz parte da organização.");

    const key = dmKey(context.userId, data.other_user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existing = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("organization_id", context.organizationId)
      .eq("kind", "dm")
      .eq("dm_key", key)
      .maybeSingle();
    if (existing.data) {
      await syncParticipants(supabaseAdmin, existing.data.id, context.organizationId, [
        context.userId,
        data.other_user_id,
      ]);
      return existing.data;
    }

    const ins = await supabaseAdmin
      .from("conversations")
      .insert({
        kind: "dm",
        organization_id: context.organizationId,
        dm_key: key,
        created_by: context.userId,
      })
      .select("*")
      .single();
    let conv = ins.data;
    if (ins.error) {
      const again = await supabaseAdmin
        .from("conversations")
        .select("*")
        .eq("organization_id", context.organizationId)
        .eq("kind", "dm")
        .eq("dm_key", key)
        .maybeSingle();
      if (!again.data) throw ins.error;
      conv = again.data;
    }

    await syncParticipants(supabaseAdmin, conv!.id, context.organizationId, [
      context.userId,
      data.other_user_id,
    ]);
    return conv;
  });

// ------------------------------------------------------------- participantes

export const listConversationParticipants = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const conv = await assertParticipant(
      context.supabase,
      data.conversation_id,
      context.userId,
    );
    assertSameOrg(conv, context.organizationId);

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
    return (profiles ?? []).map((p) => ({ id: p.id, name: p.full_name ?? "Usuário" }));
  });

// ------------------------------------------------------------------ mensagens

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
    const conv = await assertParticipant(
      context.supabase,
      data.conversation_id,
      context.userId,
    );
    assertSameOrg(conv, context.organizationId);

    const { data: msgs, error } = await context.supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw error;
    const rows = msgs ?? [];

    const authorIds = Array.from(new Set(rows.map((m) => m.author_id)));
    const { data: profiles } = authorIds.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", authorIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    // Prévia da mensagem respondida
    const replyIds = Array.from(
      new Set(rows.map((m) => m.reply_to_id).filter((v): v is string => !!v)),
    );
    const replyMap = new Map<
      string,
      { id: string; body: string; author_id: string; deleted_at: string | null }
    >();
    if (replyIds.length > 0) {
      const { data: replies } = await context.supabase
        .from("messages")
        .select("id, body, author_id, deleted_at")
        .in("id", replyIds);
      for (const r of replies ?? []) replyMap.set(r.id, r);
    }

    // Tarefas geradas a partir das mensagens (integração bidirecional)
    const messageIds = rows.map((m) => m.id);
    const taskMap = new Map<string, Array<{ id: string; title: string; status: string }>>();
    if (messageIds.length > 0) {
      const { data: links } = await context.supabase
        .from("message_tasks")
        .select("message_id, task_id")
        .in("message_id", messageIds);
      const taskIds = Array.from(new Set((links ?? []).map((l) => l.task_id)));
      if (taskIds.length > 0) {
        const { data: tasks } = await context.supabase
          .from("tasks")
          .select("id, title, status")
          .in("id", taskIds);
        const tById = new Map((tasks ?? []).map((t) => [t.id, t]));
        for (const l of links ?? []) {
          const t = tById.get(l.task_id);
          if (!t) continue;
          const arr = taskMap.get(l.message_id) ?? [];
          arr.push({ id: t.id, title: t.title, status: t.status });
          taskMap.set(l.message_id, arr);
        }
      }
    }

    return rows.map((m) => {
      const reply = m.reply_to_id ? replyMap.get(m.reply_to_id) ?? null : null;
      return {
        ...m,
        body: m.deleted_at ? "" : m.body,
        attachments: m.deleted_at ? [] : m.attachments,
        author_name: nameMap.get(m.author_id) ?? "Usuário",
        reply_to: reply
          ? {
              id: reply.id,
              author_name: nameMap.get(reply.author_id) ?? "Usuário",
              body: reply.deleted_at ? "Mensagem removida" : reply.body.slice(0, 160),
            }
          : null,
        tasks: taskMap.get(m.id) ?? [],
      };
    });
  });

export const searchMessages = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        query: z.string().min(2).max(200),
        conversation_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(50).default(30),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: parts, error } = await context.supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", context.userId)
      .eq("organization_id", context.organizationId);
    if (error) throw error;
    let ids = (parts ?? []).map((p) => p.conversation_id);
    if (data.conversation_id) {
      if (!ids.includes(data.conversation_id)) throw new Error("Você não participa desta conversa.");
      ids = [data.conversation_id];
    }
    if (ids.length === 0) return [];

    const { data: msgs, error: mErr } = await context.supabase
      .from("messages")
      .select("id, conversation_id, author_id, body, created_at")
      .in("conversation_id", ids)
      .is("deleted_at", null)
      .ilike("body", `%${data.query.replace(/[%_]/g, "")}%`)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (mErr) throw mErr;
    const rows = msgs ?? [];
    if (rows.length === 0) return [];

    const authorIds = Array.from(new Set(rows.map((m) => m.author_id)));
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const convIds = Array.from(new Set(rows.map((m) => m.conversation_id)));
    const { data: convs } = await context.supabase
      .from("conversations")
      .select("id, kind, title, case_id")
      .in("id", convIds);
    const caseIds = (convs ?? []).map((c) => c.case_id).filter((v): v is string => !!v);
    const { data: cases } = caseIds.length
      ? await context.supabase.from("cases").select("id, title").in("id", caseIds)
      : { data: [] as Array<{ id: string; title: string }> };
    const caseTitle = new Map((cases ?? []).map((c) => [c.id, c.title]));
    const convMap = new Map(
      (convs ?? []).map((c) => [
        c.id,
        {
          kind: c.kind as "general" | "case" | "dm",
          title: c.title,
          case_title: c.case_id ? caseTitle.get(c.case_id) ?? null : null,
        },
      ]),
    );

    return rows.map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      body: m.body,
      created_at: m.created_at,
      author_name: nameMap.get(m.author_id) ?? "Usuário",
      conversation: convMap.get(m.conversation_id) ?? null,
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
    const conv = await assertParticipant(
      context.supabase,
      data.conversation_id,
      context.userId,
    );
    assertSameOrg(conv, context.organizationId);
    if (!data.body.trim() && data.attachments.length === 0) {
      throw new Error("Mensagem vazia.");
    }

    // A mensagem respondida precisa ser da mesma conversa
    if (data.reply_to_id) {
      const { data: parent } = await context.supabase
        .from("messages")
        .select("id, conversation_id")
        .eq("id", data.reply_to_id)
        .maybeSingle();
      if (!parent || parent.conversation_id !== data.conversation_id) {
        throw new Error("Mensagem respondida inválida.");
      }
    }

    // Menções: apenas participantes da conversa
    let mentions: string[] = [];
    if (data.mention_user_ids.length > 0) {
      const { data: parts } = await context.supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", data.conversation_id)
        .in("user_id", Array.from(new Set(data.mention_user_ids)));
      mentions = (parts ?? [])
        .map((p) => p.user_id)
        .filter((uid) => uid !== context.userId);
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

    if (mentions.length > 0) {
      await context.supabase.from("message_mentions").upsert(
        mentions.map((uid) => ({
          message_id: ins.data.id,
          conversation_id: data.conversation_id,
          organization_id: context.organizationId,
          mentioned_user_id: uid,
        })),
        { onConflict: "message_id,mentioned_user_id", ignoreDuplicates: true },
      );
    }

    return { ...ins.data, mentioned: mentions.length };
  });

export const editMessage = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        message_id: z.string().uuid(),
        body: z.string().min(1).max(8000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("messages")
      .select("id, author_id, conversation_id, deleted_at, organization_id")
      .eq("id", data.message_id)
      .maybeSingle();
    if (error) throw error;
    if (!msg) throw new Error("Mensagem não encontrada.");
    if (msg.organization_id !== context.organizationId) throw new Error("Mensagem de outra organização.");
    if (msg.author_id !== context.userId) throw new Error("Só o autor pode editar a mensagem.");
    if (msg.deleted_at) throw new Error("Mensagem removida não pode ser editada.");

    const upd = await context.supabase
      .from("messages")
      .update({ body: data.body, edited_at: new Date().toISOString() })
      .eq("id", data.message_id)
      .select("*")
      .single();
    if (upd.error) throw upd.error;
    return upd.data;
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ message_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("messages")
      .select("id, author_id, organization_id, deleted_at")
      .eq("id", data.message_id)
      .maybeSingle();
    if (error) throw error;
    if (!msg) throw new Error("Mensagem não encontrada.");
    if (msg.organization_id !== context.organizationId) throw new Error("Mensagem de outra organização.");
    if (msg.author_id !== context.userId) throw new Error("Só o autor pode remover a mensagem.");
    if (msg.deleted_at) return { ok: true };

    const upd = await context.supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), body: "", attachments: [] })
      .eq("id", data.message_id);
    if (upd.error) throw upd.error;
    return { ok: true };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversation_id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const uploadConversationAttachment = createServerFn({ method: "POST" })
  .middleware([requireOrg])
  .inputValidator((i: unknown) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        filename: z.string().min(1).max(255),
        size: z.number().int().nonnegative().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const conv = await assertParticipant(
      context.supabase,
      data.conversation_id,
      context.userId,
    );
    assertSameOrg(conv, context.organizationId);
    if (data.size !== undefined && data.size > CONVERSATION_ATTACHMENT_MAX_BYTES) {
      throw new Error("Arquivo acima de 25 MB.");
    }
    // O upload é feito pelo cliente no bucket privado; a RLS de storage
    // confirma organização + participação usando este caminho.
    return { path: attachmentPath(context.organizationId, data.conversation_id, data.filename) };
  });

// -------------------------------------------------------- tarefas a partir de mensagens

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
      .select("id, conversation_id, organization_id")
      .eq("id", data.message_id)
      .maybeSingle();
    if (error) throw error;
    if (!msg) throw new Error("Mensagem não encontrada.");
    if (msg.organization_id !== context.organizationId) {
      throw new Error("Mensagem de outra organização.");
    }
    const conv = await assertParticipant(
      context.supabase,
      msg.conversation_id,
      context.userId,
    );
    assertSameOrg(conv, context.organizationId);

    // Participantes válidos para responsável/menções
    const { data: parts } = await context.supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", msg.conversation_id);
    const participantIds = new Set((parts ?? []).map((p) => p.user_id));

    const mentions = Array.from(new Set(data.mention_user_ids ?? [])).filter((uid) =>
      participantIds.has(uid),
    );

    let assignee = data.assigned_to_user_id ?? mentions[0] ?? null;
    if (assignee && !participantIds.has(assignee)) {
      throw new Error("Responsável precisa participar da conversa.");
    }

    const taskIns = await context.supabase
      .from("tasks")
      .insert({
        organization_id: context.organizationId,
        created_by_user_id: context.userId,
        case_id: conv.case_id,
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

    if (mentions.length > 0) {
      await context.supabase.from("message_mentions").upsert(
        mentions.map((uid) => ({
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

// ------------------------------------------------ contatos da barra de chat

/**
 * Contatos para a barra lateral de chat (estilo Bitrix24): membros ativos da
 * organização, com a conversa direta existente (quando houver) e a contagem
 * de mensagens não lidas. Não exige permissão de gestão de equipe — qualquer
 * membro ativo pode conversar com os colegas.
 */
export const listChatContacts = createServerFn({ method: "GET" })
  .middleware([requireOrg])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const memberIds = (await activeMemberIds(supabaseAdmin, context.organizationId)).filter(
      (id) => id !== context.userId,
    );
    if (memberIds.length === 0)
      return [] as Array<{
        user_id: string;
        name: string;
        conversation_id: string | null;
        unread: number;
        last_message_at: string | null;
      }>;

    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);
    const nameById = new Map(
      ((profiles ?? []) as Array<{ id: string; full_name: string | null }>).map(
        (p) => [p.id, p.full_name?.trim() || "Usuário"] as const,
      ),
    );

    // Conversas diretas existentes entre mim e cada colega.
    const keys = memberIds.map((id) => dmKey(context.userId, id));
    const { data: convs } = await context.supabase
      .from("conversations")
      .select("id, dm_key, last_message_at")
      .eq("organization_id", context.organizationId)
      .eq("kind", "dm")
      .in("dm_key", keys);

    const convByKey = new Map(
      ((convs ?? []) as Array<{ id: string; dm_key: string | null; last_message_at: string | null }>)
        .filter((c) => !!c.dm_key)
        .map((c) => [c.dm_key as string, c] as const),
    );

    const convIds = Array.from(convByKey.values()).map((c) => c.id);
    const lastReadByConv = new Map<string, string | null>();
    if (convIds.length > 0) {
      const { data: parts } = await context.supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", context.userId)
        .in("conversation_id", convIds);
      for (const p of (parts ?? []) as Array<{
        conversation_id: string;
        last_read_at: string | null;
      }>) {
        lastReadByConv.set(p.conversation_id, p.last_read_at);
      }
    }

    const unreadByConv = new Map<string, number>();
    await Promise.all(
      convIds.map(async (id) => {
        const lr = lastReadByConv.get(id);
        let q = context.supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", id)
          .neq("author_id", context.userId)
          .is("deleted_at", null);
        if (lr) q = q.gt("created_at", lr);
        const { count } = await q;
        unreadByConv.set(id, count ?? 0);
      }),
    );

    return memberIds
      .map((id) => {
        const conv = convByKey.get(dmKey(context.userId, id));
        return {
          user_id: id,
          name: nameById.get(id) ?? "Usuário",
          conversation_id: conv?.id ?? null,
          unread: conv ? unreadByConv.get(conv.id) ?? 0 : 0,
          last_message_at: conv?.last_message_at ?? null,
        };
      })
      .sort((a, b) => {
        if (b.unread !== a.unread) return b.unread - a.unread;
        const at = a.last_message_at ?? "";
        const bt = b.last_message_at ?? "";
        if (at !== bt) return bt.localeCompare(at);
        return a.name.localeCompare(b.name, "pt-BR");
      });
  });
