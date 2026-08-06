-- Add product_name and variant_name columns to order_items to store original purchased item titles
-- This avoids Bosta falling back to variant SKU descriptions if a product is deleted or not yet in the ERP inventory.

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_name TEXT;
