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
  editMessage,
  deleteMessage,
} from "@/lib/conversations.functions";
import {
  CONVERSATION_ATTACHMENT_BUCKET,
  CONVERSATION_ATTACHMENT_MAX_BYTES,
  initialsOf,
  resolveMentionIds,
} from "@/lib/conversation-utils";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Paperclip,
  Send,
  ClipboardCheck,
  X,
  FileText,
  Reply,
  Pencil,
  Trash2,
  CornerDownRight,
} from "lucide-react";
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
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_id: string | null;
  reply_to: { id: string; author_name: string; body: string } | null;
  tasks: Array<{ id: string; title: string; status: string }>;
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
  const editFn = useServerFn(editMessage);
  const deleteFn = useServerFn(deleteMessage);

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
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const [taskFor, setTaskFor] = useState<Message | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
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

  // Realtime: novas mensagens, edições e exclusões lógicas
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
    };
    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        invalidate,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    markReadFn({ data: { conversation_id: conversationId } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["my-conversations"] }))
      .catch(() => {});
  }, [conversationId, messages.length, markReadFn, queryClient]);

  async function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: Attachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > CONVERSATION_ATTACHMENT_MAX_BYTES) {
          toast.error(`${f.name} excede 25 MB`);
          continue;
        }
        const { path } = await uploadFn({
          data: { conversation_id: conversationId, filename: f.name, size: f.size },
        });
        const up = await supabase.storage
          .from(CONVERSATION_ATTACHMENT_BUCKET)
          .upload(path, f, { upsert: false });
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
      setMentionQuery(m[1] ?? "");
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
    setBody(replaced + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(replaced.length, replaced.length);
    });
  }

  async function handleSend() {
    if (editing) {
      await handleSaveEdit();
      return;
    }
    if (!body.trim() && pending.length === 0) return;
    setBusy(true);
    try {
      const result = await sendFn({
        data: {
          conversation_id: conversationId,
          body,
          attachments: pending,
          reply_to_id: replyTo?.id ?? null,
          mention_user_ids: resolveMentionIds(body, participantList),
        },
      });
      setBody("");
      setPending([]);
      setReplyTo(null);
      setMentionQuery(null);
      if ((result as { mentioned?: number }).mentioned) {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      }
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(m: Message) {
    setEditing(m);
    setReplyTo(null);
    setBody(m.body);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function handleSaveEdit() {
    if (!editing || !body.trim()) return;
    setBusy(true);
    try {
      await editFn({ data: { message_id: editing.id, body } });
      setEditing(null);
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao editar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(m: Message) {
    try {
      await deleteFn({ data: { message_id: m.id } });
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["my-conversations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col rounded-xl border bg-card">
      {(title || subtitle) && (
        <div className="border-b px-4 py-3">
          {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
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
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.author_id === user?.id}
              onReply={() => setReplyTo(m)}
              onEdit={() => startEdit(m)}
              onDelete={() => setConfirmDelete(m)}
              onTask={() => setTaskFor(m)}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      {(replyTo || editing) && (
        <div className="flex items-start gap-2 border-t bg-muted/40 px-3 py-2 text-xs">
          <CornerDownRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {editing ? "Editando sua mensagem" : `Respondendo a ${replyTo?.author_name}`}
            </p>
            <p className="truncate text-muted-foreground">
              {(editing ?? replyTo)?.body || "(anexo)"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => {
              if (editing) setBody("");
              setEditing(null);
              setReplyTo(null);
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t bg-muted/30 px-3 py-2">
          {pending.map((a, i) => (
            <span
              key={a.path}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"
            >
              <FileText className="h-3 w-3" />
              {a.filename}
              <button
                type="button"
                aria-label={`Remover ${a.filename}`}
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
          aria-label="Anexar arquivo"
          onClick={() => fileRef.current?.click()}
          disabled={busy || !!editing}
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
              <div className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
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
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {initialsOf(p.name)}
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
            placeholder="Escreva uma mensagem… use @ para mencionar"
            rows={2}
            aria-label="Mensagem"
            className="min-h-[44px] resize-none text-sm"
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
                  insertMention(mentionCandidates[mentionIndex]!);
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
        <Button
          onClick={handleSend}
          disabled={busy}
          size="icon"
          aria-label={editing ? "Salvar edição" : "Enviar mensagem"}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : editing ? (
            <Pencil className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover mensagem?</AlertDialogTitle>
            <AlertDialogDescription>
              A mensagem some do histórico visível e fica marcada como removida. Anexos vinculados
              deixam de ser exibidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {taskFor && (
        <CreateTaskDialog
          open={!!taskFor}
          onClose={() => setTaskFor(null)}
          message={taskFor}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        />
      )}
    </div>
  );
}

function renderBodyWithMentions(text: string, mine: boolean) {
  const parts: Array<string | { mention: string }> = [];
  const re = /(^|\s)@([\p{L}\p{N}._-]+(?:\s[\p{L}\p{N}._-]+){0,3})/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1]!.length;
    if (start > last) parts.push(text.slice(last, start));
    parts.push({ mention: m[2]! });
    last = start + 1 + m[2]!.length;
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

function MessageBubble({
  message,
  mine,
  onReply,
  onEdit,
  onDelete,
  onTask,
}: {
  message: Message;
  mine: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTask: () => void;
}) {
  const removed = !!message.deleted_at;

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[85%] flex-col gap-1 sm:max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
        {!mine && (
          <span className="px-2 text-xs font-medium text-muted-foreground">
            {message.author_name}
          </span>
        )}
        <div
          className={`group relative rounded-2xl px-3 py-2 text-sm ${
            removed
              ? "border border-dashed bg-muted/40 text-muted-foreground"
              : mine
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
          }`}
        >
          {message.reply_to && !removed && (
            <div
              className={`mb-1.5 rounded-md border-l-2 px-2 py-1 text-xs ${
                mine
                  ? "border-primary-foreground/50 bg-primary-foreground/10"
                  : "border-primary/40 bg-background/60"
              }`}
            >
              <span className="font-medium">{message.reply_to.author_name}</span>
              <p className="truncate opacity-80">{message.reply_to.body || "(anexo)"}</p>
            </div>
          )}

          {removed ? (
            <em className="text-xs">Mensagem removida pelo autor</em>
          ) : (
            message.body && (
              <div className="whitespace-pre-wrap break-words">
                {renderBodyWithMentions(message.body, mine)}
              </div>
            )
          )}

          {!removed && message.attachments?.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {message.attachments.map((a) => (
                <AttachmentChip key={a.path} att={a} />
              ))}
            </div>
          )}

          {message.tasks?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.tasks.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-md border border-current/20 bg-background/70 px-2 py-0.5 text-xs text-foreground"
                >
                  <ClipboardCheck className="h-3 w-3" />
                  <span className="max-w-[160px] truncate">{t.title}</span>
                </span>
              ))}
            </div>
          )}

          <div
            className={`mt-1 text-[11px] ${
              mine && !removed ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {new Date(message.created_at).toLocaleString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })}
            {message.edited_at && !removed && " · editada"}
          </div>

          {!removed && (
            <div className="absolute -top-3 right-1 hidden items-center gap-1 rounded-full border bg-background px-1 py-0.5 shadow-sm group-hover:flex">
              <IconAction label="Responder" onClick={onReply}>
                <Reply className="h-3.5 w-3.5" />
              </IconAction>
              <IconAction label="Virar tarefa" onClick={onTask}>
                <ClipboardCheck className="h-3.5 w-3.5" />
              </IconAction>
              {mine && (
                <>
                  <IconAction label="Editar" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </IconAction>
                  <IconAction label="Remover" onClick={onDelete}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </IconAction>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-full p-1 text-foreground hover:bg-muted"
    >
      {children}
    </button>
  );
}

function AttachmentChip({ att }: { att: { path: string; filename: string; mime?: string } }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from(CONVERSATION_ATTACHMENT_BUCKET)
        .createSignedUrl(att.path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("Sem URL");
      window.open(data.signedUrl, "_blank", "noopener");
    } catch {
      toast.error("Falha ao abrir anexo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-md border border-current/20 bg-background/60 px-2 py-1 text-xs text-foreground hover:bg-background"
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
      <span className="max-w-[220px] truncate">{att.filename}</span>
    </button>
  );
}

function CreateTaskDialog({
  open,
  onClose,
  message,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  message: Message;
  onCreated: () => void;
}) {
  const createTaskFn = useServerFn(createTaskFromMessage);
  const listParticipantsFn = useServerFn(listConversationParticipants);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: participants = [] } = useQuery({
    queryKey: ["conversation-participants", message.conversation_id],
    queryFn: () => listParticipantsFn({ data: { conversation_id: message.conversation_id } }),
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
      setAssignee("");
      setDue("");
    }
  }, [open, defaultTitle, message.body]);

  async function submit() {
    setBusy(true);
    try {
      const mention_user_ids = resolveMentionIds(`${title}\n${description}`, participantList);
      await createTaskFn({
        data: {
          message_id: message.id,
          title: title.trim() || defaultTitle,
          description: description || null,
          due_date: due || null,
          assigned_to_user_id: assignee || null,
          mention_user_ids,
        },
      });
      toast.success("Tarefa criada e visível no Kanban");
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar tarefa");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar tarefa a partir da mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="task-title">Título</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes (use @ para mencionar participantes)"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="task-due">Prazo (opcional)</Label>
              <Input
                id="task-due"
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="task-assignee">Responsável</Label>
              <select
                id="task-assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sem responsável</option>
                {participantList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
