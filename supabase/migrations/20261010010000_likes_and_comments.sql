-- =========================================================
-- meDiary Migration: Likes & Comments on Entries and Lists
-- Supports Movie & TV entries (and custom lists)
-- =========================================================

-- 1. LIKES TABLE
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

-- Unique constraints / indexes so a user can like a target only once
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_entry ON public.likes (user_id, entry_id) WHERE entry_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_list ON public.likes (user_id, list_id) WHERE list_id IS NOT NULL;

-- Indexes on target columns and user
CREATE INDEX IF NOT EXISTS idx_likes_entry_id ON public.likes(entry_id);
CREATE INDEX IF NOT EXISTS idx_likes_list_id ON public.likes(list_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at DESC);

-- Enable RLS on likes
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Likes are readable if target is readable" ON public.likes;
DROP POLICY IF EXISTS "Users can insert their own likes on readable targets" ON public.likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.likes;

-- SELECT policy: readable only when target entry or list is readable by the viewer
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

-- INSERT policy: insert only as yourself and only on targets you can read
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

-- DELETE policy: delete your own likes
CREATE POLICY "Users can delete their own likes"
  ON public.likes
  FOR DELETE
  USING (
    auth.uid() = user_id
  );


-- 2. COMMENTS TABLE
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

-- Indexes on target columns, parent_id, user, and created_at
CREATE INDEX IF NOT EXISTS idx_comments_entry_id ON public.comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_list_id ON public.comments(list_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at ASC);

-- Enable RLS on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Comments are readable if target is readable" ON public.comments;
DROP POLICY IF EXISTS "Users can insert comments on readable targets" ON public.comments;
DROP POLICY IF EXISTS "Users can delete their own comments or target owners can delete" ON public.comments;

-- SELECT policy: readable only when target entry or list is readable by the viewer
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

-- INSERT policy: insert only as yourself and only on targets you can read
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

-- DELETE policy: delete your own comments, OR the owner of the target entry/list can delete
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
