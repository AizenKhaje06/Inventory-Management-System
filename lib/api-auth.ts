/**
 * API Authentication Middleware
 * 
 * Protects API routes from unauthorized access
 * Validates user sessions and enforces role-based access control
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, hasPermission, type UserRole } from './auth'

// Re-export UserRole for use in API helpers
export type { UserRole }

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    username: string
    role: UserRole
    displayName: string
    // assignedChannel removed - no longer used
  }
}

/**
 * Authentication error responses
 */
export const AuthErrors = {
  UNAUTHORIZED: NextResponse.json(
    { error: 'Unauthorized - Please login' },
    { status: 401 }
  ),
  FORBIDDEN: NextResponse.json(
    { error: 'Forbidden - Insufficient permissions' },
    { status: 403 }
  ),
  INVALID_SESSION: NextResponse.json(
    { error: 'Invalid or expired session' },
    { status: 401 }
  ),
}

/**
 * Check if user is authenticated
 * This reads from the request headers (set by client)
 */
/**
 * Get authenticated user from request headers
 * 
 * Supports 2 active roles (admin, logistics-admin) and 2 legacy roles (operations, packer)
 * for backward compatibility with existing database records.
 * 
 * @deprecated Legacy roles (operations, packer) are no longer actively used.
 */
export function getAuthUser(request: NextRequest): { username: string; role: UserRole; displayName: string } | null {
  try {
    // Check for admin/logistics-admin/operations/packer headers
    const username = request.headers.get('x-user-username')
    const role = request.headers.get('x-user-role') as UserRole
    const displayName = request.headers.get('x-user-display-name')
    // assignedChannel removed - no longer used

    if (!username || !role) {
      return null
    }

    // Validate role (4 roles: admin, logistics-admin, operations, packer)
    if (!['admin', 'logistics-admin', 'operations', 'packer'].includes(role)) {
      console.warn('[API Auth] Invalid role:', role)
      return null
    }

    return { 
      username, 
      role, 
      displayName: displayName || username
      // assignedChannel removed
    }
  } catch (error) {
    console.error('[API Auth] Error reading auth headers:', error)
    return null
  }
}

/**
 * Require authentication for API route
 * Returns user if authenticated, otherwise returns error response
 */
export function requireAuth(request: NextRequest): 
  { user: { username: string; role: UserRole; displayName: string } } | NextResponse {
  
  const user = getAuthUser(request)
  
  if (!user) {
    return AuthErrors.UNAUTHORIZED
  }

  return { user }
}

/**
 * Require specific role for API route
 * Returns user if authorized, otherwise returns error response
 */
export function requireRole(request: NextRequest, allowedRoles: UserRole[]): 
  { user: { username: string; role: UserRole; displayName: string } } | NextResponse {
  
  const authResult = requireAuth(request)
  
  // If already an error response, return it
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { user } = authResult

  // Check if user has required role
  if (!allowedRoles.includes(user.role)) {
    return AuthErrors.FORBIDDEN
  }

  return { user }
}

/**
 * Require admin role for API route
 * Convenience function for admin-only routes
 */
export function requireAdmin(request: NextRequest): 
  { user: { username: string; role: UserRole; displayName: string } } | NextResponse {
  
  return requireRole(request, ['admin'])
}

/**
 * Check if user has permission to access a path
 */
export function requirePermission(request: NextRequest, path: string): 
  { user: { username: string; role: UserRole; displayName: string } } | NextResponse {
  
  const authResult = requireAuth(request)
  
  if (authResult instanceof NextResponse) {
    return authResult
  }

  const { user } = authResult

  if (!hasPermission(user.role, path)) {
    return AuthErrors.FORBIDDEN
  }

  return { user }
}

/**
 * Middleware helper to add auth headers to requests
 * Call this from your client-side code before making API requests
 */
export function addAuthHeaders(headers: Headers = new Headers()): Headers {
  if (typeof window === 'undefined') return headers

  try {
    // Get user authentication from localStorage
    const username = localStorage.getItem('username')
    const role = localStorage.getItem('userRole')
    const displayName = localStorage.getItem('displayName')
    // assignedChannel removed - no longer used

    if (username) headers.set('x-user-username', username)
    if (role) headers.set('x-user-role', role)
    if (displayName) headers.set('x-user-display-name', displayName)
    // assignedChannel header removed
  } catch (error) {
    console.error('[API Auth] Error adding auth headers:', error)
  }

  return headers
}

/**
 * Fetch wrapper that automatically adds auth headers
 * Use this instead of fetch() for authenticated API calls
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = addAuthHeaders(new Headers(options.headers))
  
  return fetch(url, {
    ...options,
    headers,
  })
}
