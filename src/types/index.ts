// Centralized type definitions for the Chess Analytics application
// This file ensures type consistency across the entire application

// Database table types (matching Supabase schema)
export const PERSONALITY_TRAITS = ['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness'] as const;
export type PersonalityTrait = typeof PERSONALITY_TRAITS[number];

export interface PersonalityScores {
  tactical: number;
  positional: number;
  aggressive: number;
  patient: number;
  novelty: number;
  staleness: number;
}

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
  opponent_name?: string
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
  user_id: string
  platform: 'lichess' | 'chess.com'
  analysis_type: string
  accuracy: number
  opponent_accuracy: number
  blunders: number
  mistakes: number
  inaccuracies: number
  brilliant_moves: number
  best_moves: number
  good_moves: number
  acceptable_moves: number
  opening_accuracy: number
  middle_game_accuracy: number
  endgame_accuracy: number
  best_move_percentage: number
  average_centipawn_loss: number
  opponent_average_centipawn_loss: number
  worst_blunder_centipawn_loss: number
  opponent_worst_blunder_centipawn_loss: number
  time_management_score: number
  opponent_time_management_score: number
  material_sacrifices: number
  aggressiveness_index: number
  tactical_score: number
  positional_score: number
  aggressive_score: number
  patient_score: number
  novelty_score: number
  staleness_score: number
  average_evaluation: number
  moves_analysis: any[]
  tactical_patterns: any[]
  positional_patterns: any[]
  strategic_themes: any[]
  analysis_date: string
  processing_time_ms: number
  stockfish_depth: number
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
  current_rating?: number // Highest ELO rating achieved
  most_played_time_control?: string // Time control where highest ELO was achieved
  validation_issues?: string[] // ELO data validation issues
  // ELO Optimization fields
  elo_optimization_active?: boolean // Whether ELO optimization is active
  total_games_with_elo?: number // Total games with ELO data processed
}

export interface DeepAnalysisData {
  total_games: number;
  average_accuracy: number;
  current_rating: number;
  personality_scores: PersonalityScores;
  player_level: PlayerLevel;
  player_style: {
    category: PlayerStyle;
    description: string;
    confidence: number;
  };
  primary_strengths: string[];
  improvement_areas: string[];
  playing_style: string;
  phase_accuracies: {
    opening: number;
    middle: number;
    endgame: number;
  };
  recommendations: {
    primary: string;
    secondary: string;
    leverage: string;
  };
  personality_insights?: {
    [key in keyof PersonalityScores]?: string;
  };
  ai_style_analysis?: {
    style_summary: string;
    characteristics: string;
    strengths: string;
    playing_patterns: string;
    improvement_focus: string;
  };
  famous_players?: {
    primary: {
      name: string;
      description: string;
      era: string;
      strengths: string[];
      similarity?: string;
    };
    secondary: {
      name: string;
      description: string;
      era: string;
      strengths: string[];
      similarity?: string;
    };
  };
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

export interface OpeningIdentifierSets {
  openingFamilies: string[]
  openings: string[]
}

export interface SerializableOpeningFilter {
  openingFamilies?: string[]
  openings?: string[]
}

export interface OpeningFilter {
  normalized: string
  identifiers: OpeningIdentifierSets
}

export interface MatchHistoryGameSummary {
  id: string
  provider_game_id?: string | null
  played_at: string
  result: 'win' | 'loss' | 'draw'
  color: 'white' | 'black'
  opponent: string
  time_control: string
  opening_family?: string | null
  opening?: string | null
  moves?: number | null
  rating?: number | null
  opponent_rating?: number | null
}

export interface MatchHistoryProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  refreshKey?: number
  openingFilter?: OpeningFilter | null
  opponentFilter?: string | null
  onClearFilter?: () => void
  onGameSelect?: (game: MatchHistoryGameSummary) => void
  onAnalyzedGamesChange?: (analyzedGameIds: Set<string>) => void
}

export interface AnalyticsBarProps {
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
  analysis_type: 'stockfish' | 'deep'
  limit?: number
  depth?: number
  skill_level?: number
}

export interface GameAnalysisRequest {
  user_id: string
  platform: 'lichess' | 'chess.com'
  game_id: string
  pgn: string
  analysis_type: 'stockfish' | 'deep'
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
export type AnalysisType = 'stockfish' | 'deep'
export type GameResult = 'win' | 'loss' | 'draw'
export type Color = 'white' | 'black'
export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type PlayerStyle = 'positional' | 'tactical' | 'aggressive' | 'balanced'

// Enhanced Opening Analysis Types
export interface OpeningMistake {
  move: number
  moveNotation: string
  mistake: string
  correctMove: string
  explanation: string
  severity: 'critical' | 'major' | 'minor'
  centipawnLoss: number
  classification: 'blunder' | 'mistake' | 'inaccuracy'
}

export interface StudyRecommendation {
  type: 'video' | 'article' | 'practice' | 'game' | 'course'
  title: string
  description: string
  url?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  priority: 'high' | 'medium' | 'low'
}

export interface PeerComparison {
  averageAccuracy: number
  percentile: number
  trend: 'improving' | 'stable' | 'declining'
  gamesPlayed: number
  ratingRange: string
}

export interface RepertoireAnalysis {
  diversity: number
  colorPerformance: { white: number; black: number }
  familyStrengths: string[]
  familyWeaknesses: string[]
  mostPlayed: string
  leastPlayed: string
  recommendation: string
}

export interface EnhancedOpeningAnalysis {
  // Basic info
  openingName: string
  openingFamily: string
  accuracy: number
  theoryKnowledge: number
  gamesPlayed: number
  
  // Detailed insights
  specificMistakes: OpeningMistake[]
  commonPatterns: string[]
  strengths: string[]
  weaknesses: string[]
  
  // Learning resources
  studyRecommendations: StudyRecommendation[]
  practicePositions: Array<{
    position: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
  }>
  
  // Comparative analysis
  peerComparison: PeerComparison
  
  // Repertoire insights
  repertoireAnalysis: RepertoireAnalysis
  
  // Improvement tracking
  improvementTrend: Array<{
    date: string
    accuracy: number
    games: number
  }>
  
  // Next steps
  nextGoals: string[]
  focusAreas: string[]
}

