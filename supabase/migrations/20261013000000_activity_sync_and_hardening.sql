-- Keep activity rows in sync with entries
CREATE OR REPLACE FUNCTION public.sync_activity_on_entry_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.activity
    WHERE ref_id = OLD.id AND type IN ('logged','reviewed');
    RETURN OLD;
  END IF;

  IF NEW.privacy = 'private' THEN
    DELETE FROM public.activity
    WHERE ref_id = NEW.id AND type IN ('logged','reviewed');
    RETURN NEW;
  END IF;

  IF NEW.review IS NULL OR length(trim(NEW.review)) = 0 THEN
    DELETE FROM public.activity WHERE ref_id = NEW.id AND type = 'reviewed';
  END IF;

  UPDATE public.activity
  SET privacy = NEW.privacy,
      data = data || jsonb_build_object(
        'rating', NEW.rating,
        'review', NEW.review,
        'contains_spoilers', NEW.contains_spoilers,
        'status', NEW.status)
  WHERE ref_id = NEW.id AND type IN ('logged','reviewed');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_entry_activity_sync ON public.entries;
CREATE TRIGGER tr_entry_activity_sync
  AFTER DELETE OR UPDATE OF privacy, review, rating, status, contains_spoilers
  ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.sync_activity_on_entry_change();

-- Same for lists
CREATE OR REPLACE FUNCTION public.sync_activity_on_list_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.activity WHERE ref_id = OLD.id AND type = 'listed';
    RETURN OLD;
  END IF;

  IF NEW.privacy = 'private' THEN
    DELETE FROM public.activity WHERE ref_id = NEW.id AND type = 'listed';
    RETURN NEW;
  END IF;

  UPDATE public.activity
  SET privacy = NEW.privacy,
      data = data || jsonb_build_object('name', NEW.title, 'description', NEW.description)
  WHERE ref_id = NEW.id AND type = 'listed';

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_list_activity_sync ON public.lists;
CREATE TRIGGER tr_list_activity_sync
  AFTER DELETE OR UPDATE OF privacy, title, description
  ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.sync_activity_on_list_change();

-- Pin search_path on older functions
ALTER FUNCTION public.check_comment_guards() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.handle_updated_at() SET search_path = '';
