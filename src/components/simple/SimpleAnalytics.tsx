// Simple Analytics Component - One component, everything you need
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UnifiedAnalysisService, AnalysisStats, DeepAnalysisData } from '../../services/unifiedAnalysisService'
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
import { shouldCountOpeningForColor } from '../../utils/openingColorClassification'
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

interface SimpleAnalyticsProps {
  userId: string
  platform?: string
  fromDate?: string
  toDate?: string
  onOpeningClick?: (filter: OpeningFilter) => void
  onOpponentClick?: (opponentName: string) => void
  forceRefresh?: boolean
}

export function SimpleAnalytics({ userId, platform, fromDate, toDate, onOpeningClick, onOpponentClick, forceRefresh = false }: SimpleAnalyticsProps) {
  const navigate = useNavigate()
  const [data, setData] = useState<AnalysisStats | null>(null)
  const [comprehensiveData, setComprehensiveData] = useState<any>(null)
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

      // Optimized data fetching - fetch ALL data in parallel for maximum speed
      const [analysisResult, playerStats, gamesData, comprehensiveAnalytics, deepAnalysis, eloStats] = await Promise.all([
        UnifiedAnalysisService.getAnalysisStats(
          userId,
          (platform as 'lichess' | 'chess.com') || 'lichess',
          'stockfish'
        ),
        // Use backend API for player stats instead of direct Supabase query
        UnifiedAnalysisService.getPlayerStats(userId, (platform as 'lichess' | 'chess.com') || 'lichess'),
        UnifiedAnalysisService.getGameAnalyses(
          userId,
          (platform as 'lichess' | 'chess.com') || 'lichess',
          'stockfish',
          50,
          0
        ),
        // Use backend API for comprehensive analytics instead of direct Supabase queries
        (async () => {
          const backendData = await UnifiedAnalysisService.getComprehensiveAnalytics(
            userId,
            (platform as 'lichess' | 'chess.com') || 'lichess',
            500  // DISK I/O OPTIMIZATION: Reduced from 10000 to 500 (still statistically significant, saves ~95% disk I/O)
          )
          // Return the full backend response with all the new analytics
          return backendData
        })(),
        UnifiedAnalysisService.fetchDeepAnalysis(
          userId,
          (platform as 'lichess' | 'chess.com') || 'lichess',
          forceRefresh  // Pass forceRefresh to bypass cache after analysis
        ),
        UnifiedAnalysisService.getEloStats(
          userId,
          (platform as 'lichess' | 'chess.com') || 'lichess'
        )
      ])

      // Set default values for removed services
      const optimizedEloStats = null

      // Only log diagnostics in development mode
      if (import.meta.env.DEV) {
        console.log('SimpleAnalytics received data - total games:', analysisResult?.total_games_analyzed)
        console.log('Comprehensive analytics - total games:', comprehensiveAnalytics?.total_games)
        console.log('Comprehensive analytics full data:', comprehensiveAnalytics)
        console.log('ELO stats from backend:', eloStats)
        console.log('Opening accuracy:', analysisResult?.average_opening_accuracy)
        console.log('Middle game accuracy:', analysisResult?.average_middle_game_accuracy)
        console.log('Endgame accuracy:', analysisResult?.average_endgame_accuracy)

        // Log validation issues if any
        if (playerStats.validationIssues && playerStats.validationIssues.length > 0) {
          console.warn('ELO data validation issues detected:', playerStats.validationIssues)
        }

        // Log comprehensive analytics benefits
        if (comprehensiveAnalytics && (comprehensiveAnalytics.total_games || comprehensiveAnalytics.totalGames) > 0) {
          console.log(`Comprehensive analytics: ${comprehensiveAnalytics.total_games || comprehensiveAnalytics.totalGames} games analyzed with single query`)
        }
      }

      // Calculate realistic accuracy from raw game data using player rating
      const playerRating = playerStats.currentRating || analysisResult?.current_rating || analysisResult?.highest_rating
      const realisticAccuracy = calculateAverageAccuracy(gamesData || [], playerRating)

      // Merge analysis stats with player stats and new accuracy
      const enhancedData = analysisResult ? {
        ...analysisResult,
        // Use realistic accuracy calculation
        average_accuracy: realisticAccuracy,
        // Use player stats for ELO data
        current_rating: playerStats.currentRating,
        most_played_time_control: playerStats.mostPlayedTimeControl,
        validation_issues: playerStats.validationIssues
      } : {
        // Fallback when no analysis stats available
        total_games_analyzed: comprehensiveAnalytics?.total_games || comprehensiveAnalytics?.totalGames || 0,
        average_accuracy: realisticAccuracy,
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

      // Debug: Opening analytics data (only in development)
      if (import.meta.env.DEV) {
        console.log('Opening Analytics Debug:', {
          totalGames: comprehensiveAnalytics?.total_games || comprehensiveAnalytics?.totalGames,
          totalOpenings: comprehensiveAnalytics?.openingStats?.length,
          winningOpenings: comprehensiveAnalytics?.openingStats?.filter(o => o.winRate >= 50).length,
          losingOpenings: comprehensiveAnalytics?.openingStats?.filter(o => o.winRate < 50).length,
          topOpenings: comprehensiveAnalytics?.openingStats?.slice(0, 5).map(o => ({
            opening: o.opening,
            games: o.games,
            winRate: o.winRate.toFixed(1)
          }))
        })
      }

      setData(enhancedData)
      // Merge ELO stats from backend API into comprehensive data
      setComprehensiveData({
        ...comprehensiveAnalytics,
        // Override with backend API data if available (more reliable)
        highestElo: eloStats.highest_elo || comprehensiveAnalytics?.highestElo,
        timeControlWithHighestElo: eloStats.time_control || comprehensiveAnalytics?.timeControlWithHighestElo,
        totalGames: eloStats.total_games || comprehensiveAnalytics?.totalGames || 0
      })
      if (comprehensiveAnalytics?.performanceTrends) {
        setSelectedTimeControl(prev => {
          const perTimeControl = comprehensiveAnalytics.performanceTrends.perTimeControl || {}
          const availableTimeControls = Object.keys(perTimeControl)

          if (prev && availableTimeControls.includes(prev)) {
            return prev
          }

          const preferred = comprehensiveAnalytics.performanceTrends.timeControlUsed
          if (preferred && (!availableTimeControls.length || availableTimeControls.includes(preferred))) {
            return preferred
          }

          if (availableTimeControls.length > 0) {
            return availableTimeControls[0]
          }

          return prev ?? (preferred || null)
        })
      }
      setDeepAnalysisData(deepAnalysis)

      // Increment refresh key to force EloTrendGraph to re-fetch data
      setDataRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
      isLoadingRef.current = false
    }
  }, [userId, platform, fromDate, toDate])

  useEffect(() => {
    if (!userId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    loadData()
  }, [userId, platform, fromDate, toDate, loadData])

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
        <div className="bg-white/[0.08] border border-white/10 p-6 rounded-lg shadow-2xl shadow-black/50">
          <h2 className="text-xl font-bold mb-4 text-slate-200">Chess Analytics</h2>
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
      <div className="bg-white/[0.08] border border-white/10 p-6 rounded-lg shadow-2xl shadow-black/50">
        <h2 className="text-xl font-bold mb-4 text-slate-200">Error</h2>
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
      <div className="bg-white/[0.08] border border-white/10 p-6 rounded-lg shadow-2xl shadow-black/50">
        <h2 className="text-xl font-bold mb-4 text-slate-200">No Data</h2>
        <p className="text-slate-300">No games found for this user.</p>
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
        openingColorStats: comprehensiveData.openingColorStats || { white: [], black: [] },
        opponentStats: comprehensiveData.opponentStats || null,
        temporalStats: comprehensiveData.temporalStats || null,
        gameLengthStats: comprehensiveData.gameLengthStats || null
      }
    : null

  const safeColorStats = safeComprehensive?.colorStats || {
    white: { games: 0, winRate: 0, averageElo: 0 },
    black: { games: 0, winRate: 0, averageElo: 0 }
  }

  const safeTimeControlStats = safeComprehensive?.timeControlStats || []
  const safeOpeningStats = safeComprehensive?.openingStats || []
  const safeOpeningColorStats = safeComprehensive?.openingColorStats || { white: [], black: [] }
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

    return {
      normalized: normalizedName,
      identifiers: hasIdentifiers
        ? identifiers!
        : {
            openingFamilies: fallbackFamilies,
            openings: fallbackOpenings,
          },
      color,
    }
  }

  const cardClass = 'rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-lg shadow-black/40'
  const subtleCardClass = 'rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-inner shadow-black/30'
  const pillBadgeClass = 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-200'

  return (
    <div className="space-y-6 text-slate-100" data-testid="analytics-container">
      {/* ELO Optimization Status */}
      {safeData.elo_optimization_active && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 shadow-lg shadow-emerald-900/30">
          <div className="flex items-start space-x-3">
            <div className="text-xl text-emerald-200">*</div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">ELO Optimization Active</h3>
              <p className="mb-3 text-sm text-emerald-100">
                Your ELO statistics are calculated using the optimized approach for maximum performance.
                This ensures accurate results even with thousands of games!
              </p>
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
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
        <div className="rounded-2xl border border-amber-300/30 bg-amber-500/10 p-5 shadow-lg shadow-amber-900/30">
          <div className="flex items-start space-x-3">
            <div className="text-xl text-amber-200">!</div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">Demo Data Shown</h3>
              <p className="mb-3 text-sm text-amber-100">
                You're seeing sample analytics data because no analysis has been performed on your games yet.
              </p>
              <div className="rounded-xl border border-amber-300/30 bg-amber-500/15 p-4">
                <p className="mb-2 text-sm font-medium text-amber-100">To see your real analytics:</p>
                <ol className="list-decimal space-y-1 text-xs text-amber-100/90">
                  <li>Click the "Analyze My Games" button above</li>
                  <li>Wait for the analysis to complete (this may take a few minutes)</li>
                  <li>Refresh the page to see your real analytics data</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ELO Data Validation Warning */}
      {safeData.validation_issues && safeData.validation_issues.length > 0 && (
        <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 p-5 shadow-lg shadow-orange-900/30">
          <div className="flex items-start space-x-3">
            <div className="text-xl text-orange-200">!</div>
            <div>
              <h3 className="mb-2 text-lg font-semibold text-white">ELO Data Quality Issues Detected</h3>
              <p className="mb-3 text-sm text-orange-100">
                Some of your game data may have incorrect ELO ratings. This could affect the accuracy of your highest ELO calculation.
              </p>
              <div className="rounded-xl border border-orange-300/30 bg-orange-500/15 p-4">
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
          <h3 className="text-xs uppercase tracking-wide text-slate-300">Total Games Analyzed</h3>
          <div className="mt-3 text-2xl font-semibold text-white">{safeData.total_games_analyzed}</div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-slate-300">Average Accuracy</h3>
          <div className="mt-3 text-2xl font-semibold text-emerald-300">{safeData.average_accuracy}%</div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-slate-300">Highest Rating</h3>
          <div className="mt-3 text-2xl font-semibold text-sky-300">{safeComprehensive?.highestElo || 'N/A'}</div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-slate-300">Time Control</h3>
          <div className="mt-3 text-2xl font-semibold text-amber-300">
            {safeComprehensive?.timeControlWithHighestElo ? getTimeControlCategory(safeComprehensive.timeControlWithHighestElo) : safeData.most_played_time_control ? getTimeControlCategory(safeData.most_played_time_control) : 'Unknown'}
          </div>
        </div>
      </div>

      {/* Backend Analysis Status */}
      {!data && safeComprehensive && safeComprehensive.totalGames > 0 && (
        <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-5 shadow-lg shadow-sky-900/30">
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
                <span className="text-xs uppercase tracking-wide text-slate-400">Total Games</span>
                <div className="text-xl font-semibold text-sky-300">{safeComprehensive.totalGames}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Win Rate</span>
                <div className="text-xl font-semibold text-emerald-300">{formatPercent(safeComprehensive.winRate, 1)}%</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Draw Rate</span>
                <div className="text-xl font-semibold text-amber-300">{formatPercent(safeComprehensive.drawRate, 1)}%</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Loss Rate</span>
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
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Games:</span>
                    <span className="font-semibold text-white">{safeColorStats.white.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="font-semibold text-emerald-300">{formatPercent(safeColorStats.white.winRate, 1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg ELO:</span>
                    <span className="font-semibold text-white">{formatPercent(safeColorStats.white.averageElo, 0)}</span>
                  </div>
                </div>
              </div>
              <div className={subtleCardClass}>
                <h4 className="mb-2 text-sm font-semibold text-white">Black</h4>
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Games:</span>
                    <span className="font-semibold text-white">{safeColorStats.black.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="font-semibold text-emerald-300">{formatPercent(safeColorStats.black.winRate, 1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg ELO:</span>
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
                    <span className="text-xs uppercase tracking-wide text-slate-400">{stat.games} games</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-200">
                    <div>
                      <span className="text-slate-400">Win Rate:</span>
                      <span className="ml-2 font-semibold text-emerald-300">{formatPercent(stat.winRate, 1)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Avg ELO:</span>
                      <span className="ml-2 font-semibold text-white">{formatPercent(stat.averageElo, 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opening Performance - Winning vs Losing */}
          <div className={cardClass}>
            <h3 className="mb-6 text-lg font-semibold text-white">Opening Performance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Winning Openings */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-emerald-200">Winning Openings</h4>
                <div className="space-y-3">
                  {safeOpeningStats && safeOpeningStats.filter((stat: any) => stat.winRate >= 50).length > 0 ? (
                    safeOpeningStats
                      .filter((stat: any) => stat.winRate >= 50)
                      .slice(0, 3)
                      .map((stat: any, index: number) => (
                    <div
                      key={index}
                      className="cursor-pointer rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 transition hover:border-emerald-300/60 hover:bg-emerald-500/20"
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
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-medium text-white">
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
                    <div className="rounded-2xl border border-slate-500/40 bg-slate-500/10 p-6 text-center">
                      <p className="text-sm text-slate-300">No winning openings yet</p>
                      <p className="mt-2 text-xs text-slate-400">Play more games to build opening statistics</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Losing Openings */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-amber-200">Losing Openings</h4>
                <div className="space-y-3">
                  {safeOpeningStats && safeOpeningStats.filter((stat: any) => stat.winRate < 50).length > 0 ? (
                    safeOpeningStats.filter((stat: any) => stat.winRate < 50).sort((a: any, b: any) => b.games - a.games).slice(0, 3).map((stat: any, index: number) => (
                      <div
                        key={index}
                        className="cursor-pointer rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 transition hover:border-amber-300/60 hover:bg-amber-500/20"
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
                        <div className="mb-3 flex items-center justify-between">
                          <span className="font-medium text-white">
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
                    <div className="rounded-2xl border border-slate-500/40 bg-slate-500/10 p-6 text-center">
                      <p className="text-sm text-slate-300">No losing openings yet</p>
                      <p className="mt-2 text-xs text-slate-400">Great! All your openings have 50%+ win rate</p>
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
                  <h4 className="mb-3 text-sm font-semibold text-emerald-200">Best Winning White Openings</h4>
                  <div className="space-y-3">
                    {safeOpeningColorStats.white
                      .filter((stat: any) => shouldCountOpeningForColor(stat.opening, 'white') && stat.winRate >= 50)
                      .sort((a: any, b: any) => b.games - a.games)
                      .slice(0, 3)
                      .map((stat: any, index: number) => (
                      <div
                        key={index}
                        className="cursor-pointer rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 transition hover:border-emerald-300/60 hover:bg-emerald-500/20"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, undefined, 'white')
                          )
                        }
                        title="Click to view games with this opening"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-sm font-medium leading-tight text-white">
                            {normalizeOpeningName(stat.opening)}
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
                      <div className="py-4 text-center text-xs text-slate-400">
                        No white opening data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Best Black Openings */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-sky-200">Best Winning Black Openings</h4>
                  <div className="space-y-3">
                    {safeOpeningColorStats.black
                      .filter((stat: any) => shouldCountOpeningForColor(stat.opening, 'black') && stat.winRate >= 50)
                      .sort((a: any, b: any) => b.games - a.games)
                      .slice(0, 3)
                      .map((stat: any, index: number) => (
                      <div
                        key={index}
                        className="cursor-pointer rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4 transition hover:border-sky-300/60 hover:bg-sky-500/20"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, undefined, 'black')
                          )
                        }
                        title="Click to view games with this opening"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <span className="text-sm font-medium leading-tight text-white">
                            {normalizeOpeningName(stat.opening)}
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
                      <div className="py-4 text-center text-xs text-slate-400">
                        No black opening data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <div className="mb-2 text-4xl text-slate-600">--</div>
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
                    <span className="text-xs uppercase tracking-wide text-slate-400">Recent Win Rate</span>
                    <div className="text-lg font-semibold text-emerald-300">{activePerformance ? formatPercent(activePerformance.recentWinRate, 1) : '--'}%</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {activePerformance
                        ? `${activePerformance.sampleSize} games • ${activePerformance.timeControlUsed}`
                        : 'No data'}
                    </div>
                  </div>
                </div>
                <div className={subtleCardClass}>
                  <span className="text-xs uppercase tracking-wide text-slate-400">Current Rating</span>
                  <div className="text-lg font-semibold text-sky-300">
                    {selectedTimeControl && comprehensiveData?.currentEloPerTimeControl?.[selectedTimeControl]
                      ? safeComprehensive.currentEloPerTimeControl[selectedTimeControl]
                      : (comprehensiveData?.currentElo || '--')}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {activePerformance
                      ? `Avg: ${formatPercent(activePerformance.recentAverageElo, 0)} • ${activePerformance.sampleSize} games`
                      : 'No data'}
                  </div>
                </div>
                <div className={subtleCardClass}>
                  <span className="text-xs uppercase tracking-wide text-slate-400">Most Played Opening</span>
                  {mostPlayedOpening ? (
                    <>
                      <div className="text-sm font-semibold text-purple-300 mt-2 break-words leading-tight">
                        {normalizeOpeningName(mostPlayedOpening.opening)}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {mostPlayedOpening.games} games • {selectedTimeControl || 'All'}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-semibold text-slate-500 mt-2">
                      No data
                    </div>
                  )}
                </div>
              </div>
              <div className="lg:col-span-2 min-w-0">
                <EloTrendGraph
                  userId={userId}
                  platform={platform as 'lichess' | 'chess.com'}
                  className="w-full"
                  selectedTimeControl={selectedTimeControl}
                  onTimeControlChange={setSelectedTimeControl}
                  onGamesUsedChange={setEloGraphGamesUsed}
                  key={dataRefreshKey}
                />
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
          {(comprehensiveData?.game_length_distribution || comprehensiveData?.quick_victory_breakdown || comprehensiveData?.marathon_performance || comprehensiveData?.recent_trend || comprehensiveData?.personal_records || comprehensiveData?.patience_rating != null || comprehensiveData?.comeback_potential || comprehensiveData?.resignation_timing) && (
            <div className={cardClass}>
              <h3 className="mb-4 text-lg font-semibold text-white">Enhanced Game Length Insights</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Marathon Performance */}
                {comprehensiveData?.marathon_performance && comprehensiveData.marathon_performance.count > 0 && (
                  <div className="lg:col-span-2">
                    <h4 className="mb-3 text-sm font-semibold text-amber-200">Marathon Performance (80+ moves)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                      <div className={subtleCardClass}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-h-[60px] sm:min-h-0">
                          <span className="text-sm sm:text-xs text-slate-400">Games</span>
                          <span className="text-2xl sm:text-lg font-semibold text-sky-300">{comprehensiveData.marathon_performance.count}</span>
                        </div>
                      </div>
                      {comprehensiveData.marathon_performance.average_accuracy !== null && comprehensiveData.marathon_performance.average_accuracy !== undefined && (
                        <div className={subtleCardClass}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-h-[60px] sm:min-h-0">
                            <span className="text-sm sm:text-xs text-slate-400">Avg Accuracy</span>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl sm:text-lg font-semibold text-emerald-300">{formatPercent(comprehensiveData.marathon_performance.average_accuracy, 1)}%</span>
                              {comprehensiveData.marathon_performance.analyzed_count && comprehensiveData.marathon_performance.analyzed_count < comprehensiveData.marathon_performance.count && (
                                <span className="text-xs text-slate-500">({comprehensiveData.marathon_performance.analyzed_count} analyzed)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      {comprehensiveData.marathon_performance.average_blunders !== null && comprehensiveData.marathon_performance.average_blunders !== undefined && (
                        <div className={subtleCardClass}>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 min-h-[60px] sm:min-h-0">
                            <span className="text-sm sm:text-xs text-slate-400">Avg Blunders</span>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl sm:text-lg font-semibold text-rose-300">{formatPercent(comprehensiveData.marathon_performance.average_blunders, 1)}</span>
                              {comprehensiveData.marathon_performance.analyzed_count && comprehensiveData.marathon_performance.analyzed_count < comprehensiveData.marathon_performance.count && (
                                <span className="text-xs text-slate-500">({comprehensiveData.marathon_performance.analyzed_count} analyzed)</span>
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
              {comprehensiveData?.recent_trend && comprehensiveData.recent_trend.recent_average_moves && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h4 className="mb-3 text-sm font-semibold text-sky-200">Recent Trend</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-xs text-slate-400 mb-1">Last 50 Games</span>
                      <div className="text-2xl sm:text-xl font-semibold text-sky-300">{formatPercent(comprehensiveData.recent_trend.recent_average_moves, 1)} <span className="text-base sm:text-sm">moves</span></div>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 mb-1">Baseline</span>
                      <div className="text-2xl sm:text-xl font-semibold text-slate-300">{formatPercent(comprehensiveData.recent_trend.baseline_average_moves, 1)} <span className="text-base sm:text-sm">moves</span></div>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 mb-1">Change</span>
                      <div className={`text-2xl sm:text-xl font-semibold ${comprehensiveData.recent_trend.difference > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {comprehensiveData.recent_trend.difference > 0 ? '+' : ''}{formatPercent(comprehensiveData.recent_trend.difference, 1)}
                      </div>
                    </div>
                  </div>
                  {comprehensiveData.recent_trend.difference !== 0 && (
                    <p className="mt-3 text-sm sm:text-xs text-slate-400">
                      {comprehensiveData.recent_trend.difference > 0
                        ? `Your recent games are ${Math.abs(comprehensiveData.recent_trend.difference).toFixed(1)} moves longer than usual`
                        : `Your recent games are ${Math.abs(comprehensiveData.recent_trend.difference).toFixed(1)} moves shorter than usual`
                      }
                    </p>
                  )}
                </div>
              )}

              {/* Performance Highlights Section */}
              {(comprehensiveData?.personal_records || comprehensiveData?.comeback_potential) && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Personal Records */}
                    {comprehensiveData?.personal_records && (
                      <div className="lg:col-span-2">
                        <h5 className="mb-3 text-sm font-semibold text-emerald-200">Personal Records</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                          {comprehensiveData.personal_records.fastest_win && (
                            <div
                              className={`${subtleCardClass} cursor-pointer hover:bg-white/15 transition-colors`}
                              onClick={() => {
                                const gameId = comprehensiveData.personal_records.fastest_win.game_id
                                if (gameId) {
                                  navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                                }
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="text-sm sm:text-xs text-slate-400">Fastest Win</span>
                                <span className="text-2xl sm:text-lg font-semibold text-emerald-300">{comprehensiveData.personal_records.fastest_win.moves} <span className="text-base sm:text-sm">moves</span></span>
                              </div>
                            </div>
                          )}
                          {comprehensiveData.personal_records.highest_accuracy_win && (
                            <div
                              className={`${subtleCardClass} cursor-pointer hover:bg-white/15 transition-colors`}
                              onClick={() => {
                                const gameId = comprehensiveData.personal_records.highest_accuracy_win.game_id
                                if (gameId) {
                                  navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                                }
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="text-sm sm:text-xs text-slate-400">Most Accurate Win</span>
                                <span className="text-2xl sm:text-lg font-semibold text-sky-300">{formatPercent(comprehensiveData.personal_records.highest_accuracy_win.accuracy, 1)}%</span>
                              </div>
                            </div>
                          )}
                          {comprehensiveData.personal_records.longest_game && (
                            <div
                              className={`${subtleCardClass} cursor-pointer hover:bg-white/15 transition-colors`}
                              onClick={() => {
                                const gameId = comprehensiveData.personal_records.longest_game.game_id
                                if (gameId) {
                                  navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                                }
                              }}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                <span className="text-sm sm:text-xs text-slate-400">Longest Game</span>
                                <span className="text-2xl sm:text-lg font-semibold text-purple-300">{comprehensiveData.personal_records.longest_game.moves} <span className="text-base sm:text-sm">moves</span></span>
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
              {comprehensiveData?.resignation_timing && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h4 className="mb-3 text-sm font-semibold text-rose-200">Resignation Timing</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="block text-xs text-slate-400 mb-1">Last 50 Games</span>
                      <div className="text-2xl sm:text-xl font-semibold text-sky-300">{formatPercent(comprehensiveData.resignation_timing.recent_average_resignation_move || 0, 1)} <span className="text-base sm:text-sm">moves</span></div>
                      {comprehensiveData.resignation_timing.insight && (
                        <div className="text-sm text-slate-400 mt-2 flex items-center gap-1">
                          <span>{comprehensiveData.resignation_timing.insight}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 mb-1">Baseline</span>
                      <div className="text-2xl sm:text-xl font-semibold text-slate-300">{formatPercent(comprehensiveData.resignation_timing.my_average_resignation_move || 0, 1)} <span className="text-base sm:text-sm">moves</span></div>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-400 mb-1">Change</span>
                      <div className={`text-2xl sm:text-xl font-semibold ${
                        comprehensiveData.resignation_timing.change && comprehensiveData.resignation_timing.change > 0
                          ? 'text-amber-300'
                          : comprehensiveData.resignation_timing.change && comprehensiveData.resignation_timing.change < 0
                            ? 'text-emerald-300'
                            : 'text-slate-300'
                      }`}>
                        {comprehensiveData.resignation_timing.change && comprehensiveData.resignation_timing.change > 0 ? '+' : ''}{comprehensiveData.resignation_timing.change || 0}
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
            className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className={subtleCardClass}>
            <div className="flex justify-between text-sm text-slate-200">
              <span className="text-slate-400">Opening Accuracy</span>
              <span className="font-semibold">{safeData.average_opening_accuracy || 'N/A'}%</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-slate-200">
              <span className="text-slate-400">Middle Game Accuracy</span>
              <span className="font-semibold">{safeData.average_middle_game_accuracy || 'N/A'}%</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-slate-200">
              <span className="text-slate-400">Endgame Accuracy</span>
              <span className="font-semibold">{safeData.average_endgame_accuracy || 'N/A'}%</span>
            </div>
          </div>
          <div className={subtleCardClass}>
            <div className="flex justify-between text-sm text-slate-200">
              <span className="text-slate-400">Blunders per Game</span>
              <span className={`font-semibold ${CHESS_ANALYSIS_COLORS.blunders}`}>{safeData.blunders_per_game}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-slate-200">
              <span className="text-slate-400">Inaccuracies per Game</span>
              <span className={`font-semibold ${CHESS_ANALYSIS_COLORS.inaccuracies}`}>{safeData.inaccuracies_per_game}</span>
            </div>
            <div className="mt-2 flex justify-between text-sm text-slate-200">
              <span className="text-slate-400">Brilliant Moves per Game</span>
              <span className={`font-semibold ${CHESS_ANALYSIS_COLORS.brilliants}`}>{safeData.brilliant_moves_per_game}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
