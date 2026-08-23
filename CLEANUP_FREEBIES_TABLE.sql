-- ============================================
-- CLEANUP FREEBIES TABLE
-- Remove unnecessary columns from freebies table
-- ============================================

-- Remove customer_name column (not needed for freebies tracking)
ALTER TABLE freebies DROP COLUMN IF EXISTS customer_name;

-- Remove notes column (not needed for freebies tracking)
ALTER TABLE freebies DROP COLUMN IF EXISTS notes;

-- ============================================
-- FINAL SIMPLIFIED FREEBIES TABLE STRUCTURE:
-- ============================================
-- id TEXT PRIMARY KEY
-- item_id TEXT REFERENCES inventory(id) ON DELETE SET NULL
-- item_name TEXT NOT NULL
-- quantity INTEGER NOT NULL CHECK (quantity > 0)
-- cost_price DECIMAL(10,2) NOT NULL
-- total_cogs DECIMAL(10,2) NOT NULL
-- given_with_sale_id TEXT
-- reason TEXT
-- dispatched_by TEXT NOT NULL
-- dispatched_date DATE NOT NULL DEFAULT CURRENT_DATE
-- created_at TIMESTAMPTZ DEFAULT NOW()
-- ============================================
