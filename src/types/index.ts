// Centralized type definitions for the Chess Analytics application
// This file ensures type consistency across the entire application

// Database table types (matching Supabase schema)
export interface Game {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  result: 'win' | 'loss' | 'draw'
  color: 'white' | 'black'
  provider_game_id: string
  opening?: string
  opening_family?: string
  accuracy?: number
  opponent_rating?: number
  my_rating?: number
  time_control?: string
  played_at: string
  created_at: string
  total_moves?: number
}

export interface GameAnalysis {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  game_id: string
  total_moves: number
  accuracy: number
  blunders: number
  mistakes: number
  inaccuracies: number
  brilliant_moves: number
  opening_accuracy: number
  middle_game_accuracy: number
  endgame_accuracy: number
  average_evaluation?: number
  time_management_score: number
  tactical_score: number
  positional_score: number
  aggressive_score: number
  patient_score: number
  novelty_score: number
  staleness_score: number
  tactical_patterns: any[]
  positional_patterns: any[]
  moves_analysis: any[]
  analysis_date: string
  analysis_method: string
  created_at: string
  updated_at: string
}

export interface MoveAnalysis {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  game_id: string
  game_analysis_id: string
  average_centipawn_loss: number
  worst_blunder_centipawn_loss: number
  best_move_percentage: number
  middle_game_accuracy: number
  endgame_accuracy: number
  time_management_score: number
  material_sacrifices: number
  aggressiveness_index: number
  average_evaluation?: number
  tactical_score: number
  positional_score: number
  aggressive_score: number
  patient_score: number
  novelty_score: number
  staleness_score: number
  tactical_patterns: any[]
  positional_patterns: any[]
  strategic_themes: any[]
  moves_analysis: any[]
  analysis_method: string
  stockfish_depth: number
  analysis_date: string
  processing_time_ms?: number
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  username?: string
  rating?: number
  total_games: number
  created_at: string
  updated_at: string
}

// API response types
export interface GameAnalysisSummary {
  game_id: string
  accuracy: number
  blunders: number
  mistakes: number
  inaccuracies: number
  brilliant_moves: number
  opening_accuracy: number
  middle_game_accuracy: number
  endgame_accuracy: number
}

export interface AnalysisStats {
  total_games_analyzed: number
  average_accuracy: number
  total_blunders: number
  total_mistakes: number
  total_inaccuracies: number
  total_brilliant_moves: number
  total_material_sacrifices: number
  average_opening_accuracy: number
  average_middle_game_accuracy: number
  average_endgame_accuracy: number
  average_aggressiveness_index: number
  blunders_per_game: number
  mistakes_per_game: number
  inaccuracies_per_game: number
  brilliant_moves_per_game: number
  material_sacrifices_per_game: number
  average_time_management_score: number
  average_tactical_score: number
  average_positional_score: number
  average_aggressive_score: number
  average_patient_score: number
  average_novelty_score: number
  average_staleness_score: number
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
  recommendations: string[]
  analysisMetadata: {
    hasMoveAnalyses: boolean
    hasTacticalScore: boolean
    hasPositionalScore: boolean
    hasAggressiveScore: boolean
    analysisDate: string
    totalGamesAnalyzed: number
  }
}

// Component prop types
export interface SimpleAnalyticsProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  refreshKey?: number
}

export interface PlayerSearchProps {
  onPlayerSelect: (userId: string, platform: 'lichess' | 'chess.com') => void
}

export interface MatchHistoryProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  refreshKey?: number
}

export interface AnalyticsBarProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  refreshKey?: number
}

export interface DeepAnalysisBlockProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  refreshKey?: number
}

export interface DataGeneratorProps {
  onDataGenerated?: () => void
}

// Utility types
export interface TimeControlInfo {
  time: number
  increment: number
  category: 'bullet' | 'blitz' | 'rapid' | 'classical'
}

export interface ImportProgress {
  current: number
  total: number
  percentage: number
  currentGame?: string
  errors: string[]
}

export interface ImportResult {
  success: boolean
  imported: number
  errors: string[]
  message: string
  errorCount?: number
}

// API request types
export interface AnalysisRequest {
  user_id: string
  platform: 'lichess' | 'chess.com'
  analysis_type: 'basic' | 'stockfish' | 'deep'
  limit?: number
  depth?: number
  skill_level?: number
}

export interface GameAnalysisRequest {
  user_id: string
  platform: 'lichess' | 'chess.com'
  game_id: string
  pgn: string
  analysis_type: 'basic' | 'stockfish' | 'deep'
  depth?: number
  skill_level?: number
}

export interface PositionAnalysisRequest {
  fen: string
  depth?: number
  skill_level?: number
}

export interface MoveAnalysisRequest {
  fen: string
  move: string
  depth?: number
  skill_level?: number
}

// API response types
export interface AnalysisResponse {
  success: boolean
  message: string
  analysis_id?: string
}

export interface PositionAnalysisResult {
  fen: string
  evaluation: number
  best_moves: string[]
  depth: number
  analysis_time_ms: number
}

export interface MoveAnalysisResult {
  fen: string
  move: string
  evaluation: number
  centipawn_loss: number
  is_best: boolean
  is_blunder: boolean
  is_mistake: boolean
  is_inaccuracy: boolean
  depth: number
  analysis_time_ms: number
}

// Error types
export interface ApiError {
  code: string
  message: string
  timestamp: string
  request_id?: string
  traceback?: string
}

// Environment types
export interface EnvironmentConfig {
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
  VITE_ANALYSIS_API_URL: string
}

// Platform types
export type Platform = 'lichess' | 'chess.com'
export type AnalysisType = 'basic' | 'stockfish' | 'deep'
export type GameResult = 'win' | 'loss' | 'draw'
export type Color = 'white' | 'black'
export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type PlayerStyle = 'positional' | 'tactical' | 'aggressive' | 'balanced'
