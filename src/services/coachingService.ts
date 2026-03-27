/**
 * Coaching Service - Service for Coach tab features
 * Handles API communication for lessons, puzzles, and progress tracking
 */

import {
  DashboardData,
  Puzzle,
  PuzzleSet,
  PuzzleAttempt,
  Platform,
  ChatPositionContext,
  CoachChatResponse,
  ProgressData,
  GameTag,
  SavedPosition,
  OpeningRepertoire,
  OpeningDetail,
  StudyPlan,
  UserGoal,
  BankPuzzle,
  PuzzleMoveResult,
  PuzzleCompletionResult,
  DailyChallenge,
  PuzzleStats,
  RecommendationProfile,
} from '../types'
import { config } from '../lib/config'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'
import { logger } from '../utils/logger'
import { withCache, generateCacheKey } from '../utils/apiCache'
import { supabase } from '../lib/supabase'

const API_URL = config.getApi().baseUrl
const COACH_CACHE_TTL = 3 * 60 * 1000 // 3 minutes for coach data

interface CoachFetchOptions {
  method?: string
  body?: unknown
  /** @deprecated Ignored - auth is now sent via JWT Authorization header automatically. */
  authUserId?: string
  params?: Record<string, string>
  timeout?: number
}

export class CoachingService {
  /**
   * Shared fetch helper for coach API endpoints.
   * Handles: URL building, JWT auth header, fetchWithTimeout, 403 check, JSON parse.
   * Auth is sent via Authorization: Bearer header (JWT from Supabase session).
   */
  private static async coachFetch<T>(endpoint: string, options?: CoachFetchOptions): Promise<T> {
    const url = new URL(`${API_URL}${endpoint}`)
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.append(key, value)
      }
    }

    // Build headers with JWT auth from Supabase session
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    } catch {
      // Continue without auth header - backend will handle accordingly
    }

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: options?.method || 'GET',
        headers,
        ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      },
      options?.timeout || TIMEOUT_CONFIG.DEFAULT
    )

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Coach features require premium subscription')
      }
      const errorBody = await response.json().catch(() => null)
      const detail = errorBody?.detail || response.statusText
      throw new Error(`HTTP error! status: ${response.status} — ${detail}`)
    }

    return await response.json() as T
  }

  /**
   * Get Coach dashboard data (daily lesson, weaknesses, strengths)
   */
  static async getDashboard(userId: string, platform: Platform, authUserId?: string): Promise<DashboardData> {
    const cacheKey = generateCacheKey('coach_dashboard', userId, platform)
    return withCache(cacheKey, async () => {
      try {
        return await this.coachFetch<DashboardData>(
          `/api/v1/coach/dashboard/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
          { authUserId }
        )
      } catch (error) {
        logger.error('Error fetching coach dashboard:', error)
        throw error
      }
    }, COACH_CACHE_TTL)
  }

  /**
   * Get personalized puzzles for user
   */
  static async getPuzzles(
    userId: string,
    platform: Platform,
    category?: string,
    authUserId?: string
  ): Promise<PuzzleSet> {
    const cacheKey = generateCacheKey('coach_puzzles', userId, platform, { category })
    return withCache(cacheKey, async () => {
      try {
        const params: Record<string, string> = {}
        if (category) params.category = category
        return await this.coachFetch<PuzzleSet>(
          `/api/v1/coach/puzzles/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
          { authUserId, params }
        )
      } catch (error) {
        logger.error('Error fetching puzzles:', error)
        throw error
      }
    }, COACH_CACHE_TTL)
  }

  /**
   * Get daily puzzle for user
   */
  static async getDailyPuzzle(userId: string, platform: Platform, authUserId?: string): Promise<Puzzle> {
    try {
      return await this.coachFetch<Puzzle>(
        `/api/v1/coach/puzzles/daily/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
        { authUserId }
      )
    } catch (error) {
      logger.error('Error fetching daily puzzle:', error)
      throw error
    }
  }

  /**
   * Record a puzzle solving attempt
   */
  static async recordPuzzleAttempt(
    puzzleId: string,
    wasCorrect: boolean,
    timeTaken?: number,
    movesMade: string[] = []
  ): Promise<void> {
    try {
      await this.coachFetch<unknown>(
        `/api/v1/coach/puzzles/${encodeURIComponent(puzzleId)}/attempt`,
        {
          method: 'POST',
          body: { was_correct: wasCorrect, time_to_solve_seconds: timeTaken, moves_made: movesMade },
        }
      )
    } catch (error) {
      logger.error('Error recording puzzle attempt:', error)
      throw error
    }
  }

  /**
   * Get engine move for playing against Tal Coach
   */
  static async getEngineMove(
    fen: string,
    skillLevel: number = 10,
    depth: number = 10,
    authUserId?: string
  ): Promise<{ move: { san: string; uci: string; from: string; to: string }; evaluation: Record<string, unknown>; pv_line: string[] }> {
    try {
      return await this.coachFetch(
        '/api/v1/coach/play-move',
        { method: 'POST', authUserId, body: { fen, skill_level: skillLevel, depth } }
      )
    } catch (error) {
      logger.error('Error getting engine move:', error)
      throw error
    }
  }

  /**
   * Chat with Coach Tal about the current position
   */
  static async chatWithCoach(
    message: string,
    positionContext: ChatPositionContext,
    conversationHistory: Array<{ role: string; content: string }>,
    authUserId: string
  ): Promise<CoachChatResponse> {
    try {
      return await this.coachFetch<CoachChatResponse>('/api/v1/coach/chat', {
        method: 'POST',
        authUserId,
        body: {
          message,
          position_context: {
            fen: positionContext.fen,
            move_history: positionContext.moveHistory,
            player_color: positionContext.playerColor,
            move_number: positionContext.moveNumber,
            last_move: positionContext.lastMove,
            last_user_move: positionContext.lastUserMove,
            last_opponent_move: positionContext.lastOpponentMove,
            game_phase: positionContext.gamePhase,
            context_type: positionContext.contextType,
            puzzle_theme: positionContext.puzzleTheme,
            puzzle_category: positionContext.puzzleCategory,
            move_classification: positionContext.moveClassification,
            evaluation: positionContext.evaluation,
            best_move_san: positionContext.bestMoveSan,
            centipawn_loss: positionContext.centipawnLoss,
            coaching_comment: positionContext.coachingComment,
            tactical_insights: positionContext.tacticalInsights,
            positional_insights: positionContext.positionalInsights,
            learning_points: positionContext.learningPoints,
            key_moment_index: positionContext.keyMomentIndex,
            total_key_moments: positionContext.totalKeyMoments,
            game_result: positionContext.gameResult,
            opponent_name: positionContext.opponentName,
            user_attempt_move: positionContext.userAttemptMove,
            is_pre_reveal: positionContext.isPreReveal,
          },
          conversation_history: conversationHistory,
        },
      })
    } catch (error) {
      logger.error('Error chatting with coach:', error)
      throw error
    }
  }

  /**
   * Get progress tracking data (time series, streaks, weakness evolution)
   */
  static async getProgress(
    userId: string,
    platform: Platform,
    periodDays: number = 90,
    authUserId?: string
  ): Promise<ProgressData> {
    const cacheKey = generateCacheKey('coach_progress', userId, platform, { periodDays })
    return withCache(cacheKey, async () => {
      try {
        return await this.coachFetch<ProgressData>(
          `/api/v1/coach/progress/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
          { authUserId, params: { period_days: String(periodDays) } }
        )
      } catch (error) {
        logger.error('Error getting progress data:', error)
        throw error
      }
    }, COACH_CACHE_TTL)
  }

  // ========================================================================
  // PUZZLE BANK (Multi-move puzzles from Lichess)
  // ========================================================================

  /**
   * Get next puzzle from bank, matched to user rating
   */
  static async getNextBankPuzzle(
    authUserId: string,
    theme?: string,
    mode: string = 'rated'
  ): Promise<BankPuzzle> {
    const params: Record<string, string> = { mode }
    if (theme) params.theme = theme
    return this.coachFetch<BankPuzzle>('/api/v1/coach/puzzle-bank/next', { authUserId, params })
  }

  /**
   * Check a single move in a multi-move puzzle
   */
  static async checkPuzzleMove(
    puzzleId: string,
    moveUci: string,
    moveIndex: number,
    authUserId: string
  ): Promise<PuzzleMoveResult> {
    return this.coachFetch<PuzzleMoveResult>(
      `/api/v1/coach/puzzle-bank/${encodeURIComponent(puzzleId)}/check-move`,
      { method: 'POST', body: { move_uci: moveUci, move_index: moveIndex } }
    )
  }

  /**
   * Complete a puzzle (record result, update rating/XP)
   */
  static async completeBankPuzzle(
    puzzleId: string,
    solved: boolean,
    timeSeconds: number,
    movesMade: string[],
    authUserId: string
  ): Promise<PuzzleCompletionResult> {
    return this.coachFetch<PuzzleCompletionResult>(
      `/api/v1/coach/puzzle-bank/${encodeURIComponent(puzzleId)}/complete`,
      { method: 'POST', body: { solved, time_seconds: timeSeconds, moves_made: movesMade } }
    )
  }

  /**
   * Get today's daily challenge (5 puzzles)
   */
  static async getDailyChallenge(authUserId: string): Promise<DailyChallenge> {
    const cacheKey = generateCacheKey('coach_daily_challenge', authUserId, 'all')
    return withCache(cacheKey, async () => {
      return this.coachFetch<DailyChallenge>('/api/v1/coach/puzzle-bank/daily-challenge', { authUserId })
    }, COACH_CACHE_TTL)
  }

  /**
   * Get puzzle training statistics
   */
  static async getPuzzleStats(authUserId: string): Promise<PuzzleStats> {
    const cacheKey = generateCacheKey('coach_puzzle_stats', authUserId, 'all')
    return withCache(cacheKey, async () => {
      return this.coachFetch<PuzzleStats>('/api/v1/coach/puzzle-bank/stats', { authUserId })
    }, COACH_CACHE_TTL)
  }

  /**
   * Get personalized recommendation profile based on game weaknesses
   */
  static async getRecommendationProfile(authUserId: string): Promise<RecommendationProfile> {
    const cacheKey = generateCacheKey('coach_rec_profile', authUserId, 'all')
    return withCache(cacheKey, async () => {
      return this.coachFetch<RecommendationProfile>('/api/v1/coach/puzzle-bank/recommendation-profile', { authUserId })
    }, COACH_CACHE_TTL)
  }

  // ========================================================================
  // GAME TAGS
  // ========================================================================

  static async addTag(
    gameId: string,
    platform: Platform,
    tag: string,
    authUserId: string,
    tagType: 'user' | 'system' = 'user'
  ): Promise<GameTag> {
    const data = await this.coachFetch<{ tag: GameTag }>('/api/v1/coach/tags', {
      method: 'POST', authUserId, body: { game_id: gameId, platform, tag, tag_type: tagType },
    })
    return data.tag
  }

  static async deleteTag(tagId: string, authUserId: string): Promise<void> {
    await this.coachFetch<unknown>(`/api/v1/coach/tags/${encodeURIComponent(tagId)}`, {
      method: 'DELETE', authUserId,
    })
  }

  static async getUserTags(userId: string, platform: Platform, authUserId: string): Promise<GameTag[]> {
    const cacheKey = generateCacheKey('coach_user_tags', userId, platform)
    return withCache(cacheKey, async () => {
      const data = await this.coachFetch<{ tags: GameTag[] }>(
        `/api/v1/coach/tags/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
        { authUserId }
      )
      return data.tags
    }, COACH_CACHE_TTL)
  }

  static async getGameTags(gameId: string, authUserId: string): Promise<GameTag[]> {
    const data = await this.coachFetch<{ tags: GameTag[] }>(
      `/api/v1/coach/tags/game/${encodeURIComponent(gameId)}`,
      { authUserId }
    )
    return data.tags
  }

  // ========================================================================
  // SAVED POSITIONS
  // ========================================================================

  static async savePosition(
    position: { fen: string; platform: Platform; title?: string; notes?: string; source_game_id?: string; source_move_number?: number; tags?: string[] },
    authUserId: string
  ): Promise<SavedPosition> {
    const data = await this.coachFetch<{ position: SavedPosition }>('/api/v1/coach/positions', {
      method: 'POST', authUserId, body: position,
    })
    return data.position
  }

  static async getSavedPositions(userId: string, platform: Platform, authUserId: string): Promise<SavedPosition[]> {
    const cacheKey = generateCacheKey('coach_positions', userId, platform)
    return withCache(cacheKey, async () => {
      const data = await this.coachFetch<{ positions: SavedPosition[] }>(
        `/api/v1/coach/positions/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
        { authUserId }
      )
      return data.positions
    }, COACH_CACHE_TTL)
  }

  static async updatePosition(
    positionId: string,
    update: { title?: string; notes?: string; tags?: string[] },
    authUserId: string
  ): Promise<SavedPosition> {
    const data = await this.coachFetch<{ position: SavedPosition }>(
      `/api/v1/coach/positions/${encodeURIComponent(positionId)}`,
      { method: 'PUT', authUserId, body: update }
    )
    return data.position
  }

  static async deletePosition(positionId: string, authUserId: string): Promise<void> {
    await this.coachFetch<unknown>(`/api/v1/coach/positions/${encodeURIComponent(positionId)}`, {
      method: 'DELETE', authUserId,
    })
  }

  // ========================================================================
  // OPENING REPERTOIRE
  // ========================================================================

  static async getRepertoire(
    userId: string,
    platform: Platform,
    authUserId: string,
    refresh: boolean = false
  ): Promise<OpeningRepertoire[]> {
    const params: Record<string, string> = {}
    if (refresh) params.refresh = 'true'
    const data = await this.coachFetch<{ repertoire: OpeningRepertoire[] }>(
      `/api/v1/coach/openings/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
      { authUserId, params }
    )
    return data.repertoire
  }

  static async getOpeningDetail(
    userId: string,
    platform: Platform,
    openingFamily: string,
    color: string,
    authUserId: string
  ): Promise<OpeningDetail> {
    return this.coachFetch<OpeningDetail>(
      `/api/v1/coach/openings/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}/${encodeURIComponent(openingFamily)}`,
      { authUserId, params: { color } }
    )
  }

  static async getDrillPositions(
    userId: string,
    platform: Platform,
    openingFamily: string,
    color: string,
    authUserId: string
  ): Promise<Array<{ fen: string; move_number: number; your_move: string; classification: string; description: string }>> {
    const data = await this.coachFetch<{ positions: Array<{ fen: string; move_number: number; your_move: string; classification: string; description: string }> }>(
      '/api/v1/coach/openings/drill',
      { method: 'POST', authUserId, body: { user_id: userId, platform, opening_family: openingFamily, color } }
    )
    return data.positions
  }

  static async completeDrill(
    repertoireId: string,
    confidenceDelta: number,
    authUserId: string
  ): Promise<{ confidence_level: number; next_review: string; days_until_review: number }> {
    return this.coachFetch('/api/v1/coach/openings/drill/complete', {
      method: 'POST', authUserId, body: { repertoire_id: repertoireId, confidence_delta: confidenceDelta },
    })
  }

  // ========================================================================
  // STUDY PLANS
  // ========================================================================

  static async getStudyPlan(userId: string, platform: Platform, authUserId: string): Promise<StudyPlan | null> {
    const data = await this.coachFetch<{ plan: StudyPlan | null }>(
      `/api/v1/coach/study-plan/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
      { authUserId }
    )
    return data.plan
  }

  static async createStudyPlan(userId: string, platform: Platform, authUserId: string): Promise<StudyPlan> {
    const data = await this.coachFetch<{ plan: StudyPlan }>(
      `/api/v1/coach/study-plan/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
      { method: 'POST', authUserId }
    )
    return data.plan
  }

  static async completeActivity(planId: string, day: number, activityIndex: number, authUserId: string): Promise<StudyPlan> {
    const data = await this.coachFetch<{ plan: StudyPlan }>(
      `/api/v1/coach/study-plan/${encodeURIComponent(planId)}/activity`,
      { method: 'POST', authUserId, body: { day, activity_index: activityIndex } }
    )
    return data.plan
  }

  static async getGoals(userId: string, platform: Platform, authUserId: string): Promise<UserGoal[]> {
    const data = await this.coachFetch<{ goals: UserGoal[] }>(
      `/api/v1/coach/goals/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`,
      { authUserId }
    )
    return data.goals
  }
}
