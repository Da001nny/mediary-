-- Prevent duplicate catalog rows per provider ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_media_type_tmdb_unique
  ON public.media (type, (external_ids->>'tmdb_id'))
  WHERE type IN ('movie','tv') AND external_ids ? 'tmdb_id';

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_game_rawg_id
  ON public.media ((external_ids->>'rawg_id'))
  WHERE type = 'game' AND external_ids ? 'rawg_id';

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_book_google_id
  ON public.media ((external_ids->>'google_books_id'))
  WHERE type = 'book' AND external_ids ? 'google_books_id';
