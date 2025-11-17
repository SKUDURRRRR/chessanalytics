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
      const url = new URL(`${API_URL}/api/v1/coach/dashboard/${encodeURIComponent(userId)}/${platform}`)
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
      const url = new URL(`${API_URL}/api/v1/coach/lessons/${encodeURIComponent(userId)}/${platform}`)
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
      const url = new URL(`${API_URL}/api/v1/coach/puzzles/${encodeURIComponent(userId)}/${platform}`)
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
      const url = new URL(`${API_URL}/api/v1/coach/puzzles/daily/${encodeURIComponent(userId)}/${platform}`)
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
}
