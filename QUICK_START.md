# ⚡ Quick Start - Return Flow

## 🎯 What's New?

You can now track and return Demo/Display items!

---

## 📝 3-Minute Setup

### 1️⃣ Run SQL Migration (1 min)

**Option A: Supabase Dashboard**
1. Open: https://app.supabase.com/project/quiiedommysvgzfddsnc/sql/new
2. Paste the SQL from `ADD_INTERNAL_USAGE_RETURNS.sql`
3. Click "Run"

**Option B: Copy-Paste**
```sql
ALTER TABLE internal_usage
ADD COLUMN IF NOT EXISTS returned_items JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_return_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS return_history JSONB DEFAULT '[]';
```

### 2️⃣ Start Dev Server (30 sec)
```bash
npm run dev
```

### 3️⃣ Test It! (1.5 min)
1. Go to: http://localhost:3000/dashboard/internal-usage
2. Click **"Use Item"** → Create demo/display record
3. Click **"Return Items"** → Return the items
4. ✅ See the status badges update!

---

## 🎨 What You'll See

### New UI Elements

**1. Return Items Button**
```
┌─────────────────────────────────────────────┐
│  Internal Usage                             │
│  Track items used for demo...               │
│                                             │
│              [ Return Items ] [ Use Item ]  │
└─────────────────────────────────────────────┘
```

**2. New Table Columns**
```
┌─────────┬─────────┬────────────────┬──────────────┐
│ Type    │ Return Status     │ Last Return  │
├─────────┼────────────────┼──────────────┤
│ Demo    │ 🔴 0/5 returned  │ —            │
│ Demo    │ 🟡 2/5 returned  │ Nov 22, 2026 │
│ Demo    │ 🟢 All returned  │ Nov 22, 2026 │
│ Internal│ —              │ —            │
└─────────┴────────────────┴──────────────┘
```

**3. Return Modal**
```
┌────────────────────────────────┐
│  🔄 Return Demo/Display Items  │
├────────────────────────────────┤
│  ① Select Person               │
│  [ Elsa - 8 items        ▼ ]  │
│                                │
│  ② Select Items to Return      │
│  ☑ Laptop    Return: [2]       │
│  ☑ Mouse     Return: [3]       │
│                                │
│  2 items  |  Total: ₱11,500   │
│  [ Cancel ]  [ Return Items ]  │
└────────────────────────────────┘
```

---

## 📖 How to Use

### Borrowing Items (Demo/Display)
```
1. Click "Use Item"
2. Select "Demo / Display"
3. Enter person's name
4. Add items
5. Submit
   → Items deducted from inventory
   → Shows as 🔴 pending in table
```

### Returning Items
```
1. Click "Return Items"
2. Select person from dropdown
3. Check items to return
4. Enter quantities
5. Submit
   → Items added back to inventory
   → Status badge updates
   → Last return date recorded
```

### Return Status Badges

- 🔴 **Pending**: No items returned yet
  - Example: "0/5 returned"

- 🟡 **Partial**: Some items returned
  - Example: "2/5 returned"

- 🟢 **Completed**: All items returned
  - Example: "All items returned"

---

## 🔍 Key Features

### ✅ Smart Aggregation
If same person borrowed items in 3 separate transactions:
- Transaction 1: 2 items
- Transaction 2: 3 items  
- Transaction 3: 5 items

**Return modal shows**: All 10 items in one view!

### ✅ Partial Returns
Don't need to return everything at once:
- Return 3 items today
- Return 4 items next week
- Return 3 items later
- System tracks each return

### ✅ Auto Inventory
Items automatically added back to inventory when returned.

### ✅ Audit Trail
Full history of who returned what and when.

---

## 💡 Examples

### Example 1: Product Demo
```
Elsa borrows:
- 1 Laptop
- 1 Mouse
- 1 HDMI Cable

After demo (3 days later):
- Returns all 3 items
- Status: 🟢 All items returned
- Inventory: +3 items
```

### Example 2: Display Items
```
Anna borrows for display:
- 5 Products for Facebook store display

Returns gradually:
- Day 1: Returns 2 items → 🟡 2/5 returned
- Day 5: Returns 2 more → 🟡 4/5 returned
- Day 10: Returns last 1 → 🟢 All items returned
```

### Example 3: Multiple Transactions
```
Kristoff borrows over time:
- Jan 15: 3 items
- Feb 20: 2 items
- Mar 10: 5 items

Total: 10 items across 3 transactions

Return modal shows:
- All 10 items in one view
- Can select any items from any transaction
- Each transaction updates its status independently
```

---

## ⚠️ Important Notes

1. **Demo/Display Only**: Return feature only for demo/display items, not internal use

2. **Inventory Impact**: 
   - Borrow: Deducts from inventory ✅
   - Return: Adds back to inventory ✅
   - Does NOT count as sales ✅

3. **Multiple Records**: Same person can have multiple separate borrowing records

4. **Status Per Record**: Each transaction has its own return status

---

## 🚦 Status Flow

```
New Record
    ↓
🔴 Pending (0 returned)
    ↓
  Return some items
    ↓
🟡 Partial (X/Y returned)
    ↓
  Return remaining items
    ↓
🟢 Completed (All returned)
```

---

## 📞 Need Help?

### Check These Files:
- `RETURN_FLOW_SUMMARY.md` - Full technical details
- `TESTING_GUIDE.md` - Complete testing scenarios
- `RETURN_FLOW_SETUP_INSTRUCTIONS.md` - Setup instructions

### Common Questions:

**Q: Can I return internal use items?**
A: No, only demo/display items can be returned.

**Q: What if I enter wrong quantity?**
A: System validates and prevents returning more than borrowed.

**Q: Can I undo a return?**
A: Not yet - this is a future enhancement.

**Q: Where's the return history?**
A: It's tracked in the database. A "View History" feature can be added.

---

## ✅ Quick Verification

After setup, verify:
- [ ] "Return Items" button appears (emerald green)
- [ ] Table has "Return Status" column
- [ ] Table has "Last Return" column
- [ ] Return modal opens when clicked
- [ ] Demo records appear in person dropdown
- [ ] Items can be returned successfully
- [ ] Status badges update correctly
- [ ] Inventory quantities update

---

## 🎉 You're Ready!

The return flow is fully implemented and ready to use. 

**Time to test**: ~5 minutes
**Time to master**: ~15 minutes

Start with creating a simple demo record and returning it!

---

**Created**: November 22, 2026
**Version**: 1.0.0
**Status**: ✅ Production Ready
