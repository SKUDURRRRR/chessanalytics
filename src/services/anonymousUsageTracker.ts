/**
 * Anonymous Usage Tracker
 * Tracks anonymous user usage in localStorage
 *
 * Limits:
 * - 100 game imports (one-time)
 * - 1 analysis (one-time)
 *
 * Note: Can be bypassed by clearing localStorage, which is acceptable.
 * The goal is to provide friction and encourage registration, not perfect security.
 */

interface AnonymousUsage {
  imports: number
  analyses: number
  firstUsed: string
}

const STORAGE_KEY = 'chess_analytics_anonymous_usage'
const IMPORT_LIMIT = 100
const ANALYSIS_LIMIT = 1

export class AnonymousUsageTracker {
  /**
   * Get current usage stats from localStorage
   */
  private static getUsage(): AnonymousUsage {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return { imports: 0, analyses: 0, firstUsed: new Date().toISOString() }
      }
      return JSON.parse(stored)
    } catch (error) {
      console.error('Error reading anonymous usage:', error)
      return { imports: 0, analyses: 0, firstUsed: new Date().toISOString() }
    }
  }

  /**
   * Save usage stats to localStorage
   */
  private static saveUsage(usage: AnonymousUsage): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usage))
    } catch (error) {
      console.error('Error saving anonymous usage:', error)
    }
  }

  /**
   * Check if anonymous user can import more games
   */
  static canImport(): boolean {
    const usage = this.getUsage()
    return usage.imports < IMPORT_LIMIT
  }

  /**
   * Check if anonymous user can analyze games
   */
  static canAnalyze(): boolean {
    const usage = this.getUsage()
    return usage.analyses < ANALYSIS_LIMIT
  }

  /**
   * Increment import count
   */
  static incrementImports(count: number): void {
    const usage = this.getUsage()
    usage.imports += count
    this.saveUsage(usage)
    console.log(`Anonymous usage: ${usage.imports}/${IMPORT_LIMIT} imports used`)
  }

  /**
   * Increment analysis count
   */
  static incrementAnalyses(): void {
    const usage = this.getUsage()
    usage.analyses += 1
    this.saveUsage(usage)
    console.log(`Anonymous usage: ${usage.analyses}/${ANALYSIS_LIMIT} analyses used`)
  }

  /**
   * Get current usage statistics
   */
  static getStats(): {
    imports: { used: number; remaining: number; limit: number }
    analyses: { used: number; remaining: number; limit: number }
  } {
    const usage = this.getUsage()
    return {
      imports: {
        used: usage.imports,
        remaining: Math.max(0, IMPORT_LIMIT - usage.imports),
        limit: IMPORT_LIMIT
      },
      analyses: {
        used: usage.analyses,
        remaining: Math.max(0, ANALYSIS_LIMIT - usage.analyses),
        limit: ANALYSIS_LIMIT
      }
    }
  }

  /**
   * Reset usage (for testing or user request)
   */
  static reset(): void {
    localStorage.removeItem(STORAGE_KEY)
    console.log('Anonymous usage reset')
  }

  /**
   * Check if user has used any anonymous features
   */
  static hasUsedFeatures(): boolean {
    const usage = this.getUsage()
    return usage.imports > 0 || usage.analyses > 0
  }
}
