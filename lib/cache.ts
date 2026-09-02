/**
 * Server-side caching utility for database calls
 * Reduces database queries and improves response times
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

/**
 * Get cached data or fetch fresh data if cache is stale
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const cached = cache.get(key)
  const now = Date.now()
  
  // Return cached data if still fresh
  if (cached && now - cached.timestamp < ttl) {
    console.log(`[Cache HIT] ${key}`)
    return cached.data
  }
  
  // Fetch fresh data
  console.log(`[Cache MISS] ${key} - Fetching fresh data`)
  const data = await fetcher()
  cache.set(key, { data, timestamp: now })
  return data
}

/**
 * Invalidate cache for a specific key
 */
export function invalidateCache(key: string): void {
  cache.delete(key)
  console.log(`[Cache INVALIDATE] ${key}`)
}

/**
 * Invalidate all cache entries matching a pattern
 */
export function invalidateCachePattern(pattern: string): void {
  const keys = Array.from(cache.keys())
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.delete(key)
      console.log(`[Cache INVALIDATE] ${key}`)
    }
  })
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  cache.clear()
  console.log('[Cache CLEAR] All cache cleared')
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  }
}
