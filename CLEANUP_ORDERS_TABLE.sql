-- ============================================
-- CLEANUP ORDERS TABLE
-- Remove unnecessary columns from orders table
-- ============================================

-- Remove courier and waybill columns (no longer needed for POS system)
ALTER TABLE orders DROP COLUMN IF EXISTS courier;
ALTER TABLE orders DROP COLUMN IF EXISTS waybill;

-- Remove status and parcel_status columns (simplified tracking)
ALTER TABLE orders DROP COLUMN IF EXISTS status;
ALTER TABLE orders DROP COLUMN IF EXISTS parcel_status;

-- Remove order_number column (using id instead)
ALTER TABLE orders DROP COLUMN IF EXISTS order_number;

-- Remove cancellation columns (simplified - not needed for POS)
ALTER TABLE orders DROP COLUMN IF EXISTS is_cancelled;
ALTER TABLE orders DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE orders DROP COLUMN IF EXISTS reason;
ALTER TABLE orders DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE orders DROP COLUMN IF EXISTS cancelled_by;

-- Remove packed columns (POS sales are instant)
ALTER TABLE orders DROP COLUMN IF EXISTS packed_by;
ALTER TABLE orders DROP COLUMN IF EXISTS packed_at;

-- Remove customer contact fields (not needed for POS)
ALTER TABLE orders DROP COLUMN IF EXISTS customer_name;
ALTER TABLE orders DROP COLUMN IF EXISTS customer_address;
ALTER TABLE orders DROP COLUMN IF EXISTS customer_contact;

-- Remove product_name (redundant with product)
ALTER TABLE orders DROP COLUMN IF EXISTS product_name;

-- Remove dispatch_notes (use notes column from transactions instead)
ALTER TABLE orders DROP COLUMN IF EXISTS dispatch_notes;

-- Remove deleted_at (hard delete instead of soft delete)
ALTER TABLE orders DROP COLUMN IF EXISTS deleted_at;

-- Remove updated_at (not tracking updates for POS sales)
ALTER TABLE orders DROP COLUMN IF EXISTS updated_at;

-- ============================================
-- FINAL SIMPLIFIED ORDERS TABLE STRUCTURE:
-- ============================================
-- id TEXT PRIMARY KEY
-- date TIMESTAMPTZ NOT NULL
-- qty INTEGER NOT NULL
-- cogs DECIMAL(10,2) NOT NULL
-- total DECIMAL(10,2) NOT NULL
-- product TEXT NOT NULL
-- dispatched_by TEXT
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- ============================================

-- Drop unnecessary indexes
DROP INDEX IF EXISTS idx_orders_waybill;
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_parcel_status;
DROP INDEX IF EXISTS idx_orders_packed_at;
DROP INDEX IF EXISTS idx_orders_is_cancelled;
DROP INDEX IF EXISTS idx_orders_deleted_at;
DROP INDEX IF EXISTS idx_orders_active;

-- Keep only essential indexes
-- idx_orders_date (already exists)
-- idx_orders_dispatched_by (create if doesn't exist)
CREATE INDEX IF NOT EXISTS idx_orders_dispatched_by ON orders(dispatched_by);
