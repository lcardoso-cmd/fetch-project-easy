import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Records an MCP tool call to public.mcp_tool_audit_log via the service role.
 * Never throws — audit failures must not break the tool call.
 */
export async function recordMcpAudit(
  ctx: ToolContext,
  entry: {
    tool_name: string;
    params?: Record<string, unknown>;
    case_id?: string | null;
    status?: "ok" | "error" | "unauthorized";
    error_message?: string | null;
    duration_ms?: number;
    result_count?: number | null;
  },
): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const userId = ctx.getUserId?.();
    if (!url || !serviceKey || !userId) return;

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await admin.from("mcp_tool_audit_log").insert({
      user_id: userId,
      client_id: ctx.getClientId?.() ?? null,
      tool_name: entry.tool_name,
      case_id: entry.case_id ?? null,
      params: sanitizeParams(entry.params ?? {}),
      status: entry.status ?? "ok",
      error_message: entry.error_message ?? null,
      duration_ms: entry.duration_ms ?? null,
      result_count: entry.result_count ?? null,
    });
  } catch {
    // swallow
  }
}

/** Keep params compact; drop giant blobs and truncate long strings. */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (typeof v === "string") out[k] = v.length > 500 ? v.slice(0, 500) + "…" : v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.slice(0, 20);
    else {
      try {
        const s = JSON.stringify(v);
        out[k] = s.length > 800 ? s.slice(0, 800) + "…" : JSON.parse(s);
      } catch {
        // skip unserializable
      }
    }
  }
  return out;
}
