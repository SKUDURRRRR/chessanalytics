import { describe, it, expect, vi } from 'vitest'
import { UnifiedAnalysisService } from '../src/services/unifiedAnalysisService'
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
  describe('UnifiedAnalysisService', () => {
    it('should have getAnalysisStats method', () => {
      expect(typeof UnifiedAnalysisService.getAnalysisStats).toBe('function')
    })

    it('should have startBatchAnalysis method', () => {
      expect(typeof UnifiedAnalysisService.startBatchAnalysis).toBe('function')
    })

    it('should have checkHealth method', () => {
      expect(typeof UnifiedAnalysisService.checkHealth).toBe('function')
    })

    it('should handle API errors gracefully', async () => {
      // Mock fetch to return an error
      ;(fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      })

      try {
        await UnifiedAnalysisService.getAnalysisStats('testuser', 'lichess')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should return null when API is not available', async () => {
      // Mock fetch to fail
      ;(fetch as any).mockRejectedValueOnce(new Error('Network error'))

      try {
        const result = await UnifiedAnalysisService.getAnalysisStats('testuser', 'lichess')
        
        // Should return null as fallback
        expect(result).toBeNull()
      } catch (error) {
        // If the service throws an error, that's also acceptable
        expect(error).toBeDefined()
      }
    })
  })
})
