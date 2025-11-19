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
  // Status flags to detect mock/placeholder data
  is_mock_data?: boolean
  analysis_status?: 'complete' | 'no_analyses' | 'partial'
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

// Comprehensive Analytics Types - supports both camelCase and snake_case for backwards compatibility
export interface ComprehensiveAnalytics {
  totalGames: number
  total_games?: number  // Backwards compatibility
  winRate: number
  win_rate?: number  // Backwards compatibility
  drawRate: number
  draw_rate?: number  // Backwards compatibility
  lossRate: number
  loss_rate?: number  // Backwards compatibility
  colorStats: {
    white: { games: number; winRate: number; averageElo: number }
    black: { games: number; winRate: number; averageElo: number }
  }
  openingStats: Array<{
    opening: string
    games: number
    winRate: number
    averageElo: number
    identifiers?: { openingFamilies: string[]; openings: string[] }
  }>
  openingColorStats: {
    white: Array<{
      opening: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      averageElo: number
      identifiers?: { openingFamilies: string[]; openings: string[] }
    }>
    black: Array<{
      opening: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      averageElo: number
      identifiers?: { openingFamilies: string[]; openings: string[] }
    }>
  }
  highestElo: number | null
  highest_elo?: number | null  // Backwards compatibility
  timeControlWithHighestElo: string | null
  time_control_with_highest_elo?: string | null  // Backwards compatibility
  currentElo: number | null
  currentEloPerTimeControl: Record<string, number>
  current_elo_per_time_control?: Record<string, number>  // Backwards compatibility
  performanceTrends: any | null
  // New fields - support both naming conventions
  resignationTiming: {
    my_average_resignation_move: number | null
    recent_average_resignation_move: number | null
    change: number | null
    insight: string | null
  } | null
  resignation_timing?: any  // Backwards compatibility
  personalRecords: {
    fastest_win: { game_id: string; moves: number } | null
    highest_accuracy_win: { game_id: string; accuracy: number } | null
    longest_game: { game_id: string; moves: number } | null
  } | null
  personal_records?: any  // Backwards compatibility
  marathonPerformance: {
    count: number
    average_accuracy: number | null
    average_blunders: number | null
    analyzed_count: number | null
  } | null
  marathon_performance?: any  // Backwards compatibility
  recentTrend: {
    recent_average_moves: number
    baseline_average_moves: number
    difference: number
  } | null
  recent_trend?: any  // Backwards compatibility
  gameLengthStats: any | null
  game_length_distribution?: any  // Backwards compatibility
  quickVictoryBreakdown: any | null
  quick_victory_breakdown?: any  // Backwards compatibility
  patienceRating: number | null
  patience_rating?: number | null  // Backwards compatibility
  comebackPotential: any | null
  comeback_potential?: any  // Backwards compatibility
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
    primary?: {
      name: string;
      description: string;
      era: string;
      strengths: string[];
      similarity?: string;
      similarity_score?: number;
      match_confidence?: number;
      trait_similarities?: {
        tactical: number;
        positional: number;
        aggressive: number;
        patient: number;
        novelty: number;
        staleness: number;
      };
      insights?: string[];
    };
    secondary?: {
      name: string;
      description: string;
      era: string;
      strengths: string[];
      similarity?: string;
      similarity_score?: number;
      match_confidence?: number;
      trait_similarities?: {
        tactical: number;
        positional: number;
        aggressive: number;
        patient: number;
        novelty: number;
        staleness: number;
      };
      insights?: string[];
    };
    tertiary?: {
      name: string;
      description: string;
      era: string;
      strengths: string[];
      similarity?: string;
      similarity_score?: number;
      match_confidence?: number;
      trait_similarities?: {
        tactical: number;
        positional: number;
        aggressive: number;
        patient: number;
        novelty: number;
        staleness: number;
      };
      insights?: string[];
    };
  };
  enhanced_opening_analysis?: EnhancedOpeningAnalysis;
  // Status flags to detect fallback/placeholder data
  is_fallback_data?: boolean;
  analysis_status?: 'complete' | 'no_analyses' | 'insufficient_data';
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
  color?: 'white' | 'black' // Optional: filter by player color
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
  move_notation?: string // snake_case from API
  mistake: string
  correctMove: string
  correct_move?: string // snake_case from API
  explanation: string
  severity: 'critical' | 'major' | 'minor'
  centipawnLoss: number
  centipawn_loss?: number // snake_case from API
  classification: 'blunder' | 'mistake' | 'inaccuracy'
  fen?: string
  game_id?: string // For linking to specific games
  gameId?: string // camelCase version
}

export interface StyleRecommendation {
  openingName: string
  opening_name?: string // snake_case from API
  compatibilityScore: number
  compatibility_score?: number // snake_case from API
  reasoning: string
  suggestedLines: string[]
  suggested_lines?: string[] // snake_case from API
  priority: 'high' | 'medium' | 'low'
}

export interface TrendPoint {
  date: string
  openingWinRate: number
  opening_win_rate?: number // snake_case from API
  games: number
  accuracy?: number
}

export interface RepertoireAnalysis {
  diversityScore: number
  diversity_score?: number // snake_case from API
  whiteOpenings: string[]
  white_openings?: string[] // snake_case from API
  blackOpenings: string[]
  black_openings?: string[] // snake_case from API
  mostSuccessful: {
    opening: string
    winRate: number
    win_rate?: number // snake_case from API
    games: number
  }
  most_successful?: any // snake_case from API
  needsWork: {
    opening: string
    winRate: number
    win_rate?: number // snake_case from API
    games: number
  }
  needs_work?: any // snake_case from API
  styleMatchScore: number
  style_match_score?: number // snake_case from API
}

export interface EnhancedOpeningAnalysis {
  openingWinRate: number
  opening_win_rate?: number // snake_case from API
  specificMistakes: OpeningMistake[]
  specific_mistakes?: OpeningMistake[] // snake_case from API
  styleRecommendations: StyleRecommendation[]
  style_recommendations?: StyleRecommendation[] // snake_case from API
  actionableInsights: string[]
  actionable_insights?: string[] // snake_case from API
  improvementTrend: TrendPoint[]
  improvement_trend?: TrendPoint[] // snake_case from API
  repertoireAnalysis: RepertoireAnalysis
  repertoire_analysis?: RepertoireAnalysis // snake_case from API
}

// Legacy types for backward compatibility
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

// ============================================================================
// COACH TAB TYPES
// ============================================================================

// Coach Dashboard Types
export interface DashboardData {
  daily_lesson: Lesson | null
  top_weaknesses: Weakness[]
  top_strengths: Strength[]
  recent_activity: Activity[]
}

export interface Weakness {
  category: string
  title: string
  description: string
  score: number
  severity: 'critical' | 'important'
  recommendation: string
}

export interface Strength {
  category: string
  title: string
  description: string
  score: number
  icon: string
}

export interface Activity {
  type: 'lesson_completed' | 'puzzle_attempted' | 'puzzle_solved'
  title: string
  completed_at?: string
  attempted_at?: string
  was_correct?: boolean
}

// Lesson Types
export interface Lesson {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  lesson_type: 'opening' | 'tactical' | 'positional' | 'time_management' | 'style'
  lesson_title: string
  lesson_description?: string
  lesson_content: LessonContent
  priority: 'critical' | 'important' | 'enhancement'
  estimated_time_minutes: number
  generated_from_games?: string[]
  status?: 'not_started' | 'in_progress' | 'completed'
  completion_percentage?: number
  created_at?: string
  updated_at?: string
}

export interface LessonContent {
  theory?: string
  common_mistakes?: GameExample[]
  practice_positions?: PracticePosition[]
  action_items?: string[]
}

export interface GameExample {
  game_id?: string
  blunders?: number
  mistakes?: number
  accuracy?: number
  tactical_score?: number
}

export interface PracticePosition {
  fen: string
  description: string
  correct_move?: string
}

export interface LessonDetail extends Lesson {
  theory_content: string
  your_games_examples: GameExample[]
  practice_positions: PracticePosition[]
  action_items: string[]
}

// Puzzle Types
export interface Puzzle {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  fen_position: string
  correct_move: string
  solution_line: string[]
  puzzle_category: 'tactical' | 'positional' | 'opening' | 'endgame' | 'time_management'
  tactical_theme?: string
  difficulty_rating: number
  source_game_id?: string
  source_move_number?: number
  explanation: string
  created_at?: string
}

export interface PuzzleAttempt {
  puzzle_id: string
  was_correct: boolean
  time_to_solve_seconds?: number
  moves_made: string[]
}

export interface PuzzleSet {
  puzzles: Puzzle[]
  categorized: {
    tactical: Puzzle[]
    positional: Puzzle[]
    opening: Puzzle[]
    endgame: Puzzle[]
  }
  total: number
}
