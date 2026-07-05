-- ============================================================
-- 003: Customers Table + Orders Migration
-- ============================================================

-- UP Migration
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  governorate TEXT,
  customer_type TEXT NOT NULL DEFAULT 'Regular'
    CHECK (customer_type IN ('Regular', 'VIP', 'Wholesale')),
  total_purchases NUMERIC DEFAULT 0,
  orders_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  notes TEXT
);

-- Add customer_id to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Everyone can read customers
CREATE POLICY "all_read_customers" ON customers FOR SELECT USING (true);

-- Everyone can insert customers (needed when creating orders)
CREATE POLICY "all_insert_customers" ON customers FOR INSERT WITH CHECK (true);

-- Only Admin/SuperAdmin can update customer data
CREATE POLICY "admin_edit_customers" ON customers FOR UPDATE USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
);

-- Only Admin/SuperAdmin can delete customers
CREATE POLICY "admin_delete_customers" ON customers FOR DELETE USING (
  (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('Admin', 'SuperAdmin')
);

-- ============================================================
-- Migration: Link existing orders to customers by phone
-- ============================================================
-- Step 1: Create customers from existing orders
INSERT INTO customers (name, phone, governorate, customer_type)
SELECT DISTINCT ON (phone)
  sub.client_name,
  sub.phone,
  sub.gov,
  'Regular'
FROM (
  SELECT
    o.client AS client_name,
    CASE
      WHEN o.address LIKE '{%' THEN (o.address::json->>'phone')
      ELSE NULL
    END AS phone,
    o.governorate AS gov
  FROM orders o
  WHERE o.address IS NOT NULL
) sub
WHERE sub.phone IS NOT NULL AND sub.phone != ''
ORDER BY sub.phone, sub.client_name
ON CONFLICT (phone) DO NOTHING;

-- Step 2: Link orders to customers
UPDATE orders o
SET customer_id = c.id
FROM customers c
WHERE o.customer_id IS NULL
  AND o.address LIKE '{%'
  AND c.phone = (o.address::json->>'phone');

-- Step 3: Recalculate customer stats
UPDATE customers c
SET
  total_purchases = COALESCE(stats.total_val, 0),
  orders_count = COALESCE(stats.cnt, 0)
FROM (
  SELECT
    customer_id,
    SUM(COALESCE(total_value, 0)) AS total_val,
    COUNT(*) AS cnt
  FROM orders
  WHERE customer_id IS NOT NULL
    AND status = 'Completed'
  GROUP BY customer_id
) stats
WHERE c.id = stats.customer_id;

-- ============================================================
-- ROLLBACK
-- ============================================================
-- UPDATE orders SET customer_id = NULL;
-- ALTER TABLE orders DROP COLUMN IF EXISTS customer_id;
-- DROP TABLE IF EXISTS customers;
