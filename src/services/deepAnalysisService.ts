// Deep Analysis Service - Handles deep analysis functionality
import { config } from '../lib/config'
import type { DeepAnalysisData, PersonalityScores } from '../types'
export type { DeepAnalysisData } from '../types'

const API_URL = config.getApi().baseUrl

const FALLBACK_PERSONALITY: PersonalityScores = {
  tactical: 50,
  positional: 50,
  aggressive: 50,
  patient: 50,
  novelty: 50,
  staleness: 50,
}

// Input validation helpers
function validateUserId(userId: string): boolean {
  return typeof userId === 'string' && userId.trim().length > 0
}

function validatePlatform(platform: string): platform is 'lichess' | 'chess.com' {
  return platform === 'lichess' || platform === 'chess.com'
}

function validatePersonalityScores(scores: any): PersonalityScores | null {
  if (!scores || typeof scores !== 'object') {
    return null
  }

  const requiredTraits = ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness']
  const validatedScores: Partial<PersonalityScores> = {}

  for (const trait of requiredTraits) {
    const value = scores[trait]
    if (typeof value === 'number' && !isNaN(value) && value >= 0 && value <= 100) {
      validatedScores[trait] = value
    } else {
      return null // Invalid data
    }
  }

  return validatedScores as PersonalityScores
}

function validateDeepAnalysisData(data: any): DeepAnalysisData | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  // Validate required fields
  const requiredFields = ['total_games', 'average_accuracy', 'current_rating', 'personality_scores']
  for (const field of requiredFields) {
    if (!(field in data)) {
      return null
    }
  }

  // Validate personality scores
  const personalityScores = validatePersonalityScores(data.personality_scores)
  if (!personalityScores) {
    return null
  }

  // Return validated data with defaults for missing fields
  return {
    total_games: Math.max(0, data.total_games || 0),
    average_accuracy: Math.max(0, Math.min(100, data.average_accuracy || 0)),
    current_rating: Math.max(0, data.current_rating || 0),
    personality_scores: personalityScores,
    player_level: data.player_level || 'intermediate',
    player_style: data.player_style || {
      category: 'balanced',
      description: 'Analysis in progress...',
      confidence: 0,
    },
    primary_strengths: Array.isArray(data.primary_strengths) ? data.primary_strengths : ['Analysis in progress...'],
    improvement_areas: Array.isArray(data.improvement_areas) ? data.improvement_areas : ['Analysis in progress...'],
    playing_style: data.playing_style || 'Data unavailable',
    phase_accuracies: {
      opening: Math.max(0, Math.min(100, data.phase_accuracies?.opening || 0)),
      middle: Math.max(0, Math.min(100, data.phase_accuracies?.middle || 0)),
      endgame: Math.max(0, Math.min(100, data.phase_accuracies?.endgame || 0)),
    },
    recommendations: {
      primary: data.recommendations?.primary || 'Complete a Stockfish analysis to unlock deep recommendations.',
      secondary: data.recommendations?.secondary || 'Play a fresh set of games to refresh recent patterns.',
      leverage: data.recommendations?.leverage || 'Review your most accurate games once analysis is ready.',
    },
  }
}

export async function fetchDeepAnalysis(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<DeepAnalysisData> {
  // Input validation
  if (!validateUserId(userId)) {
    throw new Error('Invalid userId provided')
  }

  if (!validatePlatform(platform)) {
    throw new Error('Invalid platform provided. Must be "lichess" or "chess.com"')
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/deep-analysis/${userId}/${platform}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const rawData = await response.json()
    const validatedData = validateDeepAnalysisData(rawData)
    
    if (!validatedData) {
      throw new Error('Invalid data format received from server')
    }

    return validatedData
  } catch (error) {
    console.error('Error fetching deep analysis:', error)

    // Return fallback data with neutral personality scores
    return {
      total_games: 0,
      average_accuracy: 0,
      current_rating: 0,
      personality_scores: FALLBACK_PERSONALITY,
      player_level: 'intermediate',
      player_style: {
        category: 'balanced',
        description: 'Fallback data - run a full analysis for personalised insights.',
        confidence: 0,
      },
      primary_strengths: ['Analysis in progress...'],
      improvement_areas: ['Analysis in progress...'],
      playing_style: 'Data unavailable',
      phase_accuracies: {
        opening: 0,
        middle: 0,
        endgame: 0,
      },
      recommendations: {
        primary: 'Complete a Stockfish analysis to unlock deep recommendations.',
        secondary: 'Play a fresh set of games to refresh recent patterns.',
        leverage: 'Review your most accurate games once analysis is ready.',
      },
    }
  }
}
