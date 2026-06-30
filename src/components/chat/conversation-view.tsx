import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMessages,
  sendMessage,
  markConversationRead,
  uploadConversationAttachment,
  createTaskFromMessage,
  listConversationParticipants,
} from "@/lib/conversations.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Paperclip, Send, ClipboardCheck, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

type Message = {
  id: string;
  conversation_id: string;
  author_id: string;
  author_name?: string;
  body: string;
  attachments: Array<{ path: string; filename: string; mime?: string; size?: number }>;
  created_at: string;
};

type Attachment = { path: string; filename: string; size: number; mime: string };

export function ConversationView({
  conversationId,
  title,
  subtitle,
}: {
  conversationId: string;
  title?: string;
  subtitle?: string;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const listFn = useServerFn(listMessages);
  const sendFn = useServerFn(sendMessage);
  const markReadFn = useServerFn(markConversationRead);
  const uploadFn = useServerFn(uploadConversationAttachment);
  const listParticipantsFn = useServerFn(listConversationParticipants);

  const { data: messagesRaw = [], isLoading } = useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => listFn({ data: { conversation_id: conversationId, limit: 100 } }),
  });
  const messages = messagesRaw as unknown as Message[];

  const { data: participants = [] } = useQuery({
    queryKey: ["conversation-participants", conversationId],
    queryFn: () => listParticipantsFn({ data: { conversation_id: conversationId } }),
  });
  const participantList = participants as Array<{ id: string; name: string }>;

  const [body, setBody] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  // mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // resolved mentions in current draft: name -> userId
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return participantList
      .filter((p) => p.id !== user?.id && p.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, participantList, user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
          queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Mark read on open and when new messages arrive
  useEffect(() => {
    markReadFn({ data: { conversation_id: conversationId } }).catch(() => {});
  }, [conversationId, messages.length, markReadFn]);

  async function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 25 * 1024 * 1024) {
          toast.error(`${f.name} excede 25 MB`);
          continue;
        }
        const { path } = await uploadFn({
          data: { conversation_id: conversationId, filename: f.name },
        });
        const up = await supabase.storage.from("documents").upload(path, f, { upsert: false });
        if (up.error) throw up.error;
        uploaded.push({
          path,
          filename: f.name,
          size: f.size,
          mime: f.type || "application/octet-stream",
        });
      }
      setPending((p) => [...p, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleBodyChange(value: string) {
    setBody(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const upto = value.slice(0, caret);
    const m = upto.match(/(?:^|\s)@([\p{L}\p{N}._-]{0,30})$/u);
    if (m) {
      setMentionQuery(m[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(p: { id: string; name: string }) {
    const ta = textareaRef.current;
    if (!ta) return;
    const caret = ta.selectionStart ?? body.length;
    const upto = body.slice(0, caret);
    const after = body.slice(caret);
    const replaced = upto.replace(/@([\p{L}\p{N}._-]{0,30})$/u, `@${p.name} `);
    const next = replaced + after;
    setBody(next);
    setMentionMap((mm) => ({ ...mm, [p.name]: p.id }));
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = replaced.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function resolveMentionIds(text: string): string[] {
    const ids = new Set<string>();
    for (const [name, id] of Object.entries(mentionMap)) {
      // word-boundary-ish: ensure @name still present
      const re = new RegExp(
        `(?:^|\\s)@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\\\$&")}(?=\\s|$|[,.;:!?])`,
        "u",
      );
      if (re.test(text)) ids.add(id);
    }
    return Array.from(ids);
  }

  async function handleSend() {
    if (!body.trim() && pending.length === 0) return;
    setBusy(true);
    try {
      await sendFn({
        data: {
          conversation_id: conversationId,
          body,
          attachments: pending,
          mention_user_ids: resolveMentionIds(body),
        },
      });
      setBody("");
      setPending([]);
      setMentionMap({});
      setMentionQuery(null);
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-xl border bg-card">
      {(title || subtitle) && (
        <div className="border-b px-4 py-3">
          {title && <div className="font-semibold text-foreground">{title}</div>}
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Comece a conversa abaixo.
          </p>
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} mine={m.author_id === user?.id} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t bg-muted/30 px-3 py-2">
          {pending.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
            >
              <FileText className="h-3 w-3" />
              {a.filename}
              <button
                type="button"
                onClick={() => setPending((p) => p.filter((_, idx) => idx !== i))}
                className="ml-1 text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative flex items-end gap-2 border-t p-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleAttach(e.target.files)}
        />
        <div className="relative flex-1">
          {mentionQuery !== null && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-64 overflow-hidden rounded-md border bg-popover shadow-lg">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                Mencionar
              </div>
              {mentionCandidates.map((p, i) => (
                <button
                  type="button"
                  key={p.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(p);
                  }}
                  onMouseEnter={() => setMentionIndex(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    i === mentionIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold uppercase text-primary">
                    {p.name.slice(0, 2)}
                  </span>
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => handleBodyChange(e.target.value)}
            onKeyUp={(e) => {
              // re-check after caret moves
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                handleBodyChange(body);
              }
            }}
            placeholder="Escreva uma mensagem… use @ para mencionar"
            rows={2}
            className="min-h-[44px] resize-none"
            onKeyDown={(e) => {
              if (mentionQuery !== null && mentionCandidates.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex(
                    (i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length,
                  );
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  insertMention(mentionCandidates[mentionIndex]);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMentionQuery(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>
        <Button onClick={handleSend} disabled={busy} size="icon">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function renderBodyWithMentions(text: string, mine: boolean) {
  const parts: Array<string | { mention: string }> = [];
  const re = /(^|\s)@([\p{L}\p{N}._-]+(?:\s[\p{L}\p{N}._-]+){0,3})/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1].length;
    if (start > last) parts.push(text.slice(last, start));
    parts.push({ mention: m[2] });
    last = start + 1 + m[2].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <span
        key={i}
        className={`rounded px-1 font-medium ${
          mine ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"
        }`}
      >
        @{p.mention}
      </span>
    ),
  );
}

function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  const [openTask, setOpenTask] = useState(false);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {!mine && (
          <span className="px-2 text-xs font-medium text-muted-foreground">
            {message.author_name}
          </span>
        )}
        <div
          className={`group relative rounded-2xl px-3 py-2 text-sm ${
            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          {message.body && (
            <div className="whitespace-pre-wrap break-words">{renderBodyWithMentions(message.body, mine)}</div>
          )}
          {message.attachments?.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {message.attachments.map((a, i) => (
                <AttachmentChip key={i} att={a} />
              ))}
            </div>
          )}
          <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {new Date(message.created_at).toLocaleString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })}
          </div>
          <button
            type="button"
            onClick={() => setOpenTask(true)}
            className="absolute -top-2 -right-2 hidden rounded-full border bg-background p-1 text-foreground shadow-sm group-hover:block"
            title="Virar tarefa"
          >
            <ClipboardCheck className="h-3 w-3" />
          </button>
        </div>
      </div>
      <CreateTaskDialog open={openTask} onClose={() => setOpenTask(false)} message={message} />
    </div>
  );
}

function AttachmentChip({ att }: { att: { path: string; filename: string; mime?: string } }) {
  const [url, setUrl] = useState<string | null>(null);

  async function open() {
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    const { data, error } = await supabase.storage.from("documents").download(att.path);
    if (error || !data) {
      toast.error("Falha ao abrir anexo");
      return;
    }
    const blobUrl = URL.createObjectURL(data);
    setUrl(blobUrl);
    window.open(blobUrl, "_blank", "noopener");
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-2 rounded-md border border-current/20 bg-background/60 px-2 py-1 text-xs text-foreground hover:bg-background"
    >
      <FileText className="h-3 w-3" />
      <span className="truncate">{att.filename}</span>
    </button>
  );
}

function CreateTaskDialog({
  open,
  onClose,
  message,
}: {
  open: boolean;
  onClose: () => void;
  message: Message;
}) {
  const createTaskFn = useServerFn(createTaskFromMessage);
  const listParticipantsFn = useServerFn(listConversationParticipants);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: participants = [] } = useQuery({
    queryKey: ["conversation-participants", message.conversation_id],
    queryFn: () =>
      listParticipantsFn({ data: { conversation_id: message.conversation_id } }),
    enabled: open,
  });
  const participantList = participants as Array<{ id: string; name: string }>;

  const defaultTitle = useMemo(
    () => (message.body || "Tarefa da conversa").slice(0, 80),
    [message.body],
  );

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setDescription(message.body || "");
    }
  }, [open, defaultTitle, message.body]);

  // mention autocomplete shared between title + description
  const [mentionTarget, setMentionTarget] = useState<"title" | "desc" | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const candidates = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    return participantList.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [participantList, mentionQuery]);

  function detectMention(value: string, caret: number, which: "title" | "desc") {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([\p{L}0-9._-]*)$/u);
    if (m) {
      setMentionTarget(which);
      setMentionQuery(m[1] ?? "");
      setMentionIndex(0);
    } else {
      setMentionTarget(null);
    }
  }

  function applyMention(p: { id: string; name: string }) {
    if (!mentionTarget) return;
    const ref = mentionTarget === "title" ? titleRef.current : descRef.current;
    const value = mentionTarget === "title" ? title : description;
    const setter = mentionTarget === "title" ? setTitle : setDescription;
    const caret = ref?.selectionStart ?? value.length;
    const before = value.slice(0, caret).replace(/@([\p{L}0-9._-]*)$/u, `@${p.name} `);
    const after = value.slice(caret);
    setter(before + after);
    setMentionTarget(null);
    setMentionQuery("");
    requestAnimationFrame(() => {
      ref?.focus();
      const pos = before.length;
      ref?.setSelectionRange(pos, pos);
    });
  }

  function resolveMentionIds(): string[] {
    const ids = new Set<string>();
    const text = `${title}\n${description}`;
    const byName = new Map(participantList.map((p) => [p.name.toLowerCase(), p.id]));
    const regex = /@([\p{L}0-9._\-\s]{1,60}?)(?=\s|$|[,.;:!?])/gu;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const candidate = match[1].trim().toLowerCase();
      // try longest match first by stripping trailing words
      const parts = candidate.split(/\s+/);
      for (let len = parts.length; len > 0; len--) {
        const key = parts.slice(0, len).join(" ");
        const id = byName.get(key);
        if (id) {
          ids.add(id);
          break;
        }
      }
    }
    return Array.from(ids);
  }

  async function submit() {
    setBusy(true);
    try {
      const mention_user_ids = resolveMentionIds();
      await createTaskFn({
        data: {
          message_id: message.id,
          title: title.trim() || defaultTitle,
          description: description || null,
          due_date: due || null,
          mention_user_ids,
        },
      });
      toast.success(
        mention_user_ids.length > 0
          ? `Tarefa criada e ${mention_user_ids.length} responsável(eis) notificado(s)`
          : "Tarefa criada",
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!mentionTarget || candidates.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      applyMention(candidates[mentionIndex]);
    } else if (e.key === "Escape") {
      setMentionTarget(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar tarefa a partir da mensagem</DialogTitle>
        </DialogHeader>
        <div className="relative space-y-3">
          <div>
            <Label>Título</Label>
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                detectMention(e.target.value, e.target.selectionStart ?? 0, "title");
              }}
              onKeyDown={handleKey}
              placeholder="Use @ para mencionar e notificar membros"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              ref={descRef}
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                detectMention(e.target.value, e.target.selectionStart ?? 0, "desc");
              }}
              onKeyDown={handleKey}
              placeholder="Detalhes (use @ para mencionar)"
            />
          </div>
          <div>
            <Label>Prazo (opcional)</Label>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>

          {mentionTarget && candidates.length > 0 && (
            <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
              {candidates.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMention(p);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                    idx === mentionIndex ? "bg-accent" : ""
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          )}

          <p className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
            Mensagem origem: {message.body || "(sem texto)"}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

