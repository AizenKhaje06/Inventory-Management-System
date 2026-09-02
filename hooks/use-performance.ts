/**
 * Performance React Hooks
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { debounce, throttle, isLowEndDevice } from '@/lib/performance'

/**
 * Hook for debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Hook for throttled callback
 * @template T - Function type to throttle
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const throttledCallback = useRef(throttle(callback, delay))

  useEffect(() => {
    throttledCallback.current = throttle(callback, delay)
  }, [callback, delay])

  return throttledCallback.current as T
}

/**
 * Hook to detect low-end device
 */
export function useLowEndDevice(): boolean {
  const [isLowEnd, setIsLowEnd] = useState(false)

  useEffect(() => {
    setIsLowEnd(isLowEndDevice())
  }, [])

  return isLowEnd
}

/**
 * Hook for intersection observer (lazy loading)
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [ref, options])

  return isIntersecting
}

/**
 * Hook for measuring component render time
 */
export function useRenderTime(componentName: string) {
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current++
    const startTime = performance.now()

    return () => {
      const endTime = performance.now()
      const renderTime = endTime - startTime

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[Render Time] ${componentName} (render #${renderCount.current}): ${renderTime.toFixed(2)}ms`
        )
      }
    }
  })
}

/**
 * Hook for idle callback
 * @param deps - Dependency array for effect
 */
export function useIdleCallback(callback: () => void, deps: unknown[] = []) {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(callback)
      return () => window.cancelIdleCallback(id)
    } else {
      const id = setTimeout(callback, 1)
      return () => clearTimeout(id)
    }
  }, deps)
}

/**
 * Hook for network status
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [connectionType, setConnectionType] = useState<string>('unknown')

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      setConnectionType(connection.effectiveType || 'unknown')
    }

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleConnectionChange = () => {
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown')
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    connection?.addEventListener('change', handleConnectionChange)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      connection?.removeEventListener('change', handleConnectionChange)
    }
  }, [])

  return { isOnline, connectionType }
}

/**
 * Hook for virtual scrolling
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) {
  const [scrollTop, setScrollTop] = useState(0)

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex + 1)
  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll,
    startIndex,
    endIndex,
  }
}
