import { supabase } from '../lib/supabase'
import UnifiedAnalysisService from './unifiedAnalysisService'
import type { Platform } from '../types'

export interface GameAnalysisFetchResult {
  game: any | null
  analysis: any | null
  pgn: string | null
}

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

  let gameRecord: any | null = null
  let analysisRecord: any | null = null
  let pgnText: string | null = null

  try {
    const { data: primaryGame } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', canonicalUserId)
      .eq('platform', platform)
      .eq('provider_game_id', normalizedGameId)
      .maybeSingle()

    gameRecord = primaryGame ?? null

    if (!gameRecord) {
      const { data: fallbackGame } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .eq('id', normalizedGameId)
        .maybeSingle()

      gameRecord = fallbackGame ?? null
    }

    const identifierCandidates = unique([
      normalizedGameId,
      gameRecord?.provider_game_id,
      gameRecord?.id,
    ])

    if (!analysisRecord) {
      for (const candidate of identifierCandidates) {
        const { data } = await supabase
          .from('move_analyses')
          .select('*')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .eq('game_id', candidate)
          .maybeSingle()

        if (data) {
          analysisRecord = data
          break
        }
      }
    }

    if (!analysisRecord) {
      const apiAnalyses = await UnifiedAnalysisService.getGameAnalyses(userId, platform, 'stockfish')
      analysisRecord = apiAnalyses.find(item =>
        item?.game_id === normalizedGameId ||
        (gameRecord && item?.game_id === gameRecord.id) ||
        (gameRecord && item?.game_id === gameRecord.provider_game_id)
      ) ?? null
    }

    const needsMoveData = !analysisRecord?.moves_analysis || !Array.isArray(analysisRecord.moves_analysis) || analysisRecord.moves_analysis.length === 0

    if (needsMoveData) {
      for (const candidate of identifierCandidates) {
        const { data } = await supabase
          .from('move_analyses')
          .select('*')
          .eq('user_id', canonicalUserId)
          .eq('platform', platform)
          .eq('game_id', candidate)
          .eq('analysis_method', 'stockfish')
          .maybeSingle()

        if (data) {
          analysisRecord = {
            ...data,
            ...(analysisRecord ?? {}),
            moves_analysis: data.moves_analysis ?? analysisRecord?.moves_analysis ?? null,
          }
          break
        }
      }
    }

    for (const candidate of identifierCandidates) {
      if (pgnText) {
        break
      }

      const { data } = await supabase
        .from('games_pgn')
        .select('pgn')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .eq('provider_game_id', candidate)
        .maybeSingle()

      if (data?.pgn) {
        pgnText = data.pgn
      }
    }
  } catch (error) {
    console.error('Failed to fetch game analysis data', error)
  }

  return {
    game: gameRecord,
    analysis: analysisRecord,
    pgn: pgnText,
  }
}
