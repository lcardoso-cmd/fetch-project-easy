ALTER TABLE public.google_connections
  ADD COLUMN IF NOT EXISTS sync_window_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS sync_end_date date;

ALTER TABLE public.outlook_connections
  ADD COLUMN IF NOT EXISTS sync_window_days integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS sync_end_date date;