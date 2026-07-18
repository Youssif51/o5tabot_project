-- Add unit_cost, total_cost, and notes to track costs during restock/sales in stock_ledger
ALTER TABLE public.stock_ledger ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;
ALTER TABLE public.stock_ledger ADD COLUMN IF NOT EXISTS total_cost numeric DEFAULT 0;
ALTER TABLE public.stock_ledger ADD COLUMN IF NOT EXISTS notes text;

-- Add support for multiple collections in products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shopify_collection_ids text[] DEFAULT '{}';

-- Migrate existing single collection to the new array column (if applicable)
UPDATE public.products 
SET shopify_collection_ids = ARRAY[shopify_collection_id]
WHERE shopify_collection_id IS NOT NULL AND shopify_collection_ids = '{}';

-- (Optional) If you are absolutely sure, you can drop the old column:
-- ALTER TABLE public.products DROP COLUMN shopify_collection_id;
