-- =========================================================
-- meDiary Migration: Drop Algolia sync triggers and functions
-- Server-side best-effort indexing in API routes replaces database triggers.
-- =========================================================

DROP TRIGGER IF EXISTS tr_media_algolia_sync ON public.media;
DROP TRIGGER IF EXISTS tr_media_algolia_delete ON public.media;
DROP FUNCTION IF EXISTS public.handle_media_algolia_sync();
DROP FUNCTION IF EXISTS public.handle_media_algolia_delete();
