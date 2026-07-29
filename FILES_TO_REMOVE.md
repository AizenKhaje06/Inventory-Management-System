# Files and Directories to Remove for Simplification

## 🗑️ Directories to Delete

### Frontend (App Routes)
```
app/packer/                    # Entire packer dashboard
app/tracker/                   # Entire tracker dashboard
app/dept-manager/              # Entire department manager dashboard
app/logistics/                 # Separate logistics dashboard (use /dashboard instead)
app/admin/                     # Separate admin pages (use /dashboard instead)
```

### Dashboard Subdirectories to Remove
```
app/dashboard/dispatch/        # Complex dispatch system
app/dashboard/packing-queue/   # Packing queue management ❌ REMOVE
app/dashboard/track-orders/    # Order tracking ❌ REMOVE
app/dashboard/agent-performance/  # Team performance ❌ REMOVE
app/dashboard/operations/      # Operations role pages
app/dashboard/sales-channels/  # Sales channel reports ❌ REMOVE
app/dashboard/insights/        # Business insights ❌ REMOVE
app/dashboard/reports/         # Reports page ❌ REMOVE
```

### API Routes to Delete
```
app/api/packer/                # Packer operations
app/api/departments/           # Department management
app/api/dept-manager/          # Department manager APIs
app/api/auth/team-leader-*     # Team leader authentication
app/api/check-create-packer/   # Packer checks
app/api/debug-packer/          # Packer debugging
```

### Components to Remove
```
components/barcode-scanner.tsx  # Barcode scanning (packer-specific)
```

## ⚠️ Files to Keep But Simplify

### Keep These (Core Inventory Features)
```
✅ app/dashboard/page.tsx         # Main dashboard
✅ app/dashboard/inventory/       # Inventory management
✅ app/dashboard/pos/             # Point of Sale
✅ app/dashboard/analytics/       # Basic analytics
✅ app/dashboard/sales/           # Simple sales view
✅ app/dashboard/business-contacts/  # Contacts
✅ app/dashboard/log/             # Audit logs
✅ app/dashboard/settings/        # Settings
```

### API Routes to Keep
```
✅ app/api/auth/unified-login/    # Login (modify for 2 roles)
✅ app/api/auth/logout/           # Logout
✅ app/api/items/                 # Inventory CRUD
✅ app/api/products/              # Products unified
✅ app/api/bundles/               # Bundles
✅ app/api/categories/            # Categories
✅ app/api/transactions/          # (if exists) Sales
✅ app/api/dashboard/             # Dashboard data
✅ app/api/analytics/             # Analytics data
✅ app/api/business-contacts/     # Business contacts
✅ app/api/logs/                  # Audit logs
✅ app/api/reports/               # Reports
```

## 📝 Execution Plan

### Step 1: Backup First!
```bash
# Create backup
git add .
git commit -m "Backup before simplification"
git branch backup-complex-system
```

### Step 2: Delete Directories (Windows CMD)
```cmd
rmdir /s /q "app\packer"
rmdir /s /q "app\tracker"
rmdir /s /q "app\dept-manager"
rmdir /s /q "app\logistics"
rmdir /s /q "app\admin"
rmdir /s /q "app\dashboard\dispatch"
rmdir /s /q "app\dashboard\packing-queue"
rmdir /s /q "app\dashboard\track-orders"
rmdir /s /q "app\dashboard\agent-performance"
rmdir /s /q "app\dashboard\operations"
rmdir /s /q "app\dashboard\sales-channels"
rmdir /s /q "app\dashboard\insights"
rmdir /s /q "app\dashboard\reports"
rmdir /s /q "app\api\packer"
rmdir /s /q "app\api\departments"
rmdir /s /q "app\api\dept-manager"
rmdir /s /q "app\api\check-create-packer"
rmdir /s /q "app\api\debug-packer"
rmdir /s /q "app\api\reports"
```

### Step 3: Delete Component Files
```cmd
del "components\barcode-scanner.tsx"
```

### Step 4: Delete Team Leader Auth Routes
```cmd
rmdir /s /q "app\api\auth\team-leader-login"
rmdir /s /q "app\api\auth\team-leader-logout"
rmdir /s /q "app\api\auth\team-leader-change-password"
```

### Step 5: Update Database
Create a new migration to remove old role constraints and add new 2-role constraint.

---

Would you like me to execute these deletions? ✅
