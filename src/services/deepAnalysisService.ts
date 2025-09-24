import { config } from '../lib/config'

function canonicalizeUserId(userId: string, platform: 'lichess' | 'chess.com'): string {
  return platform === 'chess.com' ? userId.trim().toLowerCase() : userId.trim()
}

export interface DeepAnalysisData {
  totalGames: number
  averageAccuracy: number
  currentRating: number
  personalityScores: {
    tactical: number
    positional: number
    aggressive: number
    patient: number
    endgame: number
    opening: number
    novelty: number
    staleness: number
  }
  playerLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  playerStyle: {
    category: 'positional' | 'tactical' | 'aggressive' | 'balanced'
    description: string
    confidence: number
  }
  primaryStrengths: string[]
  improvementAreas: string[]
  playingStyle: string
  phaseAccuracies: {
    opening: number
    middleGame: number
    endgame: number
  }
  recommendations: {
    primary: string
    secondary: string
    leverage: string
  }
}

type DeepAnalysisApiResponse = {
  total_games: number
  average_accuracy: number
  current_rating: number
  personality_scores: Record<string, number>
  player_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  player_style: { category: string; description: string; confidence: number }
  primary_strengths: string[]
  improvement_areas: string[]
  playing_style: string
  phase_accuracies: Record<string, number>
  recommendations: Record<string, string>
}

const ANALYSIS_API_URL = config.getApi().baseUrl

export async function fetchDeepAnalysis(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<DeepAnalysisData> {
  const canonicalUserId = canonicalizeUserId(userId, platform)
  const url = `${ANALYSIS_API_URL}/api/v1/deep-analysis/${encodeURIComponent(canonicalUserId)}/${platform}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      if (response.status === 404) {
        return getDefaultAnalysis(canonicalUserId)
      }
      const message = await safeReadError(response)
      throw new Error(`Deep analysis request failed (${response.status}): ${message}`)
    }

    const payload = (await response.json()) as DeepAnalysisApiResponse
    return adaptDeepAnalysis(payload)
  } catch (error) {
    console.error('Failed to fetch deep analysis:', error)
    throw error instanceof Error ? error : new Error('Failed to fetch deep analysis')
  }
}

function adaptDeepAnalysis(payload: DeepAnalysisApiResponse): DeepAnalysisData {
  const scores = payload.personality_scores || {}
  const phase = payload.phase_accuracies || {}
  const recommendations = payload.recommendations || {}
  const style = payload.player_style || { category: 'balanced', description: '', confidence: 0 }
  const category = ((style.category || 'balanced') as DeepAnalysisData['playerStyle']['category'])

  return {
    totalGames: payload.total_games ?? 0,
    averageAccuracy: payload.average_accuracy ?? 0,
    currentRating: payload.current_rating ?? 0,
    personalityScores: {
      tactical: scores.tactical ?? 0,
      positional: scores.positional ?? 0,
      aggressive: scores.aggressive ?? 0,
      patient: scores.patient ?? 0,
      endgame: scores.endgame ?? 0,
      opening: scores.opening ?? 0,
      novelty: scores.novelty ?? 0,
      staleness: scores.staleness ?? 0,
    },
    playerLevel: payload.player_level ?? 'beginner',
    playerStyle: {
      category,
      description: style.description ?? '',
      confidence: style.confidence ?? 0,
    },
    primaryStrengths: payload.primary_strengths ?? [],
    improvementAreas: payload.improvement_areas ?? [],
    playingStyle: payload.playing_style ?? '',
    phaseAccuracies: {
      opening: phase.opening ?? 0,
      middleGame: phase.middle ?? phase.middle_game ?? 0,
      endgame: phase.endgame ?? 0,
    },
    recommendations: {
      primary: recommendations.primary ?? '',
      secondary: recommendations.secondary ?? '',
      leverage: recommendations.leverage ?? '',
    },
  }
}

function getDefaultAnalysis(userId: string): DeepAnalysisData {
  return {
    totalGames: 0,
    averageAccuracy: 0,
    currentRating: 0,
    personalityScores: {
      tactical: 50,
      positional: 50,
      aggressive: 50,
      patient: 50,
      endgame: 50,
      opening: 50,
      novelty: 50,
      staleness: 50,
    },
    playerLevel: 'beginner',
    playerStyle: {
      category: 'balanced',
      description: `No deep analysis available for ${userId}.`,
      confidence: 0,
    },
    primaryStrengths: [],
    improvementAreas: ['Run Stockfish analysis to unlock deep insights'],
    playingStyle: 'No deep analysis available yet.',
    phaseAccuracies: {
      opening: 0,
      middleGame: 0,
      endgame: 0,
    },
    recommendations: {
      primary: 'Run Stockfish analysis on recent games to unlock deep recommendations.',
      secondary: 'Import more games to build a richer dataset.',
      leverage: 'Once analysis is complete we will suggest strengths to lean into.',
    },
  }
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text || response.statusText
  } catch {
    return response.statusText
  }
}

