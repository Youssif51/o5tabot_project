-- Create shopify_collections table
CREATE TABLE IF NOT EXISTS public.shopify_collections (
    id TEXT PRIMARY KEY, -- Shopify Collection ID (stored as string to avoid overflow)
    title TEXT NOT NULL,
    handle TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS policies
ALTER TABLE public.shopify_collections ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists first
DROP POLICY IF EXISTS "Allow anonymous read on shopify_collections" ON public.shopify_collections;
DROP POLICY IF EXISTS "Allow anonymous insert/update/delete on shopify_collections" ON public.shopify_collections;

-- Create policies
CREATE POLICY "Allow anonymous read on shopify_collections" ON public.shopify_collections FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert/update/delete on shopify_collections" ON public.shopify_collections FOR ALL USING (true) WITH CHECK (true);

-- Add shopify_collection_id column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shopify_collection_id TEXT;
