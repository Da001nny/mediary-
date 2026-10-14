-- media.tmdb_id column is unused; its unique constraint would collide movie/TV IDs
ALTER TABLE public.media DROP CONSTRAINT IF EXISTS media_tmdb_id_key;
