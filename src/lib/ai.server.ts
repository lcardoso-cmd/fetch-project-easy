// Server-only helpers para chamar o Lovable AI Gateway.
// Endpoint OpenAI-compatible em https://ai.gateway.lovable.dev/v1
// Usa LOVABLE_API_KEY (já configurada como secret no projeto).

const AI_BASE = "https://ai.gateway.lovable.dev/v1";

function apiKey() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  return key;
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const res = await fetch(`${AI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: inputs,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Embeddings falhou (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
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
  opts: { model?: string; temperature?: number; tools?: ToolDef[] } = {},
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-2.5-flash",
    messages,
    temperature: opts.temperature ?? 0.3,
  };
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Chat falhou (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as {
    choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[];
  };
  const msg = json.choices[0]?.message;
  return { content: msg?.content ?? "", tool_calls: msg?.tool_calls };
}

/**
 * Streaming chat completion (SSE). Chama onDelta a cada pedaço de texto.
 * Retorna o conteúdo completo agregado + tool_calls acumulados (se houver).
 */
export async function chatCompleteStream(
  messages: ChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    tools?: ToolDef[];
    onDelta?: (delta: string) => void;
    signal?: AbortSignal;
  } = {},
): Promise<{ content: string; tool_calls?: ToolCall[] }> {
  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-2.5-flash",
    messages,
    temperature: opts.temperature ?? 0.3,
    stream: true,
  };
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;

  const res = await fetch(`${AI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Chat stream falhou (${res.status}): ${txt}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCallsByIndex = new Map<
    number,
    { id?: string; name?: string; arguments: string }
  >();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
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
      };
      try {
        chunk = JSON.parse(payload);
      } catch {
        continue;
      }
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
