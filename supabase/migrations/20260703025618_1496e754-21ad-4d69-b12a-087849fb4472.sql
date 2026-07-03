ALTER TABLE public.ai_budgets
  ADD COLUMN IF NOT EXISTS max_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_context_chars integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 1;

ALTER TABLE public.ai_budgets
  DROP CONSTRAINT IF EXISTS ai_budgets_max_tokens_nonneg,
  DROP CONSTRAINT IF EXISTS ai_budgets_max_ctx_nonneg,
  DROP CONSTRAINT IF EXISTS ai_budgets_max_retries_range;

ALTER TABLE public.ai_budgets
  ADD CONSTRAINT ai_budgets_max_tokens_nonneg CHECK (max_tokens >= 0 AND max_tokens <= 200000),
  ADD CONSTRAINT ai_budgets_max_ctx_nonneg CHECK (max_context_chars >= 0 AND max_context_chars <= 2000000),
  ADD CONSTRAINT ai_budgets_max_retries_range CHECK (max_retries BETWEEN 0 AND 5);