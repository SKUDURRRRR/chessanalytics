import { supabase } from '../lib/supabase'
import UnifiedAnalysisService from './unifiedAnalysisService'
import type { Platform } from '../types'

export interface GameAnalysisFetchResult {
  game: any | null
  analysis: any | null
  pgn: string | null
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
 * Optimized version that runs queries in parallel and uses batch queries instead of loops
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

  // Check cache first
  const cacheKey = `${canonicalUserId}:${platform}:${normalizedGameId}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  let gameRecord: any | null = null
  let analysisRecord: any | null = null
  let pgnText: string | null = null

  try {
    // OPTIMIZATION 1: Run both game queries in parallel instead of sequentially
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
    ]).filter(Boolean) // Remove null/undefined values

    // OPTIMIZATION 2: Batch query for analysis records using OR conditions instead of loops
    // This queries all candidates in parallel (faster than sequential loops)
    // Also try unified_analyses view which has provider_game_id alias
    const analysisPromises = identifierCandidates.flatMap(candidate => [
      // Query move_analyses by game_id
      supabase
        .from('move_analyses')
        .select('*')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .eq('game_id', candidate)
        .maybeSingle(),
      // Also try unified_analyses view by provider_game_id (alias for game_id)
      supabase
        .from('unified_analyses')
        .select('*')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .eq('provider_game_id', candidate)
        .maybeSingle()
    ])

    // OPTIMIZATION 3: Query PGN in parallel with analysis
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

    // OPTIMIZATION 4: Only check for move data if analysis exists but lacks moves_analysis
    // Query with stockfish filter only if needed
    const needsMoveData = analysisRecord && (!analysisRecord.moves_analysis || !Array.isArray(analysisRecord.moves_analysis) || analysisRecord.moves_analysis.length === 0)

    if (needsMoveData && identifierCandidates.length > 0) {
      // Query all candidates in parallel with stockfish filter
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

    // OPTIMIZATION 5: Only call expensive API as absolute last resort
    // This is expensive because it fetches ALL analyses for the user
    // Only use if we have a game but no analysis at all
    if (!analysisRecord && gameRecord) {
      // Try one more direct query before falling back to API
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
        // Last resort: API call (but this is expensive, so we try to avoid it)
        // Only fetch 1 analysis to minimize data transfer
        const apiAnalyses = await UnifiedAnalysisService.getGameAnalyses(userId, platform, 'stockfish', 1, 0)
        analysisRecord = apiAnalyses.find(item =>
          item?.game_id === normalizedGameId ||
          (gameRecord && item?.game_id === gameRecord.id) ||
          (gameRecord && item?.game_id === gameRecord.provider_game_id)
        ) ?? null
      }
    }
  } catch (error) {
    console.error('Failed to fetch game analysis data', error)
  }

  const result = {
    game: gameRecord,
    analysis: analysisRecord,
    pgn: pgnText,
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
