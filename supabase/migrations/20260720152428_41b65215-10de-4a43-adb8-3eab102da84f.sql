
CREATE TABLE public.mcp_tool_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id text,
  tool_name text NOT NULL,
  case_id uuid,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ok',
  error_message text,
  duration_ms integer,
  result_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mcp_tool_audit_log_user_created_idx ON public.mcp_tool_audit_log (user_id, created_at DESC);
CREATE INDEX mcp_tool_audit_log_case_idx ON public.mcp_tool_audit_log (case_id) WHERE case_id IS NOT NULL;
CREATE INDEX mcp_tool_audit_log_tool_idx ON public.mcp_tool_audit_log (tool_name);

GRANT SELECT ON public.mcp_tool_audit_log TO authenticated;
GRANT ALL ON public.mcp_tool_audit_log TO service_role;

ALTER TABLE public.mcp_tool_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own MCP audit"
  ON public.mcp_tool_audit_log FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_platform_staff(auth.uid())
  );

CREATE POLICY "Service role manages MCP audit"
  ON public.mcp_tool_audit_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
