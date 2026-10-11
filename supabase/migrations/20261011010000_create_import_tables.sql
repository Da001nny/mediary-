-- =========================================================
-- meDiary Migration: Import Jobs and Items for Letterboxd & Goodreads
-- =========================================================

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  total INT NOT NULL DEFAULT 0,
  matched INT NOT NULL DEFAULT 0,
  already_logged INT NOT NULL DEFAULT 0,
  needs_review INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  media_id UUID REFERENCES public.media(id) ON DELETE SET NULL,
  candidates JSONB,
  error TEXT,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance & Uniqueness Indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON public.import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.import_jobs(status);

-- Partial unique index ensuring only one active import job per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_jobs_user_active
  ON public.import_jobs (user_id)
  WHERE status IN ('pending', 'processing', 'paused');

CREATE INDEX IF NOT EXISTS idx_import_items_job_id ON public.import_items(job_id);
CREATE INDEX IF NOT EXISTS idx_import_items_status ON public.import_items(status);
CREATE INDEX IF NOT EXISTS idx_import_items_job_status ON public.import_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_import_items_claim ON public.import_items(job_id, status, claimed_at);

-- Enable RLS on both tables
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users can insert their own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users can update their own import jobs" ON public.import_jobs;
DROP POLICY IF EXISTS "Users can delete their own import jobs" ON public.import_jobs;

DROP POLICY IF EXISTS "Users can view their own import items" ON public.import_items;
DROP POLICY IF EXISTS "Users can insert their own import items" ON public.import_items;
DROP POLICY IF EXISTS "Users can update their own import items" ON public.import_items;
DROP POLICY IF EXISTS "Users can delete their own import items" ON public.import_items;

-- RLS policies for import_jobs (owner-only)
CREATE POLICY "Users can view their own import jobs"
  ON public.import_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own import jobs"
  ON public.import_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own import jobs"
  ON public.import_jobs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own import jobs"
  ON public.import_jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for import_items (owner-only via job_id)
CREATE POLICY "Users can view their own import items"
  ON public.import_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.import_jobs
      WHERE import_jobs.id = import_items.job_id
        AND import_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own import items"
  ON public.import_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.import_jobs
      WHERE import_jobs.id = import_items.job_id
        AND import_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own import items"
  ON public.import_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.import_jobs
      WHERE import_jobs.id = import_items.job_id
        AND import_jobs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.import_jobs
      WHERE import_jobs.id = import_items.job_id
        AND import_jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own import items"
  ON public.import_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.import_jobs
      WHERE import_jobs.id = import_items.job_id
        AND import_jobs.user_id = auth.uid()
    )
  );

-- Atomic batch item claiming function
-- SECURITY INVOKER enforces owner-only RLS policies
CREATE OR REPLACE FUNCTION public.claim_import_items(p_job_id UUID, p_limit INT)
RETURNS SETOF public.import_items
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM public.import_items
    WHERE job_id = p_job_id
      AND (
        status = 'pending'
        OR (
          status = 'processing'
          AND (claimed_at IS NULL OR claimed_at < (pg_catalog.now() - INTERVAL '2 minutes'))
        )
      )
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.import_items i
  SET status = 'processing',
      claimed_at = pg_catalog.now()
  FROM claimable c
  WHERE i.id = c.id
  RETURNING i.*;
END;
$$;

-- Revoke default public/anon access and grant only to authenticated and service_role
REVOKE ALL ON FUNCTION public.claim_import_items(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_import_items(UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_import_items(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_import_items(UUID, INT) TO service_role;
