import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Routes that are always public — no session required.
 */
const PUBLIC_ROUTES = new Set([
  '/',
  '/api/auth/login',
  '/api/auth/unified-login',
  '/api/auth/channels',
  '/api/auth/forgot-password',
])

/**
 * Prefixes that are always skipped (static assets, Next internals, API routes).
 * API routes are protected by their own auth helpers (withAuth / requireRole).
 */
const SKIP_PREFIXES = [
  '/api/',
  '/_next/',
  '/static/',
  '/public/',
]

/**
 * Protected route prefixes → minimum required cookie presence.
 * SIMPLIFIED: Only dashboard routes (both roles use /dashboard)
 */
const PROTECTED_PREFIXES = [
  '/dashboard',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public routes
  if (PUBLIC_ROUTES.has(pathname)) {
    return NextResponse.next()
  }

  // Always allow static/API/asset paths
  for (const prefix of SKIP_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      return NextResponse.next()
    }
  }

  // Allow files with extensions (images, fonts, sw.js, manifest.json, etc.)
  if (pathname.includes('.')) {
    return NextResponse.next()
  }

  // Check if this is a protected route
  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))

  if (isProtected) {
    // Read the HTTP-only session cookie set at login
    const sessionCookie = request.cookies.get('__session')?.value

    if (!sessionCookie) {
      // No session cookie → redirect to login
      const loginUrl = new URL('/', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)

      // Ensure no cached protected page is served
      response.headers.set('Cache-Control', 'no-store, must-revalidate')
      return response
    }

    // Cookie exists — basic format validation: "username:sessionId"
    // Deep validation (Supabase lookup) happens client-side via useSessionGuard
    // to avoid Edge runtime Supabase limitations
    const parts = sessionCookie.split(':')
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      // Malformed cookie → redirect to login and clear it
      const loginUrl = new URL('/', request.url)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('__session')
      response.headers.set('Cache-Control', 'no-store, must-revalidate')
      return response
    }
  }

  // Allow through — add cache-control headers for protected pages
  const response = NextResponse.next()
  if (isProtected) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
