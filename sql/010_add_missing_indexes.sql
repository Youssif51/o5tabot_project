-- ============================================================
-- 010: Add Missing Foreign Key and Query Sort Indexes
-- ============================================================

-- UP Migration
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_sku ON order_items(variant_sku);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_order_id ON stock_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product_id ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_date ON stock_ledger(date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_items_po_id ON purchase_items(po_id);
