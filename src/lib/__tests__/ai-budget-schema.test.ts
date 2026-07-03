import { describe, it, expect } from "vitest";
import {
  AI_BUDGET_LIMITS,
  AiBudgetPayloadSchema,
  encodeValidationError,
  toFieldErrors,
  tryDecodeValidationError,
} from "@/lib/ai-budget-schema";

const L = AI_BUDGET_LIMITS;

const valid = {
  monthly_limit_usd: 25,
  warn_threshold_pct: 80,
  max_tokens: 2000,
  max_context_chars: 32000,
  max_retries: 2,
  force_fallback_on_retry: false,
};

describe("AiBudgetPayloadSchema", () => {
  it("accepts a valid payload", () => {
    expect(AiBudgetPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a payload without optional fields", () => {
    const { monthly_limit_usd, warn_threshold_pct } = valid;
    const res = AiBudgetPayloadSchema.safeParse({
      monthly_limit_usd,
      warn_threshold_pct,
    });
    expect(res.success).toBe(true);
  });

  it.each([
    ["monthly_limit_usd", -1],
    ["monthly_limit_usd", L.limit.max + 1],
    ["warn_threshold_pct", 0],
    ["warn_threshold_pct", 150],
    ["warn_threshold_pct", 50.5], // non-integer
    ["max_tokens", -1],
    ["max_tokens", L.maxTokens.max + 1],
    ["max_context_chars", L.maxCtx.max + 1],
    ["max_retries", 6],
    ["max_retries", -1],
  ])("rejects invalid %s = %s", (field, value) => {
    const res = AiBudgetPayloadSchema.safeParse({ ...valid, [field]: value });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path[0] === field)).toBe(true);
    }
  });

  it("rejects wrong type for required field with a helpful message", () => {
    const res = AiBudgetPayloadSchema.safeParse({
      ...valid,
      monthly_limit_usd: "abc" as unknown as number,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find(
        (i) => i.path[0] === "monthly_limit_usd",
      )!;
      expect(issue.message).toContain(L.limit.label);
    }
  });
});

describe("toFieldErrors", () => {
  it("maps payload keys to form field keys", () => {
    const res = AiBudgetPayloadSchema.safeParse({
      monthly_limit_usd: -5,
      warn_threshold_pct: 200,
      max_retries: 99,
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const err = toFieldErrors(res.error);
    expect(err.code).toBe("VALIDATION");
    expect(err.fieldErrors.limit).toBeTruthy();
    expect(err.fieldErrors.warn).toBeTruthy();
    expect(err.fieldErrors.maxRetries).toBeTruthy();
    // must NOT keep raw payload keys
    expect(err.fieldErrors.monthly_limit_usd).toBeUndefined();
    expect(err.fieldErrors.warn_threshold_pct).toBeUndefined();
  });

  it("keeps the first issue per field", () => {
    const res = AiBudgetPayloadSchema.safeParse({
      monthly_limit_usd: L.limit.max + 10,
      warn_threshold_pct: 50,
    });
    if (res.success) throw new Error("expected failure");
    const err = toFieldErrors(res.error);
    expect(Object.keys(err.fieldErrors)).toEqual(["limit"]);
  });
});

describe("encode/tryDecodeValidationError", () => {
  it("roundtrips a structured error", () => {
    const original = {
      code: "VALIDATION" as const,
      message: "Corrija os campos destacados antes de salvar.",
      fieldErrors: { limit: "Use um valor entre 0 e 100000." },
    };
    const encoded = encodeValidationError(original);
    expect(encoded.startsWith("AI_BUDGET_VALIDATION::")).toBe(true);
    expect(tryDecodeValidationError(encoded)).toEqual(original);
  });

  it("returns null for unrelated messages", () => {
    expect(tryDecodeValidationError("Network error")).toBeNull();
    expect(tryDecodeValidationError("AI_BUDGET_VALIDATION::not-json")).toBeNull();
  });

  it("simulates the full server → client flow", () => {
    // Server side
    const parsed = AiBudgetPayloadSchema.safeParse({
      monthly_limit_usd: -1,
      warn_threshold_pct: 80,
    });
    if (parsed.success) throw new Error("expected failure");
    const encoded = encodeValidationError(toFieldErrors(parsed.error));

    // Client side receives it as Error.message
    const decoded = tryDecodeValidationError(encoded);
    expect(decoded?.fieldErrors.limit).toBeTruthy();
  });
});
