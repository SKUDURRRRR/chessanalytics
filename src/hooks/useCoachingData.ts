/**
 * Custom hooks for Coach tab data fetching
 */

import { useState, useEffect, useCallback } from 'react'
import { CoachingService } from '../services/coachingService'
import { DashboardData, Puzzle, PuzzleSet, Platform, ProgressData, PuzzleStats, DailyChallenge } from '../types'
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

/**
 * Hook to fetch progress tracking data (time series, streaks, weakness evolution)
 */
export function useCoachProgress(userId: string, platform: Platform, periodDays: number = 90) {
  const { user } = useAuth()
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchProgress = useCallback(async () => {
    if (!userId || !platform) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await CoachingService.getProgress(userId, platform, periodDays, user?.id)
      setProgress(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch progress data')
      setError(error)
      logger.error('Error fetching progress data:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, platform, periodDays, user?.id])

  useEffect(() => {
    fetchProgress()
  }, [fetchProgress])

  return { progress, loading, error, refetch: fetchProgress }
}

/**
 * Hook to fetch puzzle training statistics (rating, XP, streaks)
 */
export function usePuzzleStats() {
  const { user } = useAuth()
  const [stats, setStats] = useState<PuzzleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchStats = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await CoachingService.getPuzzleStats(user.id)
      setStats(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch puzzle stats')
      setError(error)
      logger.error('Error fetching puzzle stats:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return { stats, loading, error, refetch: fetchStats }
}

/**
 * Hook to fetch today's daily challenge
 */
export function useDailyChallenge() {
  const { user } = useAuth()
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchChallenge = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await CoachingService.getDailyChallenge(user.id)
      setChallenge(data)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch daily challenge')
      setError(error)
      logger.error('Error fetching daily challenge:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchChallenge()
  }, [fetchChallenge])

  return { challenge, loading, error, refetch: fetchChallenge }
}
