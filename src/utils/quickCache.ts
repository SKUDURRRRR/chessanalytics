/**
 * Quick cache utility for fast, short-lived caching
 * Optimized for game count checks and other frequently accessed data
 */

interface QuickCacheEntry<T> {
  data: T
  timestamp: number
}

class QuickCache {
  private cache = new Map<string, QuickCacheEntry<any>>()
  private readonly DEFAULT_TTL = 2 * 60 * 1000 // 2 minutes

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string, ttl: number = this.DEFAULT_TTL): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      return null
    }

    const now = Date.now()
    if (now - entry.timestamp > ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Remove specific key
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear entries for a specific user
   */
  clearUser(userId: string, platform: string): void {
    const prefix = `${userId}_${platform}`
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const quickCache = new QuickCache()

/**
 * Generate cache key for game count
 */
export function getGameCountCacheKey(userId: string, platform: string): string {
  return `${userId}_${platform}_gameCount`
}

/**
 * Generate cache key for user existence check
 */
export function getUserExistsCacheKey(userId: string, platform: string): string {
  return `${userId}_${platform}_exists`
}
