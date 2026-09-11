import { describe, expect, it } from "vitest";
import { formatCnj, normalizeCnjExact } from "@/lib/case-tracking/process-search.server";

describe("process CNJ normalization", () => {
  it("normalizes and formats a valid CNJ number", () => {
    const digits = normalizeCnjExact("0021932-09.2019.8.19.0023");
    expect(digits).toBe("00219320920198190023");
    expect(formatCnj(digits ?? "")).toBe("0021932-09.2019.8.19.0023");
  });

  it("rejects incomplete process numbers", () => {
    expect(normalizeCnjExact("21932/2019")).toBeNull();
  });
});