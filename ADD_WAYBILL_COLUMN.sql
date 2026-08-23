-- ============================================
-- ADD WAYBILL COLUMN
-- Add waybill_number to orders and transactions tables
-- ============================================

-- Add waybill_number to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS waybill_number TEXT;

-- Add index for faster searching
CREATE INDEX IF NOT EXISTS idx_orders_waybill ON orders(waybill_number);

-- Add waybill_number to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS waybill_number TEXT;

-- Add index for faster searching
CREATE INDEX IF NOT EXISTS idx_transactions_waybill ON transactions(waybill_number);

-- ============================================
-- UPDATED TABLE STRUCTURES:
-- ============================================
-- orders: id, date, qty, cogs, total, product, dispatched_by, waybill_number, created_at
-- transactions: id, item_id, item_name, quantity, cost_price, selling_price, 
--               total_cost, total_revenue, profit, timestamp, type, staff_name, 
--               notes, waybill_number
-- ============================================
