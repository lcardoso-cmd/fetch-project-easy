
ALTER TABLE public.ai_usage_events
  ADD COLUMN IF NOT EXISTS max_tokens_applied integer,
  ADD COLUMN IF NOT EXISTS context_chars_before integer,
  ADD COLUMN IF NOT EXISTS context_chars_after integer,
  ADD COLUMN IF NOT EXISTS messages_truncated integer,
  ADD COLUMN IF NOT EXISTS retries_used integer;
