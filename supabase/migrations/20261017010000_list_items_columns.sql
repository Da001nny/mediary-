ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS added_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS list_items_id_key ON public.list_items (id);
