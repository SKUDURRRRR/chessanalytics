import { supabase } from '../lib/supabase'
import UnifiedAnalysisService from './unifiedAnalysisService'
import type { Platform } from '../types'

export interface GameAnalysisFetchResult {
  game: any | null
  analysis: any | null
  pgn: string | null
  ai_comments_status?: 'pending' | 'generating' | 'completed'
}

// Simple in-memory cache to avoid redundant queries
// Cache key: `${canonicalUserId}:${platform}:${normalizedGameId}`
const cache = new Map<string, { data: GameAnalysisFetchResult; timestamp: number }>()
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes cache

const canonicalizeUserId = (userId: string, platform: Platform): string => {
  if (platform === 'chess.com') {
    return userId.trim().toLowerCase()
  }
  return userId.trim()
}

const unique = <T,>(values: T[]): T[] => {
  const seen = new Set<T>()
  const result: T[] = []
  for (const value of values) {
    if (value != null && !seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }
  return result
}

/**
 * Optimized version that uses backend API to avoid UUID validation issues
 * Falls back to direct Supabase queries for authenticated users
 */
export async function fetchGameAnalysisData(
  userId: string,
  platform: Platform,
  gameIdentifier: string
): Promise<GameAnalysisFetchResult> {
  const canonicalUserId = canonicalizeUserId(userId, platform)

  let normalizedGameId = gameIdentifier
  try {
    normalizedGameId = decodeURIComponent(gameIdentifier)
  } catch {
    normalizedGameId = gameIdentifier
  }

  // Check cache first (but allow bypass for fresh data)
  const cacheKey = `${canonicalUserId}:${platform}:${normalizedGameId}`
  const cached = cache.get(cacheKey)
  // Don't use cache if we're checking for AI comments (force fresh data)
  const forceRefresh = (window as any)?._forceRefreshGameAnalysis
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  let gameRecord: any | null = null
  let analysisRecord: any | null = null
  let pgnText: string | null = null

  try {
    // Try backend API first - handles both UUID and username-based queries
    const baseUrl = import.meta.env.VITE_ANALYSIS_API_URL || 'http://localhost:8002'
    const response = await fetch(
      `${baseUrl}/api/v1/game/${encodeURIComponent(userId)}/${platform}/${encodeURIComponent(normalizedGameId)}`
    )

    if (response.ok) {
      // Backend API succeeded
      const data = await response.json()
      gameRecord = data.game
      analysisRecord = data.analysis
      pgnText = data.pgn

      // Return result with ai_comments_status
      const result: GameAnalysisFetchResult = {
        game: gameRecord,
        analysis: analysisRecord,
        pgn: pgnText,
        ai_comments_status: data.ai_comments_status || (analysisRecord?.ai_comments_status) || 'pending'
      }

      // Update cache
      cache.set(cacheKey, { data: result, timestamp: Date.now() })

      // Clear force refresh flag
      if ((window as any)?._forceRefreshGameAnalysis) {
        delete (window as any)._forceRefreshGameAnalysis
      }

      return result
    } else {
      // Backend API failed - fall back to direct Supabase queries
      // This only works for authenticated users with UUID-based user_ids
      console.warn('Backend API failed, falling back to direct Supabase queries')

      const [primaryGameResult, fallbackGameResult] = await Promise.all([
        supabase
          .from('games')
          .select('*')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .eq('provider_game_id', normalizedGameId)
          .maybeSingle(),
        supabase
          .from('games')
          .select('*')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .eq('id', normalizedGameId)
          .maybeSingle(),
      ])

      gameRecord = primaryGameResult.data ?? fallbackGameResult.data ?? null

      const identifierCandidates = unique([
        normalizedGameId,
        gameRecord?.provider_game_id,
        gameRecord?.id,
      ]).filter(Boolean)

      const analysisPromises = identifierCandidates.flatMap(candidate => [
        supabase
          .from('move_analyses')
          .select('*')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .eq('game_id', candidate)
          .maybeSingle(),
        supabase
          .from('unified_analyses')
          .select('*')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .eq('provider_game_id', candidate)
          .maybeSingle()
      ])

      const pgnPromises = identifierCandidates.map(candidate =>
        supabase
          .from('games_pgn')
          .select('pgn')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .eq('provider_game_id', candidate)
          .maybeSingle()
      )

      const [analysisResults, pgnResults] = await Promise.all([
        Promise.all(analysisPromises),
        Promise.all(pgnPromises),
      ])

      // Get the first non-null analysis record
      for (const result of analysisResults) {
        if (result.data) {
          analysisRecord = result.data
          break
        }
      }

      // Get the first non-null PGN
      for (const pgnResult of pgnResults) {
        if (pgnResult.data?.pgn) {
          pgnText = pgnResult.data.pgn
          break
        }
      }

      // OPTIMIZATION: Only check for move data if analysis exists but lacks moves_analysis
      const needsMoveData = analysisRecord && (!analysisRecord.moves_analysis || !Array.isArray(analysisRecord.moves_analysis) || analysisRecord.moves_analysis.length === 0)

      if (needsMoveData && identifierCandidates.length > 0) {
        const moveDataPromises = identifierCandidates.map(candidate =>
          supabase
            .from('move_analyses')
            .select('*')
            .eq('user_id', canonicalUserId)
            .eq('platform', platform)
            .eq('game_id', candidate)
            .eq('analysis_method', 'stockfish')
            .maybeSingle()
        )

        const moveDataResults = await Promise.all(moveDataPromises)
        for (const result of moveDataResults) {
          if (result.data) {
            analysisRecord = {
              ...result.data,
              ...analysisRecord,
              moves_analysis: result.data.moves_analysis ?? analysisRecord.moves_analysis ?? null,
            }
            break
          }
        }
      }

      // Last resort: Try API call if we have a game but no analysis
      if (!analysisRecord && gameRecord) {
        const finalAttempt = await supabase
          .from('move_analyses')
          .select('*')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .or(`game_id.eq.${gameRecord.id},game_id.eq.${gameRecord.provider_game_id}`)
          .maybeSingle()

        if (finalAttempt.data) {
          analysisRecord = finalAttempt.data
        } else {
          const apiAnalyses = await UnifiedAnalysisService.getGameAnalyses(userId, platform, 'stockfish', 1, 0)
          analysisRecord = apiAnalyses.find(item =>
            item?.game_id === normalizedGameId ||
            (gameRecord && item?.game_id === gameRecord.id) ||
            (gameRecord && item?.game_id === gameRecord.provider_game_id)
          ) ?? null
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch game analysis data', error)
  }

  const result: GameAnalysisFetchResult = {
    game: gameRecord,
    analysis: analysisRecord,
    pgn: pgnText,
    ai_comments_status: analysisRecord?.ai_comments_status || 'pending'
  }

  // Clear force refresh flag
  if ((window as any)?._forceRefreshGameAnalysis) {
    delete (window as any)._forceRefreshGameAnalysis
  }

  // Cache the result
  cache.set(cacheKey, { data: result, timestamp: Date.now() })

  // Clean up old cache entries (keep cache size manageable)
  if (cache.size > 100) {
    const now = Date.now()
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        cache.delete(key)
      }
    }
  }

  return result
}
