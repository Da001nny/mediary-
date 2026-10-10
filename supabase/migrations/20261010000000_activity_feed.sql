-- =========================================================
-- meDiary Migration: Activity Feed, Columns & Hardened Policies
-- Safe on existing database tables (activity)
-- =========================================================

-- 1. Ensure columns exist on public.activity
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'friends', 'private'));
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS media_id UUID REFERENCES public.media(id) ON DELETE CASCADE;
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;

-- 2. Enforce one row per (user_id, type, ref_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_user_type_ref ON public.activity(user_id, type, ref_id);

-- Additional performance indexes on activity
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON public.activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_media_type ON public.activity(media_type);

-- 3. Row Level Security Policies on public.activity
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

-- Drop "Activity is viewable by everyone" by that exact name
DROP POLICY IF EXISTS "Activity is viewable by everyone" ON public.activity;
DROP POLICY IF EXISTS "Activity is viewable based on privacy and visibility" ON public.activity;

-- New SELECT policy:
-- 1. Can read own rows
-- 2. Public rows are readable by anyone only if the author's profile_visibility is 'public'
-- 3. Friends rows are readable by mutual followers of the author (A follows B and B follows A)
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

-- Update-own policy
DROP POLICY IF EXISTS "Users can update their own activity" ON public.activity;
CREATE POLICY "Users can update their own activity"
  ON public.activity
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep insert and delete policies safely
DROP POLICY IF EXISTS "Users can insert their own activity" ON public.activity;
CREATE POLICY "Users can insert their own activity"
  ON public.activity
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can delete their own activity" ON public.activity;
CREATE POLICY "Users can delete their own activity"
  ON public.activity
  FOR DELETE
  USING (
    auth.uid() = user_id
  );

-- 4. Backfill activity from existing public and friends entries and lists
-- (type logged or listed, created_at = source row's created_at)
INSERT INTO public.activity (user_id, type, ref_id, privacy, media_id, media_type, data, created_at)
SELECT
  e.user_id,
  'logged',
  e.id,
  e.privacy,
  e.media_id,
  m.type,
  jsonb_build_object(
    'rating', e.rating,
    'review', e.review,
    'contains_spoilers', COALESCE(e.contains_spoilers, false),
    'status', e.status
  ),
  e.created_at
FROM public.entries e
LEFT JOIN public.media m ON m.id = e.media_id
WHERE e.privacy IN ('public', 'friends')
ON CONFLICT (user_id, type, ref_id) DO UPDATE
SET privacy = EXCLUDED.privacy,
    media_id = EXCLUDED.media_id,
    media_type = EXCLUDED.media_type,
    data = EXCLUDED.data;

-- Backfill 'reviewed' for entries that have review text
INSERT INTO public.activity (user_id, type, ref_id, privacy, media_id, media_type, data, created_at)
SELECT
  e.user_id,
  'reviewed',
  e.id,
  e.privacy,
  e.media_id,
  m.type,
  jsonb_build_object(
    'rating', e.rating,
    'review', e.review,
    'contains_spoilers', COALESCE(e.contains_spoilers, false),
    'status', e.status
  ),
  e.created_at
FROM public.entries e
LEFT JOIN public.media m ON m.id = e.media_id
WHERE e.privacy IN ('public', 'friends')
  AND e.review IS NOT NULL
  AND length(trim(e.review)) > 0
ON CONFLICT (user_id, type, ref_id) DO UPDATE
SET privacy = EXCLUDED.privacy,
    media_id = EXCLUDED.media_id,
    media_type = EXCLUDED.media_type,
    data = EXCLUDED.data;

-- Backfill 'listed' for public and friends custom lists
INSERT INTO public.activity (user_id, type, ref_id, privacy, data, created_at)
SELECT
  l.user_id,
  'listed',
  l.id,
  l.privacy,
  jsonb_build_object(
    'name', l.title,
    'description', l.description
  ),
  l.created_at
FROM public.lists l
WHERE l.privacy IN ('public', 'friends')
ON CONFLICT (user_id, type, ref_id) DO UPDATE
SET privacy = EXCLUDED.privacy,
    data = EXCLUDED.data;
