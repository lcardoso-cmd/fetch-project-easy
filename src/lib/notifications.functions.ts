import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationItem =
  | {
      kind: "mention";
      id: string; // message_mentions.id
      created_at: string;
      read: boolean;
      conversation_id: string;
      message_id: string;
      author_name: string;
      preview: string;
      case_id: string | null;
    }
  | {
      kind: "task";
      id: string; // tasks.id
      created_at: string;
      read: boolean;
      title: string;
      case_id: string | null;
      due_date: string | null;
      status: string;
    };

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [mentionsRes, tasksRes] = await Promise.all([
      context.supabase
        .from("message_mentions")
        .select("id, message_id, conversation_id, read_at, created_at")
        .eq("mentioned_user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(30),
      context.supabase
        .from("tasks")
        .select("id, title, case_id, due_date, status, created_at")
        .eq("assigned_to_user_id", context.userId)
        .neq("user_id", context.userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (mentionsRes.error) throw mentionsRes.error;
    if (tasksRes.error) throw tasksRes.error;

    const mentions = mentionsRes.data ?? [];
    const messageIds = mentions.map((m) => m.message_id);
    const messagesById = new Map<
      string,
      { id: string; body: string; author_id: string; conversation_id: string }
    >();
    if (messageIds.length > 0) {
      const { data: msgs } = await context.supabase
        .from("messages")
        .select("id, body, author_id, conversation_id")
        .in("id", messageIds);
      for (const m of msgs ?? []) messagesById.set(m.id, m);
    }
    const authorIds = Array.from(
      new Set(Array.from(messagesById.values()).map((m) => m.author_id)),
    );
    const profileMap = new Map<string, string>();
    if (authorIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", authorIds);
      for (const p of profs ?? []) profileMap.set(p.id, p.full_name ?? "Usuário");
    }
    const convIds = Array.from(
      new Set(Array.from(messagesById.values()).map((m) => m.conversation_id)),
    );
    const convCase = new Map<string, string | null>();
    if (convIds.length > 0) {
      const { data: convs } = await context.supabase
        .from("conversations")
        .select("id, case_id")
        .in("id", convIds);
      for (const c of convs ?? []) convCase.set(c.id, c.case_id);
    }

    const items: NotificationItem[] = [];
    for (const m of mentions) {
      const msg = messagesById.get(m.message_id);
      items.push({
        kind: "mention",
        id: m.id,
        created_at: m.created_at,
        read: !!m.read_at,
        conversation_id: m.conversation_id,
        message_id: m.message_id,
        author_name: msg ? profileMap.get(msg.author_id) ?? "Usuário" : "Usuário",
        preview: (msg?.body ?? "").slice(0, 120),
        case_id: msg ? convCase.get(msg.conversation_id) ?? null : null,
      });
    }
    for (const t of tasksRes.data ?? []) {
      items.push({
        kind: "task",
        id: t.id,
        created_at: t.created_at,
        read: t.status === "done" || t.status === "completed",
        title: t.title,
        case_id: t.case_id,
        due_date: t.due_date,
        status: t.status,
      });
    }
    items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const unread = items.filter((i) => !i.read).length;
    return { items, unread };
  });

export const markMentionRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ mention_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("message_mentions")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.mention_id)
      .eq("mentioned_user_id", context.userId);
    return { ok: true };
  });

export const markAllMentionsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("message_mentions")
      .update({ read_at: new Date().toISOString() })
      .eq("mentioned_user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });
