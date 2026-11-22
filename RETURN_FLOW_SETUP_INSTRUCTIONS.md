# Return Flow Setup Instructions

## Overview
The return flow for Demo/Display items has been implemented. This allows tracking when borrowed items are returned and automatically adds them back to inventory.

## Implementation Complete ✅

### 1. Database Migration
- **File**: `ADD_INTERNAL_USAGE_RETURNS.sql`
- **Adds 4 new columns to `internal_usage` table**:
  - `returned_items` (JSONB): Tracks returned quantity per item
  - `return_status` (TEXT): 'pending', 'partial', or 'completed'
  - `last_return_date` (TIMESTAMP): Most recent return date
  - `return_history` (JSONB): Array of all return events

### 2. API Endpoint
- **File**: `app/api/internal-usage/return/route.ts`
- **Endpoint**: POST `/api/internal-usage/return`
- **Functionality**:
  - Accepts person name and array of items to return
  - Updates multiple records if person has borrowed items in different transactions
  - Automatically adds returned items back to inventory
  - Updates return status based on total returned vs requested
  - Creates audit log for each return

### 3. Return Modal Component
- **File**: `components/internal-usage/return-demo-items-modal.tsx`
- **Features**:
  - Step 1: Dropdown of all people who have borrowed demo/display items
  - Step 2: Shows aggregated view of ALL items borrowed by selected person
  - Shows progress bars for each item (returned/total)
  - Allows selecting which items to return with quantity input
  - Validates return quantities
  - Shows total cost summary

### 4. Internal Usage Page Updates
- **File**: `app/dashboard/internal-usage/page.tsx`
- **Changes**:
  - Added "Return Items" button next to "Use Item" button
  - Added "Return Status" column with color-coded badges:
    - 🔴 Red: Pending (0 returned)
    - 🟡 Yellow: Partial (some returned)
    - 🟢 Green: Completed (all returned)
  - Added "Last Return" column showing date/time of last return
  - Badge shows format like "2/3 returned" or "All items returned"

## 🚨 REQUIRED: Run Database Migration

**You MUST run the SQL migration before using the return feature:**

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy the contents of `ADD_INTERNAL_USAGE_RETURNS.sql`
4. Paste and run the SQL script
5. Verify the columns were added successfully

**Migration SQL:**
```sql
-- Add return tracking columns to internal_usage table
ALTER TABLE internal_usage
ADD COLUMN IF NOT EXISTS returned_items JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'pending' CHECK (return_status IN ('pending', 'partial', 'completed')),
ADD COLUMN IF NOT EXISTS last_return_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS return_history JSONB DEFAULT '[]';

-- Add comment for documentation
COMMENT ON COLUMN internal_usage.returned_items IS 'Tracks returned quantity per item: {"itemId": {"returned": 2, "total": 3}}';
COMMENT ON COLUMN internal_usage.return_status IS 'Status: pending (none returned), partial (some returned), completed (all returned)';
COMMENT ON COLUMN internal_usage.last_return_date IS 'Timestamp of most recent return';
COMMENT ON COLUMN internal_usage.return_history IS 'Array of return events with dates and quantities';
```

## How It Works

### Recording Demo/Display Usage
1. Click "Use Item" button
2. Select "Demo / Display" as usage type
3. Enter person's name in "Requested By" field
4. Items are deducted from inventory but NOT counted as sales

### Returning Items
1. Click "Return Items" button (emerald green)
2. Select person from dropdown (shows all who have borrowed items)
3. Modal displays ALL items borrowed by that person across all records
4. Select which items to return and enter quantities
5. Click "Return Items" button
6. Items are automatically added back to inventory
7. Return status and date are updated in the table

### Return Status Logic
- **Pending (Red)**: 0 items returned out of total requested
- **Partial (Yellow)**: Some items returned but not all
- **Completed (Green)**: All items returned

### Example Scenario
**Person: Elsa**
- Transaction 1: Borrowed 1 item (Laptop)
- Transaction 2: Borrowed 3 items (Mouse, Keyboard, Monitor)
- Transaction 3: Borrowed 4 items (Cables, Adapter, Hub, Stand)

**Total**: 8 items across 3 transactions

When returning:
- Dropdown shows "Elsa - 8 items"
- Modal aggregates all 8 items
- Can return items partially (e.g., 5 out of 8)
- System tracks which specific items were returned
- Status updates automatically

## Database Schema

### returned_items (JSONB)
```json
{
  "item-id-123": {
    "returned": 2,
    "total": 3
  },
  "item-id-456": {
    "returned": 1,
    "total": 1
  }
}
```

### return_history (JSONB)
```json
[
  {
    "date": "2026-11-22T10:30:00Z",
    "itemId": "item-id-123",
    "itemName": "Laptop",
    "quantity": 1,
    "returnedBy": "Admin User"
  },
  {
    "date": "2026-11-23T14:15:00Z",
    "itemId": "item-id-123",
    "itemName": "Laptop",
    "quantity": 1,
    "returnedBy": "Admin User"
  }
]
```

## Testing Checklist

- [ ] Run SQL migration in Supabase
- [ ] Create a demo/display record with multiple items
- [ ] Verify items are deducted from inventory
- [ ] Click "Return Items" button
- [ ] Verify person appears in dropdown
- [ ] Select person and verify all items are shown
- [ ] Return some items (partial return)
- [ ] Verify inventory is updated
- [ ] Verify "Return Status" shows "Partial" with yellow badge
- [ ] Return remaining items
- [ ] Verify "Return Status" shows "All items returned" with green badge
- [ ] Check "Last Return" column shows correct date/time

## Notes

- Only Demo/Display items can be returned (not Internal Use items)
- Return Status and Last Return columns show "—" for Internal Use records
- Multiple people can have items borrowed simultaneously
- Same person can have multiple separate transactions
- All items from all transactions are aggregated in the return modal
- Progress bars show visual indication of return completion
- Return history maintains full audit trail

## Next Steps (Optional Enhancements)

1. Add "View Return History" button to see detailed return events
2. Add filtering by return status in the table
3. Add notifications when items are overdue
4. Export return report to Excel
5. Add ability to cancel/undo a return (admin only)
