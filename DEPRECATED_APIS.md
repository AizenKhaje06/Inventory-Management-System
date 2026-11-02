# 🗑️ Deprecated APIs & Legacy Code

**Last Updated:** September 2, 2026  
**Status:** Documented for Future Cleanup

---

## 📋 Overview

This document lists deprecated API endpoints and legacy code that remain in the codebase for backward compatibility but are no longer actively used in the simplified 2-role system (Admin, Logistics-Admin).

---

## 🚫 Deprecated API Endpoints

### Team Leader APIs (Deprecated)

**Status:** ⚠️ No longer used in current workflow  
**Reason:** Department/team leader roles removed in simplification  
**Action:** Can be safely removed after confirming no usage

#### Endpoints:

```
app/api/team-leader/
├── packing-queue/route.ts          # Team leader packing queue view
├── packing-queue/[id]/pack/route.ts # Pack order as team leader
├── orders/route.ts                  # Team leader orders list
├── orders/[id]/route.ts            # Single order view
├── orders/search/route.ts          # Order search
├── dispatch/route.ts               # Dispatch management
├── dispatch/[id]/dispatch/route.ts # Dispatch single order
└── inventory-alerts/route.ts       # Low stock alerts
```

**Replacement:** Main admin/logistics-admin dashboards handle these features

---

### Debug & Utility Endpoints (Keep for Troubleshooting)

**Status:** ⚠️ Useful for debugging  
**Reason:** Helpful for account management and troubleshooting  
**Action:** Keep but document clearly

#### Endpoints:

```
app/api/debug-packer/route.ts       # Debug packer account details
app/api/check-create-packer/route.ts # Create/update packer account
app/api/debug-cancelled/route.ts    # Debug cancelled orders
```

**Recommendation:** Add authentication requirement and admin-only access

---

## 📁 Legacy Code Files

### Files with Legacy Role References

#### High Priority (Consider Removing)

```typescript
// app/api/items/route.ts
export const POST = withRoles(['admin', 'logistics-admin'], ...) 
// Previously: ['admin', 'logistics-admin', 'operations'] ❌

// app/api/categories/route.ts  
export const POST = withRoles(['admin', 'operations', 'dept-manager'], ...)
// Should be: ['admin', 'logistics-admin'] ✅
```

#### Low Priority (Documented, Keep for Compatibility)

```typescript
// lib/auth.ts - Legacy roles in ROLES object
operations: { ... }  // @deprecated
packer: { ... }      // @deprecated

// lib/api-auth.ts - Legacy role validation
if (!['admin', 'logistics-admin', 'operations', 'packer'].includes(role))
// Can be simplified to: ['admin', 'logistics-admin']
```

---

## 🔧 Cleanup Recommendations

### Phase 1: Safe Removals (No Risk)

1. **Remove Team Leader APIs**
   ```bash
   rm -rf app/api/team-leader/
   ```
   - Confirm zero usage in logs
   - Remove route handlers
   - Update API documentation

2. **Update Role Validation**
   ```typescript
   // Before
   if (!['admin', 'logistics-admin', 'operations', 'packer'].includes(role))
   
   // After
   if (!['admin', 'logistics-admin'].includes(role))
   ```

3. **Clean up withRoles() calls**
   ```typescript
   // Find all instances of:
   withRoles(['admin', 'operations', ...])
   
   // Replace with:
   withRoles(['admin', 'logistics-admin'], ...)
   ```

### Phase 2: Database Cleanup (Medium Risk)

⚠️ **CAUTION:** Only proceed if no legacy accounts exist

1. **Check for legacy role users**
   ```sql
   SELECT COUNT(*) FROM users WHERE role IN ('operations', 'packer', 'tracker', 'dept-manager', 'dept-agent');
   ```

2. **If count = 0, safe to simplify role enum**
   ```sql
   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
   ALTER TABLE users ADD CONSTRAINT users_role_check 
     CHECK (role IN ('admin', 'logistics-admin'));
   ```

3. **Update TypeScript type**
   ```typescript
   // Before
   export type UserRole = 'admin' | 'logistics-admin' | 'operations' | 'packer'
   
   // After
   export type UserRole = 'admin' | 'logistics-admin'
   ```

---

## 📊 Impact Analysis

### Team Leader APIs

| Endpoint | Last Used | Impact if Removed | Priority |
|----------|-----------|-------------------|----------|
| `/api/team-leader/packing-queue` | N/A | None (feature replaced) | HIGH |
| `/api/team-leader/dispatch` | N/A | None (admin handles this) | HIGH |
| `/api/team-leader/orders` | N/A | None (consolidated view exists) | HIGH |

### Debug Endpoints

| Endpoint | Usage | Impact if Removed | Priority |
|----------|-------|-------------------|----------|
| `/api/debug-packer` | Occasional | Harder to debug packer issues | LOW (Keep) |
| `/api/check-create-packer` | Setup only | Must manually create accounts | LOW (Keep) |
| `/api/debug-cancelled` | Troubleshooting | Harder to debug cancellations | LOW (Keep) |

---

## 🔍 Search Commands for Cleanup

### Find all legacy role references:
```bash
# PowerShell
Select-String -Path "**/*.ts" -Pattern "operations|packer|tracker|dept-manager|dept-agent"

# Bash
grep -r "operations\|packer\|tracker\|dept-manager\|dept-agent" --include="*.ts" .
```

### Find withRoles with legacy roles:
```bash
# PowerShell
Select-String -Path "**/*.ts" -Pattern "withRoles.*\['.*operations.*'\]"

# Bash
grep -r "withRoles.*\[.*operations" --include="*.ts" .
```

### Find any type usage:
```bash
# PowerShell
Select-String -Path "**/*.ts" -Pattern ": any\b"

# Bash
grep -r ": any\b" --include="*.ts" .
```

---

## ✅ Completed Improvements

### Type Safety (Phase 1) ✅
- [x] Replaced `any` with proper types in `lib/api-helpers.ts`
- [x] Updated API client generics in `lib/api-client.ts`
- [x] Fixed cache types in `lib/cache.ts`
- [x] Added comprehensive type definitions in `lib/types.ts`
- [x] Updated hook types in `hooks/use-performance.ts`
- [x] Fixed error handling types across codebase

### Documentation (Phase 1) ✅
- [x] Added JSDoc deprecation notices to legacy roles
- [x] Created `CLEANUP_PLAN.md`
- [x] Created `CLEANUP_SUMMARY.md`
- [x] Created `DEPRECATED_APIS.md` (this file)
- [x] Updated inline comments

---

## 📝 Migration Checklist

When ready to remove legacy code, follow this checklist:

### Pre-removal
- [ ] Verify zero active users with legacy roles
- [ ] Check application logs for API usage
- [ ] Backup database
- [ ] Create git branch for cleanup

### Removal Steps
- [ ] Remove team leader API routes
- [ ] Update all `withRoles()` calls
- [ ] Simplify role type to 2 roles only
- [ ] Update database constraints
- [ ] Remove legacy role definitions
- [ ] Update tests

### Post-removal
- [ ] Run full test suite
- [ ] Check for TypeScript errors
- [ ] Verify authentication flows
- [ ] Test role-based access control
- [ ] Deploy to staging
- [ ] Monitor for errors

---

## 🎯 Timeline

**Immediate (Completed):**
- ✅ Document deprecated code
- ✅ Add deprecation warnings
- ✅ Improve type safety

**Short-term (1-2 weeks):**
- ⏳ Verify zero usage of team leader APIs
- ⏳ Remove team leader routes
- ⏳ Update withRoles() calls

**Long-term (1-3 months):**
- ⏳ Database role migration
- ⏳ Complete legacy code removal
- ⏳ Comprehensive testing

---

## 📞 Support

Questions about deprecated code? Check:
- This document for deprecation status
- `CLEANUP_SUMMARY.md` for what's been cleaned
- `lib/auth.ts` for current role definitions
- Git history for when code was deprecated

---

## ⚠️ Important Notes

1. **Do NOT remove debug endpoints** - They're useful for troubleshooting
2. **Check database first** - Never remove roles that are still in use
3. **Test thoroughly** - Authentication changes are high-risk
4. **Keep backups** - Always backup before major cleanups

---

**Status:** 📋 **DOCUMENTED**  
**Next Action:** Verify team leader API usage before removal  
**Priority:** Low (No urgency, system works as-is)

---

*Last Updated: September 2, 2026*
