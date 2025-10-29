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
 * Uses exact segment matching to avoid over-deleting keys for similar user IDs
 * (e.g., "alice" should not match "malice" cache keys).
 *
 * Cache keys follow format: {endpoint}_{userId}_{platform}{optional_params}
 * Example: "stats_alice_chess.com" or "deep-analysis_magnus_lichess_{"limit":100}"
 */
export function clearUserCache(userId: string, platform: string): void {
  const keysToDelete: string[] = []

  // Normalize userId for matching (case-insensitive for chess.com)
  const normalizedUserId = platform === 'chess.com' ? userId.toLowerCase() : userId
  const normalizedUserIdLower = normalizedUserId.toLowerCase()

  // Normalize platform for matching (handle both "chess.com" and "chesscom" variants)
  const normalizedPlatform = platform.toLowerCase()
  const platformNoDots = normalizedPlatform.replace(/\./g, '')

  for (const key of apiCache.getStats().keys) {
    // Cache keys follow format: {endpoint}_{userId}_{platform}{optional}
    // Split by underscore to get segments for exact matching
    const parts = key.split('_')

    if (parts.length < 3) {
      continue // Malformed key, skip
    }

    // Extract userId and platform segments
    // parts[0] = endpoint, parts[1] = userId, parts[2] = platform (or platform.com)
    const keyUserId = parts[1]?.toLowerCase() || ''

    // Platform might be split if it contains dots, so we need to reconstruct it
    // For "stats_alice_chess.com" -> parts = ["stats", "alice", "chess.com"]
    // For "stats_alice_chesscom" -> parts = ["stats", "alice", "chesscom"]
    let keyPlatform = parts[2]?.toLowerCase() || ''

    // If there are more parts and the third part is short (like "chess"),
    // it might be the first part of "chess.com", so check if next part is "com"
    if (parts.length > 3 && parts[2] === 'chess' && parts[3]?.startsWith('com')) {
      keyPlatform = 'chess.com'
    }

    // Exact userId match (prevents "alice" from matching "malice")
    const userIdMatches = keyUserId === normalizedUserIdLower

    if (!userIdMatches) {
      continue
    }

    // Platform match (handle both dotted and non-dotted variants)
    const keyPlatformNoDots = keyPlatform.replace(/\./g, '')
    const platformMatches =
      keyPlatform === normalizedPlatform ||
      keyPlatformNoDots === platformNoDots ||
      keyPlatform === platformNoDots ||
      keyPlatformNoDots === normalizedPlatform

    if (platformMatches) {
      keysToDelete.push(key)
    }
  }

  keysToDelete.forEach(key => apiCache.delete(key))
  console.log(`[Cache] Cleared ${keysToDelete.length} cache entries for user ${userId} on ${platform}`)
  if (keysToDelete.length > 0 && import.meta.env.DEV) {
    console.log('[Cache] Keys cleared:', keysToDelete)
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
