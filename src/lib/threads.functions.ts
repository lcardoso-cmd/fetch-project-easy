import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AiThread {
  id: string;
  title: string;
  case_id: string;
  last_message_at: string;
  created_at: string;
}

export interface AiToolStep {
  name: string;
  args_json: string;
  result_json: string;
}
export interface AiCitation {
  filename: string;
  similarity: number;
}
export interface AiMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  images: string[] | null;
  tool_steps: AiToolStep[] | null;
  citations: AiCitation[] | null;
  model_tier: string | null;
  created_at: string;
  input_kind: "text" | "voice" | null;
  audio_path: string | null;
  audio_duration_ms: number | null;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ case_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_chat_threads")
      .select("id, title, case_id, last_message_at, created_at")
      .eq("case_id", data.case_id)
      .eq("user_id", context.userId)
      .order("last_message_at", { ascending: false });
    if (error) throw error;
    return (rows ?? []) as AiThread[];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        case_id: z.string().uuid(),
        title: z.string().min(1).max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_chat_threads")
      .insert({
        case_id: data.case_id,
        user_id: context.userId,
        title: data.title ?? "Nova conversa",
      })
      .select("id, title, case_id, last_message_at, created_at")
      .single();
    if (error) throw error;
    return row as AiThread;
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ id: z.string().uuid(), title: z.string().min(1).max(200) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_chat_threads")
      .update({ title: data.title })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_chat_threads")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ thread_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ai_chat_messages")
      .select(
        "id, thread_id, role, content, images, tool_steps, citations, model_tier, created_at, input_kind, audio_path, audio_duration_ms",
      )
      .eq("thread_id", data.thread_id)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as unknown as AiMessage[];
  });

export const getMessageAudioUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ message_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_chat_messages")
      .select("audio_path, user_id")
      .eq("id", data.message_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!row?.audio_path) throw new Error("Áudio não encontrado.");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("chat-audio")
      .createSignedUrl(row.audio_path, 60 * 30);
    if (sErr || !signed?.signedUrl) {
      throw new Error(sErr?.message ?? "Falha ao gerar link do áudio.");
    }
    return { url: signed.signedUrl };
  });
