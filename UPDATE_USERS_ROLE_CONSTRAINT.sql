-- ============================================
-- UPDATE USERS ROLE CONSTRAINT
-- Update the role check constraint to match current roles
-- ============================================

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with current roles only
-- Roles: admin, logistics-admin, operations, packer
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'logistics-admin', 'operations', 'packer'));

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this, you can create accounts with these roles:
-- - admin
-- - logistics-admin
-- - operations (Operations Staff/Agent)
-- - packer
-- ============================================
