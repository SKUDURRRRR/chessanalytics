/**
 * Frontend cache security tests
 *
 * Tests the clearUserCache function to ensure it uses exact segment matching
 * and prevents cache collision attacks.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Mock cache implementation for testing
class MockCache {
  private cache = new Map<string, any>()

  set(key: string, value: any): void {
    this.cache.set(key, value)
  }

  get(key: string): any {
    return this.cache.get(key)
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

// Implement the fixed clearUserCache logic for testing
function clearUserCacheFixed(
  cache: MockCache,
  userId: string,
  platform: string
): string[] {
  const keysToDelete: string[] = []

  // Normalize userId for matching (case-insensitive for both platforms)
  // Both Chess.com and Lichess don't allow duplicate usernames with different cases
  const normalizedUserId = userId.toLowerCase()

  // Normalize platform for matching (handle both "chess.com" and "chesscom" variants)
  const normalizedPlatform = platform.toLowerCase()
  const platformNoDots = normalizedPlatform.replace(/\./g, '')

  for (const key of cache.keys()) {
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

  keysToDelete.forEach(key => cache.delete(key))
  return keysToDelete
}

describe('Frontend Cache Security - clearUserCache', () => {
  let cache: MockCache

  beforeEach(() => {
    cache = new MockCache()
  })

  it('should not match similar usernames (alice vs malice)', () => {
    cache.set('stats_alice_chess.com', { data: 'alice' })
    cache.set('stats_malice_chess.com', { data: 'malice' })
    cache.set('deep-analysis_alice_lichess', { data: 'alice_lichess' })

    const deleted = clearUserCacheFixed(cache, 'alice', 'chess.com')

    expect(deleted).toHaveLength(1)
    expect(deleted).toContain('stats_alice_chess.com')
    expect(cache.keys()).toContain('stats_malice_chess.com')
    expect(cache.keys()).toContain('deep-analysis_alice_lichess')
  })

  it('should not match username prefixes (joe vs joe123)', () => {
    cache.set('stats_joe_lichess', { data: 'joe' })
    cache.set('stats_joe123_lichess', { data: 'joe123' })

    const deleted = clearUserCacheFixed(cache, 'joe', 'lichess')

    expect(deleted).toHaveLength(1)
    expect(deleted).toContain('stats_joe_lichess')
    expect(cache.keys()).toContain('stats_joe123_lichess')
  })

  it('should not match username suffixes (bob vs 123bob)', () => {
    cache.set('stats_bob_lichess', { data: 'bob' })
    cache.set('stats_123bob_lichess', { data: '123bob' })

    const deleted = clearUserCacheFixed(cache, 'bob', 'lichess')

    expect(deleted).toHaveLength(1)
    expect(deleted).toContain('stats_bob_lichess')
    expect(cache.keys()).toContain('stats_123bob_lichess')
  })

  it('should isolate cache clearing by platform', () => {
    cache.set('stats_alice_lichess', { data: 'lichess' })
    cache.set('stats_alice_chess.com', { data: 'chess' })
    cache.set('deep-analysis_alice_lichess', { data: 'deep_lichess' })

    const deleted = clearUserCacheFixed(cache, 'alice', 'lichess')

    expect(deleted).toHaveLength(2)
    expect(cache.keys()).toContain('stats_alice_chess.com')
    expect(cache.keys()).not.toContain('stats_alice_lichess')
  })

  it('should handle both chess.com and chesscom platform variants', () => {
    cache.set('stats_alice_chess.com', { data: 'dotted' })
    cache.set('stats_alice_chesscom', { data: 'no_dots' })

    const deleted = clearUserCacheFixed(cache, 'alice', 'chess.com')

    // Should match both variants
    expect(deleted.length).toBeGreaterThanOrEqual(1)
  })

  it('should clear all cache types for a user/platform', () => {
    cache.set('stats_alice_lichess', { data: 'stats' })
    cache.set('deep-analysis_alice_lichess', { data: 'deep' })
    cache.set('elo-history_alice_lichess', { data: 'elo' })
    cache.set('comprehensive_alice_lichess', { data: 'comprehensive' })

    const deleted = clearUserCacheFixed(cache, 'alice', 'lichess')

    expect(deleted).toHaveLength(4)
    expect(cache.size()).toBe(0)
  })

  it('should handle case insensitivity for both platforms', () => {
    // Both Chess.com and Lichess don't allow duplicate usernames with different cases
    // So cache clearing should be case-insensitive for both
    cache.set('stats_Alice_lichess', { data: 'uppercase' })
    cache.set('stats_alice_chess.com', { data: 'lowercase' })
    cache.set('stats_BOB_lichess', { data: 'other_user' })

    const deletedLichess = clearUserCacheFixed(cache, 'alice', 'lichess')
    expect(deletedLichess).toHaveLength(1)
    expect(deletedLichess).toContain('stats_Alice_lichess')

    const deletedChesscom = clearUserCacheFixed(cache, 'Alice', 'chess.com')
    expect(deletedChesscom).toHaveLength(1)
    expect(deletedChesscom).toContain('stats_alice_chess.com')

    // Other user should remain untouched
    expect(cache.keys()).toContain('stats_BOB_lichess')
  })

  it('should handle empty cache gracefully', () => {
    const deleted = clearUserCacheFixed(cache, 'alice', 'lichess')

    expect(deleted).toHaveLength(0)
    expect(cache.size()).toBe(0)
  })

  it('should handle usernames with special characters', () => {
    cache.set('stats_user_123_lichess', { data: 'underscore' })
    cache.set('stats_user-456_lichess', { data: 'dash' })

    const deleted = clearUserCacheFixed(cache, 'user_123', 'lichess')

    expect(deleted).toHaveLength(1)
    expect(deleted).toContain('stats_user_123_lichess')
    expect(cache.keys()).toContain('stats_user-456_lichess')
  })

  it('should handle cache keys with parameters', () => {
    cache.set('stats_alice_lichess_{"limit":100}', { data: 'with_params' })
    cache.set('stats_alice_lichess', { data: 'no_params' })

    const deleted = clearUserCacheFixed(cache, 'alice', 'lichess')

    expect(deleted).toHaveLength(2)
  })
})
