# Cart Quantity Limit Enhancement

## 🎯 Requirement

**Cart Summary Modal** - Quantity input should be **limited to good stocks only**, not total stocks.

**Example:**
- Total Stock: 800
- Good Stock: 700 ✅
- Bad Stock: 100
- **Max Quantity Allowed**: 700 (not 800)

---

## ✅ Enhancements Applied

### 1. **Visual Max Limit Label**

Added "Max: XXX" indicator next to Quantity label:

```
Quantity (Max: 700)
[___700___]
```

### 2. **Warning Toast on Exceed**

When user tries to enter 701 or higher:
- Shows toast warning: "⚠️ Maximum available stock is 700 units"
- Automatically caps quantity to 700

### 3. **Available Stock Display**

Added "Available: XXX units" text below product details:

```
Niacinamide Soap
Price: ₱99.00 × 700
Available: 700 units  ← NEW
```

---

## 🔧 Code Changes

### File: `app/dashboard/pos/page.tsx`

#### Change 1: Quantity Label with Max Indicator
```typescript
<Label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">
  Quantity {!cartItem.isFreebie && (
    <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
      (Max: {sellableQty})  ← Shows 700
    </span>
  )}
</Label>
```

#### Change 2: Warning Toast on Exceed
```typescript
onChange={(e) => {
  const value = e.target.value
  if (value === '') return
  const numValue = parseInt(value, 10)
  if (!isNaN(numValue) && numValue >= 1) {
    // NEW: Show warning if trying to exceed
    if (numValue > sellableQty) {
      toast.warning(`Maximum available stock is ${sellableQty} units`, {
        duration: 2000,
        icon: '⚠️',
      })
    }
    updateQuantity(cartItem.item.id, numValue)
  }
}}
```

#### Change 3: Available Stock Info
```typescript
{!cartItem.isFreebie && (
  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
    Available: {sellableQty} units  ← Shows 700
  </p>
)}
```

---

## 📊 How It Works

### Calculation Flow:
```typescript
// 1. Get sellable quantity (good stocks only)
const sellableQty = getSellableQuantity(cartItem.item)
// Returns: 800 - 100 = 700 ✅

// 2. Input has max attribute
<Input max={sellableQty} />  // max="700"

// 3. updateQuantity enforces limit
const finalQuantity = Math.min(quantity, sellableQty)
// If user enters 800, caps to 700 ✅
```

---

## 🎨 User Experience

### Before:
```
Quantity
[___800___]  ← User could type any number
             ← No warning
             ← Silently capped
```

### After:
```
Quantity (Max: 700)  ← Clear limit shown
[___700___]
Available: 700 units ← Available stock info

If user types 800:
⚠️ Toast: "Maximum available stock is 700 units"
Auto-capped to 700
```

---

## 🧪 Testing

### Test Case 1: Normal Addition
1. Add Niacinamide Soap (700 good, 100 bad)
2. Open cart modal
3. See "Quantity (Max: 700)"
4. See "Available: 700 units"
5. Try to type 700 → ✅ Allowed
6. See subtotal: ₱69,300

### Test Case 2: Exceed Limit
1. In quantity field, type 800
2. See warning toast: "⚠️ Maximum available stock is 700 units"
3. Value automatically capped to 700
4. Cannot exceed 700

### Test Case 3: Freebie Items
1. Mark item as freebie
2. Max limit still enforced
3. "(Max: 700)" label hidden for freebies (price is 0 anyway)
4. Available stock info hidden for freebies

---

## ✅ Validation Layers

### Layer 1: HTML Input Attribute
```html
<input max="700" />  
```
Browser prevents typing beyond max (on most browsers)

### Layer 2: JavaScript Validation
```typescript
const finalQuantity = Math.min(quantity, sellableQty)
```
Caps any value to sellable quantity

### Layer 3: User Feedback
```typescript
if (numValue > sellableQty) {
  toast.warning(...)  // Visual feedback
}
```

### Layer 4: Backend Validation
The checkout API will also validate against actual stock (existing code)

---

## 📝 Summary

### Changes Made:
1. ✅ Added "(Max: XXX)" label to quantity input
2. ✅ Added warning toast when exceeding limit
3. ✅ Added "Available: XXX units" info text
4. ✅ Maintained existing auto-cap behavior

### Result:
- **Clear visibility** of maximum allowed quantity
- **Immediate feedback** when user tries to exceed
- **Better UX** with stock availability info
- **No breaking changes** - existing validation preserved

---

## 🎯 Example Scenario

**Niacinamide Soap:**
- Database: 800 total (700 good + 100 bad)
- Cart Modal Shows:
  ```
  Niacinamide Soap
  Price: ₱99.00 × 700
  Available: 700 units
  
  Quantity (Max: 700)
  [___700___]
  
  Subtotal: ₱69,300.00
  ```

**If user types 800:**
```
⚠️ Maximum available stock is 700 units
[Value auto-capped to 700]
```

**On Dispatch:**
```
✅ Only 700 units deducted from good stock
❌ Bad stock (100) remains untouched
```

---

## 🚀 Status

✅ **COMPLETE** - Cart quantity now properly limited to good stocks with clear visual indicators and feedback!
