-- Add employee_id column to internal_usage table
-- This allows tracking which employee requested the internal usage

ALTER TABLE internal_usage
ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_internal_usage_employee_id ON internal_usage(employee_id);

-- Add foreign key constraint (optional, helps maintain data integrity)
ALTER TABLE internal_usage
ADD CONSTRAINT fk_internal_usage_employee
FOREIGN KEY (employee_id) REFERENCES employees(id)
ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN internal_usage.employee_id IS 'Foreign key to employees table - tracks who requested the items';

-- Note: The existing 'reason' column will remain for backward compatibility
-- New records will use employee_id, old records will still have reason text
