# Simplification Plan: 2 Roles Only (Admin + Logistics Admin)

## 🎯 Goal
Convert complex multi-role system to simple 2-role inventory management:
- **Admin** - Full access to everything
- **Logistics Admin** - Inventory management only

## 📋 What to Remove

### 1. User Roles to Remove
- ❌ Packer
- ❌ Tracker
- ❌ Department Manager
- ❌ Department Agent
- ❌ Operations

### 2. Features to Remove
- ❌ Packer dashboard (`/packer`)
- ❌ Tracker dashboard (`/tracker`)
- ❌ Department manager dashboard (`/dept-manager`)
- ❌ Packing queue management
- ❌ Order tracking (Tracker role)
- ❌ Department structure
- ❌ Agent management
- ❌ Voice notifications (packer-specific)
- ❌ Barcode scanning (packer-specific)
- ❌ Team leader login

### 3. Routes/Pages to Remove
- ❌ `/app/packer/`
- ❌ `/app/tracker/`
- ❌ `/app/dept-manager/`
- ❌ `/app/dashboard/dispatch/` (complex dispatch)
- ❌ `/app/dashboard/packing-queue/`
- ❌ `/app/dashboard/track-orders/`
- ❌ `/app/dashboard/agent-performance/`
- ❌ `/app/dashboard/operations/`

### 4. API Routes to Remove
- ❌ `/api/packer/`
- ❌ `/api/departments/`
- ❌ `/api/dept-manager/`
- ❌ `/api/auth/team-leader-*`
- ❌ `/api/check-create-packer/`
- ❌ `/api/debug-packer/`

### 5. Database Tables to Keep
- ✅ inventory
- ✅ transactions
- ✅ logs
- ✅ categories
- ✅ stores (storage_rooms)
- ✅ users (simplified to 2 roles only)
- ✅ bundles
- ✅ bundle_items
- ✅ business_contacts
- ❌ orders (complex tracking - can simplify or remove)
- ❌ order_items
- ❌ departments
- ❌ department_agents
- ❌ dispatch_tracking

## ✅ What to Keep

### Core Features
1. ✅ Inventory Management (CRUD)
2. ✅ Categories
3. ✅ Product Bundles
4. ✅ POS (Point of Sale)
5. ✅ Sales Reports
6. ✅ Analytics Dashboard
7. ✅ Business Contacts
8. ✅ Audit Logs
9. ✅ Settings

### Simplified Roles
**Admin:**
- Full access to everything
- User management
- System settings
- All reports

**Logistics Admin:**
- Inventory management
- View reports (read-only)
- Cannot manage users

## 🔧 Implementation Steps

### Phase 1: Backend Cleanup
1. Update middleware.ts (remove extra role checks)
2. Update lib/auth.ts (2 roles only)
3. Update lib/role-utils.ts (simplify)
4. Remove packer/tracker/dept APIs
5. Simplify orders system or remove entirely

### Phase 2: Frontend Cleanup
1. Delete /app/packer directory
2. Delete /app/tracker directory
3. Delete /app/dept-manager directory
4. Remove role-specific dashboard pages
5. Clean up navigation/sidebar
6. Remove barcode scanner component
7. Remove voice notification logic

### Phase 3: Database Cleanup
1. Create migration to remove unnecessary tables
2. Update users table constraint (2 roles only)
3. Clean up RLS policies

### Phase 4: Testing
1. Test admin login and access
2. Test logistics-admin login and access
3. Verify inventory CRUD
4. Verify reports work
5. Check for console errors

---

## 🚀 Let's Start Implementation

Would you like me to proceed with the cleanup?
