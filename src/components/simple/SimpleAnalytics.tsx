// Simple Analytics Component - One component, everything you need
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UnifiedAnalysisService, AnalysisStats, DeepAnalysisData } from '../../services/unifiedAnalysisService'
import type { ComprehensiveAnalytics } from '../../types'
import {
  getComprehensiveGameAnalytics,
  calculateAnalyticsFromGames,
  type PerformanceTrendSummary,
  type GameAnalytics
} from '../../utils/comprehensiveGameAnalytics'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { calculateAverageAccuracy } from '../../utils/accuracyCalculator'
import { normalizeOpeningName } from '../../utils/openingUtils'
import { getOpeningNameWithFallback } from '../../utils/openingIdentification'
import { getOpeningColor } from '../../utils/openingColorClassification'
import { getPlayerPerspectiveOpeningShort } from '../../utils/playerPerspectiveOpening'
import { CHESS_ANALYSIS_COLORS } from '../../utils/chessColors'
import { PersonalityRadar } from '../deep/PersonalityRadar'
import { LongTermPlanner } from '../deep/LongTermPlanner'
import { OpeningPlayerCard } from '../deep/OpeningPlayerCard'
import { EnhancedOpeningPlayerCard } from '../deep/EnhancedOpeningPlayerCard'
import { ScoreCards } from '../deep/ScoreCards'
import { EloTrendGraph } from './EloTrendGraph'
import { EnhancedOpponentAnalysis } from './EnhancedOpponentAnalysis'
import { TimeSpentSummary } from './TimeSpentAnalysis'
import { OpeningFilter, OpeningIdentifierSets } from '../../types'
import { mergeAnalysisStats, mergeComprehensiveAnalytics, mergeDeepAnalysis } from '../../utils/combinedAnalytics'

interface SimpleAnalyticsProps {
  userId: string
  platform?: string
  fromDate?: string
  toDate?: string
  onOpeningClick?: (filter: OpeningFilter) => void
  onOpponentClick?: (opponentName: string) => void
  forceRefresh?: boolean
  viewMode?: 'single' | 'combined'
  secondaryUserId?: string
  secondaryPlatform?: 'lichess' | 'chess.com'
}

export function SimpleAnalytics({ userId, platform, fromDate, toDate, onOpeningClick, onOpponentClick, forceRefresh = false, viewMode = 'single', secondaryUserId, secondaryPlatform }: SimpleAnalyticsProps) {
  const navigate = useNavigate()
  const [data, setData] = useState<AnalysisStats | null>(null)
  const [comprehensiveData, setComprehensiveData] = useState<ComprehensiveAnalytics | null>(null)
  const [deepAnalysisData, setDeepAnalysisData] = useState<DeepAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTimeControl, setSelectedTimeControl] = useState<string | null>(null)
  const [eloGraphGamesUsed, setEloGraphGamesUsed] = useState<number>(0)
  const [mostPlayedOpening, setMostPlayedOpening] = useState<{ opening: string; games: number } | null>(null)
  const [dataRefreshKey, setDataRefreshKey] = useState<number>(0)
  const isLoadingRef = useRef(false)
  const activePerformance = useMemo(() => {
    if (!comprehensiveData?.performanceTrends) {
      return null
    }

    const perTimeControl = comprehensiveData.performanceTrends.perTimeControl || {}
    if (selectedTimeControl && perTimeControl[selectedTimeControl]) {
      return {
        ...perTimeControl[selectedTimeControl],
        timeControlUsed: selectedTimeControl,
        sampleSize: eloGraphGamesUsed || perTimeControl[selectedTimeControl].sampleSize
      }
    }

    return {
      recentWinRate: comprehensiveData.performanceTrends.recentWinRate,
      recentAverageElo: comprehensiveData.performanceTrends.recentAverageElo,
      eloTrend: comprehensiveData.performanceTrends.eloTrend,
      sampleSize: eloGraphGamesUsed || comprehensiveData.performanceTrends.sampleSize,
      timeControlUsed: comprehensiveData.performanceTrends.timeControlUsed
    }
  }, [comprehensiveData?.performanceTrends, selectedTimeControl, eloGraphGamesUsed])

  // Fetch analytics data for a single platform.
  // Deep analysis is excluded — it's fetched separately in the background.
  // Calls are split into 2 batches to avoid Supabase connection contention
  // (4 simultaneous requests cause 2-3x slower responses due to rate limiting).
  const fetchPlatformData = useCallback(async (uid: string, plat: 'lichess' | 'chess.com') => {
    const start = performance.now()
    // Batch 1: Fast calls (SQL aggregation + lightweight queries)
    const [comprehensiveAnalytics, playerStats] = await Promise.all([
      UnifiedAnalysisService.getComprehensiveAnalytics(uid, plat, 10000),
      UnifiedAnalysisService.getPlayerStats(uid, plat),
    ])
    // Batch 2: Heavier calls (analysis data)
    const [analysisResult, gamesData] = await Promise.all([
      UnifiedAnalysisService.getAnalysisStats(uid, plat, 'stockfish'),
      UnifiedAnalysisService.getGameAnalyses(uid, plat, 'stockfish', 20, 0),
    ])
    if (import.meta.env.DEV) {
      console.log(`[PERF] fetchPlatformData total: ${Math.round(performance.now() - start)}ms`)
    }
    return { analysisResult, playerStats, gamesData, comprehensiveAnalytics }
  }, [])

  const loadData = useCallback(async (forceRefresh = false) => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      if (import.meta.env.DEV) {
        console.log('Already loading data, skipping duplicate call')
      }
      return
    }

    try {
      isLoadingRef.current = true
      if (forceRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const plat = (platform as 'lichess' | 'chess.com') || 'lichess'

      let analysisResult, playerStats, gamesData: ReturnType<typeof UnifiedAnalysisService.getGameAnalyses> extends Promise<infer T> ? T : never, comprehensiveAnalytics: Record<string, unknown>

      if (viewMode === 'combined' && secondaryUserId && secondaryPlatform) {
        const [primary, secondary] = await Promise.all([
          fetchPlatformData(userId, plat),
          fetchPlatformData(secondaryUserId, secondaryPlatform)
        ])

        analysisResult = primary.analysisResult && secondary.analysisResult
          ? mergeAnalysisStats(primary.analysisResult, secondary.analysisResult)
          : primary.analysisResult || secondary.analysisResult
        playerStats = primary.playerStats
        gamesData = [...(primary.gamesData || []), ...(secondary.gamesData || [])]
        comprehensiveAnalytics = (primary.comprehensiveAnalytics && secondary.comprehensiveAnalytics)
          ? mergeComprehensiveAnalytics(primary.comprehensiveAnalytics as ComprehensiveAnalytics, secondary.comprehensiveAnalytics as ComprehensiveAnalytics) as unknown as Record<string, unknown>
          : (primary.comprehensiveAnalytics || secondary.comprehensiveAnalytics) as Record<string, unknown>
      } else {
        const result = await fetchPlatformData(userId, plat)
        analysisResult = result.analysisResult
        playerStats = result.playerStats
        gamesData = result.gamesData
        comprehensiveAnalytics = result.comprehensiveAnalytics as Record<string, unknown>
      }

      // Calculate realistic accuracy from raw game data using player rating
      // Fall back to backend accuracy if no game data available for local calculation
      const playerRating = playerStats.currentRating || analysisResult?.current_rating || analysisResult?.highest_rating
      const localAccuracy = calculateAverageAccuracy(gamesData || [], playerRating)
      const realisticAccuracy = Math.round((localAccuracy > 0 ? localAccuracy : (analysisResult?.average_accuracy || 0)) * 10) / 10

      const enhancedData = analysisResult ? {
        ...analysisResult,
        average_accuracy: realisticAccuracy,
        current_rating: playerStats.currentRating,
        most_played_time_control: playerStats.mostPlayedTimeControl,
        validation_issues: playerStats.validationIssues
      } : {
        total_games_analyzed: comprehensiveAnalytics?.total_games || comprehensiveAnalytics?.totalGames || 0,
        average_accuracy: realisticAccuracy || 0,
        current_rating: playerStats.currentRating,
        most_played_time_control: playerStats.mostPlayedTimeControl,
        validation_issues: playerStats.validationIssues,
        average_opening_accuracy: 0,
        average_middle_game_accuracy: 0,
        average_endgame_accuracy: 0,
        blunders_per_game: 0,
        mistakes_per_game: 0,
        inaccuracies_per_game: 0,
        brilliant_moves_per_game: 0,
        best_moves_per_game: 0,
        good_moves_per_game: 0,
        acceptable_moves_per_game: 0,
        highest_rating: playerStats.currentRating,
        elo_optimization_active: false,
        total_games_with_elo: comprehensiveAnalytics?.total_games || comprehensiveAnalytics?.totalGames || 0
      }

      setData(enhancedData)
      setComprehensiveData({
        ...comprehensiveAnalytics,
        highestElo: comprehensiveAnalytics?.highestElo,
        timeControlWithHighestElo: comprehensiveAnalytics?.timeControlWithHighestElo,
        totalGames: comprehensiveAnalytics?.totalGames || comprehensiveAnalytics?.total_games || 0,
        openingColorStats: comprehensiveAnalytics?.openingColorStats || comprehensiveAnalytics?.opening_color_stats || { white: [], black: [] },
        game_length_distribution: comprehensiveAnalytics?.game_length_distribution,
        quick_victory_breakdown: comprehensiveAnalytics?.quick_victory_breakdown,
        marathon_performance: comprehensiveAnalytics?.marathon_performance,
        recent_trend: comprehensiveAnalytics?.recent_trend,
        personal_records: comprehensiveAnalytics?.personal_records,
        patience_rating: comprehensiveAnalytics?.patience_rating,
        comeback_potential: comprehensiveAnalytics?.comeback_potential,
        resignation_timing: comprehensiveAnalytics?.resignation_timing
      })

      if (comprehensiveAnalytics?.performanceTrends) {
        setSelectedTimeControl(prev => {
          const perTimeControl = comprehensiveAnalytics.performanceTrends.perTimeControl || {}
          const availableTimeControls = Object.keys(perTimeControl)

          if (prev && availableTimeControls.includes(prev)) return prev

          const preferred = comprehensiveAnalytics.performanceTrends.timeControlUsed
          if (preferred && (!availableTimeControls.length || availableTimeControls.includes(preferred))) return preferred
          if (availableTimeControls.length > 0) return availableTimeControls[0]

          return prev ?? (preferred || null)
        })
      }
      setDataRefreshKey(prev => prev + 1)

      // Fetch deep analysis in background (5-7s) — don't block page render
      // Deep analysis powers the personality radar which can appear after page loads
      const fetchDeep = async () => {
        try {
          let deepAnalysis: DeepAnalysisData
          if (viewMode === 'combined' && secondaryUserId && secondaryPlatform) {
            const [primary, secondary] = await Promise.all([
              UnifiedAnalysisService.fetchDeepAnalysis(userId, plat, forceRefresh),
              UnifiedAnalysisService.fetchDeepAnalysis(secondaryUserId, secondaryPlatform, forceRefresh)
            ])
            deepAnalysis = (primary && secondary)
              ? mergeDeepAnalysis(primary, secondary)
              : primary || secondary
          } else {
            deepAnalysis = await UnifiedAnalysisService.fetchDeepAnalysis(userId, plat, forceRefresh)
          }
          setDeepAnalysisData(deepAnalysis)
        } catch (err) {
          console.warn('Deep analysis failed (non-fatal):', err)
        }
      }
      fetchDeep()
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
      isLoadingRef.current = false
    }
  }, [userId, platform, fromDate, toDate, viewMode, secondaryUserId, secondaryPlatform, fetchPlatformData])

  useEffect(() => {
    if (!userId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    loadData()
  }, [userId, platform, fromDate, toDate, viewMode, secondaryUserId, secondaryPlatform, loadData])

  // Load most played opening when time control changes
  // Calculate most played opening from comprehensive data (no separate query needed)
  useEffect(() => {
    const loadMostPlayedOpening = async () => {
      if (!comprehensiveData || !selectedTimeControl) {
        setMostPlayedOpening(null)
        return
      }

      try {
        // Get the most played opening for this time control from openingStats
        // Since we already have all opening data, just use the top one
        if (comprehensiveData.openingStats && comprehensiveData.openingStats.length > 0) {
          const mostPlayed = comprehensiveData.openingStats[0] // Already sorted by games played
          setMostPlayedOpening({
            opening: mostPlayed.opening,
            games: mostPlayed.games
          })
        } else {
          setMostPlayedOpening(null)
        }
      } catch (error) {
        console.error('Error calculating most played opening:', error)
        setMostPlayedOpening(null)
      }
    }

    loadMostPlayedOpening()
  }, [comprehensiveData, selectedTimeControl])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-surface-1 p-6 rounded-lg shadow-card">
          <h2 className="text-xl font-semibold mb-4 text-gray-300">Chess Analytics</h2>
          <div className="space-y-2">
            <div className="h-4 bg-white/10 rounded w-32"></div>
            <div className="h-4 bg-white/10 rounded w-24"></div>
            <div className="h-4 bg-white/10 rounded w-28"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-surface-1 p-6 rounded-lg shadow-card">
        <h2 className="text-xl font-semibold mb-4 text-gray-300">Error</h2>
        <p className="text-rose-400 mb-4">{error}</p>
        <button
          onClick={() => loadData(true)}
          className="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data && !comprehensiveData) {
    return (
      <div className="bg-surface-1 p-6 rounded-lg shadow-card">
        <h2 className="text-xl font-semibold mb-4 text-gray-300">No Data</h2>
        <p className="text-gray-400">No games found for this user.</p>
      </div>
    )
  }

  // Check if we're showing mock data - look for actual mock patterns, not just specific values
  const isMockData = data && (
    data.total_games_analyzed === 15 &&
    data.average_accuracy === 78.5 &&
    data.total_blunders === 3 &&
    data.total_mistakes === 8 &&
    data.average_opening_accuracy === 82.3
  )

  // Create safe data object with fallbacks
  const safeData = data || {
    total_games_analyzed: comprehensiveData?.totalGames || 0,
    average_accuracy: 0,
    current_rating: comprehensiveData?.currentElo || null,
    most_played_time_control: comprehensiveData?.timeControlWithHighestElo || null,
    average_opening_accuracy: 0,
    average_middle_game_accuracy: 0,
    average_endgame_accuracy: 0,
    blunders_per_game: 0,
    inaccuracies_per_game: 0,
    brilliant_moves_per_game: 0,
    elo_optimization_active: false,
    total_games_with_elo: comprehensiveData?.totalGames || 0,
    validation_issues: []
  }

  const safeComprehensive = comprehensiveData
    ? {
        ...comprehensiveData,
        // Normalize field naming - support both camelCase and snake_case for backwards compatibility
        totalGames: comprehensiveData.totalGames ?? comprehensiveData.total_games ?? 0,
        winRate: comprehensiveData.winRate ?? comprehensiveData.win_rate ?? 0,
        drawRate: comprehensiveData.drawRate ?? comprehensiveData.draw_rate ?? 0,
        lossRate: comprehensiveData.lossRate ?? comprehensiveData.loss_rate ?? 0,
        highestElo: comprehensiveData.highestElo ?? comprehensiveData.highest_elo ?? null,
        timeControlWithHighestElo: comprehensiveData.timeControlWithHighestElo ?? comprehensiveData.time_control_with_highest_elo ?? null,
        currentEloPerTimeControl: comprehensiveData.currentEloPerTimeControl ?? comprehensiveData.current_elo_per_time_control ?? {},
        currentElo: comprehensiveData.currentElo ?? null,
        colorStats: comprehensiveData.colorStats || {
          white: { games: 0, winRate: 0, averageElo: 0 },
          black: { games: 0, winRate: 0, averageElo: 0 }
        },
        timeControlStats: comprehensiveData.timeControlStats || [],
        openingStats: comprehensiveData.openingStats || [],
        openingColorStats: comprehensiveData.openingColorStats || comprehensiveData.opening_color_stats || { white: [], black: [] },
        opponentStats: comprehensiveData.opponentStats || null,
        temporalStats: comprehensiveData.temporalStats || null,
        gameLengthStats: comprehensiveData.gameLengthStats ?? comprehensiveData.game_length_distribution ?? null,
        // Add missing critical fields with both naming conventions for consistency
        resignationTiming: comprehensiveData.resignationTiming ?? comprehensiveData.resignation_timing ?? null,
        personalRecords: comprehensiveData.personalRecords ?? comprehensiveData.personal_records ?? null,
        quickVictoryBreakdown: comprehensiveData.quickVictoryBreakdown ?? comprehensiveData.quick_victory_breakdown ?? null,
        marathonPerformance: comprehensiveData.marathonPerformance ?? comprehensiveData.marathon_performance ?? null,
        recentTrend: comprehensiveData.recentTrend ?? comprehensiveData.recent_trend ?? null,
        patienceRating: comprehensiveData.patienceRating ?? comprehensiveData.patience_rating ?? null,
        comebackPotential: comprehensiveData.comebackPotential ?? comprehensiveData.comeback_potential ?? null,
        performanceTrends: comprehensiveData.performanceTrends ?? null,
      }
    : null

  const safeColorStats = safeComprehensive?.colorStats || {
    white: { games: 0, winRate: 0, averageElo: 0 },
    black: { games: 0, winRate: 0, averageElo: 0 }
  }

  const safeTimeControlStats = safeComprehensive?.timeControlStats || []
  const safeOpeningStats = safeComprehensive?.openingStats || []
  const safeOpeningColorStats = safeComprehensive?.openingColorStats || safeComprehensive?.opening_color_stats || { white: [], black: [] }

  // Debug: Log what we're using for opening color stats
  if (import.meta.env.DEV && safeOpeningColorStats) {
    console.log('Safe Opening Color Stats:', {
      whiteCount: safeOpeningColorStats.white?.length || 0,
      blackCount: safeOpeningColorStats.black?.length || 0,
      whiteSample: safeOpeningColorStats.white?.slice(0, 3),
      blackSample: safeOpeningColorStats.black?.slice(0, 3)
    })
  }
  const safeOpponentStats = safeComprehensive?.opponentStats || null
  const safeTemporalStats = safeComprehensive?.temporalStats || {
    firstGame: null,
    lastGame: null,
    gamesThisMonth: 0,
    gamesThisWeek: 0,
    averageGamesPerDay: 0
  }

  // Helper functions for safe formatting
  const formatPercent = (value: number | null | undefined, decimals: number = 1): string => {
    return typeof value === 'number' && !isNaN(value) ? value.toFixed(decimals) : '0.0'
  }

  const formatNumber = (value: number | null | undefined, fallback: string = '0'): string => {
    return typeof value === 'number' && !isNaN(value) ? value.toString() : fallback
  }

  const gameLengthStats = (() => {
    if (safeComprehensive?.gameLengthStats) {
      return safeComprehensive.gameLengthStats
    }

    const games = Array.isArray((safeComprehensive as any)?.games)
      ? (safeComprehensive as any).games
      : []

    if (!games.length) {
      return {
        averageGameLength: 0,
        shortestGame: 0,
        longestGame: 0,
        quickVictories: 0,
        longGames: 0
      }
    }

    const lengths = games
      .map((g: any) => g?.total_moves || g?.totalMoves)
      .filter((value: any) => typeof value === 'number' && value > 0)

    if (!lengths.length) {
      return {
        averageGameLength: 0,
        shortestGame: 0,
        longestGame: 0,
        quickVictories: 0,
        longGames: 0
      }
    }

    const averageGameLength = lengths.reduce((a: number, b: number) => a + b, 0) / lengths.length
    const shortestGame = Math.min(...lengths)
    const longestGame = Math.max(...lengths)
    const quickVictories = games.filter((g: any) => (g?.total_moves || g?.totalMoves || 0) < 20 && g?.result === 'win').length
    const longGames = games.filter((g: any) => (g?.total_moves || g?.totalMoves || 0) > 60).length

    return {
      averageGameLength,
      shortestGame,
      longestGame,
      quickVictories,
      longGames
    }
  })()

  const buildOpeningFilter = (
    normalizedName: string,
    identifiers?: OpeningIdentifierSets,
    fallback?: { openingFamily?: string | null; opening?: string | null },
    color?: 'white' | 'black'
  ): OpeningFilter => {
    const hasIdentifiers = identifiers && (identifiers.openingFamilies.length > 0 || identifiers.openings.length > 0)
    const fallbackFamilies = fallback?.openingFamily ? [fallback.openingFamily] : []
    const fallbackOpenings = fallback?.opening ? [fallback.opening] : []

    // Auto-determine color if not explicitly provided
    // This ensures we only show games where the player actually played this opening
    const determinedColor = color || (() => {
      const openingColor = getOpeningColor(normalizedName)
      // If the opening is neutral (e.g., "King's Pawn Game"), don't filter by color
      // If it's white or black, filter to only show games where player played that color
      return openingColor === 'neutral' ? undefined : openingColor
    })()

    return {
      normalized: normalizedName,
      identifiers: hasIdentifiers
        ? identifiers!
        : {
            openingFamilies: fallbackFamilies,
            openings: fallbackOpenings,
          },
      color: determinedColor,
    }
  }

  const cardClass = 'rounded-lg bg-surface-1 p-6 shadow-card'
  const subtleCardClass = 'rounded-lg bg-surface-2 p-6 shadow-card'
  const pillBadgeClass = 'inline-flex items-center gap-2 rounded-md bg-white/[0.06] px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-300'

  return (
    <div className="space-y-6 text-gray-300" data-testid="analytics-container">
      {/* ELO Optimization Status */}
      {safeData.elo_optimization_active && (
        <div className="rounded-lg bg-emerald-500/10 p-5 shadow-card">
          <div className="flex items-start space-x-3">
            <div className="text-xl text-emerald-200">*</div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">ELO Optimization Active</h3>
              <p className="mb-3 text-sm text-emerald-100">
                Your ELO statistics are calculated using the optimized approach for maximum performance.
                This ensures accurate results even with thousands of games!
              </p>
              <div className="rounded-lg bg-emerald-500/10 p-4">
                <p className="mb-2 text-sm font-medium text-emerald-100">Optimization Benefits:</p>
                <ul className="space-y-1 text-xs text-emerald-200">
                  <li>• Fast ELO calculations (single database query)</li>
                  <li>• Complete coverage of all imported games</li>
                  <li>• No analysis dependency — data available immediately after import</li>
                  <li>• Handles players with thousands of games efficiently</li>
                </ul>
                {safeData.total_games_with_elo > 0 && (
                  <p className="mt-3 text-xs text-emerald-100">
                    <span className="font-semibold">Total games processed:</span> {safeData.total_games_with_elo}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mock Data Warning */}
      {isMockData && (
        <div className="rounded-lg bg-amber-500/10 p-5 shadow-card">
          <div className="flex items-start space-x-3">
            <div className="text-xl text-amber-200">!</div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">Demo Data Shown</h3>
              <p className="mb-3 text-sm text-amber-100">
                You're seeing sample analytics data because no analysis has been performed on your games yet.
              </p>
              <div className="rounded-lg bg-amber-500/15 p-4">
                <p className="mb-2 text-sm font-medium text-amber-100">To see your real analytics:</p>
                <p className="text-xs text-amber-100/90">
                  Games need to be analyzed to show real analytics data. Analysis can be triggered from individual games in the match history.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ELO Data Validation Warning */}
      {safeData.validation_issues && safeData.validation_issues.length > 0 && (
        <div className="rounded-lg bg-orange-500/10 p-5 shadow-card">
          <div className="flex items-start space-x-3">
            <div className="text-xl text-orange-200">!</div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">ELO Data Quality Issues Detected</h3>
              <p className="mb-3 text-sm text-orange-100">
                Some of your game data may have incorrect ELO ratings. This could affect the accuracy of your highest ELO calculation.
              </p>
              <div className="rounded-lg bg-orange-500/15 p-4">
                <p className="mb-2 text-sm font-medium text-orange-100">Issues found:</p>
                <ul className="list-disc space-y-1 text-xs text-orange-100/90">
                  {safeData.validation_issues.slice(0, 3).map((issue: string, index: number) => (
                    <li key={index}>{issue}</li>
                  ))}
                  {safeData.validation_issues.length > 3 && (
                    <li>... and {safeData.validation_issues.length - 3} more issues</li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-orange-100">
                  <span className="font-semibold">Note:</span> The highest ELO shown may not be accurate. Consider re-importing your games to fix these issues.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-responsive">
        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-gray-400">Total Games Analyzed</h3>
          <div className="mt-3 text-2xl font-semibold text-white">{safeData.total_games_analyzed}</div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-gray-400">Average Accuracy</h3>
          <div className="mt-3 text-2xl font-semibold text-emerald-300">{safeData.average_accuracy}%</div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-gray-400">Highest Rating</h3>
          <div className="mt-3 text-2xl font-semibold text-sky-300">{safeComprehensive?.highestElo || 'N/A'}</div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-gray-400">Time Control</h3>
          <div className="mt-3 text-2xl font-semibold text-amber-300">
            {safeComprehensive?.timeControlWithHighestElo ? getTimeControlCategory(safeComprehensive.timeControlWithHighestElo) : safeData.most_played_time_control ? getTimeControlCategory(safeData.most_played_time_control) : 'Unknown'}
          </div>
        </div>
      </div>

      {/* Backend Analysis Status */}
      {!data && safeComprehensive && safeComprehensive.totalGames > 0 && (
        <div className="rounded-lg bg-sky-500/10 p-5 shadow-card">
          <div className="flex items-start space-x-3">
            <div className="text-xl text-sky-200">…</div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">Analysis in Progress</h3>
              <p className="text-sm text-sky-100">
                Your comprehensive game statistics are available below. Detailed move analysis is currently being processed by the backend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Analytics Section */}
      {safeComprehensive && safeComprehensive.totalGames > 0 && (
        <div className="space-y-4">
          {/* Basic Statistics */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Basic Statistics</h3>
            <div className="grid-responsive text-sm">
              <div>
                <span className="text-xs uppercase tracking-wide text-gray-500">Total Games</span>
                <div className="text-xl font-semibold text-sky-300">{safeComprehensive.totalGames}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-gray-500">Win Rate</span>
                <div className="text-xl font-semibold text-emerald-300">{formatPercent(safeComprehensive.winRate, 1)}%</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-gray-500">Draw Rate</span>
                <div className="text-xl font-semibold text-amber-300">{formatPercent(safeComprehensive.drawRate, 1)}%</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-gray-500">Loss Rate</span>
                <div className="text-xl font-semibold text-rose-300">{formatPercent(safeComprehensive.lossRate, 1)}%</div>
              </div>
            </div>
          </div>

          {/* Color Performance */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Color Performance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className={subtleCardClass}>
                <h4 className="mb-2 text-sm font-semibold text-white">White</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Games:</span>
                    <span className="font-semibold text-white">{safeColorStats.white.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Win Rate:</span>
                    <span className="font-semibold text-emerald-300">{formatPercent(safeColorStats.white.winRate, 1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg ELO:</span>
                    <span className="font-semibold text-white">{formatPercent(safeColorStats.white.averageElo, 0)}</span>
                  </div>
                </div>
              </div>
              <div className={subtleCardClass}>
                <h4 className="mb-2 text-sm font-semibold text-white">Black</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Games:</span>
                    <span className="font-semibold text-white">{safeColorStats.black.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Win Rate:</span>
                    <span className="font-semibold text-emerald-300">{formatPercent(safeColorStats.black.winRate, 1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg ELO:</span>
                    <span className="font-semibold text-white">{formatPercent(safeColorStats.black.averageElo, 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Time Controls */}
          <div className={`${cardClass} hidden`}>
            <h3 className="mb-4 text-lg font-semibold text-white">Time Control Performance</h3>
            <div className="space-y-3">
              {safeTimeControlStats.slice(0, 3).map((stat: any, index: number) => (
                <div key={index} className={subtleCardClass}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-white">{stat.timeControl}</span>
                    <span className="text-xs uppercase tracking-wide text-gray-500">{stat.games} games</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                    <div>
                      <span className="text-gray-500">Win Rate:</span>
                      <span className="ml-2 font-semibold text-emerald-300">{formatPercent(stat.winRate, 1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg ELO:</span>
                      <span className="ml-2 font-semibold text-white">{formatPercent(stat.averageElo, 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opening Performance - Winning vs Losing */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Opening Performance</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Winning Openings */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-emerald-200">Winning Openings</h4>
                <div className="space-y-3">
                  {safeOpeningStats && safeOpeningStats.filter((stat: any) => stat.winRate >= 50).length > 0 ? (
                    safeOpeningStats.filter((stat: any) => stat.winRate >= 50).slice(0, 3).map((stat: any, index: number) => (
                    <div
                      key={index}
                      className="cursor-pointer rounded-lg bg-emerald-500/10 p-4 shadow-card transition-colors hover:bg-emerald-500/15"
                      onClick={() =>
                        onOpeningClick?.(
                          buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, {
                            openingFamily: stat.openingFamily,
                            opening: stat.opening,
                          })
                        )
                      }
                      title="Click to view games with this opening"
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <span className="text-sm font-medium leading-tight text-white">
                          {normalizeOpeningName(stat.opening)}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-emerald-100/80">{stat.games} games</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm text-emerald-100">
                        <div>
                          <span className="text-emerald-100/70">Win Rate:</span>
                          <span className="ml-2 font-semibold">{formatPercent(stat.winRate, 1)}%</span>
                        </div>
                        <div>
                          <span className="text-emerald-100/70">Avg ELO:</span>
                          <span className="ml-2 font-semibold">{formatPercent(stat.averageElo, 0)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                  ) : (
                    <div className="rounded-lg bg-surface-2 p-6 text-center shadow-card">
                      <p className="text-sm text-gray-400">No winning openings yet</p>
                      <p className="mt-2 text-xs text-gray-500">Play more games to build opening statistics</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Losing Openings */}
              <div>
                <h4 className="mb-3 text-sm font-semibold text-amber-200">Losing Openings</h4>
                <div className="space-y-3">
                  {safeOpeningStats && safeOpeningStats.filter((stat: any) => stat.winRate < 50).length > 0 ? (
                    safeOpeningStats.filter((stat: any) => stat.winRate < 50).sort((a: any, b: any) => b.games - a.games).slice(0, 3).map((stat: any, index: number) => (
                      <div
                        key={index}
                        className="cursor-pointer rounded-lg bg-amber-500/10 p-4 shadow-card transition-colors hover:bg-amber-500/15"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, {
                              openingFamily: stat.openingFamily,
                              opening: stat.opening,
                            })
                          )
                        }
                        title="Click to view games with this opening"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-sm font-medium leading-tight text-white">
                            {normalizeOpeningName(stat.opening)}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-amber-100/80">{stat.games} games</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm text-amber-100">
                          <div>
                            <span className="text-amber-100/70">Win Rate:</span>
                            <span className="ml-2 font-semibold">{formatPercent(stat.winRate, 1)}%</span>
                          </div>
                          <div>
                            <span className="text-amber-100/70">Avg ELO:</span>
                            <span className="ml-2 font-semibold">{formatPercent(stat.averageElo, 0)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg bg-surface-2 p-6 text-center shadow-card">
                      <p className="text-sm text-gray-400">No losing openings yet</p>
                      <p className="mt-2 text-xs text-gray-500">Great! All your openings have 50%+ win rate</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Opening Color Performance */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Opening Performance by Color</h3>

            {safeOpeningColorStats &&
             (safeOpeningColorStats.white.length > 0 || safeOpeningColorStats.black.length > 0) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Best White Openings */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-emerald-200">Most Played White Openings</h4>
                  <div className="space-y-3">
                    {safeOpeningColorStats.white.slice(0, 3).map((stat: any, index: number) => (
                      <div
                        key={index}
                        className="cursor-pointer rounded-lg bg-emerald-500/10 p-4 shadow-card transition-colors hover:bg-emerald-500/15"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, undefined, 'white')
                          )
                        }
                        title="Click to view games with this opening"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-sm font-medium leading-tight text-white">
                            {stat.opening}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            stat.winRate >= 60 ? 'bg-emerald-500/20 text-emerald-300' :
                            stat.winRate >= 50 ? 'bg-sky-500/20 text-sky-300' :
                            'bg-rose-500/20 text-rose-300'
                          }`}>
                            {formatPercent(stat.winRate, 1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-emerald-100">
                          <span>{stat.games} games</span>
                          <span className="font-semibold">
                            {stat.wins}W-{stat.losses}L-{stat.draws}D
                          </span>
                        </div>
                      </div>
                    ))}
                    {safeOpeningColorStats.white.length === 0 && (
                      <div className="py-4 text-center text-xs text-gray-500">
                        No white opening data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Best Black Openings */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-sky-200">Most Played Black Openings</h4>
                  <div className="space-y-3">
                    {safeOpeningColorStats.black.slice(0, 3).map((stat: any, index: number) => (
                      <div
                        key={index}
                        className="cursor-pointer rounded-lg bg-sky-500/10 p-4 shadow-card transition-colors hover:bg-sky-500/15"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, undefined, 'black')
                          )
                        }
                        title="Click to view games with this opening"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-sm font-medium leading-tight text-white">
                            {stat.opening}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            stat.winRate >= 60 ? 'bg-emerald-500/20 text-emerald-300' :
                            stat.winRate >= 50 ? 'bg-sky-500/20 text-sky-300' :
                            'bg-rose-500/20 text-rose-300'
                          }`}>
                            {formatPercent(stat.winRate, 1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-sky-100">
                          <span>{stat.games} games</span>
                          <span className="font-semibold">
                            {stat.wins}W-{stat.losses}L-{stat.draws}D
                          </span>
                        </div>
                      </div>
                    ))}
                    {safeOpeningColorStats.black.length === 0 && (
                      <div className="py-4 text-center text-xs text-gray-500">
                        No black opening data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                <div className="mb-2 text-4xl text-gray-600">--</div>
                <p>No opening data available</p>
                <p className="text-xs">Games need opening names to show color performance</p>
              </div>
            )}
          </div>

          {/* Recent Performance */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Recent Performance</h3>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-1">
                <div className={subtleCardClass}>
                  <div>
                    <span className="text-xs uppercase tracking-wide text-gray-500">Recent Win Rate</span>
                    <div className="text-lg font-semibold text-emerald-300">{activePerformance ? formatPercent(activePerformance.recentWinRate, 1) : '--'}%</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {activePerformance
                        ? `${activePerformance.sampleSize} games • ${activePerformance.timeControlUsed}`
                        : 'No data'}
                    </div>
                  </div>
                </div>
                <div className={subtleCardClass}>
                  <span className="text-xs uppercase tracking-wide text-gray-500">Current Rating</span>
                  <div className="text-lg font-semibold text-sky-300">
                    {selectedTimeControl && comprehensiveData?.currentEloPerTimeControl?.[selectedTimeControl]
                      ? safeComprehensive.currentEloPerTimeControl[selectedTimeControl]
                      : (comprehensiveData?.currentElo || '--')}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {activePerformance
                      ? `Avg: ${formatPercent(activePerformance.recentAverageElo, 0)} • ${activePerformance.sampleSize} games`
                      : 'No data'}
                  </div>
                </div>
                <div className={subtleCardClass}>
                  <span className="text-xs uppercase tracking-wide text-gray-500">Most Played Opening</span>
                  {mostPlayedOpening ? (
                    <>
                      <div className="text-sm font-semibold text-purple-300 mt-2 break-words leading-tight">
                        {normalizeOpeningName(mostPlayedOpening.opening)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {mostPlayedOpening.games} games • {selectedTimeControl || 'All'}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-semibold text-gray-500 mt-2">
                      No data
                    </div>
                  )}
                </div>
              </div>
              <div className="lg:col-span-2 min-w-0">
                {viewMode === 'combined' && secondaryUserId && secondaryPlatform ? (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-green-300 uppercase tracking-wide mb-1">
                        {platform === 'chess.com' ? 'Chess.com' : 'Lichess'}
                      </div>
                      <EloTrendGraph
                        userId={userId}
                        platform={platform as 'lichess' | 'chess.com'}
                        className="w-full"
                        selectedTimeControl={selectedTimeControl}
                        onTimeControlChange={setSelectedTimeControl}
                        onGamesUsedChange={setEloGraphGamesUsed}
                        key={`primary-${dataRefreshKey}`}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-yellow-300 uppercase tracking-wide mb-1">
                        {secondaryPlatform === 'chess.com' ? 'Chess.com' : 'Lichess'}
                      </div>
                      <EloTrendGraph
                        userId={secondaryUserId}
                        platform={secondaryPlatform}
                        className="w-full"
                        selectedTimeControl={selectedTimeControl}
                        onTimeControlChange={setSelectedTimeControl}
                        key={`secondary-${dataRefreshKey}`}
                      />
                    </div>
                  </div>
                ) : (
                  <EloTrendGraph
                    userId={userId}
                    platform={platform as 'lichess' | 'chess.com'}
                    className="w-full"
                    selectedTimeControl={selectedTimeControl}
                    onTimeControlChange={setSelectedTimeControl}
                    onGamesUsedChange={setEloGraphGamesUsed}
                    key={dataRefreshKey}
                  />
                )}
              </div>
            </div>

            {/* Time Spent Summary - Full Width */}
            {comprehensiveData?.games && userId && platform && (
              <div className="mt-6">
                <TimeSpentSummary
                  userId={userId}
                  platform={platform as 'lichess' | 'chess.com'}
                  fallbackGames={comprehensiveData.games}
                />
              </div>
            )}
          </div>

          {/* Enhanced Opponent Analysis */}
          {comprehensiveData?.opponentStats && (
            <EnhancedOpponentAnalysis
              userId={userId}
              opponentStats={safeOpponentStats}
              platform={(platform as 'lichess' | 'chess.com') || 'lichess'}
              onOpponentClick={onOpponentClick}
            />
          )}

          {/* NEW: Enhanced Game Length Insights & Performance Highlights - Combined Block */}
          {(safeComprehensive?.gameLengthStats || safeComprehensive?.quickVictoryBreakdown || safeComprehensive?.marathonPerformance || safeComprehensive?.recentTrend || safeComprehensive?.personalRecords || safeComprehensive?.patienceRating != null || safeComprehensive?.comebackPotential || safeComprehensive?.resignationTiming) && (
            <div className={cardClass}>
              <h3 className="mb-4 text-lg font-semibold text-white">Enhanced Game Length Insights</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Marathon Performance */}
                {safeComprehensive?.marathonPerformance && safeComprehensive.marathonPerformance.count > 0 && (
                  <div className="lg:col-span-2">
                    <h4 className="mb-3 text-sm font-semibold text-amber-200">Marathon Performance (80+ moves)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                      <div className={subtleCardClass}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-h-[60px] sm:min-h-0">
                          <span className="text-sm sm:text-xs text-gray-500">Games</span>
                          <span className="text-2xl sm:text-lg font-semibold text-sky-300">{safeComprehensive.marathonPerformance.count}</span>
                        </div>
                      </div>
                      {safeComprehensive.marathonPerformance.average_accuracy !== null && safeComprehensive.marathonPerformance.average_accuracy !== undefined && (
                        <div className={subtleCardClass}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-h-[60px] sm:min-h-0">
                            <span className="text-sm sm:text-xs text-gray-500">Avg Accuracy</span>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl sm:text-lg font-semibold text-emerald-300">{formatPercent(safeComprehensive.marathonPerformance.average_accuracy, 1)}%</span>
                              {safeComprehensive.marathonPerformance.analyzed_count && safeComprehensive.marathonPerformance.analyzed_count < safeComprehensive.marathonPerformance.count && (
                                <span className="text-xs text-gray-500">({safeComprehensive.marathonPerformance.analyzed_count} analyzed)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {safeComprehensive.marathonPerformance.average_blunders !== null && safeComprehensive.marathonPerformance.average_blunders !== undefined && (
                        <div className={subtleCardClass}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-h-[60px] sm:min-h-0">
                            <span className="text-sm sm:text-xs text-gray-500">Avg Blunders</span>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl sm:text-lg font-semibold text-rose-300">{formatPercent(safeComprehensive.marathonPerformance.average_blunders, 1)}</span>
                              {safeComprehensive.marathonPerformance.analyzed_count && safeComprehensive.marathonPerformance.analyzed_count < safeComprehensive.marathonPerformance.count && (
                                <span className="text-xs text-gray-500">({safeComprehensive.marathonPerformance.analyzed_count} analyzed)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Trend - Full Width */}
              {safeComprehensive?.recentTrend && safeComprehensive.recentTrend.recent_average_moves && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h4 className="mb-3 text-sm font-semibold text-sky-200">Recent Trend</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Last 100 Games</span>
                      <div className="text-2xl sm:text-xl font-semibold text-sky-300">{formatPercent(safeComprehensive.recentTrend.recent_average_moves, 1)} <span className="text-sm">moves</span></div>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Baseline</span>
                      <div className="text-2xl sm:text-xl font-semibold text-gray-400">{formatPercent(safeComprehensive.recentTrend.baseline_average_moves, 1)} <span className="text-sm">moves</span></div>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Change</span>
                      <div className={`text-2xl sm:text-xl font-semibold ${safeComprehensive.recentTrend.difference > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {safeComprehensive.recentTrend.difference > 0 ? '+' : ''}{formatPercent(safeComprehensive.recentTrend.difference, 1)}
                      </div>
                    </div>
                  </div>
                  {safeComprehensive.recentTrend.difference !== 0 && (
                    <p className="mt-3 text-sm sm:text-xs text-gray-500">
                      {safeComprehensive.recentTrend.difference > 0
                        ? `Your recent games are ${Math.abs(safeComprehensive.recentTrend.difference).toFixed(1)} moves longer than usual`
                        : `Your recent games are ${Math.abs(safeComprehensive.recentTrend.difference).toFixed(1)} moves shorter than usual`
                      }
                    </p>
                  )}
                </div>
              )}

              {/* Performance Highlights Section */}
              {(safeComprehensive?.personalRecords || safeComprehensive?.comebackPotential) && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Personal Records */}
                    {safeComprehensive?.personalRecords && (
                      <div className="lg:col-span-2">
                        <h5 className="mb-3 text-sm font-semibold text-emerald-200">Personal Records</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                          {comprehensiveData.personal_records.fastest_win && comprehensiveData.personal_records.fastest_win.moves > 0 && (
                            <div
                              className={`${subtleCardClass} cursor-pointer hover:bg-white/15 transition-colors`}
                              onClick={() => {
                                const gameId = safeComprehensive.personalRecords.fastest_win.game_id
                                if (gameId) {
                                  navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                                }
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="text-sm sm:text-xs text-gray-500">Fastest Win</span>
                                <span className="text-2xl sm:text-lg font-semibold text-emerald-300">{safeComprehensive.personalRecords.fastest_win.moves} <span className="text-sm">moves</span></span>
                              </div>
                            </div>
                          )}
                          {safeComprehensive.personalRecords.highest_accuracy_win && (
                            <div
                              className={`${subtleCardClass} cursor-pointer hover:bg-white/15 transition-colors`}
                              onClick={() => {
                                const gameId = safeComprehensive.personalRecords.highest_accuracy_win.game_id
                                if (gameId) {
                                  navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                                }
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="text-sm sm:text-xs text-gray-500">Most Accurate Win</span>
                                <span className="text-2xl sm:text-lg font-semibold text-sky-300">{formatPercent(safeComprehensive.personalRecords.highest_accuracy_win.accuracy, 1)}%</span>
                              </div>
                            </div>
                          )}
                          {comprehensiveData.personal_records.longest_game && comprehensiveData.personal_records.longest_game.moves > 0 && (
                            <div
                              className={`${subtleCardClass} cursor-pointer hover:bg-white/15 transition-colors`}
                              onClick={() => {
                                const gameId = safeComprehensive.personalRecords.longest_game.game_id
                                if (gameId) {
                                  navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                                }
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="text-sm sm:text-xs text-gray-500">Longest Game</span>
                                <span className="text-2xl sm:text-lg font-semibold text-purple-300">{safeComprehensive.personalRecords.longest_game.moves} <span className="text-sm">moves</span></span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Resignation Timing - Full Width */}
              {comprehensiveData?.resignation_timing && comprehensiveData.resignation_timing.my_average_resignation_move != null && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h4 className="mb-3 text-sm font-semibold text-rose-200">Resignation Timing</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Last 50 Games</span>
                      <div className="text-2xl sm:text-xl font-semibold text-sky-300">
                        {comprehensiveData.resignation_timing.recent_average_resignation_move != null
                          ? `${formatPercent(comprehensiveData.resignation_timing.recent_average_resignation_move, 1)} moves`
                          : 'N/A'}
                      </div>
                      {comprehensiveData.resignation_timing.insight && (
                        <div className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                          <span>{safeComprehensive.resignationTiming.insight}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Baseline</span>
                      <div className="text-2xl sm:text-xl font-semibold text-gray-400">{formatPercent(comprehensiveData.resignation_timing.my_average_resignation_move, 1)} <span className="text-sm">moves</span></div>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 mb-1">Change</span>
                      <div className={`text-2xl sm:text-xl font-semibold ${
                        comprehensiveData.resignation_timing.change != null && comprehensiveData.resignation_timing.change > 0
                          ? 'text-amber-300'
                          : comprehensiveData.resignation_timing.change != null && comprehensiveData.resignation_timing.change < 0
                            ? 'text-emerald-300'
                            : 'text-gray-400'
                      }`}>
                        {comprehensiveData.resignation_timing.change != null
                          ? `${comprehensiveData.resignation_timing.change > 0 ? '+' : ''}${comprehensiveData.resignation_timing.change}`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Deep Analysis Section */}
      {deepAnalysisData && (
        <div className="space-y-6">

          {/* Long-term Planner */}
          <LongTermPlanner data={deepAnalysisData} userId={userId} />

          {/* Main Analysis Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personality Radar */}
            {deepAnalysisData.personality_scores && (
              <div className={cardClass}>
                <PersonalityRadar scores={deepAnalysisData.personality_scores} />
              </div>
            )}

            {/* Enhanced Opening Player Card */}
            <div className={cardClass}>
              <EnhancedOpeningPlayerCard
                score={deepAnalysisData.phase_accuracies?.opening || 0}
                phaseAccuracy={deepAnalysisData.phase_accuracies?.opening || 0}
                openingStats={comprehensiveData?.openingStats || []}
                totalGames={deepAnalysisData.total_games || 0}
                enhancedAnalysis={deepAnalysisData.enhanced_opening_analysis}
                personalityScores={deepAnalysisData.personality_scores}
              />
            </div>
          </div>

        </div>
      )}

      {/* Analysis Stats */}
      <div className={cardClass}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Analysis Statistics</h2>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium text-gray-300 shadow-card transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className={subtleCardClass}>
            <div className="flex justify-between text-sm text-gray-300">
              <span className="text-gray-500">Opening Accuracy</span>
              <span className="font-semibold">{safeData.average_opening_accuracy ? Number(safeData.average_opening_accuracy).toFixed(1) : 'N/A'}%</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-300">
              <span className="text-gray-500">Middle Game Accuracy</span>
              <span className="font-semibold">{safeData.average_middle_game_accuracy ? Number(safeData.average_middle_game_accuracy).toFixed(1) : 'N/A'}%</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-300">
              <span className="text-gray-500">Endgame Accuracy</span>
              <span className="font-semibold">{safeData.average_endgame_accuracy ? Number(safeData.average_endgame_accuracy).toFixed(1) : 'N/A'}%</span>
            </div>
          </div>
          <div className={subtleCardClass}>
            <div className="flex justify-between text-sm text-gray-300">
              <span className="text-gray-500">Blunders per Game</span>
              <span className={`font-semibold ${CHESS_ANALYSIS_COLORS.blunders}`}>{Number(safeData.blunders_per_game).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-300">
              <span className="text-gray-500">Inaccuracies per Game</span>
              <span className={`font-semibold ${CHESS_ANALYSIS_COLORS.inaccuracies}`}>{Number(safeData.inaccuracies_per_game).toFixed(2)}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-gray-300">
              <span className="text-gray-500">Brilliant Moves per Game</span>
              <span className={`font-semibold ${CHESS_ANALYSIS_COLORS.brilliants}`}>{Number(safeData.brilliant_moves_per_game).toFixed(2)}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
