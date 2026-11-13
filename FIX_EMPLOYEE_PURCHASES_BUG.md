# Employee Purchases Bug Fix - Multiple Records Issue

## Problem
When creating 1 purchase order with 3 items, the system was creating **3 separate database records** instead of **1 purchase with 3 items**.

## Root Cause
The `POST /api/employee-purchases` endpoint was looping through the items array and creating individual database records for each item:

```typescript
// OLD CODE (BUGGY)
const purchaseRecords = items.map((item: any) => ({
  employee_name: employee_name.trim(),
  item_name: item.name,
  quantity: item.quantity,
  amount: item.price * item.quantity,
  // ...
}))

await supabaseAdmin.from('employee_purchases').insert(purchaseRecords) // Multiple inserts!
```

## Solution
Changed the database schema and API to store all items as a **JSONB array in a single purchase record**.

### Changes Made

#### 1. Database Schema Update (`MIGRATE_EMPLOYEE_PURCHASES_FIX.sql`)
- Removed: `item_name TEXT`, `quantity INTEGER`
- Added: `items JSONB` - stores entire items array
- Added: `total_quantity INTEGER` - sum of all item quantities
- Changed: `amount` now stores the total purchase amount
- Added: GIN index on `items` for efficient JSON queries

**Old Schema:**
```sql
CREATE TABLE employee_purchases (
  id SERIAL PRIMARY KEY,
  employee_name TEXT NOT NULL,
  item_name TEXT NOT NULL,        -- Single item per record
  quantity INTEGER NOT NULL,       -- Single quantity
  amount DECIMAL(10, 2) NOT NULL,
  -- ...
)
```

**New Schema:**
```sql
CREATE TABLE employee_purchases (
  id SERIAL PRIMARY KEY,
  employee_name TEXT NOT NULL,
  items JSONB NOT NULL,                    -- Array of items [{id, name, quantity, price, isFreebie}]
  total_quantity INTEGER NOT NULL,         -- Total of all item quantities
  amount DECIMAL(10, 2) NOT NULL,          -- Total purchase amount
  -- ...
)
```

#### 2. API Route Update (`app/api/employee-purchases/route.ts`)
- Now creates **1 single record** per purchase order
- Stores items as JSON array
- Calculates `total_quantity` and `amount` from all items
- Creates human-readable summary in `notes` field

**New API Logic:**
```typescript
// Calculate totals
const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
const calculatedTotal = items.reduce((sum, item) => {
  const itemPrice = item.isFreebie ? 0 : (item.price * item.quantity)
  return sum + itemPrice
}, 0)

// Create single record
const purchaseRecord = {
  employee_name: employee_name.trim(),
  items: JSON.stringify(items),  // Store as JSON
  total_quantity: totalQuantity,
  amount: calculatedTotal,
  // ...
}

const { data: created } = await supabaseAdmin
  .from('employee_purchases')
  .insert(purchaseRecord)
  .select()
  .single()  // Returns single record, not array
```

#### 3. Table Component Update (`components/employee-purchases/purchases-table.tsx`)
- Updated interface to handle `items` as JSONB
- Added helper functions to parse JSON items
- Changed columns: "Item" → "Items", "Qty" → "Total Qty"
- Shows item summary: "Berry Soap +2 more" for multiple items
- Updated CSV export to include all items

**New Display Logic:**
```typescript
const getParsedItems = (purchase: Purchase): PurchaseItem[] => {
  if (typeof purchase.items === 'string') {
    return JSON.parse(purchase.items)
  }
  return purchase.items || []
}

const getItemsSummary = (purchase: Purchase): string => {
  const items = getParsedItems(purchase)
  if (items.length === 1) return items[0].name
  return `${items[0].name} +${items.length - 1} more`
}
```

## Migration Steps

### Step 1: Backup Current Data (if any exists)
```sql
-- Export existing data before migration
SELECT * FROM employee_purchases;
```

### Step 2: Run Migration Script
```bash
# Execute the migration SQL file in your Supabase SQL editor
# File: MIGRATE_EMPLOYEE_PURCHASES_FIX.sql
```

**⚠️ WARNING:** This migration will **DROP** the existing table. Make sure to backup data first!

### Step 3: Verify Schema
```sql
-- Check new structure
\d employee_purchases

-- Should show:
-- - items (jsonb)
-- - total_quantity (integer)
-- - amount (numeric)
```

## Testing

### Test Case 1: Single Item Purchase
**Input:**
- Employee: "John Doe"
- Items: [{ name: "Berry Soap", quantity: 2, price: 150 }]

**Expected Result:**
- 1 database record created
- `items`: `[{"id":1,"name":"Berry Soap","quantity":2,"price":150,"isFreebie":false}]`
- `total_quantity`: 2
- `amount`: 300
- `notes`: "Berry Soap (2x)"

### Test Case 2: Multiple Items Purchase
**Input:**
- Employee: "Jane Smith"
- Items: 
  - Berry Soap (1x) - ₱150
  - Volcanic Mud (2x) - ₱200
  - Face Cream (1x) - ₱180 [Freebie]

**Expected Result:**
- **1 database record created** (not 3!)
- `items`: JSON array with 3 items
- `total_quantity`: 4
- `amount`: 550 (excludes freebie)
- `notes`: "Berry Soap (1x), Volcanic Mud (2x), Face Cream (1x) [Freebie]"

### Test Case 3: All Freebies
**Input:**
- Employee: "Bob Johnson"
- Items: All marked as freebies

**Expected Result:**
- 1 database record created
- `amount`: 0
- Items stored in JSON with `isFreebie: true`

## Benefits of This Fix

1. **Data Integrity**: One purchase order = one database record
2. **Better Queries**: Can fetch purchase order with all items in single query
3. **Accurate Reporting**: Total amounts per purchase are correct
4. **Flexible**: Can add unlimited items to a purchase without schema changes
5. **Freebie Support**: Can mix paid and free items in same purchase
6. **Performance**: Fewer database rows, faster queries

## Files Modified

1. `app/api/employee-purchases/route.ts` - API logic fixed
2. `components/employee-purchases/purchases-table.tsx` - Display logic updated
3. `MIGRATE_EMPLOYEE_PURCHASES_FIX.sql` - New migration script created

## Files to Keep

- `components/employee-purchases/new-purchase-modal.tsx` - No changes needed (works with new API)
- `app/dashboard/employee-purchases/page.tsx` - No changes needed
- `app/api/employee-purchases/[id]/route.ts` - Should work with new schema (PATCH updates still work)

## Next Steps

1. ✅ Run the migration SQL script
2. ✅ Test creating purchases with multiple items
3. ✅ Verify only 1 record is created per purchase
4. ✅ Test marking purchases as paid/cancelled
5. ✅ Test CSV export with new format

## Rollback Plan (if needed)

If issues occur, restore from backup and use the old schema:
```sql
-- Restore old table structure
-- Run: CREATE_EMPLOYEE_PURCHASES_TABLE.sql or MIGRATE_EMPLOYEE_PURCHASES.sql
```

---

**Status**: ✅ **FIXED** - One purchase order now creates exactly ONE database record with items stored as JSON array.
