-- ============================================================
-- 004: Discounts & Coupons System
-- ============================================================

-- UP Migration: Add discount columns to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('Percentage', 'Fixed'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS applied_coupon_code TEXT;

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('Percentage', 'Fixed')),
  discount_value NUMERIC NOT NULL,
  min_order_value NUMERIC DEFAULT 0,
  usage_limit INTEGER,
  times_used INTEGER DEFAULT 0,
  expiry_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Enable RLS
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Everyone can read active coupons (needed for validation)
CREATE POLICY "all_read_coupons" ON coupons FOR SELECT USING (true);

-- Only Admin/SuperAdmin can manage coupons
CREATE POLICY "admin_insert_coupons" ON coupons FOR INSERT WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
);

CREATE POLICY "admin_update_coupons" ON coupons FOR UPDATE USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
);

CREATE POLICY "admin_delete_coupons" ON coupons FOR DELETE USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
);

-- Allow times_used increment by any authenticated user (for coupon application)
-- This is handled by the app logic; the UPDATE policy above covers Admin.
-- For Staff applying coupons, we need a function:
CREATE OR REPLACE FUNCTION apply_coupon_usage(p_coupon_code TEXT, p_increment INTEGER)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE coupons 
  SET times_used = times_used + p_increment 
  WHERE code = p_coupon_code;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- RLS Policies for Orders (discount-related)
-- ============================================================
-- Staff cannot apply manual discounts (discount without a coupon)
-- Note: Orders table may already have RLS enabled from a previous migration.
-- Run ALTER TABLE only if RLS is not yet enabled.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'orders' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Everyone can read orders
CREATE POLICY IF NOT EXISTS "all_read_orders" ON orders FOR SELECT USING (true);

-- Everyone can insert orders
CREATE POLICY IF NOT EXISTS "all_insert_orders" ON orders FOR INSERT WITH CHECK (true);

-- Update: Staff can update orders but cannot set manual discounts
CREATE POLICY IF NOT EXISTS "order_update_policy" ON orders FOR UPDATE USING (true)
WITH CHECK (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
  OR (
    -- Staff can update but discount must be 0 or from a coupon
    COALESCE(discount_value, 0) = 0 
    OR applied_coupon_code IS NOT NULL
  )
);

-- Only Admin/SuperAdmin can delete orders
CREATE POLICY IF NOT EXISTS "admin_delete_orders" ON orders FOR DELETE USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
);

-- ============================================================
-- ROLLBACK
-- ============================================================
-- DROP FUNCTION IF EXISTS apply_coupon_usage(TEXT, INTEGER);
-- DROP TABLE IF EXISTS coupons;
-- ALTER TABLE orders DROP COLUMN IF EXISTS applied_coupon_code;
-- ALTER TABLE orders DROP COLUMN IF EXISTS discount_value;
-- ALTER TABLE orders DROP COLUMN IF EXISTS discount_type;
