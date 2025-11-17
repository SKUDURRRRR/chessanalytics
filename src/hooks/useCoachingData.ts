/**
 * Custom hooks for Coach tab data fetching
 */

import { useState, useEffect, useCallback } from 'react'
import { CoachingService } from '../services/coachingService'
import { DashboardData, Lesson, Puzzle, PuzzleSet, Platform } from '../types'
import { logger } from '../utils/logger'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook to fetch and manage Coach dashboard data
 */
export function useCoachDashboard(userId: string, platform: Platform) {
  const { user } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDashboard = useCallback(async () => {
    if (!userId || !platform) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      // Pass authenticated user's UUID for premium check
      const data = await CoachingService.getDashboard(userId, platform, user?.id)
      setDashboard(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch dashboard')
      setError(error)
      logger.error('Error fetching coach dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, platform, user?.id])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return { dashboard, loading, error, refetch: fetchDashboard }
}

/**
 * Hook to fetch and manage lessons
 */
export function useLessons(
  userId: string,
  platform: Platform,
  category?: string
) {
  const { user } = useAuth()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchLessons = useCallback(async () => {
    if (!userId || !platform) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await CoachingService.getLessons(userId, platform, category, user?.id)
      setLessons(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch lessons')
      setError(error)
      logger.error('Error fetching lessons:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, platform, category, user?.id])

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  return { lessons, loading, error, refetch: fetchLessons }
}

/**
 * Hook to fetch and manage puzzles
 */
export function usePuzzles(userId: string, platform: Platform, category?: string) {
  const { user } = useAuth()
  const [puzzleSet, setPuzzleSet] = useState<PuzzleSet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchPuzzles = useCallback(async () => {
    if (!userId || !platform) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await CoachingService.getPuzzles(userId, platform, category, user?.id)
      setPuzzleSet(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch puzzles')
      setError(error)
      logger.error('Error fetching puzzles:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, platform, category, user?.id])

  useEffect(() => {
    fetchPuzzles()
  }, [fetchPuzzles])

  return { puzzleSet, loading, error, refetch: fetchPuzzles }
}

/**
 * Hook to fetch daily puzzle
 */
export function useDailyPuzzle(userId: string, platform: Platform) {
  const { user } = useAuth()
  const [dailyPuzzle, setDailyPuzzle] = useState<Puzzle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchDailyPuzzle = useCallback(async () => {
    if (!userId || !platform) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await CoachingService.getDailyPuzzle(userId, platform, user?.id)
      setDailyPuzzle(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch daily puzzle')
      setError(error)
      logger.error('Error fetching daily puzzle:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, platform, user?.id])

  useEffect(() => {
    fetchDailyPuzzle()
  }, [fetchDailyPuzzle])

  return { dailyPuzzle, loading, error, refetch: fetchDailyPuzzle }
}
