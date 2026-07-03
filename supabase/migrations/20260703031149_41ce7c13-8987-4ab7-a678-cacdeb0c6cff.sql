
CREATE TABLE public.ai_session_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  thread_id UUID NULL,
  case_id UUID NULL,
  feature TEXT NULL,
  event_type TEXT NOT NULL, -- cache_hit | cache_miss | context_truncated | fallback | chat_finish
  model TEXT NULL,
  fallback_model TEXT NULL,
  reason TEXT NULL,
  chars_before INT NULL,
  chars_after INT NULL,
  messages_truncated INT NULL,
  latency_ms INT NULL,
  payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_session_events_session_idx ON public.ai_session_events (session_id, created_at);
CREATE INDEX ai_session_events_thread_idx ON public.ai_session_events (thread_id, created_at DESC);
CREATE INDEX ai_session_events_user_idx ON public.ai_session_events (user_id, created_at DESC);

GRANT SELECT ON public.ai_session_events TO authenticated;
GRANT ALL ON public.ai_session_events TO service_role;

ALTER TABLE public.ai_session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own session events"
  ON public.ai_session_events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.can_view_all_ai_usage(auth.uid()));

CREATE POLICY "Service role manages session events"
  ON public.ai_session_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
