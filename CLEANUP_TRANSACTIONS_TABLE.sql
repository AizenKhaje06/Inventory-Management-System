-- ============================================
-- CLEANUP TRANSACTIONS TABLE
-- Remove unnecessary columns from transactions table
-- ============================================

-- Remove customer fields (not needed)
ALTER TABLE transactions DROP COLUMN IF EXISTS customer_name;
ALTER TABLE transactions DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE transactions DROP COLUMN IF EXISTS customer_email;
ALTER TABLE transactions DROP COLUMN IF EXISTS customer_address;
ALTER TABLE transactions DROP COLUMN IF EXISTS customer_id;

-- Remove discount fields (not used)
ALTER TABLE transactions DROP COLUMN IF EXISTS discount;
ALTER TABLE transactions DROP COLUMN IF EXISTS discount_amount;

-- Remove status tracking (simplified)
ALTER TABLE transactions DROP COLUMN IF EXISTS status;
ALTER TABLE transactions DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE transactions DROP COLUMN IF EXISTS cancelled_by;
ALTER TABLE transactions DROP COLUMN IF EXISTS cancelled_at;

-- Remove transaction_type (keep only type: sale/restock)
ALTER TABLE transactions DROP COLUMN IF EXISTS transaction_type;

-- Remove department (not tracking departments for transactions)
ALTER TABLE transactions DROP COLUMN IF EXISTS department;

-- ============================================
-- FINAL SIMPLIFIED TRANSACTIONS TABLE STRUCTURE:
-- ============================================
-- id TEXT PRIMARY KEY
-- item_id TEXT NOT NULL
-- item_name TEXT NOT NULL
-- quantity INTEGER NOT NULL
-- cost_price DECIMAL(10,2) NOT NULL
-- selling_price DECIMAL(10,2) NOT NULL
-- total_cost DECIMAL(10,2) NOT NULL
-- total_revenue DECIMAL(10,2) NOT NULL
-- profit DECIMAL(10,2) NOT NULL
-- timestamp TIMESTAMPTZ DEFAULT NOW()
-- type TEXT NOT NULL ('sale' or 'restock')
-- staff_name TEXT
-- notes TEXT
-- ============================================

-- Drop unnecessary indexes
DROP INDEX IF EXISTS idx_transactions_status;

-- Keep essential indexes
-- idx_transactions_item_id (already exists)
-- idx_transactions_timestamp (already exists)
-- idx_transactions_type (already exists)
