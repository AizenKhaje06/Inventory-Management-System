-- ============================================
-- ADD ORDER CANCELLATION FIELDS
-- Add cancellation tracking to orders table
-- ============================================

-- Add cancellation fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_is_cancelled ON orders(is_cancelled);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at);

-- ============================================
-- UPDATED ORDERS TABLE STRUCTURE:
-- ============================================
-- id, date, qty, cogs, total, product, dispatched_by, 
-- waybill_number, created_at, is_cancelled, cancelled_at, 
-- cancelled_by, cancellation_reason
-- ============================================
