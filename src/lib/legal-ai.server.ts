import { assertAiBudget, getAiLimitsForCurrentUser, logAiUsage, type RawUsage } from "./ai-usage.server";
import { logSessionEvent } from "./ai-session-log.server";
import type { ChatMessage, ToolCall, ToolDef } from "./ai.server";

const RESPONSES_URL = "https://ai.gateway.lovable.dev/v1/responses";
export const LEGAL_MODEL = "openai/gpt-6-astra";

export type LegalDepth = "fast" | "balanced" | "max";
export type ReasoningEffort = "low" | "medium" | "high";

export class AiGatewayError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly requires?: "top_up" | "admin_action",
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

function apiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new AiGatewayError(401, "O serviço de IA não está configurado.");
  return key;
}

function effortFor(depth: LegalDepth): ReasoningEffort {
  if (depth === "fast") return "low";
  if (depth === "max") return "high";
  return "medium";
}

function summaryFor(depth: LegalDepth): "concise" | "auto" | "detailed" {
  if (depth === "fast") return "concise";
  if (depth === "max") return "detailed";
  return "auto";
}

function messageSize(message: ChatMessage) {
  return typeof message.content === "string"
    ? message.content.length
    : JSON.stringify(message.content ?? "").length;
}

function trimContext(messages: ChatMessage[], maxChars: number) {
  const charsBefore = messages.reduce((sum, message) => sum + messageSize(message), 0);
  if (!maxChars || charsBefore <= maxChars) {
    return { messages, charsBefore, charsAfter: charsBefore, removed: 0 };
  }
  const leading = messages[0]?.role === "system" ? [messages[0]] : [];
  const rest = leading.length ? messages.slice(1) : messages;
  const kept: ChatMessage[] = [];
  let used = leading.reduce((sum, message) => sum + messageSize(message), 0);
  for (let index = rest.length - 1; index >= 0; index -= 1) {
    const size = messageSize(rest[index]);
    if (used + size > maxChars) break;
    kept.unshift(rest[index]);
    used += size;
  }
  const removed = rest.length - kept.length;
  if (removed > 0) {
    const marker: ChatMessage = {
      role: "system",
      content: `Há ${removed} mensagem(ns) anteriores fora da janela ativa. Use apenas o histórico recente e os dados verificados do caso.`,
    };
    kept.unshift(marker);
    used += messageSize(marker);
  }
  return { messages: [...leading, ...kept], charsBefore, charsAfter: used, removed };
}

function nullableSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const type = schema.type;
  if (typeof type === "string") return { ...schema, type: [type, "null"] };
  if (Array.isArray(type) && !type.includes("null")) return { ...schema, type: [...type, "null"] };
  return schema;
}

function strictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema.type === "array" && schema.items && typeof schema.items === "object") {
    return { ...schema, items: strictSchema(schema.items as Record<string, unknown>) };
  }
  if (schema.type !== "object") return { ...schema };
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const originallyRequired = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  const normalized = Object.fromEntries(
    Object.entries(properties).map(([name, child]) => {
      const next = strictSchema(child);
      return [name, originallyRequired.has(name) ? next : nullableSchema(next)];
    }),
  );
  return {
    ...schema,
    properties: normalized,
    required: Object.keys(normalized),
    additionalProperties: false,
  };
}

function hasOpenObject(schema: Record<string, unknown>): boolean {
  if (schema.type === "object") {
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    if (Object.keys(properties).length === 0 && schema.additionalProperties !== false) return true;
    return Object.values(properties).some(hasOpenObject);
  }
  if (schema.type === "array" && schema.items && typeof schema.items === "object") {
    return hasOpenObject(schema.items as Record<string, unknown>);
  }
  return false;
}

function responseTools(tools: ToolDef[]) {
  return tools.map((tool) => {
    const parameters = tool.function.parameters;
    const strict = !hasOpenObject(parameters);
    return {
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      parameters: strict ? strictSchema(parameters) : parameters,
      strict,
    };
  });
}

function responseInput(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = [];
  for (const message of messages) {
    if (message.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id,
        output: typeof message.content === "string" ? message.content : JSON.stringify(message.content),
      });
      continue;
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      if (message.content) {
        input.push({ role: "assistant", content: [{ type: "output_text", text: message.content }] });
      }
      for (const call of message.tool_calls) {
        input.push({
          type: "function_call",
          call_id: call.id,
          name: call.function.name,
          arguments: call.function.arguments,
        });
      }
      continue;
    }
    const role = message.role === "system" ? "developer" : message.role;
    if (Array.isArray(message.content)) {
      const content = message.content.map((part) => {
        if (part.type === "text") return { type: "input_text", text: part.text };
        if (part.type === "image_url") {
          const value = part.image_url as { url?: string } | undefined;
          return { type: "input_image", image_url: value?.url };
        }
        return part;
      });
      input.push({ role, content });
    } else {
      input.push({ role, content: [{ type: role === "assistant" ? "output_text" : "input_text", text: message.content ?? "" }] });
    }
  }
  return input;
}

async function gatewayError(response: Response) {
  const text = await response.text().catch(() => "");
  let message = text || `Falha no serviço de IA (${response.status}).`;
  let requires: "top_up" | "admin_action" | undefined;
  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      error?: { message?: string; props?: { requires?: "top_up" | "admin_action" } };
      props?: { requires?: "top_up" | "admin_action" };
    };
    message = parsed.error?.message ?? parsed.message ?? message;
    requires = parsed.error?.props?.requires ?? parsed.props?.requires;
  } catch {
    // O gateway pode responder texto simples.
  }
  if (response.status === 402 && requires === "top_up") {
    message = "Os créditos de IA do workspace acabaram. O proprietário precisa adicionar créditos para continuar.";
  } else if (response.status === 403) {
    message = "O uso de IA está bloqueado para este workspace. Um administrador precisa revisar a configuração.";
  } else if (response.status === 401) {
    message = "O serviço de IA não está configurado corretamente.";
  }
  return new AiGatewayError(response.status, message, requires);
}

function retryDelay(response: Response, attempt: number) {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  return Math.min(8000, 750 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export async function legalChatStream(
  messages: ChatMessage[],
  opts: {
    depth: LegalDepth;
    tools?: ToolDef[];
    onDelta?: (text: string) => void;
    onReasoningDelta?: (text: string) => void;
    onRunId?: (runId: string) => void;
    signal?: AbortSignal;
    initialRunId?: string;
    feature?: string;
  },
): Promise<{ content: string; reasoning: string; tool_calls?: ToolCall[]; runId?: string }> {
  await assertAiBudget();
  const limits = await getAiLimitsForCurrentUser();
  const trimmed = trimContext(messages, limits.maxContextChars);
  if (trimmed.removed > 0) {
    await logSessionEvent({
      event_type: "context_truncated",
      model: LEGAL_MODEL,
      chars_before: trimmed.charsBefore,
      chars_after: trimmed.charsAfter,
      messages_truncated: trimmed.removed,
      reason: `limite de contexto ${limits.maxContextChars} caracteres`,
    });
  }

  const body: Record<string, unknown> = {
    model: LEGAL_MODEL,
    input: responseInput(trimmed.messages),
    stream: true,
    store: false,
    reasoning: { effort: effortFor(opts.depth), summary: summaryFor(opts.depth) },
    include: ["reasoning.encrypted_content"],
  };
  if (opts.tools?.length) body.tools = responseTools(opts.tools);

  const attempts = Math.max(1, Math.min(3, 1 + limits.maxRetries));
  let response: Response | null = null;
  let lastError: Error | null = null;
  let retriesUsed = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Lovable-API-Key": apiKey(),
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-Lovable-AIG-SDK": "fetch",
        ...(opts.initialRunId ? { "X-Lovable-AIG-Run-ID": opts.initialRunId } : {}),
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    const runId = response.headers.get("X-Lovable-AIG-Run-ID");
    if (runId) opts.onRunId?.(runId);
    if (response.ok && response.body) break;
    lastError = await gatewayError(response);
    if ((response.status !== 429 && response.status < 500) || attempt === attempts - 1) throw lastError;
    await sleep(retryDelay(response, attempt), opts.signal);
    retriesUsed += 1;
    response = null;
  }
  if (!response?.body) throw lastError ?? new Error("O serviço de IA não iniciou a resposta.");

  const startedAt = Date.now();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  let usage: RawUsage | undefined;
  const calls = new Map<string, ToolCall>();
  const processEvent = (raw: string) => {
    const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
    if (!dataLine) return;
    let event: Record<string, unknown>;
    try { event = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>; } catch { return; }
    const type = String(event.type ?? "");
    if (type === "response.output_text.delta") {
      const delta = String(event.delta ?? "");
      content += delta;
      opts.onDelta?.(delta);
    } else if (type === "response.reasoning_summary_text.delta") {
      const delta = String(event.delta ?? "");
      reasoning += delta;
      opts.onReasoningDelta?.(delta);
    } else if (type === "response.output_item.done") {
      const item = event.item as { type?: string; call_id?: string; name?: string; arguments?: string } | undefined;
      if (item?.type === "function_call" && item.call_id && item.name) {
        calls.set(item.call_id, { id: item.call_id, type: "function", function: { name: item.name, arguments: item.arguments ?? "{}" } });
      }
    } else if (type === "response.completed") {
      const completed = event.response as {
        usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
        output?: Array<{ type?: string; call_id?: string; name?: string; arguments?: string }>;
      } | undefined;
      usage = completed?.usage ? {
        prompt_tokens: completed.usage.input_tokens,
        completion_tokens: completed.usage.output_tokens,
        total_tokens: completed.usage.total_tokens,
      } : usage;
      for (const item of completed?.output ?? []) {
        if (item.type === "function_call" && item.call_id && item.name) {
          calls.set(item.call_id, { id: item.call_id, type: "function", function: { name: item.name, arguments: item.arguments ?? "{}" } });
        }
      }
    } else if (type === "error" || type === "response.failed") {
      const error = event.error as { message?: string } | undefined;
      throw new Error(error?.message ?? "A geração da resposta falhou.");
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator: number;
    while ((separator = buffer.indexOf("\n\n")) >= 0) {
      processEvent(buffer.slice(0, separator));
      buffer = buffer.slice(separator + 2);
    }
  }
  if (buffer.trim()) processEvent(buffer);
  const runId = response.headers.get("X-Lovable-AIG-Run-ID") ?? opts.initialRunId;
  await logAiUsage({
    feature: opts.feature,
    model: LEGAL_MODEL,
    usage,
    gatewayRunId: runId,
    applied: {
      max_tokens_applied: null,
      context_chars_before: trimmed.charsBefore,
      context_chars_after: trimmed.charsAfter,
      messages_truncated: trimmed.removed,
      retries_used: retriesUsed,
    },
  });
  await logSessionEvent({
    event_type: "chat_finish",
    model: LEGAL_MODEL,
    latency_ms: Date.now() - startedAt,
    payload: { streaming: true, depth: opts.depth, reasoning_chars: reasoning.length },
  });
  return { content, reasoning, tool_calls: calls.size ? Array.from(calls.values()) : undefined, runId };
}

export function removeNullArguments(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeNullArguments);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== null)
      .map(([key, child]) => [key, removeNullArguments(child)]),
  );
}

export async function legalChatWithTools(
  messages: ChatMessage[],
  tools: ToolDef[],
  executor: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  opts: { depth: LegalDepth; maxSteps?: number; feature?: string },
) {
  const conversation = [...messages];
  const steps: Array<{ name: string; args: unknown; result: unknown }> = [];
  const maxSteps = opts.maxSteps ?? 6;
  for (let index = 0; index < maxSteps; index += 1) {
    const response = await legalChatStream(conversation, {
      depth: opts.depth,
      tools,
      feature: opts.feature,
    });
    if (!response.tool_calls?.length) return { content: response.content, steps };
    conversation.push({ role: "assistant", content: response.content, tool_calls: response.tool_calls });
    for (const call of response.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = removeNullArguments(JSON.parse(call.function.arguments || "{}")) as Record<string, unknown>;
      } catch {
        args = {};
      }
      let result: unknown;
      try {
        result = await executor(call.function.name, args);
      } catch (error) {
        result = { error: error instanceof Error ? error.message : String(error) };
      }
      steps.push({ name: call.function.name, args, result });
      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      });
    }
  }
  const final = await legalChatStream(conversation, { depth: opts.depth, feature: opts.feature });
  return { content: final.content, steps };
}