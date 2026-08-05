-- ============================================================
-- 011: Add Unique Constraint to shopify_order_id in orders
-- ============================================================

-- UP Migration
ALTER TABLE orders ADD CONSTRAINT unique_shopify_order_id UNIQUE (shopify_order_id);
