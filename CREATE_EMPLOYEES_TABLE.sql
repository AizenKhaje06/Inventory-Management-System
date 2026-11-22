-- Create employees table for tracking demo/display requesters
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT,
  position TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

-- Add comments
COMMENT ON TABLE employees IS 'Stores employee information for internal usage tracking';
COMMENT ON COLUMN employees.id IS 'Unique identifier (EMP-timestamp format)';
COMMENT ON COLUMN employees.name IS 'Full name of the employee';
COMMENT ON COLUMN employees.department IS 'Department: Facebook, TikTok, Shopee, Lazada, Office';
COMMENT ON COLUMN employees.position IS 'Job position/title (optional)';
COMMENT ON COLUMN employees.status IS 'active or inactive - inactive employees are hidden from dropdowns';

-- Migrate existing names from internal_usage to employees
INSERT INTO employees (id, name, department, status, created_at)
SELECT 
  'EMP-' || EXTRACT(EPOCH FROM MIN(created_at))::BIGINT::TEXT || '-' || ROW_NUMBER() OVER (ORDER BY reason) AS id,
  reason AS name,
  department,
  'active' AS status,
  MIN(created_at) AS created_at
FROM internal_usage
WHERE usage_type = 'demo'
  AND reason IS NOT NULL
  AND reason != ''
GROUP BY reason, department
ON CONFLICT (id) DO NOTHING;
