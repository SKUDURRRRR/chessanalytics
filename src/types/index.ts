// Centralized type definitions for the Chess Analytics application
// This file ensures type consistency across the entire application

// Platform switcher view mode for analytics page
export type ViewMode = 'single' | 'combined'

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

export interface TacticalPattern {
  type: string
  length?: number
  moves: string[]
  average_centipawn_loss?: number
  count?: number
}

export interface PositionalPattern {
  type: string
  count: number
  moves: string[]
}

export interface StrategicTheme {
  type: string
  description: string
  strength: string
}

export interface MoveAnalysisEntry {
  move: string
  move_san: string
  move_notation: string
  best_move: string
  best_move_san: string
  best_move_pv: string[]
  engine_move: string
  fen_before: string
  fen_after: string
  evaluation: Record<string, unknown>
  evaluation_before: number | null
  evaluation_after: number | null
  is_best: boolean
  is_brilliant: boolean
  is_great: boolean
  is_excellent: boolean
  is_blunder: boolean
  is_mistake: boolean
  is_inaccuracy: boolean
  is_good: boolean
  is_acceptable: boolean
  centipawn_loss: number
  depth_analyzed: number
  is_user_move: boolean
  player_color: string
  ply_index: number
  ply: number
  opening_ply: number
  explanation: string
  heuristic_details: Record<string, unknown>
  coaching_comment: string
  what_went_right: string
  what_went_wrong: string
  how_to_improve: string
  tactical_insights: string[]
  positional_insights: string[]
  risks: string[]
  benefits: string[]
  learning_points: string[]
  encouragement_level: number
  move_quality: string
  game_phase: string
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
  tactical_patterns: TacticalPattern[]
  positional_patterns: PositionalPattern[]
  moves_analysis: MoveAnalysisEntry[]
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
  tactical_patterns: TacticalPattern[]
  positional_patterns: PositionalPattern[]
  strategic_themes: StrategicTheme[]
  moves_analysis: MoveAnalysisEntry[]
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
  moves_analysis: MoveAnalysisEntry[]
  tactical_patterns: TacticalPattern[]
  positional_patterns: PositionalPattern[]
  strategic_themes: StrategicTheme[]
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

/**
 * Comprehensive Analytics from backend deep analysis.
 *
 * NAMING: Contains both camelCase (frontend convention) and optional snake_case
 * fields (direct from database/backend). The snake_case variants exist for backward
 * compatibility with older API responses. New code should use camelCase fields only.
 * Migration: When backend normalizes to camelCase responses, remove snake_case variants.
 */
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
  viewMode?: ViewMode
  secondaryUserId?: string
  secondaryPlatform?: 'lichess' | 'chess.com'
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
  quick_stats?: QuickStats
}

export interface QuickStats {
  current_streak: number
  lessons_completed: number
  puzzles_solved: number
  puzzle_solve_rate: number
  active_study_plan: boolean
  openings_tracked: number
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

// ============================================================================
// PUZZLE BANK TYPES (Multi-move puzzles from Lichess)
// ============================================================================

/** A puzzle from the standard puzzle bank (Lichess) */
export interface BankPuzzle {
  puzzle_id: string
  fen: string
  setup_move: string
  rating: number
  themes: string[]
  total_moves: number
  user_rating: number
  user_xp: number
  user_level: number
  recommendation_reason?: string
}

/** Result of checking a single move in a multi-move puzzle */
export interface PuzzleMoveResult {
  is_correct: boolean
  opponent_move?: string
  correct_move?: string
  is_complete: boolean
}

/** Result of completing a puzzle (rating/XP changes) */
export interface PuzzleCompletionResult {
  rating_change: number
  new_rating: number
  xp_earned: number
  new_xp_total: number
  level: number
  level_up: boolean
  daily_challenge_progress?: string
  streak: number
}

/** Daily challenge data */
export interface DailyChallenge {
  challenge_date: string
  puzzles: BankPuzzle[]
  completed_ids: string[]
  total_xp: number
}

/** User puzzle statistics */
export interface PuzzleStats {
  rating: number
  highest_rating: number
  rd: number
  puzzles_attempted: number
  puzzles_correct: number
  solve_rate: number
  xp: number
  level: number
  xp_to_next_level: number
  rating_history: Array<{ date: string; rating: number }>
  current_streak: number
  best_streak: number
  daily_challenges_completed: number
  theme_performance: Record<string, { attempted: number; correct: number }>
}

/** Weakness-based puzzle recommendation profile */
export interface RecommendationProfile {
  has_game_data: boolean
  games_analyzed: number
  weaknesses: Array<{
    category: string
    title: string
    score: number
    severity: 'critical' | 'important'
    recommended_themes: string[]
    reason: string
  }>
  theme_solve_rates: Record<string, { attempted: number; correct: number; rate: number }>
  top_recommended_theme: string | null
  top_recommendation_reason: string | null
}

// ============================================================================
// COACH CHAT TYPES
// ============================================================================

/** Context about the current chess position for coach chat */
export interface ChatPositionContext {
  fen: string
  /** FEN of the position BEFORE lastUserMove was played. Used by the backend to anchor
   *  hypothetical-line discussions (e.g. "why was c3 best?") to the correct starting state. */
  fenBefore?: string
  moveHistory: string[]
  playerColor?: 'white' | 'black'
  moveNumber?: number
  lastMove?: string
  lastUserMove?: string
  lastOpponentMove?: string
  gamePhase?: 'opening' | 'middlegame' | 'endgame'
  contextType: 'play' | 'puzzle' | 'analysis' | 'game-review'
  puzzleTheme?: string
  puzzleCategory?: string
  moveClassification?: string
  evaluation?: string
  // Game review context fields
  bestMoveSan?: string
  centipawnLoss?: number
  coachingComment?: string
  tacticalInsights?: string[]
  positionalInsights?: string[]
  learningPoints?: string[]
  keyMomentIndex?: number
  totalKeyMoments?: number
  gameResult?: string
  opponentName?: string
  // User attempt fields (game review: user tries a move before reveal)
  userAttemptMove?: string
  isPreReveal?: boolean
}

/** Summary of a game available for review */
export interface GameReviewSummary {
  gameId: string
  platform: 'lichess' | 'chess.com'
  playedAt: string
  result: 'win' | 'loss' | 'draw'
  playerColor: 'white' | 'black'
  opponent: string
  opening: string
  timeControl: string
  accuracy: number
  blunders: number
  mistakes: number
  inaccuracies: number
  keyMomentsCount: number
}

/** A single chat message */
export interface ChatMessage {
  id: string
  role: 'user' | 'coach'
  content: string
  timestamp: number
  positionContext?: ChatPositionContext
}

/** Response from the coach chat API */
export interface CoachChatResponse {
  response: string
  tokens_used?: number
  model_used?: string
}

// ============================================================================
// COACH PHASE 2 TYPES
// ============================================================================

/** Progress tracking time-series data */
export interface ProgressData {
  time_series: {
    rating_trend: Array<{ week: string; avg_rating: number; games: number }>
    accuracy_by_phase: Array<{
      week: string
      opening: number
      middlegame: number
      endgame: number
    }>
    blunder_rate_trend: Array<{ week: string; blunders_per_game: number }>
    personality_trends: Array<{
      week: string
      tactical: number
      positional: number
      aggressive: number
      patient: number
      novelty: number
      staleness: number
    }>
  }
  streaks: {
    current_streak: number
    best_streak: number
    days_active: number
    lessons_completed: number
    puzzles_solved: number
    puzzle_solve_rate: number
  }
  weakness_evolution: Array<{
    week: string
    scores: Record<string, number>
  }>
  advanced_metrics?: AdvancedProgressMetrics
  diagnostic?: DiagnosticSummary
}

export interface DiagnosticSummary {
  summary: string
  generated_by: 'ai' | 'template'
  key_insight: string
}

/** Advanced progress metrics computed from per-move analysis */
export interface AdvancedProgressMetrics {
  advantage_conversion?: AdvantageConversionData
  comeback_throw?: ComebackThrowData
  win_loss_by_phase?: WinLossByPhaseData
  opening_repertoire?: OpeningRepertoireData
  time_trouble?: TimeTroubleData
  critical_moments?: CriticalMomentData
  endgame_types?: EndgameTypeData
  missed_tactics?: MissedTacticData
  peer_comparison?: PeerComparisonData
}

export interface AdvantageConversionData {
  overall_rate: number
  total_opportunities: number
  total_converted: number
  weekly_trend: Array<{
    week: string
    rate: number
    opportunities: number
    converted: number
  }>
}

export interface ComebackThrowData {
  comeback_rate: number
  throw_rate: number
  total_comebacks: number
  total_throws: number
  weekly_trend: Array<{
    week: string
    comebacks: number
    throws: number
    total_decided: number
  }>
}

export interface WinLossByPhaseData {
  summary: {
    opening_advantage_wins: number
    middlegame_decided: number
    endgame_decided: number
  }
  weekly_trend: Array<{
    week: string
    avg_opening_eval: number | null
    avg_middlegame_eval: number | null
    avg_endgame_eval: number | null
  }>
}

export interface OpeningRepertoireData {
  openings: Array<{
    opening_family: string
    color: 'white' | 'black'
    games: number
    win_rate: number
    draw_rate: number
    avg_accuracy: number
    performance_score: number
  }>
  best_opening: { name: string; color: string; win_rate: number } | null
  worst_opening: { name: string; color: string; win_rate: number } | null
}

export interface TimeTroubleData {
  avg_accuracy_degradation: number
  by_time_control: Array<{
    category: string
    win_rate: number
    games: number
  }>
  weekly_trend: Array<{ week: string; degradation: number }>
}

export interface CriticalMomentData {
  avg_cpl_critical: number
  avg_cpl_normal: number
  critical_performance_ratio: number
  total_critical_moments: number
  weekly_trend: Array<{
    week: string
    avg_cpl_critical: number
    critical_count: number
  }>
}

export interface EndgameTypeData {
  types: Array<{
    type: string
    games: number
    avg_cpl: number
    accuracy_estimate: number
  }>
  best_type: string | null
  worst_type: string | null
}

export interface MissedTacticData {
  total_missed: number
  per_game_rate: number
  most_common_missed: string | null
  weekly_trend: Array<{
    week: string
    missed_per_game: number
  }>
}

export interface PeerComparisonData {
  peer_rating_range: { min: number; max: number }
  peer_count: number
  comparisons: Array<{
    metric: string
    label: string
    your_value: number
    peer_avg: number
    percentile: number
    assessment: 'above_average' | 'average' | 'below_average'
  }>
}

/** Weekly study plan */
export interface StudyPlan {
  id: string
  user_id: string
  platform: 'lichess' | 'chess.com'
  week_start: string
  week_number: number
  goals: StudyPlanGoal[]
  daily_activities: Record<string, DailyActivity[]>
  status: 'active' | 'completed' | 'skipped'
  weakness_snapshot?: Record<string, number>
  weekly_summary?: WeeklySummary
  days_completed?: number
  created_at?: string
  updated_at?: string
}

/** Goal as stored in study plan JSONB (different from UserGoal DB record) */
export interface StudyPlanGoal {
  type: string
  description: string
  target: number
  theme?: string
  opening?: string
  color?: string
  category?: string
}

/** Single daily activity within a study plan */
export interface DailyActivity {
  type: 'puzzle' | 'lesson' | 'review' | 'play' | 'opening'
  label: string
  description?: string
  route?: string
  target_id?: string
  goal_type?: string
  time_estimate?: number
  completed: boolean
  completed_at?: string
  day_name?: string
}

/** User improvement goal (database record from user_goals table) */
export interface UserGoal {
  id: string
  goal_type: string
  goal_description: string
  target_value: number
  current_value: number
  deadline?: string
  status: 'pending' | 'in_progress' | 'completed' | 'abandoned'
}

/** Weekly summary comparing current vs previous plan */
export interface WeeklySummary {
  improved_areas: Array<{ area: string; change: number }>
  declined_areas: Array<{ area: string; change: number }>
  activities_completed: number
  activities_total: number
  completion_rate: number
  plan_streak: number
  focus_next_week: string
}

/** Tag on a game */
export interface GameTag {
  id: string
  game_id: string
  platform: 'lichess' | 'chess.com'
  tag: string
  tag_type: 'user' | 'system'
  created_at?: string
}

/** Saved chess position */
export interface SavedPosition {
  id: string
  fen: string
  title?: string
  notes?: string
  source_game_id?: string
  source_move_number?: number
  platform: 'lichess' | 'chess.com'
  tags: string[]
  created_at?: string
  updated_at?: string
}

/** Opening repertoire entry */
export interface OpeningRepertoire {
  id: string
  opening_family: string
  color: 'white' | 'black'
  platform?: Platform
  games_played: number
  win_rate: number
  avg_accuracy: number
  deviation_moves: DeviationMove[]
  confidence_level: number
  last_practiced?: string
  spaced_repetition_due?: string
}

/** A point where user deviates from main opening line */
export interface DeviationMove {
  move_number: number
  expected_move: string
  actual_move: string
  frequency: number
  result_after?: string
}

/** Full opening detail with deviations and drill positions */
export interface OpeningDetail {
  repertoire: OpeningRepertoire
  deviations: DeviationMove[]
  drill_positions: PracticePosition[]
}
