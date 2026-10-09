-- =========================================================
-- meDiary Migration: Tighten follows SELECT policy
-- Protect follow graph from unauthenticated/arbitrary inspection
-- =========================================================

-- Drop existing public read policy on follows
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "Follows are viewable based on ownership or public profiles" ON public.follows;

-- A row in follows is readable if:
-- 1. auth.uid() is the follower
-- 2. auth.uid() is the person being followed
-- 3. OR both users have profile_visibility = 'public' (checked via profiles)
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

-- Ensure public and authenticated roles have SELECT on safe_profiles view
GRANT SELECT ON public.safe_profiles TO anon, authenticated;
