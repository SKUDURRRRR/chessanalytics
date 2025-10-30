/**
 * Simple in-memory cache for API responses to reduce database load
 * and improve performance for frequently accessed data
 */

import { logger } from './logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000 // Maximum number of cache entries

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
   * Implements LRU-like eviction when cache is full
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // Before adding new entry, check if cache is at capacity
    if (this.cache.size >= this.MAX_CACHE_SIZE && !this.cache.has(key)) {
      // Remove oldest entry (first entry in Map)
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
        logger.log(`[Cache] Evicted oldest entry due to size limit: ${firstKey}`)
      }
    }

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
 * Uses exact segment matching to avoid over-deleting keys for similar user IDs
 * (e.g., "alice" should not match "malice" cache keys).
 *
 * Cache keys follow format: {endpoint}_{userId}_{platform}{optional_params}
 * Example: "stats_alice_chess.com" or "deep-analysis_magnus_lichess_{"limit":100}"
 */
export function clearUserCache(userId: string, platform: string): void {
  const keysToDelete: string[] = []

  // Normalize userId for matching (case-insensitive for both platforms)
  // Both Chess.com and Lichess don't allow duplicate usernames with different cases
  const normalizedUserId = userId.toLowerCase()

  // Normalize platform for matching (handle both "chess.com" and "chesscom" variants)
  const normalizedPlatform = platform.toLowerCase()
  const platformNoDots = normalizedPlatform.replace(/\./g, '')

  for (const key of apiCache.getStats().keys) {
    // Cache keys follow format: {endpoint}_{userId}_{platform}{optional}
    // We can't use split('_') because usernames can contain underscores
    // Instead, we'll use a more robust pattern matching approach

    // Extract the platform portion first (from the end or before optional params)
    let keyPlatform = ''
    let remainingKey = key

    // Try to match common platform patterns
    const platformPatterns = ['lichess', 'chess.com', 'chesscom', 'chess_com']
    for (const pattern of platformPatterns) {
      if (key.toLowerCase().includes(`_${pattern}`)) {
        const platformIndex = key.toLowerCase().lastIndexOf(`_${pattern}`)
        // Extract just the platform portion (not including any trailing params)
        const afterPlatform = key.substring(platformIndex + 1)
        const nextUnderscore = afterPlatform.indexOf('_')
        keyPlatform = nextUnderscore === -1 ? afterPlatform : afterPlatform.substring(0, nextUnderscore)
        remainingKey = key.substring(0, platformIndex)
        break
      }
    }

    if (!keyPlatform) {
      continue // No platform found in key
    }

    // Now extract userId from remaining key (everything after first underscore)
    const firstUnderscoreIndex = remainingKey.indexOf('_')
    if (firstUnderscoreIndex === -1) {
      continue // No endpoint separator found
    }

    const keyUserId = remainingKey.substring(firstUnderscoreIndex + 1)

    // Match userId (case-insensitive for both platforms)
    const userIdMatches = keyUserId.toLowerCase() === normalizedUserId

    if (!userIdMatches) {
      continue
    }

    // Platform match (handle both dotted and non-dotted variants)
    const keyPlatformLower = keyPlatform.toLowerCase().replace(/\./g, '')
    const platformMatches =
      keyPlatform.toLowerCase() === normalizedPlatform ||
      keyPlatformLower === platformNoDots ||
      keyPlatform.toLowerCase() === platformNoDots ||
      keyPlatformLower === normalizedPlatform

    if (platformMatches) {
      keysToDelete.push(key)
    }
  }

  keysToDelete.forEach(key => apiCache.delete(key))
  logger.log(`[Cache] Cleared ${keysToDelete.length} cache entries for user ${userId} on ${platform}`)
  if (keysToDelete.length > 0 && import.meta.env.DEV) {
    logger.log('[Cache] Keys cleared:', keysToDelete)
  }

  // Also clear backend cache via API call
  clearBackendCache(userId, platform)
}

/**
 * Clear backend cache via API call
 */
async function clearBackendCache(userId: string, platform: string): Promise<void> {
  try {
    // Import UnifiedAnalysisService dynamically to avoid circular dependency
    const { UnifiedAnalysisService } = await import('../services/unifiedAnalysisService')
    await UnifiedAnalysisService.clearBackendCache(userId, platform as 'lichess' | 'chess.com')
  } catch (error) {
    console.error('[Cache] Failed to clear backend cache:', error)
  }
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
