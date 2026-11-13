-- Migration: Update employee_purchases table to use employee_name instead of staff_id
-- This removes the foreign key constraint and uses manual text input

-- Drop the old table (WARNING: This will delete all existing data)
DROP TABLE IF EXISTS employee_purchases CASCADE;

-- Create new table with employee_name field
CREATE TABLE employee_purchases (
  id SERIAL PRIMARY KEY,
  
  -- Employee Info (manual text input, no foreign key)
  employee_name TEXT NOT NULL,
  
  -- Purchase Details
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  
  -- Dates
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deduction_date DATE NOT NULL,
  paid_date TIMESTAMPTZ,
  
  -- Status: pending, paid, cancelled
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  
  -- Notes
  notes TEXT,
  created_by TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_employee_purchases_employee_name ON employee_purchases(employee_name);
CREATE INDEX idx_employee_purchases_status ON employee_purchases(status);
CREATE INDEX idx_employee_purchases_deduction_date ON employee_purchases(deduction_date);
CREATE INDEX idx_employee_purchases_created_at ON employee_purchases(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_employee_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_purchases_updated_at_trigger
  BEFORE UPDATE ON employee_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_purchases_updated_at();

-- Comments
COMMENT ON TABLE employee_purchases IS 'Employee salary deduction purchases';
COMMENT ON COLUMN employee_purchases.employee_name IS 'Employee name (manual text input)';
COMMENT ON COLUMN employee_purchases.status IS 'pending, paid, or cancelled';
COMMENT ON COLUMN employee_purchases.deduction_date IS 'Date when amount will be deducted from salary';
COMMENT ON COLUMN employee_purchases.paid_date IS 'Date when purchase was marked as paid';
