-- Migration: Simplify System to 2 Roles Only
-- Date: 2026-01-29
-- Description: Remove complex role system, keep only admin and logistics-admin

-- ============================================
-- STEP 1: Update users table constraint
-- ============================================

-- Drop old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint for 2 roles only
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'logistics-admin'));

-- ============================================
-- STEP 2: Update existing users to valid roles
-- ============================================

-- Convert operations → logistics-admin
UPDATE users 
SET role = 'logistics-admin' 
WHERE role = 'operations';

-- Convert packer → logistics-admin
UPDATE users 
SET role = 'logistics-admin' 
WHERE role = 'packer';

-- Convert tracker → logistics-admin
UPDATE users 
SET role = 'logistics-admin' 
WHERE role = 'tracker';

-- Convert dept-manager → admin
UPDATE users 
SET role = 'admin' 
WHERE role = 'dept-manager';

-- ============================================
-- STEP 3: Drop unnecessary tables (optional)
-- ============================================

-- Drop department-related tables
DROP TABLE IF EXISTS department_agents CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- Drop order tracking tables (if using simplified inventory)
-- COMMENTED OUT - uncomment if you want to remove order tracking entirely
-- DROP TABLE IF EXISTS order_items CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS dispatch_tracking CASCADE;

-- ============================================
-- STEP 4: Clean up RLS policies
-- ============================================

-- Remove policies for deleted roles
DROP POLICY IF EXISTS "packer_select_policy" ON orders;
DROP POLICY IF EXISTS "tracker_select_policy" ON orders;
DROP POLICY IF EXISTS "dept_manager_select_policy" ON orders;

-- Add comment
COMMENT ON TABLE users IS 'User accounts - Simplified to 2 roles: admin and logistics-admin';

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all users have valid roles
-- SELECT username, role FROM users;

-- Check for any orphaned role references
-- SELECT DISTINCT role FROM users;

