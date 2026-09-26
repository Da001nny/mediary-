-- =========================================================
-- meDiary Migration: Update Entries Table
-- 1. Add progress JSONB column for media-specific tracking
--    ({season, episode} for TV, {hoursPlayed, completionPct}
--    for games, {pagesRead} for books; null/empty for movies)
-- 2. Normalize rating column to store 0-100 internally
--    instead of 0-5
-- =========================================================

-- 1. Add progress JSONB column
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}'::jsonb;

-- Create GIN index for querying progress attributes
CREATE INDEX IF NOT EXISTS idx_entries_progress ON public.entries USING gin(progress);

COMMENT ON COLUMN public.entries.progress IS 'Media-specific progress tracking: {season, episode} for TV, {hoursPlayed, completionPct} for games, {pagesRead} for books; null or empty for movies.';

-- 2. Drop existing rating check constraint (was 0 to 5)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.entries'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%rating%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.entries DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Convert existing ratings from 0-5 scale to 0-100 scale
-- (e.g. 3.5 -> 70, 5 -> 100, 4 -> 80)
UPDATE public.entries
  SET rating = ROUND(rating * 20)
  WHERE rating IS NOT NULL AND rating <= 5;

-- 4. Add new check constraint ensuring rating is 0 to 100
ALTER TABLE public.entries
  ADD CONSTRAINT entries_rating_check CHECK (rating >= 0 AND rating <= 100);

COMMENT ON COLUMN public.entries.rating IS 'Internal normalized rating between 0 and 100 (supports 5-star, 10-point, 100-point, and future rating systems).';
