/**
 * Custom hooks for Coach tab data fetching
 */

import { useState, useEffect, useCallback } from 'react'
import { CoachingService } from '../services/coachingService'
import { DashboardData, Puzzle, PuzzleSet, Platform, ProgressData, PuzzleStats, DailyChallenge, RecommendationProfile } from '../types'
import { logger } from '../utils/logger'
import { useAuth } from '../contexts/AuthContext'

/**
 * Generic hook for coach data fetching with loading/error state management.
 * Reduces boilerplate across all coach data hooks.
 */
function useCoachData<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList,
  guard: boolean = true,
  resourceName: string = 'data'
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetch = useCallback(async () => {
    if (!guard) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      setError(null)
      setData(await fetchFn())
    } catch (err) {
      const e = err instanceof Error ? err : new Error(`Failed to fetch ${resourceName}`)
      setError(e)
      logger.error(`Error fetching ${resourceName}:`, e)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

export function useCoachDashboard(userId: string, platform: Platform) {
  const { user } = useAuth()
  const { data: dashboard, loading, error, refetch } = useCoachData(
    () => CoachingService.getDashboard(userId, platform, user?.id),
    [userId, platform, user?.id],
    !!(userId && platform),
    'dashboard'
  )
  return { dashboard, loading, error, refetch }
}

export function usePuzzles(userId: string, platform: Platform, category?: string) {
  const { user } = useAuth()
  const { data: puzzleSet, loading, error, refetch } = useCoachData(
    () => CoachingService.getPuzzles(userId, platform, category, user?.id),
    [userId, platform, category, user?.id],
    !!(userId && platform),
    'puzzles'
  )
  return { puzzleSet, loading, error, refetch }
}

export function useDailyPuzzle(userId: string, platform: Platform) {
  const { user } = useAuth()
  const { data: dailyPuzzle, loading, error, refetch } = useCoachData(
    () => CoachingService.getDailyPuzzle(userId, platform, user?.id),
    [userId, platform, user?.id],
    !!(userId && platform),
    'daily puzzle'
  )
  return { dailyPuzzle, loading, error, refetch }
}

export function useCoachProgress(userId: string, platform: Platform, periodDays: number = 90) {
  const { user } = useAuth()
  const { data: progress, loading, error, refetch } = useCoachData(
    () => CoachingService.getProgress(userId, platform, periodDays, user?.id),
    [userId, platform, periodDays, user?.id],
    !!(userId && platform),
    'progress'
  )
  return { progress, loading, error, refetch }
}

export function usePuzzleStats() {
  const { user } = useAuth()
  const { data: stats, loading, error, refetch } = useCoachData(
    () => CoachingService.getPuzzleStats(user!.id),
    [user?.id],
    !!user?.id,
    'puzzle stats'
  )
  return { stats, loading, error, refetch }
}

export function useDailyChallenge() {
  const { user } = useAuth()
  const { data: challenge, loading, error, refetch } = useCoachData(
    () => CoachingService.getDailyChallenge(user!.id),
    [user?.id],
    !!user?.id,
    'daily challenge'
  )
  return { challenge, loading, error, refetch }
}

export function useRecommendationProfile() {
  const { user } = useAuth()
  const { data: profile, loading, error, refetch } = useCoachData(
    () => CoachingService.getRecommendationProfile(user!.id),
    [user?.id],
    !!user?.id,
    'recommendation profile'
  )
  return { profile, loading, error, refetch }
}
