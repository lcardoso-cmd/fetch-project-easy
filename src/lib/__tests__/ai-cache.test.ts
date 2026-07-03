import { describe, it, expect } from "vitest";
import { shouldFallback, fallbackModel } from "../ai-cache";

describe("shouldFallback", () => {
  it("returns true for retryable HTTP statuses (408/425/429/500/502/503/504)", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(shouldFallback(new Error(`Chat falhou (${status}): boom`))).toBe(true);
    }
  });

  it("returns true for AI_LATENCY_TIMEOUT", () => {
    expect(shouldFallback(new Error("AI_LATENCY_TIMEOUT"))).toBe(true);
  });

  it("returns false for 4xx client errors that are not retryable", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(shouldFallback(new Error(`Chat falhou (${status}): boom`))).toBe(false);
    }
  });

  it("returns false for unknown errors without status", () => {
    expect(shouldFallback(new Error("something odd"))).toBe(false);
    expect(shouldFallback(null)).toBe(false);
    expect(shouldFallback(undefined)).toBe(false);
  });
});

describe("fallbackModel", () => {
  it("maps known models to cheaper alternatives", () => {
    expect(fallbackModel("google/gemini-2.5-flash")).toBe("google/gemini-2.5-flash-lite");
    expect(fallbackModel("openai/gpt-5")).toBe("openai/gpt-5-mini");
  });

  it("returns null for unknown models", () => {
    expect(fallbackModel("unknown/model")).toBeNull();
  });
});
