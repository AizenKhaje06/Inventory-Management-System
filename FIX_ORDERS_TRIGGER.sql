-- ============================================
-- FIX ORDERS TABLE TRIGGER
-- Remove ALL triggers that expect updated_at column
-- ============================================

-- Drop all possible trigger variations
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS update_orders_timestamp ON orders;
DROP TRIGGER IF EXISTS set_updated_at ON orders;
DROP TRIGGER IF EXISTS handle_updated_at ON orders;

-- List all triggers on orders table to verify
-- Run this to see if there are any remaining triggers:
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'orders'::regclass;

-- ============================================
-- ALTERNATIVE: Add updated_at column if you prefer
-- ============================================
-- If you want to keep the trigger, add the column instead:
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this, verify no triggers exist:
-- SELECT tgname, tgtype, tgenabled 
-- FROM pg_trigger 
-- WHERE tgrelid = 'orders'::regclass 
-- AND tgname NOT LIKE 'RI_%';  -- Exclude internal triggers
-- ============================================
