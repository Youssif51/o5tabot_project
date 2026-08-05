-- ============================================================
-- 009: Atomic Stock Adjustment RPC Function
-- ============================================================

-- UP Migration
CREATE OR REPLACE FUNCTION adjust_variant_stock(p_sku TEXT, p_delta INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE product_variants
  SET stock_sulur = GREATEST(0, COALESCE(stock_sulur, 0) + p_delta)
  WHERE sku = p_sku;
END;
$$;
