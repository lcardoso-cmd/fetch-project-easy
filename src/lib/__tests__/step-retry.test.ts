import { describe, expect, it } from "vitest";
import {
  backoffDelay,
  describeStepFailure,
  isRetryableError,
  withStepRetry,
  type StepAttemptFailure,
} from "@/lib/rag/step-retry";

const noSleep = async () => {};

describe("step-retry", () => {
  it("repete etapas transitórias até obter sucesso", async () => {
    let calls = 0;
    const out = await withStepRetry(
      "ocr",
      async () => {
        calls++;
        if (calls < 3) throw new Error("timeout na leitura");
        return "ok";
      },
      { sleep: noSleep },
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });

  it("não repete falhas permanentes", async () => {
    let calls = 0;
    const failures: StepAttemptFailure[] = [];
    await expect(
      withStepRetry(
        "parse",
        async () => {
          calls++;
          throw new Error("Formato não suportado");
        },
        { sleep: noSleep, onAttemptFailed: (i) => void failures.push(i) },
      ),
    ).rejects.toThrow(/não suportado/i);
    expect(calls).toBe(1);
    expect(failures[0]?.willRetry).toBe(false);
  });

  it("reporta motivo em cada tentativa e desiste ao esgotar", async () => {
    const failures: StepAttemptFailure[] = [];
    await expect(
      withStepRetry("embedding", async () => Promise.reject(new Error("rede instável")), {
        attempts: 3,
        sleep: noSleep,
        onAttemptFailed: (i) => void failures.push(i),
      }),
    ).rejects.toThrow("rede instável");
    expect(failures.map((f) => f.attempt)).toEqual([1, 2, 3]);
    expect(failures.at(-1)?.willRetry).toBe(false);
    expect(failures[0]!.reason).toBe("rede instável");
  });

  it("classifica erros e calcula espera crescente", () => {
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("Payment Required"))).toBe(false);
    expect(backoffDelay(1, 1000, 10_000)).toBe(1000);
    expect(backoffDelay(3, 1000, 10_000)).toBe(4000);
    expect(backoffDelay(9, 1000, 10_000)).toBe(10_000);
  });

  it("descreve a falha em linguagem do usuário", () => {
    const msg = describeStepFailure({
      step: "ocr",
      attempt: 1,
      attempts: 3,
      willRetry: true,
      delayMs: 1000,
      reason: "tempo esgotado",
    });
    expect(msg).toContain("ler as imagens (OCR)");
    expect(msg).toContain("tentativa 1 de 3");
    expect(msg).toContain("Tentando novamente");
  });
});
