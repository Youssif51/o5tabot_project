-- ============================================================
-- 012: Add Atomic Stock Adjustment with Average Cost Function
-- ============================================================

-- UP Migration
CREATE OR REPLACE FUNCTION adjust_variant_stock_with_cost(
  p_sku TEXT,
  p_delta INTEGER,
  p_cost NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_stock INTEGER;
  v_old_cost NUMERIC;
  v_new_stock INTEGER;
  v_new_cost NUMERIC;
  v_product_id UUID;
BEGIN
  -- Select and lock the row to prevent concurrent updates
  SELECT stock_sulur, COALESCE(average_cost, wholesale_price, 0), product_id
  INTO v_old_stock, v_old_cost, v_product_id
  FROM product_variants
  WHERE sku = p_sku
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Variant not found');
  END IF;
  
  v_new_stock := COALESCE(v_old_stock, 0) + p_delta;
  
  IF v_new_stock < 0 THEN
    v_new_stock := 0;
  END IF;
  
  -- Calculate average cost if it's an increase
  IF p_delta > 0 THEN
    IF COALESCE(v_old_stock, 0) <= 0 THEN
      v_new_cost := p_cost;
    ELSE
      v_new_cost := ((COALESCE(v_old_stock, 0) * v_old_cost) + (p_delta * p_cost)) / v_new_stock;
    END IF;
  ELSE
    -- Keep existing cost if we are just reducing stock (Wastes/Losses)
    v_new_cost := v_old_cost;
  END IF;
  
  UPDATE product_variants
  SET 
    stock_sulur = v_new_stock,
    average_cost = v_new_cost
  WHERE sku = p_sku;
  
  RETURN jsonb_build_object(
    'success', true, 
    'new_stock', v_new_stock, 
    'new_cost', v_new_cost,
    'product_id', v_product_id
  );
END;
$$;
