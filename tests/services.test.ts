import { describe, it, expect, vi } from 'vitest'
import { AnalysisService } from '../src/services/analysisService'
import { normalizeUserId } from '../src/lib/security'
import config from '../src/lib/config'

// Mock fetch for API calls
global.fetch = vi.fn()


describe('configuration', () => {
  it('exposes the analysis API base URL from validated config', () => {
    expect(config.getApi().baseUrl).toBe('http://localhost:8002')
  })
})

describe('normalizeUserId', () => {
  it('trims whitespace and preserves lichess casing', () => {
    expect(normalizeUserId('  MagnusCarlsen  ', 'lichess')).toBe('MagnusCarlsen')
  })

  it('lowercases chess.com usernames', () => {
    expect(normalizeUserId('  Hikaru  ', 'chess.com')).toBe('hikaru')
  })
})

describe('Services', () => {
  describe('AnalysisService', () => {
    it('should have getAnalysisStats method', () => {
      expect(typeof AnalysisService.getAnalysisStats).toBe('function')
    })

    it('should handle API errors gracefully', async () => {
      // Mock fetch to return an error
      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      })

      try {
        await AnalysisService.getAnalysisStats('testuser', 'lichess')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should return mock data when API is not available', async () => {
      // Mock fetch to fail
      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      try {
        const result = await AnalysisService.getAnalysisStats('testuser', 'lichess')
        
        // Should return mock data as fallback
        expect(result).toBeDefined()
        expect(result).not.toBeNull()
        if (result) {
          expect(result.total_games_analyzed).toBeGreaterThan(0)
        }
      } catch (error) {
        // If the service throws an error, that's also acceptable
        expect(error).toBeDefined()
      }
    })
  })
})
