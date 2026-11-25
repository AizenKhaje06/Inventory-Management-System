-- ============================================
-- CREATE EMPLOYEE PURCHASES TABLE
-- Tracks items purchased by employees (deducted from salary)
-- ============================================

CREATE TABLE IF NOT EXISTS employee_purchases (
  id TEXT PRIMARY KEY DEFAULT ('EP-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '-' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)),
  employee_name TEXT NOT NULL,
  items JSONB NOT NULL,                          -- Array of items: [{id, name, quantity, price, isFreebie}]
  total_quantity INTEGER NOT NULL DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,       -- Total amount (excluding freebies)
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deduction_date DATE NOT NULL,                  -- When to deduct from salary
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deducted', 'cancelled')),
  notes TEXT,
  created_by TEXT,                               -- Username of who recorded it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_employee_purchases_employee_name ON employee_purchases(employee_name);
CREATE INDEX IF NOT EXISTS idx_employee_purchases_purchase_date ON employee_purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_employee_purchases_deduction_date ON employee_purchases(deduction_date);
CREATE INDEX IF NOT EXISTS idx_employee_purchases_status ON employee_purchases(status);
CREATE INDEX IF NOT EXISTS idx_employee_purchases_created_at ON employee_purchases(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_purchases_timestamp()
RETURNS TRIGGER AS $$
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_employee_purchases_timestamp ON employee_purchases;
CREATE TRIGGER trigger_update_employee_purchases_timestamp
  BEFORE UPDATE ON employee_purchases
  FOR EACH ROW EXECUTE FUNCTION update_employee_purchases_timestamp();

-- Add comments
COMMENT ON TABLE employee_purchases IS 'Tracks items purchased by employees to be deducted from salary';
COMMENT ON COLUMN employee_purchases.id IS 'Unique identifier (EP-timestamp-random format)';
COMMENT ON COLUMN employee_purchases.employee_name IS 'Name of the employee who purchased the items';
COMMENT ON COLUMN employee_purchases.items IS 'JSON array of purchased items with details';
COMMENT ON COLUMN employee_purchases.total_quantity IS 'Total quantity of all items';
COMMENT ON COLUMN employee_purchases.amount IS 'Total amount to deduct (excludes freebies)';
COMMENT ON COLUMN employee_purchases.purchase_date IS 'When the purchase was recorded';
COMMENT ON COLUMN employee_purchases.deduction_date IS 'Target date for salary deduction';
COMMENT ON COLUMN employee_purchases.status IS 'pending, deducted, or cancelled';
