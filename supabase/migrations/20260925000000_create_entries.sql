-- =========================================================
-- meDiary Entries Schema & Policies (Supabase Postgres)
-- User logs, statuses, star ratings, reviews, and privacy
-- =========================================================

-- 1. Create entries table
CREATE TABLE IF NOT EXISTS public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'dropped', 'on_hold')),
  rating NUMERIC CHECK (rating >= 0 AND rating <= 5),
  review TEXT,
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
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON public.entries(created_at);

-- Comments
COMMENT ON TABLE public.entries IS 'Individual user diary logs with status, rating, reviews, and privacy constraints.';
COMMENT ON CONSTRAINT unique_user_media ON public.entries IS 'Ensures each user can have at most one active entry row per media item.';

-- 2. Enable Row Level Security (RLS)
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

-- 3. Trigger to auto-update updated_at timestamp on entries
DROP TRIGGER IF EXISTS set_entries_updated_at ON public.entries;
CREATE TRIGGER set_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
