# 🚀 Run Migration Guide

## Quick Steps

### Option 1: Supabase Dashboard (Recommended)
1. Go to: https://app.supabase.com/project/quiiedommysvgzfddsnc/sql/new
2. Copy the SQL below and paste it
3. Click "Run" button
4. You should see: "Success. No rows returned"

### Option 2: Command Line (Advanced)
If you have `psql` or Supabase CLI installed, you can run:
```bash
supabase db execute --file ADD_INTERNAL_USAGE_RETURNS.sql
```

---

## SQL to Run

Copy this entire block:

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

---

## Verification

After running the migration, verify it worked:

1. Go to: https://app.supabase.com/project/quiiedommysvgzfddsnc/editor
2. Open the `internal_usage` table
3. You should see 4 new columns:
   - `returned_items`
   - `return_status`
   - `last_return_date`
   - `return_history`

---

## Next Steps

1. ✅ Run the migration (above)
2. ✅ Start your dev server: `npm run dev`
3. ✅ Go to: http://localhost:3000/dashboard/internal-usage
4. ✅ Test the "Return Items" button

---

## Troubleshooting

### Error: "column already exists"
✅ Migration already ran - you're good to go!

### Error: "relation internal_usage does not exist"
❌ The internal_usage table doesn't exist. Check your database.

### Error: "permission denied"
❌ Make sure you're logged into the correct Supabase project.

---

**Your Supabase Project**: quiiedommysvgzfddsnc
**Direct SQL Editor Link**: https://app.supabase.com/project/quiiedommysvgzfddsnc/sql/new
