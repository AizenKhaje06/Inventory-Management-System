/**
 * API Client - Updated for Simplified System
 * 
 * Client-side wrapper for making authenticated API requests
 * Automatically adds authentication headers
 */

/**
 * Add authentication headers to fetch requests
 */
function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {}

  try {
    const headers: Record<string, string> = {}

    // Get user authentication from localStorage
    const username = localStorage.getItem('username')
    const role = localStorage.getItem('userRole')
    const displayName = localStorage.getItem('displayName')
    // assignedChannel removed - no longer used

    // DEBUG: Log what we're reading from localStorage
    console.log('[API Client] Reading from localStorage:', {
      username,
      role,
      displayName
    })

    // Add headers
    if (username) headers['x-user-username'] = username
    if (role) headers['x-user-role'] = role
    if (displayName) headers['x-user-display-name'] = displayName
    // assignedChannel header removed

    // DEBUG: Log final headers
    console.log('[API Client] Final headers:', headers)

    return headers
  } catch (error) {
    console.error('[API Client] Error reading auth from localStorage:', error)
    return {}
  }

}

/**
 * Authenticated fetch wrapper
 * Use this instead of fetch() for all API calls
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = getAuthHeaders()
  
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...options.headers,
  }

  console.log('[API Client] Making request to:', url)
  console.log('[API Client] With headers:', headers)

  return fetch(url, {
    ...options,
    headers,
  })
}

/**
 * Authenticated fetch with JSON response
 * @template T - Expected response type
 */
export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiFetch(url)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    console.error(`[API Client] GET ${url} failed:`, response.status, error)
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Authenticated POST request
 * @template T - Expected response type
 * @template D - Request body type
 */
export async function apiPost<T, D = unknown>(url: string, data: D): Promise<T> {
  const response = await apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    const errorMsg = error.error || error.details || error.message || `HTTP ${response.status}`
    console.error(`[API Client] POST ${url} failed:`, response.status, error)
    throw new Error(errorMsg)
  }

  return response.json()
}

/**
 * Authenticated PUT request
 * @template T - Expected response type
 * @template D - Request body type
 */
export async function apiPut<T, D = unknown>(url: string, data: D): Promise<T> {
  const response = await apiFetch(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || error.details || `HTTP ${response.status}`)
  }

  return response.json()
}

/**
 * Authenticated DELETE request
 */
export async function apiDelete(url: string): Promise<void> {
  const response = await apiFetch(url, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
}
