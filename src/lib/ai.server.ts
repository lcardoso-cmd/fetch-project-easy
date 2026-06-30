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
