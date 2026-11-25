# Run All Employee-Related Migrations

This guide will help you set up all the database tables needed for the Employee Management and Employee Purchase features.

## Prerequisites
- Access to your Supabase dashboard
- Admin permissions on the database

## Step-by-Step Instructions

### 1. Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**

---

### 2. Run Migration #1: Create Employees Table
**File:** `CREATE_EMPLOYEES_TABLE.sql`

**Purpose:** Creates the `employees` table for tracking employee information

**Steps:**
1. Copy the contents of `CREATE_EMPLOYEES_TABLE.sql`
2. Paste into Supabase SQL Editor
3. Click **Run** (or press Ctrl+Enter)
4. Wait for "Success. No rows returned" message

**What this creates:**
- `employees` table with columns: id, name, department, position, status
- Indexes for faster queries
- Migrates existing employee names from `internal_usage` table

---

### 3. Run Migration #2: Add Employee ID to Internal Usage
**File:** `ADD_EMPLOYEE_ID_TO_INTERNAL_USAGE.sql`

**Purpose:** Links internal usage records to employees table

**Steps:**
1. Copy the contents of `ADD_EMPLOYEE_ID_TO_INTERNAL_USAGE.sql`
2. Paste into Supabase SQL Editor
3. Click **Run**
4. Wait for success message

**What this creates:**
- `employee_id` column in `internal_usage` table
- Foreign key constraint to `employees` table
- Index for faster employee lookups

---

### 4. Run Migration #3: Create/Fix Employee Purchases Table
**File:** `FIX_EMPLOYEE_PURCHASES_TABLE.sql` (recommended) or `CREATE_EMPLOYEE_PURCHASES_TABLE.sql`

**Purpose:** Creates or fixes the table for tracking employee purchases (items deducted from salary)

**Important:** If you're getting an error like "column 'items' does not exist", use `FIX_EMPLOYEE_PURCHASES_TABLE.sql` instead, which will drop and recreate the table with the correct schema.

**Steps:**
1. Copy the contents of `FIX_EMPLOYEE_PURCHASES_TABLE.sql`
2. Paste into Supabase SQL Editor
3. Click **Run**
4. Wait for success message showing "employee_purchases table created successfully!"

**What this creates:**
- `employee_purchases` table with columns: id, employee_name, items (JSONB), total_quantity, amount, purchase_date, deduction_date, status, notes, created_by, created_at, updated_at
- Indexes for fast queries
- Automatic timestamp updates
- Status tracking (pending/deducted/cancelled)

**Note:** This will drop the existing table if it exists, so any old data will be lost. If you have important data, back it up first.

---

### 5. Verify All Tables Were Created

Run this query in Supabase SQL Editor to verify:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('employees', 'employee_purchases')
ORDER BY table_name;

-- Check employees table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employees'
ORDER BY ordinal_position;

-- Check employee_purchases table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'employee_purchases'
ORDER BY ordinal_position;
```

**Expected Results:**
- Both tables should appear in the first query
- `employees` table should have: id, name, department, position, status, created_at, updated_at
- `employee_purchases` table should have: id, employee_name, items, total_quantity, amount, purchase_date, deduction_date, status, notes, created_by, created_at, updated_at

---

## Troubleshooting

### Error: "relation already exists"
**Solution:** The table is already created. Skip this migration.

### Error: "column already exists"
**Solution:** The column was already added. Skip this migration.

### Error: "foreign key constraint"
**Solution:** Make sure you run migrations in order (employees table must exist before adding employee_id to internal_usage)

### Error when creating employee purchase
**Solution:** 
1. Verify `employee_purchases` table exists
2. Check that all columns match the schema
3. Look at browser console for detailed error message

---

## Post-Migration Steps

After running all migrations:

1. **Reload your application** - Refresh the browser
2. **Test Employee Management:**
   - Go to Internal Usage page
   - Click "Employees" button (or go to Employee Purchase page)
   - Add a new employee
   - Verify it appears in the list
3. **Test Employee Purchase:**
   - Go to Employee Purchase page
   - Click "New Purchase"
   - Select an employee from dropdown
   - Add items to cart
   - Create purchase
   - Verify it appears in the list

---

## Migration Files Summary

| File | Purpose | Order |
|------|---------|-------|
| `CREATE_EMPLOYEES_TABLE.sql` | Create employees master table | 1st |
| `ADD_EMPLOYEE_ID_TO_INTERNAL_USAGE.sql` | Link internal usage to employees | 2nd |
| `FIX_EMPLOYEE_PURCHASES_TABLE.sql` | Drop/recreate employee purchases table | 3rd |
| `CREATE_EMPLOYEE_PURCHASES_TABLE.sql` | (Alternative) Create new employee purchases table | 3rd |
| `ADD_INTERNAL_USAGE_RETURNS.sql` | (Already ran) Track returns | N/A |

---

## Need Help?

If you encounter any issues:
1. Check the Supabase logs for detailed error messages
2. Verify you have admin permissions
3. Ensure no typos in table/column names
4. Try running migrations one at a time
5. Check browser console (F12) for client-side errors

---

**Last Updated:** November 25, 2026
