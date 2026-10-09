-- =========================================================
-- meDiary Migration: Fix Privacy Model & Mutual Follow Friends
-- Safe on existing database tables (profiles, entries, lists, list_items)
-- =========================================================

-- 1. Add profile_visibility to profiles table ('public' or 'private')
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (profile_visibility IN ('public', 'private'));

-- Ensure default for new profiles is 'public'
ALTER TABLE public.profiles
  ALTER COLUMN profile_visibility SET DEFAULT 'public';

-- Backfill existing rows from default_privacy so nobody's profile changes visibility:
-- If default_privacy was 'private', profile_visibility is 'private'; otherwise 'public'.
UPDATE public.profiles
SET profile_visibility = CASE
  WHEN default_privacy = 'private' THEN 'private'
  ELSE 'public'
END;

-- 2. Update profiles SELECT policy
-- Choice: We restrict the profiles table SELECT policy to owner or profile_visibility = 'public', while providing a safe_profiles view exposing only safe public card columns (id, display_name, avatar_url) for attribution in public feeds and follow lists.
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable based on visibility or owner" ON public.profiles;

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

-- 3. Make 'friends' real for entries: Mutual follows (A follows B and B follows A)
DROP POLICY IF EXISTS "Entries are viewable based on privacy and ownership" ON public.entries;

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

-- 4. Make 'friends' real for lists: Mutual follows (A follows B and B follows A)
DROP POLICY IF EXISTS "Lists are viewable based on privacy and ownership" ON public.lists;

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

-- 5. Update list_items SELECT policy to match accessible parent lists (including friends)
DROP POLICY IF EXISTS "List items viewable if parent list is accessible" ON public.list_items;

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
