/**
 * Testes de integração para `chatComplete`:
 * - Contexto grande (truncamento preservando system + últimas mensagens).
 * - 5 tentativas com fallback em 408/425/429/5xx.
 * - Timeout de latência dispara fallback.
 * - `forceFallback` troca de modelo em erro não-retentável.
 *
 * `fetch` global é mockado; toda a camada de budget/usage/log é mockada via `vi.mock`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---- mocks das dependências server-only ----
const limitsRef = {
  maxTokens: 0,
  maxContextChars: 0,
  maxRetries: 4, // → 1 tentativa inicial + 4 retries = 5 no total
  forceFallback: false,
};
vi.mock("../ai-usage.server", () => ({
  assertAiBudget: vi.fn(async () => {}),
  getAiLimitsForCurrentUser: vi.fn(async () => ({ ...limitsRef })),
  logAiUsage: vi.fn(async () => {}),
}));
vi.mock("../ai-session-log.server", () => ({
  logSessionEvent: vi.fn(async () => {}),
}));

// LOVABLE_API_KEY é lida dentro do handler
process.env.LOVABLE_API_KEY = "test-key";

import { chatComplete, type ChatMessage } from "../ai.server";

interface FetchCall {
  url: string;
  body: { model: string; messages: ChatMessage[]; max_tokens?: number };
}

function mockFetchSequence(
  responses: Array<
    | { status: number; body?: unknown; delayMs?: number }
    | ((call: FetchCall) => { status: number; body?: unknown; delayMs?: number })
  >,
) {
  const calls: FetchCall[] = [];
  let i = 0;
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const call: FetchCall = { url, body };
    calls.push(call);
    const spec = responses[Math.min(i, responses.length - 1)];
    i++;
    const resolved = typeof spec === "function" ? spec(call) : spec;
    if (resolved.delayMs) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, resolved.delayMs);
        (init.signal as AbortSignal | undefined)?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }
    const ok = resolved.status >= 200 && resolved.status < 300;
    return {
      ok,
      status: resolved.status,
      headers: { get: () => null },
      json: async () => resolved.body ?? {},
      text: async () =>
        typeof resolved.body === "string" ? resolved.body : JSON.stringify(resolved.body ?? ""),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

const okBody = (content: string) => ({
  choices: [{ message: { content, tool_calls: undefined } }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
});

beforeEach(() => {
  limitsRef.maxTokens = 0;
  limitsRef.maxContextChars = 0;
  limitsRef.maxRetries = 4;
  limitsRef.forceFallback = false;
  vi.unstubAllGlobals();
});

describe("chatComplete: truncamento de contexto", () => {
  it("preserva a mensagem system inicial e as últimas mensagens quando estoura maxContextChars", async () => {
    limitsRef.maxContextChars = 200;
    const messages: ChatMessage[] = [
      { role: "system", content: "SYSTEM_PROMPT" },
      ...Array.from({ length: 20 }, (_, k) => ({
        role: (k % 2 === 0 ? "user" : "assistant") as ChatMessage["role"],
        content: `msg-${k}-${"x".repeat(40)}`,
      })),
    ];
    const { calls } = mockFetchSequence([{ status: 200, body: okBody("ok") }]);
    const res = await chatComplete(messages, { model: "google/gemini-2.5-flash", noCache: true });
    expect(res.content).toBe("ok");
    const sent = calls[0].body.messages;
    // system inicial preservada
    expect(sent[0].role).toBe("system");
    expect(sent[0].content).toBe("SYSTEM_PROMPT");
    // marcador de omissão presente
    const marker = sent.find(
      (m) => m.role === "system" && String(m.content).includes("Contexto anterior omitido"),
    );
    expect(marker).toBeDefined();
    // últimas mensagens preservadas
    expect(String(sent[sent.length - 1].content)).toContain("msg-19");
    // realmente removeu mensagens
    expect(sent.length).toBeLessThan(messages.length);
  });

  it("não trunca quando maxContextChars = 0 (sem limite)", async () => {
    limitsRef.maxContextChars = 0;
    const messages: ChatMessage[] = Array.from({ length: 5 }, (_, k) => ({
      role: "user",
      content: `m${k}`,
    }));
    const { calls } = mockFetchSequence([{ status: 200, body: okBody("ok") }]);
    await chatComplete(messages, { noCache: true });
    expect(calls[0].body.messages).toHaveLength(5);
  });
});

describe("chatComplete: 5 tentativas com fallback", () => {
  it("faz até 5 chamadas totais (1 inicial + 4 retries), trocando de modelo em 429/5xx", async () => {
    limitsRef.maxRetries = 4;
    const { calls, fetchMock } = mockFetchSequence([
      { status: 429, body: "rate limited" },
      { status: 500, body: "boom" },
      { status: 503, body: "unavailable" },
      { status: 502, body: "bad gateway" },
      { status: 200, body: okBody("recovered") },
    ]);
    const res = await chatComplete([{ role: "user", content: "hi" }], {
      model: "google/gemini-2.5-flash",
      noCache: true,
    });
    expect(res.content).toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    // Após o primeiro erro, deve alternar para o fallback (gemini-2.5-flash-lite)
    expect(calls[0].body.model).toBe("google/gemini-2.5-flash");
    expect(calls[1].body.model).toBe("google/gemini-2.5-flash-lite");
  });

  it("propaga o último erro depois de esgotar 5 tentativas", async () => {
    limitsRef.maxRetries = 4;
    const { fetchMock } = mockFetchSequence([{ status: 429, body: "rate" }]);
    await expect(
      chatComplete([{ role: "user", content: "hi" }], {
        model: "google/gemini-2.5-flash",
        noCache: true,
      }),
    ).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("para imediatamente em erro não-retentável (400) sem consumir retries", async () => {
    limitsRef.maxRetries = 4;
    const { fetchMock } = mockFetchSequence([{ status: 400, body: "bad request" }]);
    await expect(
      chatComplete([{ role: "user", content: "hi" }], { noCache: true }),
    ).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aciona fallback também em 408 e 425", async () => {
    limitsRef.maxRetries = 2;
    const { calls, fetchMock } = mockFetchSequence([
      { status: 408, body: "timeout" },
      { status: 425, body: "too early" },
      { status: 200, body: okBody("done") },
    ]);
    const res = await chatComplete([{ role: "user", content: "hi" }], {
      model: "google/gemini-2.5-flash",
      noCache: true,
    });
    expect(res.content).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls[1].body.model).toBe("google/gemini-2.5-flash-lite");
  });
});

describe("chatComplete: timeout de latência", () => {
  it("aborta a requisição após latencyTimeoutMs e cai no fallback", async () => {
    limitsRef.maxRetries = 1;
    const { calls, fetchMock } = mockFetchSequence([
      { status: 200, body: okBody("late"), delayMs: 500 }, // primeira nunca completa
      { status: 200, body: okBody("fast") },
    ]);
    const res = await chatComplete([{ role: "user", content: "hi" }], {
      model: "google/gemini-2.5-flash",
      noCache: true,
      latencyTimeoutMs: 20,
    });
    expect(res.content).toBe("fast");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls[1].body.model).toBe("google/gemini-2.5-flash-lite");
  }, 10_000);
});

describe("chatComplete: forceFallback", () => {
  it("força fallback mesmo em erro normalmente não-retentável (400) quando o toggle está on", async () => {
    limitsRef.maxRetries = 2;
    limitsRef.forceFallback = true;
    const { calls, fetchMock } = mockFetchSequence([
      { status: 400, body: "bad" },
      { status: 200, body: okBody("recovered by force") },
    ]);
    const res = await chatComplete([{ role: "user", content: "hi" }], {
      model: "google/gemini-2.5-flash",
      noCache: true,
    });
    expect(res.content).toBe("recovered by force");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calls[1].body.model).toBe("google/gemini-2.5-flash-lite");
  });
});
