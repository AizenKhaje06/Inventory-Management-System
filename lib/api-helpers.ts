/**
 * API Route Helpers
 * 
 * Utility functions to simplify API route creation with authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin, requireRole, type UserRole } from './api-auth'

/**
 * Wrap an API handler with authentication
 * 
 * @example
 * export const GET = withAuth(async (request, { user }) => {
 *   // user is guaranteed to be authenticated
 *   return NextResponse.json({ message: `Hello ${user.username}` })
 * })
 */
export function withAuth(
  handler: (
    request: NextRequest,
    context: { user: { username: string; role: UserRole; displayName: string }, params?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: { params: any }) => {
    const authResult = requireAuth(request)

    if (authResult instanceof NextResponse) {
      return authResult
    }

    return handler(request, { ...authResult, params: routeContext?.params })
  }
}

/**
 * Wrap an API handler with admin-only authentication
 * 
 * @example
 * export const DELETE = withAdmin(async (request, { user }) => {
 *   // Only admins can access this
 *   return NextResponse.json({ message: 'Deleted' })
 * })
 */
export function withAdmin(
  handler: (
    request: NextRequest,
    context: { user: { username: string; role: UserRole; displayName: string }, params?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: { params: any }) => {
    const authResult = requireAdmin(request)

    if (authResult instanceof NextResponse) {
      return authResult
    }

    return handler(request, { ...authResult, params: routeContext?.params })
  }
}

/**
 * Wrap an API handler with role-based authentication
 * 
 * @example
 * export const POST = withRoles(['admin', 'operations'], async (request, { user }) => {
 *   // Both admin and operations can access this
 *   return NextResponse.json({ message: 'Created' })
 * })
 */
export function withRoles(
  allowedRoles: UserRole[],
  handler: (
    request: NextRequest,
    context: { 
      user: { username: string; role: UserRole; displayName: string };
      params?: any  // Added for dynamic routes with params
    }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: { params: any }) => {
    const authResult = requireRole(request, allowedRoles)

    if (authResult instanceof NextResponse) {
      return authResult
    }

    return handler(request, { ...authResult, params: context?.params })
  }
}

/**
 * Standard error responses
 */
export const ApiErrors = {
  badRequest: (message: string) =>
    NextResponse.json({ error: message }, { status: 400 }),
  
  unauthorized: (message: string = 'Unauthorized') =>
    NextResponse.json({ error: message }, { status: 401 }),
  
  forbidden: (message: string = 'Forbidden') =>
    NextResponse.json({ error: message }, { status: 403 }),
  
  notFound: (message: string = 'Not found') =>
    NextResponse.json({ error: message }, { status: 404 }),
  
  conflict: (message: string) =>
    NextResponse.json({ error: message }, { status: 409 }),
  
  serverError: (message: string = 'Internal server error') =>
    NextResponse.json({ error: message }, { status: 500 }),
}

/**
 * Standard success responses
 */
export const ApiSuccess = {
  ok: (data: any) =>
    NextResponse.json(data, { status: 200 }),
  
  created: (data: any) =>
    NextResponse.json(data, { status: 201 }),
  
  noContent: () =>
    new NextResponse(null, { status: 204 }),
}
