ALTER TABLE public.google_connections ADD COLUMN IF NOT EXISTS selected_calendar_ids text[];
ALTER TABLE public.outlook_connections ADD COLUMN IF NOT EXISTS selected_calendar_ids text[];