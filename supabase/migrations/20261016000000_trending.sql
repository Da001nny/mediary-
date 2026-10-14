-- =========================================================
-- meDiary Migration: Trending Media Catalog
-- 1. Enable pg_cron extension
-- 2. Create public.trending table with index on (type, rank)
-- 3. Enable RLS with SELECT policy for everyone (no insert/update/delete)
-- 4. Create public.refresh_trending() function
-- 5. Schedule nightly refresh at 03:00 UTC via pg_cron
-- 6. Execute initial refresh
-- =========================================================

-- 1. Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create public.trending table
CREATE TABLE IF NOT EXISTS public.trending (
  media_id UUID PRIMARY KEY REFERENCES public.media(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  entry_count INT NOT NULL,
  rank INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on (type, rank)
CREATE INDEX IF NOT EXISTS idx_trending_type_rank ON public.trending(type, rank);

-- 3. Enable RLS with a SELECT policy for everyone and no insert/update/delete policies
ALTER TABLE public.trending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trending items are viewable by everyone" ON public.trending;
CREATE POLICY "Trending items are viewable by everyone"
  ON public.trending
  FOR SELECT
  USING (true);

-- 4. Function to refresh trending titles
CREATE OR REPLACE FUNCTION public.refresh_trending()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Delete all existing trending rows
  DELETE FROM public.trending;

  -- Insert top 20 titles per media type based on public entries from the last 7 days
  INSERT INTO public.trending (media_id, type, entry_count, rank, computed_at)
  WITH ranked AS (
    SELECT
      m.id AS media_id,
      m.type,
      COUNT(e.id)::int AS entry_count,
      ROW_NUMBER() OVER (
        PARTITION BY m.type
        ORDER BY COUNT(e.id) DESC, m.id ASC
      )::int AS rank
    FROM public.entries e
    JOIN public.media m ON m.id = e.media_id
    WHERE e.privacy = 'public'
      AND e.created_at >= (NOW() - INTERVAL '7 days')
    GROUP BY m.id, m.type
  )
  SELECT
    media_id,
    type,
    entry_count,
    rank,
    NOW() AS computed_at
  FROM ranked
  WHERE rank <= 20;
END;
$$;

-- 5. Schedule nightly with cron.schedule at 03:00 UTC (safe to re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_trending_nightly') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh_trending_nightly';
  END IF;

  PERFORM cron.schedule(
    'refresh_trending_nightly',
    '0 3 * * *',
    'SELECT public.refresh_trending();'
  );
END $$;

-- 6. Initial computation run
SELECT public.refresh_trending();
