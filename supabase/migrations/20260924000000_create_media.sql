-- =========================================================
-- meDiary Media Schema & Policies (Supabase Postgres)
-- Phase 3: Media Catalog (Movies, TV Shows, Games, Books)
-- =========================================================

-- 1. Create media table
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('movie', 'tv', 'game', 'book')),
  tmdb_id INTEGER UNIQUE,
  imdb_id TEXT,
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  tagline TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  poster_url TEXT,
  backdrop_url TEXT,
  release_date TEXT,
  year INTEGER,
  status TEXT,
  runtime INTEGER,
  number_of_seasons INTEGER,
  number_of_episodes INTEGER,
  genres JSONB NOT NULL DEFAULT '[]'::jsonb,
  vote_average NUMERIC(4, 2),
  vote_count INTEGER,
  popularity NUMERIC(10, 3),
  original_language TEXT,
  spoken_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  production_companies JSONB NOT NULL DEFAULT '[]'::jsonb,
  "cast" JSONB NOT NULL DEFAULT '[]'::jsonb,
  crew JSONB NOT NULL DEFAULT '[]'::jsonb,
  credits JSONB NOT NULL DEFAULT '{}'::jsonb,
  watch_providers JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE public.media IS 'Central catalog for media items (movies, TV shows, games, books) with synced metadata.';
COMMENT ON COLUMN public.media.tmdb_id IS 'Unique identifier from The Movie Database (TMDB).';
COMMENT ON COLUMN public.media.last_synced_at IS 'Timestamp of the last metadata fetch from external providers.';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_tmdb_id ON public.media(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON public.media(type);
CREATE INDEX IF NOT EXISTS idx_media_title ON public.media USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_media_release_date ON public.media(release_date);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Media items are viewable by everyone" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can insert media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can update media" ON public.media;

-- SELECT: Anyone (logged in or anonymous) can view the public media catalog
CREATE POLICY "Media items are viewable by everyone"
  ON public.media
  FOR SELECT
  USING (true);

-- INSERT: Authenticated users can insert/upsert media items during sync
CREATE POLICY "Authenticated users can insert media"
  ON public.media
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- UPDATE: Authenticated users can update media items during sync
CREATE POLICY "Authenticated users can update media"
  ON public.media
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 3. Auto-update updated_at timestamp trigger
DROP TRIGGER IF EXISTS set_media_updated_at ON public.media;
CREATE TRIGGER set_media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
