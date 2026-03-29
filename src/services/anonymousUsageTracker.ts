/**
 * Anonymous Usage Tracker
 * Tracks anonymous user usage in localStorage with 24-hour rolling window
 *
 * Limits (reset every 24 hours):
 * - 50 game imports per 24 hours
 * - 2 analyses per 24 hours
 *
 * Note: Can be bypassed by clearing localStorage, which is acceptable.
 * The goal is to provide friction and encourage registration, not perfect security.
 */

interface AnonymousUsage {
  imports: number // Games imported (daily limit)
  analyses: number
  resetAt: string // ISO timestamp when the limits will reset
}

const STORAGE_KEY = 'chess_analytics_anonymous_usage'
const IMPORT_LIMIT = 50 // Per day
const ANALYSIS_LIMIT = 2 // Per day
const RESET_WINDOW_HOURS = 24

export class AnonymousUsageTracker {
  /**
   * Get current usage stats from localStorage
   * Automatically resets if 24 hours have passed
   */
  private static getUsage(): AnonymousUsage {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        // First time - create new usage record
        const resetAt = new Date()
        resetAt.setHours(resetAt.getHours() + RESET_WINDOW_HOURS)
        return { imports: 0, analyses: 0, resetAt: resetAt.toISOString() }
      }

      const usage = JSON.parse(stored) as AnonymousUsage

      // Migrate old format if needed
      if ('totalImports' in usage && !('imports' in usage)) {
        usage.imports = (usage as any).totalImports || 0
      }
      if ('analysisResetAt' in usage && !('resetAt' in usage)) {
        usage.resetAt = (usage as any).analysisResetAt || new Date().toISOString()
      }

      // Check if 24 hours have passed since resetAt
      const resetTime = new Date(usage.resetAt)
      const now = new Date()

      if (now >= resetTime) {
        // Reset both limits when window expires
        console.log('Anonymous usage limits reset (24 hours passed)')
        const newResetAt = new Date()
        newResetAt.setHours(newResetAt.getHours() + RESET_WINDOW_HOURS)
        return { imports: 0, analyses: 0, resetAt: newResetAt.toISOString() }
      }

      return usage
    } catch (error) {
      console.error('Error reading anonymous usage:', error)
      const resetAt = new Date()
      resetAt.setHours(resetAt.getHours() + RESET_WINDOW_HOURS)
      return { imports: 0, analyses: 0, resetAt: resetAt.toISOString() }
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
   * Note: This checks localStorage, but backend also enforces the limit
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
   * Increment import count (daily)
   */
  static incrementImports(count: number): void {
    const usage = this.getUsage()
    usage.imports += count
    this.saveUsage(usage)
    console.log(`Anonymous usage: ${usage.imports}/${IMPORT_LIMIT} imports used today`)
  }

  /**
   * Increment analysis count (daily)
   */
  static incrementAnalyses(): void {
    const usage = this.getUsage()
    usage.analyses += 1
    this.saveUsage(usage)
    console.log(`Anonymous usage: ${usage.analyses}/${ANALYSIS_LIMIT} analyses used today`)
  }

  /**
   * Get current usage statistics
   */
  static getStats(): {
    imports: { used: number; remaining: number; limit: number }
    analyses: { used: number; remaining: number; limit: number }
    resetAt: string
    resetsInHours: number
  } {
    const usage = this.getUsage()
    const resetTime = new Date(usage.resetAt)
    const now = new Date()
    const resetsInHours = Math.max(0, (resetTime.getTime() - now.getTime()) / (1000 * 60 * 60))

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
      },
      resetAt: usage.resetAt,
      resetsInHours: Math.round(resetsInHours * 10) / 10 // Round to 1 decimal place
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
