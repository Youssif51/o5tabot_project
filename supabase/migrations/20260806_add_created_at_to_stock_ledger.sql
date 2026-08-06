-- Migration: Add created_at column to stock_ledger table
-- This adds a proper timestamp column for when each ledger entry was actually created

ALTER TABLE public.stock_ledger
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing rows: use the date column value if it contains a full ISO timestamp,
-- otherwise convert date-only string to a timestamp
UPDATE public.stock_ledger
SET created_at = CASE
    WHEN date ~ '^\d{4}-\d{2}-\d{2}T' THEN date::timestamptz
    WHEN date ~ '^\d{4}-\d{2}-\d{2}$' THEN (date || 'T00:00:00Z')::timestamptz
    ELSE NOW()
END
WHERE created_at = NOW(); -- Only update rows that just got the default value
