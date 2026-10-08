-- =========================================================
-- meDiary Migration: Follow System & Public Profiles
-- Safe on existing database tables (follows, activity)
-- =========================================================

-- 1. Ensure public.follows table exists
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Ensure created_at column exists if table was previously created with minimal columns
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Safely add self-follow prevention constraint if not already present
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

-- Performance Indexes on follows
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_created_at ON public.follows(created_at);

-- Enable Row Level Security (RLS) on follows
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
DROP POLICY IF EXISTS "Users can insert their own follows" ON public.follows;
DROP POLICY IF EXISTS "Users can delete their own follows" ON public.follows;

-- RLS Policies on follows
-- 1. Publicly readable
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows
  FOR SELECT
  USING (true);

-- 2. Users can only insert their own follows (follower_id = auth.uid())
CREATE POLICY "Users can insert their own follows"
  ON public.follows
  FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
  );

-- 3. Users can only delete their own follows
CREATE POLICY "Users can delete their own follows"
  ON public.follows
  FOR DELETE
  USING (
    auth.uid() = follower_id
  );

-- =========================================================
-- 2. Ensure public.activity table exists & has safe RLS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist safely
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS ref_id UUID;
ALTER TABLE public.activity ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes on activity
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON public.activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at ON public.activity(created_at);

-- Enable RLS on activity
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activity is viewable by everyone" ON public.activity;
DROP POLICY IF EXISTS "Users can insert their own activity" ON public.activity;
DROP POLICY IF EXISTS "Users can delete their own activity" ON public.activity;

CREATE POLICY "Activity is viewable by everyone"
  ON public.activity
  FOR SELECT
  USING (true);

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
