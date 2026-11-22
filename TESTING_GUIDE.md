# 🧪 Testing Guide - Return Flow

## Pre-requisites
- ✅ SQL migration ran successfully
- ✅ Dev server running: `npm run dev`
- ✅ Logged into the system

---

## Test Scenario 1: Basic Return Flow

### Step 1: Create a Demo/Display Record
1. Go to: http://localhost:3000/dashboard/internal-usage
2. Click **"Use Item"** button (blue)
3. Fill in the form:
   - **Department**: Facebook
   - **Usage Type**: Demo / Display
   - **Requested By**: `Elsa` (or any name)
   - **Notes**: "For product demo"
4. Add items:
   - Search for products
   - Click on 3-5 different products
   - Adjust quantities if needed
5. Click **"Record Usage"**
6. ✅ Verify: Items appear in the table

### Step 2: Check Initial Status
Look at the newly created record in the table:
- **Return Status**: Should show 🔴 "0/[total] returned" (red badge)
- **Last Return**: Should show "—"

### Step 3: Return Some Items (Partial Return)
1. Click **"Return Items"** button (emerald green)
2. **Select Person**: Choose `Elsa` from dropdown
3. ✅ Verify: All items borrowed by Elsa are shown
4. **Select Items**: Check 2 out of the items shown
5. **Enter Quantities**: Leave default (should be max available)
6. ✅ Verify: Summary shows correct count and total cost
7. Click **"Return Items (2)"**
8. ✅ Verify: Success toast appears
9. ✅ Verify: Table refreshes automatically

### Step 4: Check Partial Status
Look at the updated record:
- **Return Status**: Should show 🟡 "[X]/[total] returned" (yellow badge)
- **Last Return**: Should show today's date and time

### Step 5: Return Remaining Items
1. Click **"Return Items"** button again
2. **Select Person**: Choose `Elsa` again
3. ✅ Verify: Only unreturned items are shown
4. ✅ Verify: Progress bars show partial completion
5. **Select Items**: Check all remaining items
6. Click **"Return Items (X)"**
7. ✅ Verify: Success toast appears

### Step 6: Check Completed Status
Look at the updated record:
- **Return Status**: Should show 🟢 "All items returned" (green badge)
- **Last Return**: Should show updated date/time

### Step 7: Verify Inventory
1. Go to: http://localhost:3000/dashboard/inventory
2. ✅ Verify: All returned items have correct quantities
3. ✅ Compare quantities before borrowing and after returning

---

## Test Scenario 2: Multiple Transactions - Same Person

### Step 1: Create Multiple Records
1. Create 3 separate Demo/Display records for the same person:
   
   **Record 1**:
   - Requested By: `Anna`
   - Items: 2 items (e.g., Laptop, Mouse)

   **Record 2**:
   - Requested By: `Anna`
   - Items: 3 items (e.g., Keyboard, Monitor, Cable)

   **Record 3**:
   - Requested By: `Anna`
   - Items: 1 item (e.g., Adapter)

2. ✅ Verify: 3 separate rows in table, all showing 🔴 pending status

### Step 2: Return Items Across Transactions
1. Click **"Return Items"**
2. **Select Person**: Choose `Anna`
3. ✅ **IMPORTANT**: Verify all 6 items appear (aggregated from all 3 transactions)
4. Select items from different transactions
5. Return them

### Step 3: Check Individual Transaction Status
- ✅ Transaction 1: Should show partial or completed (depending on returns)
- ✅ Transaction 2: Should show partial or completed (depending on returns)
- ✅ Transaction 3: Should show partial or completed (depending on returns)
- ✅ Each transaction tracks its own return status independently

---

## Test Scenario 3: Internal Use (Should NOT Show Return Options)

### Step 1: Create Internal Use Record
1. Click **"Use Item"**
2. **Usage Type**: Select "Internal Use"
3. **Requested By**: `Office`
4. Add items and submit

### Step 2: Verify Return Columns
Look at the Internal Use record:
- **Return Status**: Should show "—" (not applicable)
- **Last Return**: Should show "—" (not applicable)

### Step 3: Try to Return
1. Click **"Return Items"**
2. ✅ Verify: Internal Use records do NOT appear in person dropdown
3. ✅ Only Demo/Display records should be returnable

---

## Test Scenario 4: Edge Cases

### Test 4.1: Return More Than Borrowed
1. Open return modal
2. Try to enter quantity higher than available
3. ✅ Verify: Input is clamped to max available
4. ✅ Cannot return more than borrowed

### Test 4.2: Empty Person Selection
1. Click **"Return Items"**
2. Don't select any person
3. Try to submit
4. ✅ Verify: Error toast "Please select a person"

### Test 4.3: No Items Selected
1. Click **"Return Items"**
2. Select a person
3. Don't check any items
4. Try to submit
5. ✅ Verify: Error toast "Please select at least one item"

### Test 4.4: Zero Quantity
1. Select a person and item
2. Change quantity to 0
3. Try to submit
4. ✅ Verify: Error toast "Return quantity must be greater than 0"

### Test 4.5: All Items Already Returned
1. Return all items for a person
2. Click **"Return Items"** again
3. Select the same person
4. ✅ Verify: Modal shows "All items returned!" message
5. ✅ Verify: No items available to return

---

## Visual Verification Checklist

### Table View
- [ ] Return Status column displays correctly
- [ ] Last Return column shows date/time
- [ ] Red badges for pending (0 returned)
- [ ] Yellow badges for partial returns
- [ ] Green badges for completed returns
- [ ] Badge text format: "X/Y returned" or "All items returned"
- [ ] Internal Use rows show "—" in return columns

### Return Modal
- [ ] Modal opens smoothly
- [ ] Person dropdown shows all demo borrowers
- [ ] Person dropdown shows item counts
- [ ] Items are aggregated correctly
- [ ] Progress bars display correctly
- [ ] Images load properly
- [ ] Quantity inputs work
- [ ] Cost calculations are accurate
- [ ] Summary section shows correct totals
- [ ] Submit button disabled when appropriate

### Inventory
- [ ] Quantities increase after returns
- [ ] Correct amounts added back

### Logs (Optional)
- [ ] Check browser console for any errors
- [ ] Check Network tab for API calls
- [ ] Verify API returns 200 status

---

## Performance Testing

### Large Dataset
1. Create 20+ demo records with different people
2. Add 5+ items per record
3. Test return modal performance:
   - [ ] Dropdown loads quickly
   - [ ] Modal renders smoothly
   - [ ] No lag when selecting items

### Multiple Returns
1. Return items 10 times rapidly
2. Check:
   - [ ] No duplicate returns
   - [ ] Inventory stays accurate
   - [ ] Status updates correctly

---

## API Testing (Advanced)

### Test Return Endpoint Directly

```bash
# Test return API
curl -X POST http://localhost:3000/api/internal-usage/return \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "personName": "Elsa",
    "items": [
      {
        "itemId": "item-123",
        "itemName": "Laptop",
        "returnQuantity": 1
      }
    ]
  }'
```

Expected Response:
```json
{
  "success": true
}
```

---

## Database Verification (Advanced)

### Check Return Data Structure

1. Go to Supabase Table Editor
2. Open `internal_usage` table
3. Find a record where items were returned
4. Check `returned_items` column (JSONB):

```json
{
  "item-123": {
    "returned": 2,
    "total": 3
  }
}
```

5. Check `return_history` column (JSONB):

```json
[
  {
    "date": "2026-11-22T10:30:00.000Z",
    "itemId": "item-123",
    "itemName": "Laptop",
    "quantity": 1,
    "returnedBy": "Admin User"
  }
]
```

---

## Common Issues & Solutions

### Issue: Return button doesn't appear
**Solution**: Refresh the page or clear browser cache

### Issue: Person doesn't show in dropdown
**Solution**: 
- Check usage_type is 'demo' (not 'internal')
- Verify migration ran successfully
- Check browser console for errors

### Issue: Inventory not updating
**Solution**:
- Check browser Network tab for API errors
- Verify API endpoint is accessible
- Check server logs

### Issue: Progress bars not showing
**Solution**:
- Check that returned_items data structure is correct
- Verify calculations in component

### Issue: Badge colors wrong
**Solution**:
- Check return_status values in database
- Verify Tailwind classes are loaded

---

## Success Criteria

✅ All test scenarios pass
✅ No console errors
✅ Return Status badges display correctly
✅ Last Return dates are accurate
✅ Inventory quantities update properly
✅ Multiple transactions aggregate correctly
✅ Internal Use records excluded from returns
✅ Edge cases handled gracefully
✅ UI is responsive and smooth
✅ Data persists after page refresh

---

## Next Steps After Testing

1. ✅ Test in production environment
2. ✅ Train users on the return flow
3. ✅ Monitor for any issues
4. ✅ Consider optional enhancements:
   - View return history modal
   - Export return reports
   - Set up return reminders
   - Add return deadline tracking

---

**Happy Testing! 🎉**

If you encounter any issues, check the browser console and Network tab for error messages.
