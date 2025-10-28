import { useState, useEffect, useRef } from 'react'
import { config } from '../lib/config'

export interface ExplorationAnalysis {
  fen: string
  evaluation: {
    type: 'cp' | 'mate'
    value: number
    scoreForWhite: number
  }
  bestMove?: {
    san: string
    from: string
    to: string
  }
  pvLine: string[]
  isAnalyzing: boolean
  error?: string
}

/**
 * Hook to analyze chess positions in real-time during exploration mode.
 *
 * Features:
 * - Debounced API calls (300ms) to prevent excessive requests
 * - Position caching to avoid re-analyzing same positions
 * - Automatic cleanup on unmount
 * - Loading states for smooth UX
 *
 * @param fen - FEN string of position to analyze (null to disable)
 * @param enabled - Whether analysis is enabled
 * @returns Analysis result or null
 */
export function useExplorationAnalysis(
  fen: string | null,
  enabled: boolean
): ExplorationAnalysis | null {
  const [analysis, setAnalysis] = useState<ExplorationAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const cacheRef = useRef<Map<string, ExplorationAnalysis>>(new Map())
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Clear analysis if disabled or no FEN
    if (!enabled || !fen) {
      setAnalysis(null)
      setIsAnalyzing(false)
      return
    }

    // Check cache first
    const cached = cacheRef.current.get(fen)
    if (cached) {
      setAnalysis(cached)
      setIsAnalyzing(false)
      return
    }

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set analyzing state immediately
    setIsAnalyzing(true)

    // Debounce analysis requests (300ms delay)
    debounceTimerRef.current = setTimeout(async () => {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController()

      try {
        const apiUrl = config.api.baseUrl || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/v1/analyze-position-quick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fen, depth: 10 }),
          signal: abortControllerRef.current.signal
        })

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.statusText}`)
        }

        const data = await response.json()

        const analysisResult: ExplorationAnalysis = {
          fen: data.fen,
          evaluation: {
            type: data.evaluation.type,
            value: data.evaluation.value,
            scoreForWhite: data.evaluation.score_for_white
          },
          bestMove: data.best_move ? {
            san: data.best_move.san,
            from: data.best_move.from,
            to: data.best_move.to
          } : undefined,
          pvLine: data.pv_line || [],
          isAnalyzing: false
        }

        // Cache result
        cacheRef.current.set(fen, analysisResult)

        // Limit cache size to 50 positions
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value
          if (firstKey) {
            cacheRef.current.delete(firstKey)
          }
        }

        setAnalysis(analysisResult)
        setIsAnalyzing(false)
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
          return
        }

        console.error('Exploration analysis error:', error)
        setAnalysis({
          fen,
          evaluation: { type: 'cp', value: 0, scoreForWhite: 0 },
          pvLine: [],
          isAnalyzing: false,
          error: error.message || 'Analysis failed'
        })
        setIsAnalyzing(false)
      }
    }, 300) // 300ms debounce

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [fen, enabled])

  return analysis ? { ...analysis, isAnalyzing } : null
}
