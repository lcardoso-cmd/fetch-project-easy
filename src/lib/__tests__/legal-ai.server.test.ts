import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ai-usage.server", () => ({
  assertAiBudget: vi.fn(async () => {}),
  getAiLimitsForCurrentUser: vi.fn(async () => ({
    maxTokens: 4096,
    maxContextChars: 120000,
    maxRetries: 0,
    forceFallback: false,
  })),
  logAiUsage: vi.fn(async () => {}),
}));
vi.mock("../ai-session-log.server", () => ({ logSessionEvent: vi.fn(async () => {}) }));

process.env.LOVABLE_API_KEY = "test-key";

import { LEGAL_MODEL, legalChatStream, removeNullArguments } from "../legal-ai.server";

function streamResponse(events: unknown[], status = 200) {
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/event-stream", "X-Lovable-AIG-Run-ID": "run-test" },
  });
}

beforeEach(() => vi.unstubAllGlobals());

describe("legalChatStream", () => {
  it("usa Responses API, Astra e transmite resposta e resumo", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => streamResponse([
      { type: "response.reasoning_summary_text.delta", delta: "Verifiquei as fontes." },
      { type: "response.output_text.delta", delta: "Resposta jurídica." },
      { type: "response.completed", response: { usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 }, output: [] } },
    ]));
    vi.stubGlobal("fetch", fetchMock);
    let answer = "";
    let reasoning = "";
    const result = await legalChatStream([{ role: "user", content: "Analise." }], {
      depth: "balanced",
      onDelta: (text) => { answer += text; },
      onReasoningDelta: (text) => { reasoning += text; },
    });
    const [url, init] = fetchMock.mock.calls[0];
    const requestBody = JSON.parse(String(init.body));
    expect(url).toContain("/v1/responses");
    expect(requestBody.model).toBe(LEGAL_MODEL);
    expect(requestBody.temperature).toBeUndefined();
    expect(requestBody.store).toBe(false);
    expect(requestBody.reasoning.effort).toBe("medium");
    expect(answer).toBe("Resposta jurídica.");
    expect(reasoning).toBe("Verifiquei as fontes.");
    expect(result.runId).toBe("run-test");
  });

  it("não repete erro terminal 400", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { message: "modelo inválido" } }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(legalChatStream([{ role: "user", content: "Oi" }], { depth: "fast" }))
      .rejects.toThrow("modelo inválido");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("removeNullArguments", () => {
  it("remove campos nulos produzidos pelos schemas estritos", () => {
    expect(removeNullArguments({ title: "Prazo", ends_at: null, nested: { value: null, ok: true } }))
      .toEqual({ title: "Prazo", nested: { ok: true } });
  });
});