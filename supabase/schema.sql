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
  profile_visibility TEXT NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public', 'private')),
  dashboard_widgets JSONB NOT NULL DEFAULT '[]'::jsonb,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable based on visibility or owner" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- RLS Policies
-- SELECT: Users can view their own profile, or any profile whose profile_visibility is 'public'
CREATE POLICY "Profiles are viewable based on visibility or owner"
  ON public.profiles
  FOR SELECT
  USING (
    profile_visibility = 'public'
    OR auth.uid() = id
  );

-- Safe view exposing only public identity columns for reviews and follow lists
CREATE OR REPLACE VIEW public.safe_profiles AS
  SELECT
    id,
    display_name,
    avatar_url
  FROM public.profiles;

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
-- OR anyone can view if privacy is 'public',
-- OR mutual followers (friends) can view if privacy is 'friends'
CREATE POLICY "Entries are viewable based on privacy and ownership"
  ON public.entries
  FOR SELECT
  USING (
    privacy = 'public'
    OR auth.uid() = user_id
    OR (
      privacy = 'friends'
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = auth.uid() AND following_id = entries.user_id
      )
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = entries.user_id AND following_id = auth.uid()
      )
    )
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
  title TEXT NOT NULL,
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
    OR (
      privacy = 'friends'
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = auth.uid() AND following_id = lists.user_id
      )
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = lists.user_id AND following_id = auth.uid()
      )
    )
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
      AND (
        lists.privacy = 'public'
        OR lists.user_id = auth.uid()
        OR (
          lists.privacy = 'friends'
          AND EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = auth.uid() AND following_id = lists.user_id
          )
          AND EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = lists.user_id AND following_id = auth.uid()
          )
        )
      )
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

-- =========================================================
-- 6. FOLLOWS & ACTIVITY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_not_self_follow'
    AND conrelid = 'public.follows'::regclass
  ) THEN
    ALTER TABLE public.follows ADD CONSTRAINT check_not_self_follow CHECK (follower_id != following_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows(created_at);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "Follows are viewable based on ownership or public profiles" ON public.follows;
DROP POLICY IF EXISTS "Users can insert their own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;

CREATE POLICY "Follows are viewable based on ownership or public profiles"
  ON public.follows
  FOR SELECT
  USING (
    auth.uid() = follower_id
    OR auth.uid() = following_id
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles p1
        WHERE p1.id = follows.follower_id
          AND p1.profile_visibility = 'public'
      )
      AND
      EXISTS (
        SELECT 1 FROM public.profiles p2
        WHERE p2.id = follows.following_id
          AND p2.profile_visibility = 'public'
      )
    )
  );

CREATE POLICY "Users can insert their own follows"
  ON public.follows
  FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
  );

CREATE POLICY "Users can delete their own follows"
  ON public.follows
  FOR DELETE
  USING (
    auth.uid() = follower_id
  );

GRANT SELECT ON public.safe_profiles TO anon, authenticated;

-- =========================================================
-- 7. ACTIVITY FEED TABLE & POLICIES
-- =========================================================
CREATE TABLE IF NOT EXISTS public.activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ref_id UUID,
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'friends', 'private')),
  media_id UUID REFERENCES public.media(id) ON DELETE CASCADE,
  media_type TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_user_type_ref ON public.activity(user_id, type, ref_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON public.activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_media_type ON public.activity(media_type);

ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activity is viewable based on privacy and visibility"
  ON public.activity
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      privacy = 'public'
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = activity.user_id
          AND profiles.profile_visibility = 'public'
      )
    )
    OR (
      privacy = 'friends'
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = auth.uid() AND following_id = activity.user_id
      )
      AND EXISTS (
        SELECT 1 FROM public.follows
        WHERE follower_id = activity.user_id AND following_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own activity"
  ON public.activity
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity"
  ON public.activity
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

CREATE POLICY "Users can delete their own activity"
  ON public.activity
  FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- =========================================================
-- 8. LIKES AND COMMENTS (Entries and Lists)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.entries(id) ON DELETE CASCADE,
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_likes_single_target CHECK (
    (entry_id IS NOT NULL AND list_id IS NULL) OR
    (entry_id IS NULL AND list_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_entry ON public.likes (user_id, entry_id) WHERE entry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_list ON public.likes (user_id, list_id) WHERE list_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_likes_entry_id ON public.likes(entry_id);
CREATE INDEX IF NOT EXISTS idx_likes_list_id ON public.likes(list_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at DESC);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes are readable if target is readable"
  ON public.likes
  FOR SELECT
  USING (
    (entry_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.entries WHERE entries.id = likes.entry_id
    ))
    OR
    (list_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.lists WHERE lists.id = likes.list_id
    ))
  );

CREATE POLICY "Users can insert their own likes on readable targets"
  ON public.likes
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (entry_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.entries WHERE entries.id = likes.entry_id
      ))
      OR
      (list_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.lists WHERE lists.id = likes.list_id
      ))
    )
  );

CREATE POLICY "Users can delete their own likes"
  ON public.likes
  FOR DELETE
  USING (
    auth.uid() = user_id
  );

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES public.entries(id) ON DELETE CASCADE,
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_comments_single_target CHECK (
    (entry_id IS NOT NULL AND list_id IS NULL) OR
    (entry_id IS NULL AND list_id IS NOT NULL)
  ),
  CONSTRAINT check_comments_body_length CHECK (
    length(trim(body)) >= 1 AND length(trim(body)) <= 1000
  )
);

CREATE INDEX IF NOT EXISTS idx_comments_entry_id ON public.comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_list_id ON public.comments(list_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at ASC);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are readable if target is readable"
  ON public.comments
  FOR SELECT
  USING (
    (entry_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.entries WHERE entries.id = comments.entry_id
    ))
    OR
    (list_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.lists WHERE lists.id = comments.list_id
    ))
  );

CREATE POLICY "Users can insert comments on readable targets"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (entry_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.entries WHERE entries.id = comments.entry_id
      ))
      OR
      (list_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.lists WHERE lists.id = comments.list_id
      ))
    )
  );

CREATE POLICY "Users can delete their own comments or target owners can delete"
  ON public.comments
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR (
      entry_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.entries WHERE entries.id = comments.entry_id AND entries.user_id = auth.uid()
      )
    )
    OR (
      list_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.lists WHERE lists.id = comments.list_id AND lists.user_id = auth.uid()
      )
    )
  );

-- Comments database-level guards (rate limit & reply hierarchy)
CREATE OR REPLACE FUNCTION public.check_comment_guards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_count INT;
  v_parent_parent_id UUID;
  v_parent_entry_id UUID;
  v_parent_list_id UUID;
BEGIN
  -- (1) Reject insert if the same user already created 10 or more comments in the last 60 seconds
  SELECT COUNT(*)
  INTO v_recent_count
  FROM public.comments
  WHERE user_id = NEW.user_id
    AND created_at >= (NOW() - INTERVAL '60 seconds');

  IF v_recent_count >= 10 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded: maximum 10 comments per 60 seconds.'
      USING ERRCODE = 'P0001';
  END IF;

  -- (2) If parent_id is set, require the parent to be a top-level comment (parent_id is null)
  -- on the same entry_id or list_id as the new comment
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent_id, entry_id, list_id
    INTO v_parent_parent_id, v_parent_entry_id, v_parent_list_id
    FROM public.comments
    WHERE id = NEW.parent_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent comment not found.'
        USING ERRCODE = 'P0002';
    END IF;

    -- Parent must be a top-level comment (its parent_id is null)
    IF v_parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Replies are one level only: parent comment must be a top-level comment.'
        USING ERRCODE = 'P0003';
    END IF;

    -- Parent must be on the same entry_id or list_id as the new comment
    IF (v_parent_entry_id IS DISTINCT FROM NEW.entry_id) OR (v_parent_list_id IS DISTINCT FROM NEW.list_id) THEN
      RAISE EXCEPTION 'Reply target must match the parent comment target.'
        USING ERRCODE = 'P0004';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_comment_guards ON public.comments;

CREATE TRIGGER trigger_comment_guards
  BEFORE INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_comment_guards();

-- =========================================================
-- IMPORT JOBS & IMPORT ITEMS (Letterboxd & Goodreads)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  total INT NOT NULL DEFAULT 0,
  matched INT NOT NULL DEFAULT 0,
  already_logged INT NOT NULL DEFAULT 0,
  needs_review INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  media_id UUID REFERENCES public.media(id) ON DELETE SET NULL,
  candidates JSONB,
  error TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON public.import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_jobs_user_active
  ON public.import_jobs (user_id)
  WHERE status IN ('pending', 'processing', 'paused');

CREATE INDEX IF NOT EXISTS idx_import_items_job_id ON public.import_items(job_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON public.import_items(status);
CREATE INDEX IF NOT EXISTS idx_import_items_job_status ON public.import_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_import_items_claim ON public.import_items(job_id, status, claimed_at);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users can insert their own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users can update their own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users can delete their own import jobs" ON public.import_jobs;

DROP POLICY IF EXISTS "Users can view their own import items" ON public.import_items;
DROP POLICY IF EXISTS "Users can insert their own import items" ON public.import_items;
DROP POLICY IF EXISTS "Users can update their own import items" ON public.import_items;
DROP POLICY IF EXISTS "Users can delete their own import items" ON public.import_items;

CREATE POLICY "Users can view their own import jobs"
  ON public.import_jobs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import jobs"
  ON public.import_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
  ON public.import_jobs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own import jobs"
  ON public.import_jobs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own import items"
  ON public.import_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.import_jobs WHERE import_jobs.id = import_items.job_id AND import_jobs.user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own import items"
  ON public.import_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.import_jobs WHERE import_jobs.id = import_items.job_id AND import_jobs.user_id = auth.uid())
  );

CREATE POLICY "Users can update their own import items"
  ON public.import_items FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.import_jobs WHERE import_jobs.id = import_items.job_id AND import_jobs.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.import_jobs WHERE import_jobs.id = import_items.job_id AND import_jobs.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own import items"
  ON public.import_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.import_jobs WHERE import_jobs.id = import_items.job_id AND import_jobs.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.claim_import_items(p_job_id UUID, p_limit INT)
RETURNS SETOF public.import_items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.import_items
    WHERE job_id = p_job_id
      AND (
        status = 'pending'
        OR (
          status = 'processing'
          AND (claimed_at IS NULL OR claimed_at < (pg_catalog.now() - INTERVAL '2 minutes'))
        )
      )
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.import_items i
  SET status = 'processing',
      claimed_at = pg_catalog.now()
  FROM claimable c
  WHERE i.id = c.id
  RETURNING i.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_import_items(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_import_items(UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_import_items(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_import_items(UUID, INT) TO service_role;










