# POS Stock Display Fix

## 🐛 Issue Found

**Problem**: POS page showing **800** stocks instead of **700** (good stocks only)

**Example:**
- Product: Niacinamide Soap
- Total Stock: 800
- Good Stock: 700
- Bad Stock: 100
- **POS showed**: 800 ❌
- **POS should show**: 700 ✅

---

## 🔧 Root Cause

**API Mapping Mismatch** - The products API was using **camelCase** for bad stock fields, but the TypeScript type and POS code expect **snake_case**.

### Before (Incorrect):
```typescript
// app/api/products/route.ts
itemStatus: item.item_status,        // camelCase
badItemReason: item.bad_item_reason,  // camelCase
badItemQuantity: item.bad_item_quantity,  // camelCase ❌
badItemsBreakdown: item.bad_items_breakdown  // camelCase
```

### After (Fixed):
```typescript
// app/api/products/route.ts
item_status: item.item_status,           // snake_case
bad_item_reason: item.bad_item_reason,   // snake_case
bad_item_quantity: item.bad_item_quantity,   // snake_case ✅
bad_items_breakdown: item.bad_items_breakdown  // snake_case
```

---

## ✅ Solution Applied

**File Changed**: `app/api/products/route.ts`

Fixed the field mapping to use `bad_item_quantity` (snake_case) instead of `badItemQuantity` (camelCase).

---

## 📊 How It Works Now

### POS Page Calculation:
```typescript
// Line 81-85 in app/dashboard/pos/page.tsx
const getSellableQuantity = (item: InventoryItem): number => {
  const badQuantity = item.bad_item_quantity || 0  // Now correctly reads from API
  return Math.max(0, item.quantity - badQuantity)  // 800 - 100 = 700 ✅
}
```

### Stock Badge Display:
```typescript
// Line 504 in app/dashboard/pos/page.tsx
{isOutOfStock ? "OUT" : sellableQty}  // Shows 700 ✅
```

---

## 🧪 Testing Instructions

1. **Set up test product** (if not already done):
   - Go to Inventory page
   - Find "Niacinamide Soap" (or any product)
   - Edit product
   - Set: Total Stock = 800, Bad Stock = 100

2. **Check Product Page**:
   - Stock column should show: **800**
   - Status column should show:
     - Green bar: **700** (Good)
     - Red bar: **100** (Bad)

3. **Check POS Page**:
   - Stock badge (top-right of product card) should show: **700** ✅
   - NOT 800 ❌

4. **Test Cart**:
   - Add product to cart
   - Try to add 700 units → Should work ✅
   - Try to add 701 units → Should be blocked with warning ✅

---

## 🎯 Expected Results After Fix

### Product Page (Inventory):
```
[700] ████████████ Good (Green bar)
[100] ██           Bad (Red bar)
Total: 800
```

### POS Page:
```
Product Card Badge: 700  ✅ (was 800 before fix)
```

### Cart Validation:
```
Maximum quantity: 700  ✅
Adding 701+: BLOCKED  ✅
```

---

## 📝 Related Files

- ✅ **Fixed**: `app/api/products/route.ts` - API mapping corrected
- ✅ **Already Correct**: `app/dashboard/pos/page.tsx` - Uses getSellableQuantity()
- ✅ **Already Correct**: `lib/types.ts` - Uses snake_case format
- ✅ **Already Correct**: `DATABASE_SCHEMA.sql` - Has bad_item_quantity field

---

## 🚀 Status

✅ **FIXED** - POS now correctly displays only good stock (700) instead of total stock (800)

The system now properly:
1. Fetches bad_item_quantity from database
2. Maps it correctly in API response
3. Calculates sellable quantity (total - bad)
4. Displays only sellable stock in POS
5. Validates cart quantities against sellable stock

---

## 🔄 Next Steps

1. Refresh POS page (Ctrl+F5 or Cmd+Shift+R)
2. Verify stock badge shows 700 (not 800)
3. Test add to cart functionality
4. Confirm maximum quantity is 700

**No database changes needed** - only API mapping was corrected!
