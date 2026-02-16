/**
 * Coaching Service - Service for Coach tab features
 * Handles API communication for lessons, puzzles, and progress tracking
 */

import {
  DashboardData,
  Lesson,
  LessonDetail,
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
} from '../types'
import { config } from '../lib/config'
import { fetchWithTimeout, TIMEOUT_CONFIG } from '../utils/fetchWithTimeout'
import { logger } from '../utils/logger'

const API_URL = config.getApi().baseUrl

export class CoachingService {
  /**
   * Get Coach dashboard data (daily lesson, weaknesses, strengths)
   */
  static async getDashboard(userId: string, platform: Platform, authUserId?: string): Promise<DashboardData> {
    try {
      const url = new URL(`${API_URL}/api/v1/coach/dashboard/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
      if (authUserId) {
        url.searchParams.append('auth_user_id', authUserId)
      }

      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data as DashboardData
    } catch (error) {
      logger.error('Error fetching coach dashboard:', error)
      throw error
    }
  }

  /**
   * Get all lessons for user
   */
  static async getLessons(
    userId: string,
    platform: Platform,
    category?: string,
    authUserId?: string
  ): Promise<Lesson[]> {
    try {
      const url = new URL(`${API_URL}/api/v1/coach/lessons/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
      if (category) {
        url.searchParams.append('category', category)
      }
      if (authUserId) {
        url.searchParams.append('auth_user_id', authUserId)
      }

      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return (data.lessons || []) as Lesson[]
    } catch (error) {
      logger.error('Error fetching lessons:', error)
      throw error
    }
  }

  /**
   * Get full lesson detail by ID
   */
  static async getLessonDetail(lessonId: string): Promise<LessonDetail> {
    try {
      const url = `${API_URL}/api/v1/coach/lessons/${encodeURIComponent(lessonId)}`

      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        if (response.status === 404) {
          throw new Error('Lesson not found')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data as LessonDetail
    } catch (error) {
      logger.error('Error fetching lesson detail:', error)
      throw error
    }
  }

  /**
   * Mark lesson as complete
   */
  static async completeLesson(
    lessonId: string,
    timeSpent: number,
    quizScore?: number
  ): Promise<void> {
    try {
      const url = `${API_URL}/api/v1/coach/lessons/${encodeURIComponent(lessonId)}/complete`

      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            time_spent_seconds: timeSpent,
            quiz_score: quizScore,
          }),
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      await response.json()
    } catch (error) {
      logger.error('Error completing lesson:', error)
      throw error
    }
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
    try {
      const url = new URL(`${API_URL}/api/v1/coach/puzzles/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
      if (category) {
        url.searchParams.append('category', category)
      }
      if (authUserId) {
        url.searchParams.append('auth_user_id', authUserId)
      }

      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data as PuzzleSet
    } catch (error) {
      logger.error('Error fetching puzzles:', error)
      throw error
    }
  }

  /**
   * Get daily puzzle for user
   */
  static async getDailyPuzzle(userId: string, platform: Platform, authUserId?: string): Promise<Puzzle> {
    try {
      const url = new URL(`${API_URL}/api/v1/coach/puzzles/daily/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
      if (authUserId) {
        url.searchParams.append('auth_user_id', authUserId)
      }

      const response = await fetchWithTimeout(
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        if (response.status === 404) {
          throw new Error('No daily puzzle available')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data as Puzzle
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
      const url = `${API_URL}/api/v1/coach/puzzles/${encodeURIComponent(puzzleId)}/attempt`

      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            was_correct: wasCorrect,
            time_to_solve_seconds: timeTaken,
            moves_made: movesMade,
          }),
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      await response.json()
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
  ): Promise<{ move: { san: string; uci: string; from: string; to: string }; evaluation: any; pv_line: string[] }> {
    try {
      const url = new URL(`${API_URL}/api/v1/coach/play-move`)
      if (authUserId) {
        url.searchParams.append('auth_user_id', authUserId)
      }

      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fen,
            skill_level: skillLevel,
            depth,
          }),
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
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
      const url = new URL(`${API_URL}/api/v1/coach/chat`)
      url.searchParams.append('auth_user_id', authUserId)

      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
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
            },
            conversation_history: conversationHistory,
          }),
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach chat requires premium subscription')
        }
        if (response.status === 429) {
          throw new Error('Chat rate limit reached. Please try again later.')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data as CoachChatResponse
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
    try {
      const url = new URL(`${API_URL}/api/v1/coach/progress/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
      url.searchParams.append('period_days', String(periodDays))
      if (authUserId) {
        url.searchParams.append('auth_user_id', authUserId)
      }

      const response = await fetchWithTimeout(
        url.toString(),
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
        TIMEOUT_CONFIG.DEFAULT
      )

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Coach features require premium subscription')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json() as ProgressData
    } catch (error) {
      logger.error('Error getting progress data:', error)
      throw error
    }
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
    const url = new URL(`${API_URL}/api/v1/coach/tags`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, platform, tag, tag_type: tagType }),
      },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.tag as GameTag
  }

  static async deleteTag(tagId: string, authUserId: string): Promise<void> {
    const url = new URL(`${API_URL}/api/v1/coach/tags/${encodeURIComponent(tagId)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
  }

  static async getUserTags(userId: string, platform: Platform, authUserId: string): Promise<GameTag[]> {
    const url = new URL(`${API_URL}/api/v1/coach/tags/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.tags as GameTag[]
  }

  static async getGameTags(gameId: string, authUserId: string): Promise<GameTag[]> {
    const url = new URL(`${API_URL}/api/v1/coach/tags/game/${encodeURIComponent(gameId)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.tags as GameTag[]
  }

  // ========================================================================
  // SAVED POSITIONS
  // ========================================================================

  static async savePosition(
    position: { fen: string; platform: Platform; title?: string; notes?: string; source_game_id?: string; source_move_number?: number; tags?: string[] },
    authUserId: string
  ): Promise<SavedPosition> {
    const url = new URL(`${API_URL}/api/v1/coach/positions`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(position),
      },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.position as SavedPosition
  }

  static async getSavedPositions(userId: string, platform: Platform, authUserId: string): Promise<SavedPosition[]> {
    const url = new URL(`${API_URL}/api/v1/coach/positions/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.positions as SavedPosition[]
  }

  static async updatePosition(
    positionId: string,
    update: { title?: string; notes?: string; tags?: string[] },
    authUserId: string
  ): Promise<SavedPosition> {
    const url = new URL(`${API_URL}/api/v1/coach/positions/${encodeURIComponent(positionId)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.position as SavedPosition
  }

  static async deletePosition(positionId: string, authUserId: string): Promise<void> {
    const url = new URL(`${API_URL}/api/v1/coach/positions/${encodeURIComponent(positionId)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
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
    const url = new URL(`${API_URL}/api/v1/coach/openings/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
    url.searchParams.append('auth_user_id', authUserId)
    if (refresh) url.searchParams.append('refresh', 'true')

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.repertoire as OpeningRepertoire[]
  }

  static async getOpeningDetail(
    userId: string,
    platform: Platform,
    openingFamily: string,
    color: string,
    authUserId: string
  ): Promise<OpeningDetail> {
    const url = new URL(`${API_URL}/api/v1/coach/openings/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}/${encodeURIComponent(openingFamily)}`)
    url.searchParams.append('color', color)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json() as OpeningDetail
  }

  static async getDrillPositions(
    userId: string,
    platform: Platform,
    openingFamily: string,
    color: string,
    authUserId: string
  ): Promise<Array<{ fen: string; move_number: number; your_move: string; classification: string; description: string }>> {
    const url = new URL(`${API_URL}/api/v1/coach/openings/drill`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, platform, opening_family: openingFamily, color }),
      },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.positions
  }

  static async completeDrill(
    repertoireId: string,
    confidenceDelta: number,
    authUserId: string
  ): Promise<{ confidence_level: number; next_review: string; days_until_review: number }> {
    const url = new URL(`${API_URL}/api/v1/coach/openings/drill/complete`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repertoire_id: repertoireId, confidence_delta: confidenceDelta }),
      },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return await response.json()
  }

  // ========================================================================
  // STUDY PLANS
  // ========================================================================

  static async getStudyPlan(userId: string, platform: Platform, authUserId: string): Promise<StudyPlan | null> {
    const url = new URL(`${API_URL}/api/v1/coach/study-plan/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.plan as StudyPlan | null
  }

  static async createStudyPlan(userId: string, platform: Platform, authUserId: string): Promise<StudyPlan> {
    const url = new URL(`${API_URL}/api/v1/coach/study-plan/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.plan as StudyPlan
  }

  static async completeActivity(planId: string, day: number, activityIndex: number, authUserId: string): Promise<StudyPlan> {
    const url = new URL(`${API_URL}/api/v1/coach/study-plan/${encodeURIComponent(planId)}/activity`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day, activity_index: activityIndex }),
      },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.plan as StudyPlan
  }

  static async getGoals(userId: string, platform: Platform, authUserId: string): Promise<UserGoal[]> {
    const url = new URL(`${API_URL}/api/v1/coach/goals/${encodeURIComponent(userId)}/${encodeURIComponent(platform)}`)
    url.searchParams.append('auth_user_id', authUserId)

    const response = await fetchWithTimeout(
      url.toString(),
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      TIMEOUT_CONFIG.DEFAULT
    )
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = await response.json()
    return data.goals as UserGoal[]
  }
}
