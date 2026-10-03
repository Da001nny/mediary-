-- =========================================================
-- meDiary Migration: Algolia Real-Time Sync Trigger
-- Sets up a Postgres trigger on public.media (insert/update)
-- that calls the 'algolia-sync' Supabase Edge Function
-- to push records to the Algolia index using the admin API key.
-- =========================================================

-- 1. Enable pg_net extension for asynchronous HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Trigger Function: Invokes the algolia-sync Supabase Edge Function
CREATE OR REPLACE FUNCTION public.handle_media_algolia_sync()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
  edge_function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
BEGIN
  -- Build the webhook payload matching Supabase Edge Function signature
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  -- Retrieve configuration from current settings or use default Supabase project URL
  -- Can be set in Postgres via: ALTER DATABASE postgres SET "app.settings.supabase_url" = 'https://xyz.supabase.co';
  project_url := NULLIF(current_setting('app.settings.supabase_url', true), '');
  service_role_key := NULLIF(current_setting('app.settings.supabase_service_role_key', true), '');
  
  IF project_url IS NOT NULL THEN
    edge_function_url := rtrim(project_url, '/') || '/functions/v1/algolia-sync';
  ELSE
    edge_function_url := 'https://your-project.supabase.co/functions/v1/algolia-sync';
  END IF;

  -- Call the Edge Function asynchronously via pg_net
  -- Non-blocking so media insertion/update transactions are never delayed
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
    -- Log warning in Postgres log without failing the parent transaction
    RAISE WARNING 'handle_media_algolia_sync encountered an error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the AFTER INSERT OR UPDATE Trigger on public.media
DROP TRIGGER IF EXISTS tr_media_algolia_sync ON public.media;
CREATE TRIGGER tr_media_algolia_sync
  AFTER INSERT OR UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_media_algolia_sync();

-- 4. Also handle DELETE cleanup in Algolia
CREATE OR REPLACE FUNCTION public.handle_media_algolia_delete()
RETURNS TRIGGER AS $$
DECLARE
  project_url TEXT;
  edge_function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
BEGIN
  payload := jsonb_build_object(
    'type', 'DELETE',
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'old_record', row_to_json(OLD)
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

  RETURN OLD;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_media_algolia_delete encountered an error: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_media_algolia_delete ON public.media;
CREATE TRIGGER tr_media_algolia_delete
  AFTER DELETE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_media_algolia_delete();
