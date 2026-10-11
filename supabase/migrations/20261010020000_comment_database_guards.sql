-- =========================================================
-- meDiary Migration: Database-Level Guards for Comments
-- 1. Rate limit: rejects insert if user already created 10 or more comments in last 60s
-- 2. Single-level reply: parent must be top-level and on same entry/list
-- =========================================================

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
