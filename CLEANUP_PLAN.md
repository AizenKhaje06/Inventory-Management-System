# 🧹 Legacy Code Cleanup & Type Safety Improvement Plan

**Date:** September 2, 2026  
**Status:** In Progress  
**Priority:** Medium (P3)

---

## 📋 Overview

This document tracks the cleanup of legacy role references and improvement of TypeScript type safety following the system simplification from 7 roles to 2 roles (Admin, Logistics-Admin).

---

## 🎯 Goals

1. **Remove Legacy Role References** - Clean up old role code (operations, packer, tracker, dept-manager, dept-agent)
2. **Improve Type Safety** - Replace `any` types with proper TypeScript types
3. **Maintain Backward Compatibility** - Ensure no breaking changes

---

## 📊 Analysis Results

### Legacy Role References Found: 50+ instances

**Categories:**
- Auth system: `lib/auth.ts`, `lib/api-auth.ts`
- API routes: Team leader APIs (deprecated)
- Database queries: Role filtering logic
- Comments: Documentation references

### Type Safety Issues Found: 80+ instances

**Categories:**
- API handlers: `params: any`
- Data fetching: Generic `any` types
- Error handling: `error: any`
- API client: Generic `<T = any>`
- Cache system: `CacheEntry<any>`

---

## ✅ Action Items

### Phase 1: Type Safety Improvements (High Impact, Low Risk)

#### 1.1 Create Proper Type Definitions
- [ ] Create `RouteContext` type for API handlers
- [ ] Create `ApiError` type for error handling
- [ ] Create `CacheValue` generic type
- [ ] Create specific types for all API responses

#### 1.2 Update Core Libraries
- [ ] `lib/api-helpers.ts` - Add proper context types
- [ ] `lib/api-client.ts` - Remove default `any` generics
- [ ] `lib/cache.ts` - Add proper generic constraints
- [ ] `lib/analytics.ts` - Type orders array

#### 1.3 Update API Routes
- [ ] Replace `error: any` with `error: unknown` or proper type
- [ ] Type dynamic route params properly
- [ ] Add response types for all API endpoints

### Phase 2: Legacy Role Cleanup (Medium Impact, Medium Risk)

#### 2.1 Update Auth System
- [ ] `lib/auth.ts` - Mark deprecated roles with JSDoc
- [ ] `lib/api-auth.ts` - Update role validation
- [ ] Keep backward compatibility for database records

#### 2.2 Clean Up API Routes
- [ ] Remove or deprecate team-leader APIs
- [ ] Update role-based filtering logic
- [ ] Simplify permission checks

#### 2.3 Update Documentation
- [ ] Add deprecation notices to old role references
- [ ] Update inline comments
- [ ] Mark legacy code sections

### Phase 3: Testing & Validation (Critical)

- [ ] Test all API endpoints
- [ ] Verify authentication flows
- [ ] Check role-based access control
- [ ] Validate type safety improvements

---

## 🔧 Implementation Files

### Files to Modify

**Priority 1 (Type Safety):**
```
lib/api-helpers.ts      - API handler types
lib/api-client.ts       - Generic type improvements
lib/cache.ts            - Cache generic type
lib/analytics.ts        - Orders type
lib/types.ts            - Add new type definitions
```

**Priority 2 (Legacy Cleanup):**
```
lib/auth.ts             - Deprecate old roles
lib/api-auth.ts         - Update validation
app/api/items/route.ts  - Remove operations role
app/api/categories/route.ts - Remove dept-manager role
```

**Priority 3 (API Routes):**
```
app/api/team-leader/**  - Mark as deprecated
app/api/debug-packer/*  - Mark as deprecated
app/api/check-create-packer/* - Mark as deprecated
```

---

## ⚠️ Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking auth | HIGH | Keep backward compatibility, add deprecation warnings |
| Type errors | MEDIUM | Gradual rollout, test thoroughly |
| Performance impact | LOW | No runtime changes, compile-time only |
| User impact | NONE | Backend changes only |

---

## 📝 Notes

- All changes will maintain backward compatibility
- Legacy roles in database won't be deleted (data integrity)
- Deprecation warnings will guide future cleanup
- Type improvements are non-breaking changes

---

## 🚀 Execution Status

- [x] Analysis completed
- [ ] Phase 1: Type Safety (0%)
- [ ] Phase 2: Legacy Cleanup (0%)
- [ ] Phase 3: Testing (0%)

---

**Last Updated:** September 2, 2026
