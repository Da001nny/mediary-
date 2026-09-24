-- =========================================================
-- meDiary Core Database Schema & Policies (Supabase Postgres)
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql
-- =========================================================

-- 1. PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  region TEXT,
  locale TEXT NOT NULL DEFAULT 'en',
  rating_scale TEXT NOT NULL DEFAULT '100',
  theme TEXT NOT NULL DEFAULT 'system',
  default_privacy TEXT NOT NULL DEFAULT 'public' CHECK (default_privacy IN ('private', 'friends', 'public')),
  dashboard_widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- RLS Policies
-- SELECT: Users can view their own profile, or any profile whose default_privacy is 'public'
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (
    default_privacy = 'public' 
    OR auth.uid() = id
  );

-- INSERT: A user can only insert their own profile record
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
  );

-- UPDATE: Users can only update their own profile row
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: Users can only delete their own profile row
CREATE POLICY "Users can delete their own profile"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- Trigger: auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: auto-create profile on auth.users signup (email or Google OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'display_name',
      SPLIT_PART(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- 2. MEDIA (Catalog for Movies, TV, Games, Books)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('movie', 'tv', 'game', 'book')),
  title TEXT NOT NULL,
  cover_url TEXT,
  release_date DATE,
  genres TEXT[] DEFAULT '{}',
  synopsis TEXT,
  type_specific JSONB DEFAULT '{}'::jsonb,
  external_ids JSONB DEFAULT '{}'::jsonb,
  watch_providers JSONB DEFAULT '{}'::jsonb,
  localized_fields JSONB DEFAULT '{}'::jsonb,
  community_rating_avg NUMERIC,
  community_rating_count INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_type ON public.media(type);
CREATE INDEX IF NOT EXISTS idx_media_external_ids ON public.media USING gin (external_ids);
CREATE INDEX IF NOT EXISTS idx_media_title ON public.media USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_media_release_date ON public.media(release_date);

-- Enable RLS
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Media items are viewable by everyone" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can insert media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can update media" ON public.media;

-- RLS Policies
CREATE POLICY "Media items are viewable by everyone"
  ON public.media
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert media"
  ON public.media
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users can update media"
  ON public.media
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS set_media_updated_at ON public.media;
CREATE TRIGGER set_media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

