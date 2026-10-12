-- =========================================================
-- meDiary Migration: Lock down writes to the shared media table
-- Removes write policies (INSERT, UPDATE, DELETE) for authenticated/anon users,
-- ensuring media catalog writes are restricted to the service-role client.
-- Leaves public SELECT policy alone.
-- =========================================================

DROP POLICY IF EXISTS "Authenticated users can insert media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can update media" ON public.media;
DROP POLICY IF EXISTS "Authenticated users can delete media" ON public.media;
DROP POLICY IF EXISTS "Users can insert media" ON public.media;
DROP POLICY IF EXISTS "Users can update media" ON public.media;
DROP POLICY IF EXISTS "Users can delete media" ON public.media;
