/**
 * Utilitários puros do módulo de comunicação interna.
 * Ficam separados das Server Functions para poderem ser testados
 * sem banco e reutilizados no cliente.
 */

export type ConversationKind = "general" | "case" | "dm";

export const CONVERSATION_KINDS: ConversationKind[] = ["general", "case", "dm"];

/**
 * Chave normalizada de uma conversa direta: os dois IDs ordenados.
 * Garante unicidade independente de quem iniciou a conversa.
 */
export function dmKey(a: string, b: string): string {
  if (a === b) throw new Error("Uma mensagem direta exige duas pessoas distintas.");
  return [a, b].sort().join(":");
}

/** Iniciais para avatares (máx. 2 letras). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Resolve os IDs mencionados em um texto a partir da lista de participantes.
 * Aceita nomes compostos (`@Maria Silva`) e ignora menções desconhecidas —
 * o servidor revalida se o usuário realmente participa da conversa.
 */
export function resolveMentionIds(
  text: string,
  participants: Array<{ id: string; name: string }>,
): string[] {
  const byName = new Map(participants.map((p) => [p.name.toLowerCase(), p.id]));
  const ids = new Set<string>();
  const regex = /@([\p{L}\p{N}._-]+(?:[ \t][\p{L}\p{N}._-]+){0,3})/gu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const words = match[1]!.trim().split(/\s+/);
    for (let len = words.length; len > 0; len--) {
      const id = byName.get(words.slice(0, len).join(" ").toLowerCase());
      if (id) {
        ids.add(id);
        break;
      }
    }
  }
  return Array.from(ids);
}

/** Rótulo exibido para uma conversa, conforme o tipo. */
export function conversationLabel(conv: {
  kind: ConversationKind;
  title: string | null;
  case_title?: string | null;
  other_name?: string | null;
}): string {
  if (conv.kind === "general") return conv.title?.trim() || "Canal geral";
  if (conv.kind === "case") return conv.case_title?.trim() || conv.title?.trim() || "Caso";
  return conv.other_name?.trim() || "Mensagem direta";
}

/** Texto exibido em uma mensagem (respeitando exclusão lógica). */
export function messagePreview(msg: {
  body: string;
  deleted_at?: string | null;
  attachments?: unknown[];
}): string {
  if (msg.deleted_at) return "Mensagem removida";
  const body = msg.body?.trim();
  if (body) return body;
  const count = msg.attachments?.length ?? 0;
  return count > 0 ? `${count} anexo(s)` : "(sem conteúdo)";
}

/** Caminho seguro do anexo dentro do bucket privado de conversas. */
export function attachmentPath(
  organizationId: string,
  conversationId: string,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `${organizationId}/${conversationId}/${Date.now()}_${safe}`;
}

export const CONVERSATION_ATTACHMENT_BUCKET = "conversation-files";
export const CONVERSATION_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
