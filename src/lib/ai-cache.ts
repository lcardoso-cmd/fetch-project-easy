// Server-only utilities: LRU response cache + fallback map for chat completions.
// - Cache: chaveia por hash(model, messages, temperature, tools) e devolve resposta pronta.
// - Fallback: mapa de modelo→modelo mais barato usado em 429/5xx/timeout.

import { createHash } from "crypto";

import type { ChatMessage, ToolCall, ToolDef } from "./ai.server";

export interface CachedResponse {
  content: string;
  tool_calls?: ToolCall[];
  model: string;
}

interface CacheEntry {
  value: CachedResponse;
  expiresAt: number;
}

const MAX_ENTRIES = 200;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 min
const store = new Map<string, CacheEntry>();

export interface CacheKeyInput {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  tools?: ToolDef[];
}

/** Determinístico: só cacheia quando o resultado tende a se repetir. */
export function isCacheable(input: CacheKeyInput): boolean {
  const temp = input.temperature ?? 0.3;
  if (temp > 0.4) return false;
  if (input.tools && input.tools.length > 0) return false;
  // Não cachear mensagens muito longas (custo de memória)
  const totalChars = input.messages.reduce((n, m) => {
    if (typeof m.content === "string") return n + m.content.length;
    return n + JSON.stringify(m.content ?? "").length;
  }, 0);
  return totalChars < 40_000;
}

export function cacheKey(input: CacheKeyInput): string {
  const payload = JSON.stringify({
    model: input.model,
    temperature: input.temperature ?? 0.3,
    tools: input.tools ?? null,
    messages: input.messages,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function getCached(key: string): CachedResponse | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  // LRU: reinsere no fim
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

export function setCached(key: string, value: CachedResponse, ttlMs = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Mapa modelo→fallback mais barato/rápido. Sem entrada = sem fallback. */
const FALLBACK: Record<string, string> = {
  "google/gemini-3-flash-preview": "google/gemini-2.5-flash-lite",
  "google/gemini-3.1-pro-preview": "google/gemini-2.5-flash",
  "google/gemini-3.5-flash": "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro": "google/gemini-2.5-flash",
  "google/gemini-2.5-flash": "google/gemini-2.5-flash-lite",
  "openai/gpt-5": "openai/gpt-5-mini",
  "openai/gpt-5-mini": "openai/gpt-5-nano",
  "openai/gpt-5.5": "openai/gpt-5.4-mini",
  "openai/gpt-5.4": "openai/gpt-5.4-mini",
  "openai/gpt-5.4-mini": "openai/gpt-5.4-nano",
  "openai/gpt-5.2": "openai/gpt-5-mini",
};

export function fallbackModel(model: string): string | null {
  return FALLBACK[model] ?? null;
}

/** Erros/latência que autorizam fallback. */
export function shouldFallback(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = err instanceof Error ? err.message : String(err);
  if (/AI_LATENCY_TIMEOUT/.test(msg)) return true;
  const m = msg.match(/\((\d{3})\)/);
  if (!m) return false;
  const status = Number(m[1]);
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Timeout padrão (ms) antes de acionar fallback em chamadas não-stream. */
export const DEFAULT_LATENCY_TIMEOUT_MS = 25_000;
/** Timeout até o primeiro byte para chamadas em streaming. */
export const DEFAULT_STREAM_TTFB_MS = 12_000;
