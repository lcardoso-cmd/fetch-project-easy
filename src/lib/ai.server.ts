// Server-only helpers para chamar o Lovable AI Gateway.
// Endpoint OpenAI-compatible em https://ai.gateway.lovable.dev/v1
// Usa LOVABLE_API_KEY (já configurada como secret no projeto).

import { logAiUsage, assertAiBudget, type RawUsage } from "./ai-usage.server";
import {
  cacheKey,
  fallbackModel,
  getCached,
  isCacheable,
  setCached,
  shouldFallback,
  DEFAULT_LATENCY_TIMEOUT_MS,
  DEFAULT_STREAM_TTFB_MS,
} from "./ai-cache";

const AI_BASE = "https://ai.gateway.lovable.dev/v1";

function apiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  return key;
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  await assertAiBudget();
  const model = "openai/text-embedding-3-small";
  const res = await fetch(`${AI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: inputs,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Embeddings falhou (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[]; usage?: RawUsage };
  const runId = res.headers.get("X-Lovable-AIG-Run-ID");
  await logAiUsage({ feature: "embeddings", model, usage: json.usage, gatewayRunId: runId });
  return json.data.map((d) => d.embedding);
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null | Array<Record<string, unknown>>;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export async function chatComplete(
  messages: ChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    tools?: ToolDef[];
    feature?: string;
    /** Desabilita cache (default: cacheável se determinístico e sem tools). */
    noCache?: boolean;
    /** Timeout de latência (ms) que dispara fallback para modelo mais barato. */
    latencyTimeoutMs?: number;
    /** Desativa fallback automático. */
    noFallback?: boolean;
  } = {},
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  await assertAiBudget();
  const model = opts.model ?? "google/gemini-2.5-flash";
  const temperature = opts.temperature ?? 0.3;
  const cacheable = !opts.noCache && isCacheable({ model, messages, temperature, tools: opts.tools });
  const key = cacheable ? cacheKey({ model, messages, temperature, tools: opts.tools }) : null;
  if (key) {
    const hit = getCached(key);
    if (hit) return { content: hit.content, tool_calls: hit.tool_calls };
  }

  const attempt = async (m: string): Promise<{ content: string; tool_calls?: ToolCall[] }> => {
    const body: Record<string, unknown> = {
      model: m,
      messages,
      temperature,
    };
    if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

    const controller = new AbortController();
    const timeoutMs = opts.latencyTimeoutMs ?? DEFAULT_LATENCY_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(new Error("AI_LATENCY_TIMEOUT")), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${AI_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e) {
      if (controller.signal.aborted) throw new Error("AI_LATENCY_TIMEOUT");
      throw e;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Chat falhou (${res.status}): ${txt}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
      usage?: RawUsage;
    };
    const runId = res.headers.get("X-Lovable-AIG-Run-ID");
    await logAiUsage({ feature: opts.feature, model: m, usage: json.usage, gatewayRunId: runId });
    const msg = json.choices[0]?.message;
    return { content: msg?.content ?? "", tool_calls: msg?.tool_calls };
  };

  let result: { content: string; tool_calls?: ToolCall[] };
  try {
    result = await attempt(model);
  } catch (err) {
    const fb = opts.noFallback ? null : fallbackModel(model);
    if (fb && shouldFallback(err)) {
      console.warn(`[ai] fallback ${model} → ${fb}:`, err instanceof Error ? err.message : err);
      result = await attempt(fb);
    } else {
      throw err;
    }
  }

  if (key) setCached(key, { content: result.content, tool_calls: result.tool_calls, model });
  return result;
}

/**
 * Streaming chat completion (SSE). Chama onDelta a cada pedaço de texto.
 * Retorna o conteúdo completo agregado + tool_calls acumulados (se houver).
 * - Se houver resposta em cache, faz replay via onDelta (mantendo streaming aparente).
 * - Fallback automático se a conexão falhar antes do primeiro token (não podemos
 *   duplicar tokens já enviados ao cliente).
 */
export async function chatCompleteStream(
  messages: ChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    tools?: ToolDef[];
    onDelta?: (delta: string) => void;
    signal?: AbortSignal;
    feature?: string;
    noCache?: boolean;
    noFallback?: boolean;
    /** TTFB máximo (ms) antes de considerar fallback. */
    ttfbTimeoutMs?: number;
  } = {},
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  await assertAiBudget();
  const model = opts.model ?? "google/gemini-2.5-flash";
  const temperature = opts.temperature ?? 0.3;

  // Cache replay
  const cacheable = !opts.noCache && isCacheable({ model, messages, temperature, tools: opts.tools });
  const key = cacheable ? cacheKey({ model, messages, temperature, tools: opts.tools }) : null;
  if (key) {
    const hit = getCached(key);
    if (hit) {
      // Replay em chunks curtos para simular streaming
      if (opts.onDelta && hit.content) {
        const step = 24;
        for (let i = 0; i < hit.content.length; i += step) {
          if (opts.signal?.aborted) break;
          opts.onDelta(hit.content.slice(i, i + step));
        }
      }
      return { content: hit.content, tool_calls: hit.tool_calls };
    }
  }

  const attempt = async (
    m: string,
    allowFallback: boolean,
  ): Promise<{ content: string; tool_calls?: ToolCall[] }> => {
    const body: Record<string, unknown> = {
      model: m,
      messages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

    // TTFB timeout controla apenas a abertura da conexão
    const ttfbCtrl = new AbortController();
    const ttfbMs = opts.ttfbTimeoutMs ?? DEFAULT_STREAM_TTFB_MS;
    const ttfbTimer = setTimeout(() => ttfbCtrl.abort(new Error("AI_LATENCY_TIMEOUT")), ttfbMs);
    const onExternalAbort = () => ttfbCtrl.abort();
    opts.signal?.addEventListener("abort", onExternalAbort);

    let res: Response;
    try {
      res = await fetch(`${AI_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: ttfbCtrl.signal,
      });
    } catch (e) {
      opts.signal?.removeEventListener("abort", onExternalAbort);
      clearTimeout(ttfbTimer);
      if (opts.signal?.aborted) throw e;
      if (ttfbCtrl.signal.aborted) {
        const err = new Error("AI_LATENCY_TIMEOUT");
        if (allowFallback) {
          const fb = fallbackModel(m);
          if (fb) {
            console.warn(`[ai] stream fallback ${m} → ${fb} (TTFB)`);
            return attempt(fb, false);
          }
        }
        throw err;
      }
      throw e;
    }
    clearTimeout(ttfbTimer);
    opts.signal?.removeEventListener("abort", onExternalAbort);

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      const err = new Error(`Chat stream falhou (${res.status}): ${txt}`);
      if (allowFallback && shouldFallback(err)) {
        const fb = fallbackModel(m);
        if (fb) {
          console.warn(`[ai] stream fallback ${m} → ${fb}:`, err.message);
          return attempt(fb, false);
        }
      }
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    let usage: RawUsage | undefined;
    const toolCallsByIndex = new Map<
      number,
      { id?: string; name?: string; arguments: string }
    >();

    // Do primeiro chunk em diante, cliente do usuário já pode estar recebendo tokens.
    // Se falhar mid-stream, não podemos retentar sem duplicar — apenas propagamos.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (opts.signal?.aborted) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf("\n")) !== -1) {
        const rawLine = buffer.slice(0, sep).replace(/\r$/, "");
        buffer = buffer.slice(sep + 1);
        if (!rawLine.startsWith("data:")) continue;
        const payload = rawLine.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let chunk: {
          choices?: Array<{
            delta?: {
              content?: string | null;
              tool_calls?: Array<{
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
          }>;
          usage?: RawUsage;
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue;
        }
        if (chunk.usage) usage = chunk.usage;
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;
        if (typeof delta.content === "string" && delta.content.length > 0) {
          content += delta.content;
          opts.onDelta?.(delta.content);
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const cur = toolCallsByIndex.get(tc.index) ?? { arguments: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.arguments += tc.function.arguments;
            toolCallsByIndex.set(tc.index, cur);
          }
        }
      }
    }

    const runId = res.headers.get("X-Lovable-AIG-Run-ID");
    await logAiUsage({ feature: opts.feature, model: m, usage, gatewayRunId: runId });

    const tool_calls: ToolCall[] = [];
    for (const [, v] of Array.from(toolCallsByIndex.entries()).sort((a, b) => a[0] - b[0])) {
      if (!v.name) continue;
      tool_calls.push({
        id: v.id ?? `call_${tool_calls.length}`,
        type: "function",
        function: { name: v.name, arguments: v.arguments || "{}" },
      });
    }
    return { content, tool_calls: tool_calls.length ? tool_calls : undefined };
  };

  const result = await attempt(model, !opts.noFallback);
  if (key && result.content && (!result.tool_calls || result.tool_calls.length === 0)) {
    setCached(key, { content: result.content, tool_calls: result.tool_calls, model });
  }
  return result;
}

/** Loop multi-step de tool calling. Para quando o modelo retorna texto sem tool_calls. */
export async function chatWithTools(
  messages: ChatMessage[],
  tools: ToolDef[],
  executor: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  opts: { model?: string; temperature?: number; maxSteps?: number } = {},
): Promise<{ content: string; steps: { name: string; args: unknown; result: unknown }[] }> {
  const convo: ChatMessage[] = [...messages];
  const steps: { name: string; args: unknown; result: unknown }[] = [];
  const max = opts.maxSteps ?? 5;

  for (let i = 0; i < max; i++) {
    const r = await chatComplete(convo, { ...opts, tools });
    if (!r.tool_calls || r.tool_calls.length === 0) {
      return { content: r.content, steps };
    }
    convo.push({ role: "assistant", content: r.content, tool_calls: r.tool_calls });
    for (const tc of r.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch {
        args = {};
      }
      let result: unknown;
      try {
        result = await executor(tc.function.name, args);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      steps.push({ name: tc.function.name, args, result });
      convo.push({
        role: "tool",
        tool_call_id: tc.id,
        name: tc.function.name,
        content: JSON.stringify(result),
      });
    }
  }
  // Última tentativa sem tools para forçar resposta final
  const final = await chatComplete(convo, opts);
  return { content: final.content, steps };
}

/** Quebra texto longo em chunks de ~targetChars com overlap. */
export function chunkText(text: string, targetChars = 1800, overlap = 200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= targetChars) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + targetChars, clean.length);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - overlap;
  }
  return chunks;
}

function u8ToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa disponível no runtime Workers/Node 20+
  return btoa(bin);
}

/**
 * OCR / transcrição multimodal de um PDF (inclusive escaneado) via Gemini.
 * Retorna o texto completo transcrito, preservando estrutura básica.
 */
export async function visionExtractPdf(pdfBytes: Uint8Array, filename: string): Promise<string> {
  // Limite defensivo (~20MB); a API do gateway tem um teto de payload.
  const MAX = 18 * 1024 * 1024;
  if (pdfBytes.byteLength > MAX) {
    throw new Error(
      `PDF muito grande para visão (${(pdfBytes.byteLength / 1024 / 1024).toFixed(1)}MB). Limite: 18MB.`,
    );
  }
  const b64 = u8ToBase64(pdfBytes);
  const dataUrl = `data:application/pdf;base64,${b64}`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Você é um OCR jurídico de altíssima precisão. Transcreva integralmente o conteúdo do PDF, página a página, preservando cabeçalhos, títulos, tabelas (em markdown) e assinaturas. Não resuma, não omita e não adicione comentários.",
    },
    {
      role: "user",
      content: [
        {
          type: "file",
          file: { filename, file_data: dataUrl },
        },
        {
          type: "text",
          text: `Transcreva TODO o conteúdo do arquivo "${filename}". Use "--- Página N ---" como separador entre páginas.`,
        },
      ],
    },
  ];

  const r = await chatComplete(messages, {
    model: "google/gemini-2.5-flash",
    temperature: 0,
  });
  return r.content ?? "";
}

/** Reescreve a pergunta do usuário em N variações + termos-chave para melhorar recall no RAG. */
export async function rewriteQuery(
  query: string,
  n = 3,
): Promise<{ queries: string[]; keywords: string[] }> {
  try {
    const r = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você reformula perguntas jurídicas para busca em documentos processuais. Responda SOMENTE em JSON válido.",
        },
        {
          role: "user",
          content: `Pergunta original: """${query}"""\n\nGere ${n} reformulações curtas e diretas (parafraseando com sinônimos jurídicos) e uma lista de palavras-chave (nomes, números de processo, artigos de lei, datas, valores). Formato: {"queries": ["...","..."], "keywords": ["..."]}`,
        },
      ],
      { model: "google/gemini-2.5-flash-lite", temperature: 0.2 },
    );
    const jsonStr = r.content.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed = JSON.parse(jsonStr) as { queries?: string[]; keywords?: string[] };
    return {
      queries: [query, ...(parsed.queries ?? [])].slice(0, n + 1),
      keywords: parsed.keywords ?? [],
    };
  } catch {
    return { queries: [query], keywords: [] };
  }
}

/** Reordena trechos por relevância à pergunta usando um modelo leve. */
export async function rerankChunks(
  query: string,
  candidates: { id: string; content: string }[],
  topK = 8,
): Promise<string[]> {
  if (candidates.length <= topK) return candidates.map((c) => c.id);
  try {
    const list = candidates
      .map((c, i) => `[${i}] ${c.content.slice(0, 400).replace(/\s+/g, " ")}`)
      .join("\n\n");
    const r = await chatComplete(
      [
        {
          role: "system",
          content:
            "Você é um reranker. Dada uma pergunta e trechos numerados, retorne SOMENTE um array JSON com os índices dos trechos mais relevantes, ordenados do mais para o menos relevante.",
        },
        {
          role: "user",
          content: `Pergunta: """${query}"""\n\nTrechos:\n${list}\n\nRetorne apenas os ${topK} melhores índices como JSON, ex: [3,1,7,0,...]`,
        },
      ],
      { model: "google/gemini-2.5-flash-lite", temperature: 0 },
    );
    const arr = JSON.parse(r.content.match(/\[[\s\S]*\]/)?.[0] ?? "[]") as number[];
    const ids = arr
      .filter((i) => Number.isInteger(i) && i >= 0 && i < candidates.length)
      .slice(0, topK)
      .map((i) => candidates[i].id);
    if (ids.length === 0) return candidates.slice(0, topK).map((c) => c.id);
    return ids;
  } catch {
    return candidates.slice(0, topK).map((c) => c.id);
  }
}
