/**
 * Simple in-memory cache for API responses to reduce database load
 * and improve performance for frequently accessed data
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get data from cache if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Store data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Create a singleton instance
export const apiCache = new ApiCache()

// Clean up expired entries every 10 minutes
setInterval(() => {
  apiCache.cleanup()
}, 10 * 60 * 1000)

/**
 * Generate cache key for API requests
 */
export function generateCacheKey(
  endpoint: string,
  userId: string,
  platform: string,
  params?: Record<string, any>
): string {
  const paramString = params ? `_${JSON.stringify(params)}` : ''
  return `${endpoint}_${userId}_${platform}${paramString}`
}

/**
 * Clear cache for a specific user
 */
export function clearUserCache(userId: string, platform: string): void {
  const keysToDelete: string[] = []
  for (const key of apiCache.getStats().keys) {
    if (key.includes(userId) && key.includes(platform)) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach(key => apiCache.delete(key))
  console.log(`Cleared ${keysToDelete.length} cache entries for user ${userId} on ${platform}`)
}

/**
 * Cache wrapper for async functions
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number,
  validator?: (data: T) => boolean
): Promise<T> {
  // Try to get from cache first
  const cached = apiCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetcher()

  // Don't cache null, undefined, or invalid data
  if (data === null || data === undefined) {
    return data
  }

  // Use validator if provided
  if (validator && !validator(data)) {
    return data
  }

  // Store in cache only if valid
  apiCache.set(key, data, ttl)

  return data
}
