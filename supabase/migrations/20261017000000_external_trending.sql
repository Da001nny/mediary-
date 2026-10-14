-- =========================================================
-- meDiary Migration: External Trending (TMDB Movies & TV)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.external_trending (
  media_id UUID REFERENCES public.media(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  rank INT NOT NULL,
  source TEXT NOT NULL DEFAULT 'tmdb',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (media_id, source)
);

-- Performance & ordering indexes
CREATE INDEX IF NOT EXISTS idx_external_trending_type_rank ON public.external_trending(type, rank);
CREATE INDEX IF NOT EXISTS idx_external_trending_source ON public.external_trending(source);

-- Enable Row Level Security (RLS)
ALTER TABLE public.external_trending ENABLE ROW LEVEL SECURITY;

-- SELECT policy for everyone; no client write policies (admin client only)
DROP POLICY IF EXISTS "External trending is viewable by everyone" ON public.external_trending;
CREATE POLICY "External trending is viewable by everyone"
  ON public.external_trending
  FOR SELECT
  USING (true);
