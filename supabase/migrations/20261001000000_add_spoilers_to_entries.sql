-- =========================================================
-- meDiary Migration: Add Spoiler Tagging to Entries
-- Adds contains_spoilers boolean flag to public.entries
-- =========================================================

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS contains_spoilers BOOLEAN NOT NULL DEFAULT FALSE;

-- Performance index for filtering/sorting spoiler reviews
CREATE INDEX IF NOT EXISTS idx_entries_contains_spoilers ON public.entries(contains_spoilers);

COMMENT ON COLUMN public.entries.contains_spoilers IS 'Flag indicating whether the user review contains plot spoilers that should be blurred behind a "Show spoilers" toggle.';
