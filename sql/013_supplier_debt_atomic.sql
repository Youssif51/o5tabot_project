-- ============================================================
-- 013: Add Atomic Supplier Debt Increment Function
-- ============================================================

-- UP Migration
CREATE OR REPLACE FUNCTION increment_supplier_debt(
  p_supplier_id UUID,
  p_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_debt NUMERIC;
BEGIN
  UPDATE suppliers
  SET debt = COALESCE(debt, 0) + p_amount
  WHERE id = p_supplier_id
  RETURNING debt INTO v_new_debt;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Supplier not found');
  END IF;
  
  RETURN jsonb_build_object('success', true, 'new_debt', v_new_debt);
END;
$$;
