CREATE INDEX IF NOT EXISTS idx_media_genres ON public.media USING gin (genres);
