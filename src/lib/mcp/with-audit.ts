import type { ToolContext } from "@lovable.dev/mcp-js";
import { recordMcpAudit } from "./audit";

type ToolResult = {
  content: Array<{ type: "text"; text: string } | { type: string; [k: string]: unknown }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

/**
 * Wraps a tool handler so every call is written to public.mcp_tool_audit_log,
 * even on errors. Never breaks the underlying handler.
 */
export function withAudit<I extends Record<string, unknown>>(
  toolName: string,
  handler: (input: I, ctx: ToolContext) => Promise<ToolResult>,
): (input: I, ctx: ToolContext) => Promise<ToolResult> {
  return async (input, ctx) => {
    const started = Date.now();
    let result: ToolResult | undefined;
    let thrown: unknown;
    try {
      result = await handler(input, ctx);
      return result;
    } catch (err) {
      thrown = err;
      throw err;
    } finally {
      const duration = Date.now() - started;
      const caseId =
        typeof (input as Record<string, unknown>).case_id === "string"
          ? ((input as Record<string, unknown>).case_id as string)
          : null;

      let status: "ok" | "error" | "unauthorized" = "ok";
      let errorMessage: string | null = null;
      let resultCount: number | null = null;

      if (thrown) {
        status = "error";
        errorMessage = thrown instanceof Error ? thrown.message : String(thrown);
      } else if (result?.isError) {
        const t = result.content?.[0]?.text ?? "";
        status = /não autenticado|unauthorized/i.test(t) ? "unauthorized" : "error";
        errorMessage = t.slice(0, 500);
      } else if (result?.structuredContent) {
        const sc = result.structuredContent as Record<string, unknown>;
        const firstArray = Object.values(sc).find((v) => Array.isArray(v)) as unknown[] | undefined;
        if (firstArray) resultCount = firstArray.length;
      }

      void recordMcpAudit(ctx, {
        tool_name: toolName,
        params: input as Record<string, unknown>,
        case_id: caseId,
        status,
        error_message: errorMessage,
        duration_ms: duration,
        result_count: resultCount,
      });
    }
  };
}
