# Employee Management - Migration Guide

## Overview
This guide walks you through setting up the Employee Management system for Internal Usage tracking.

## ✅ What's Ready
- Employee API endpoints (GET, POST, PUT, DELETE)
- Employee Management Modal (Add/Edit/Delete employees)
- Updated Use Item Modal (employee dropdown instead of text input)
- Updated Internal Usage API (stores employee_id + name)

## 🚀 Quick Setup (2 minutes)

### Step 1: Run Employee Table Migration
1. Open Supabase Dashboard: https://app.supabase.com/project/quiiedommysvgzfddsnc/sql/new
2. Open file: `CREATE_EMPLOYEES_TABLE.sql`
3. Copy all the SQL
4. Paste in Supabase SQL Editor
5. Click **"Run"**

This creates:
- `employees` table
- Indexes for performance
- Migrates existing names from `internal_usage` to `employees`

### Step 2: Add employee_id Column to internal_usage
1. Stay in Supabase SQL Editor
2. Open file: `ADD_EMPLOYEE_ID_TO_INTERNAL_USAGE.sql`
3. Copy all the SQL
4. Paste in Supabase SQL Editor
5. Click **"Run"**

This adds:
- `employee_id` column to `internal_usage` table
- Foreign key constraint to `employees` table
- Index for performance

### Step 3: Verify Setup
1. Go to: https://app.supabase.com/project/quiiedommysvgzfddsnc/editor
2. Check `employees` table exists with migrated data
3. Check `internal_usage` table has `employee_id` column

### Step 4: Test the Feature
1. Open Internal Usage page
2. Click **"Employees"** button → Add some employees
3. Click **"Use Item"** button
4. In "Requested By" field, you should see employee dropdown (not text input)
5. Select employee → Add items → Submit
6. Verify record is created with employee name

## ✨ What Changed

### Before
```
Use Item Modal:
└─ Requested By: [Text Input] ❌
```

### After
```
Use Item Modal:
└─ Requested By: [Employee Dropdown] ✅
                  - Shows: "Nica - TikTok"
                  - Stores: employee_id + name
```

## 📊 Database Schema

### employees table
```sql
- id (TEXT, PK) - "EMP-123456789"
- name (TEXT) - "Nica"
- department (TEXT) - "TikTok"
- position (TEXT) - "Social Media Manager"
- status (TEXT) - "active" or "inactive"
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### internal_usage table (NEW COLUMN)
```sql
- employee_id (TEXT, FK to employees.id) - Links to employee
- reason (TEXT) - Still stores name for backward compatibility
```

## 🔄 Data Flow

1. User clicks "Use Item"
2. Modal loads active employees from `/api/employees?status=active`
3. User selects employee from dropdown
4. On submit, sends `employeeId` to API
5. API fetches employee details, validates
6. Saves to `internal_usage` with both `employee_id` AND `reason` (name)
7. Old records still work (have `reason` but no `employee_id`)

## 🎯 Benefits

✅ **Data Consistency** - No more typos in names  
✅ **Better Tracking** - Know exact who requested what  
✅ **Employee Management** - Centralized employee list  
✅ **Inactive Handling** - Hide inactive employees from dropdown  
✅ **Department Info** - See employee's department in dropdown  
✅ **Backward Compatible** - Old records still display correctly  

## 🐛 Troubleshooting

### Error: "column employee_id does not exist"
→ Run `ADD_EMPLOYEE_ID_TO_INTERNAL_USAGE.sql` migration

### Error: "Employee not found or inactive"
→ Employee was deleted/deactivated. Add them back in Employees modal

### Dropdown shows "No active employees found"
→ Click "Employees" button and add employees first

### Migration error: "relation employees does not exist"
→ Run `CREATE_EMPLOYEES_TABLE.sql` first, then `ADD_EMPLOYEE_ID_TO_INTERNAL_USAGE.sql`

## 📝 Notes

- The `reason` column remains for backward compatibility with old records
- New records will have both `employee_id` (for linking) and `reason` (for display)
- Inactive employees are hidden from dropdown but not deleted
- The migration automatically imports existing names from internal_usage records
