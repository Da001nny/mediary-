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

-- =========================================================
-- 3. ENTRIES (User Logs, Statuses, Ratings & Reviews)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'dropped', 'on_hold')),
  rating NUMERIC CHECK (rating >= 0 AND rating <= 100),
  progress JSONB DEFAULT '{}'::jsonb,
  review TEXT,
  contains_spoilers BOOLEAN NOT NULL DEFAULT FALSE,
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('private', 'friends', 'public')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_media UNIQUE (user_id, media_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON public.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_media_id ON public.entries(media_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON public.entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_privacy ON public.entries(privacy);
CREATE INDEX IF NOT EXISTS idx_entries_contains_spoilers ON public.entries(contains_spoilers);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON public.entries(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Entries are viewable based on privacy and ownership" ON public.entries;
DROP POLICY IF EXISTS "Users can only insert their own entries" ON public.entries;
DROP POLICY IF EXISTS "Users can only update their own entries" ON public.entries;
DROP POLICY IF EXISTS "Users can only delete their own entries" ON public.entries;

-- 1. SELECT: Reads respect the privacy column
-- Users can view their own entries regardless of privacy,
-- OR anyone can view if privacy is 'public'
CREATE POLICY "Entries are viewable based on privacy and ownership"
  ON public.entries
  FOR SELECT
  USING (
    privacy = 'public'
    OR auth.uid() = user_id
  );

-- 2. INSERT: Users can only insert their own entries
CREATE POLICY "Users can only insert their own entries"
  ON public.entries
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

-- 3. UPDATE: Users can only update their own entries
CREATE POLICY "Users can only update their own entries"
  ON public.entries
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. DELETE: Users can only delete their own entries
CREATE POLICY "Users can only delete their own entries"
  ON public.entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: auto-update updated_at timestamp on entries
DROP TRIGGER IF EXISTS set_entries_updated_at ON public.entries;
CREATE TRIGGER set_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================
-- 4. LISTS (Custom Ranked & Unranked Curations)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_ranked BOOLEAN NOT NULL DEFAULT FALSE,
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('private', 'friends', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes on Lists
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON public.lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_privacy ON public.lists(privacy);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON public.lists(created_at);

-- Enable RLS on Lists
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Lists are viewable based on privacy and ownership" ON public.lists;
DROP POLICY IF EXISTS "Users can only insert their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can only update their own lists" ON public.lists;
DROP POLICY IF EXISTS "Users can only delete their own lists" ON public.lists;

-- RLS Policies on Lists
CREATE POLICY "Lists are viewable based on privacy and ownership"
  ON public.lists
  FOR SELECT
  USING (
    privacy = 'public'
    OR auth.uid() = user_id
  );

CREATE POLICY "Users can only insert their own lists"
  ON public.lists
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Users can only update their own lists"
  ON public.lists
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own lists"
  ON public.lists
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: auto-update updated_at timestamp on lists
DROP TRIGGER IF EXISTS set_lists_updated_at ON public.lists;
CREATE TRIGGER set_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================
-- 5. LIST_ITEMS (Items In Ranked or Unranked Lists)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_list_media UNIQUE (list_id, media_id)
);

-- Performance Indexes on List Items
CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_list_items_media_id ON public.list_items(media_id);
CREATE INDEX IF NOT EXISTS idx_list_items_position ON public.list_items(list_id, position);

-- Enable RLS on List Items
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "List items viewable if parent list is accessible" ON public.list_items;
DROP POLICY IF EXISTS "List items insertable by list owner" ON public.list_items;
DROP POLICY IF EXISTS "List items updatable by list owner" ON public.list_items;
DROP POLICY IF EXISTS "List items deletable by list owner" ON public.list_items;

-- RLS Policies on List Items
CREATE POLICY "List items viewable if parent list is accessible"
  ON public.list_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND (lists.privacy = 'public' OR lists.user_id = auth.uid())
    )
  );

CREATE POLICY "List items insertable by list owner"
  ON public.list_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "List items updatable by list owner"
  ON public.list_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "List items deletable by list owner"
  ON public.list_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND lists.user_id = auth.uid()
    )
  );

-- =========================================================
-- 5. ALGOLIA REAL-TIME SYNC TRIGGER (Edge Function Invocation)
-- =========================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.handle_media_algolia_sync()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
  edge_function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  project_url := NULLIF(current_setting('app.settings.supabase_url', true), '');
  service_role_key := NULLIF(current_setting('app.settings.supabase_service_role_key', true), '');

  IF project_url IS NOT NULL THEN
    edge_function_url := rtrim(project_url, '/') || '/functions/v1/algolia-sync';
  ELSE
    edge_function_url := 'https://your-project.supabase.co/functions/v1/algolia-sync';
  END IF;

  PERFORM extensions.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_media_algolia_sync encountered an error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_media_algolia_sync ON public.media;
CREATE TRIGGER tr_media_algolia_sync
  AFTER INSERT OR UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_media_algolia_sync();




