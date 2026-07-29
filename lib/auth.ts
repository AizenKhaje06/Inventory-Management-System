// Role-based access control system - SIMPLIFIED TO 2 ROLES

export type UserRole = 'admin' | 'logistics-admin'

export interface User {
  username: string
  role: UserRole
  displayName: string
  email?: string
  phone?: string
  profileImage?: string | null
}

// Role definitions - Only 2 roles
export const ROLES = {
  admin: {
    id: 'admin' as const,
    name: 'Administrator',
    description: 'Full system access - All features',
    icon: '👔'
  },
  'logistics-admin': {
    id: 'logistics-admin' as const,
    name: 'Logistics Admin',
    description: 'Inventory management and reports',
    icon: '📦'
  }
} as const

// Page permissions per role - SIMPLIFIED
export const ROLE_PERMISSIONS = {
  admin: [
    '/dashboard',
    '/dashboard/**'  // Admin has access to everything
  ],
  'logistics-admin': [
    '/dashboard',
    '/dashboard/inventory/**',
    '/dashboard/sales',
    '/dashboard/pos',
    '/dashboard/log'
    // NO Settings access for logistics-admin
  ]
} as const

// Default passwords removed from source code for security.
// All authentication is handled via Supabase (bcrypt hashes in DB).
// See: app/api/auth/unified-login/route.ts → validateCredentials()
export const DEFAULT_PASSWORDS: Record<UserRole, string> = {
  admin: '',
  'logistics-admin': ''
}

// Auth helpers
/**
 * Check if a role has permission to access a path.
 * Supports exact matches and wildcard patterns (e.g., /dashboard/inventory/**)
 * 
 * Pattern matching rules:
 * - Exact: /dashboard/sales matches only /dashboard/sales
 * - Wildcard: /dashboard/inventory/** matches /dashboard/inventory and all sub-routes
 * 
 * @param role - User role to check
 * @param path - Path to validate access for
 * @returns true if role has permission, false otherwise
 */
export function hasPermission(role: UserRole, path: string): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  
  // Normalize path (remove trailing slash)
  const normalizedPath = path.replace(/\/$/, '')
  
  return permissions.some(pattern => {
    // Normalize pattern
    const normalizedPattern = pattern.replace(/\/$/, '')
    
    // Exact match
    if (normalizedPattern === normalizedPath) return true
    
    // Wildcard match: /dashboard/inventory/** matches /dashboard/inventory/create
    if (normalizedPattern.endsWith('/**')) {
      const basePattern = normalizedPattern.slice(0, -3)
      return normalizedPath === basePattern || normalizedPath.startsWith(basePattern + '/')
    }
    
    return false
  })
}

export function getDefaultRoute(role: UserRole): string {
  // Both roles go to main dashboard
  return '/dashboard'
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  
  // CRITICAL: Check for logout parameter FIRST
  // If logout is in progress, ALWAYS return null regardless of localStorage
  try {
    const urlParams = new URLSearchParams(window.location.search)
    const logoutParam = urlParams.get('logout')
    
    if (logoutParam) {
      console.log('[Auth] Logout parameter detected, forcing null user')
      return null
    }
  } catch (e) {
    console.error('[Auth] Error checking logout parameter:', e)
  }
  
  try {
    // Check for admin/logistics-admin session
    const isLoggedIn = localStorage.getItem('isLoggedIn')
    const username = localStorage.getItem('username')
    const role = localStorage.getItem('userRole') as UserRole
    const displayName = localStorage.getItem('displayName')
    
    if (isLoggedIn === 'true' && username && role) {
      if (!['admin', 'logistics-admin'].includes(role)) {
        clearCurrentUser()
        return null
      }
      return { username, role, displayName: displayName || username }
    }
  } catch (error) {
    console.error('[Auth] Error reading user from localStorage:', error)
    clearCurrentUser()
  }
  
  return null
}

/**
 * Get the assigned channel/department - NOT USED IN SIMPLIFIED VERSION
 * Returns null (no channel assignments with 2 roles)
 */
export function getUserDepartment(): string | null {
  return null
}

export function setCurrentUser(user: User): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('isLoggedIn', 'true')
    localStorage.setItem('username', user.username)
    localStorage.setItem('userRole', user.role)
    localStorage.setItem('displayName', user.displayName)
  } catch (error) {
    console.error('Error saving user to localStorage:', error)
  }
}

// validateRolePassword removed — all auth handled server-side via Supabase.
// See: app/api/auth/unified-login/route.ts

export function clearCurrentUser(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('isLoggedIn')
    localStorage.removeItem('username')
    localStorage.removeItem('userRole')
    localStorage.removeItem('displayName')
    localStorage.removeItem('currentUser')
  } catch (error) {
    console.error('Error clearing user from localStorage:', error)
  }
}

/**
 * Check if current user can edit content
 * Admin can edit everything, logistics-admin can edit inventory only
 */
export function canEdit(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin' || user?.role === 'logistics-admin'
}
