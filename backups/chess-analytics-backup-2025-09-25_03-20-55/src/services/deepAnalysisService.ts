// Deep Analysis Service - Handles deep analysis functionality
import { config } from '../lib/config'

const API_URL = config.getApi().baseUrl

export interface DeepAnalysisData {
  total_games: number
  average_accuracy: number
  current_rating: number
  personality_scores: Record<string, number>
  player_level: string
  player_style: Record<string, any>
  primary_strengths: string[]
  improvement_areas: string[]
  playing_style: string
  phase_accuracies: Record<string, number>
  recommendations: Record<string, string>
}

export async function fetchDeepAnalysis(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<DeepAnalysisData> {
  try {
    const response = await fetch(`${API_URL}/api/v1/deep-analysis/${userId}/${platform}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching deep analysis:', error)
    
    // Return mock data for now
    return {
      total_games: 0,
      average_accuracy: 0,
      current_rating: 0,
      personality_scores: {
        aggressive: 0.5,
        defensive: 0.3,
        tactical: 0.4,
        positional: 0.6,
        endgame: 0.5
      },
      player_level: 'Intermediate',
      player_style: {
        playing_style: 'Aggressive',
        risk_tolerance: 'High',
        time_management: 'Good'
      },
      primary_strengths: ['Analysis in progress...'],
      improvement_areas: ['Analysis in progress...'],
      playing_style: 'Aggressive',
      phase_accuracies: {
        opening: 0,
        middlegame: 0,
        endgame: 0
      },
      recommendations: {
        general: 'Complete game analysis to get detailed insights'
      }
    }
  }
}