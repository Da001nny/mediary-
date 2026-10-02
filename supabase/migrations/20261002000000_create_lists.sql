-- =========================================================
-- meDiary Migration: Create Custom Lists and List Items
-- Allows users to create named ranked or unranked lists,
-- configure privacy (private/friends/public), and add/reorder media items.
-- =========================================================

-- 1. LISTS TABLE
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

-- 2. LIST_ITEMS TABLE
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
