// Simple Analytics Component - One component, everything you need
import { useState, useEffect, useMemo, useCallback, useRef, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import { UnifiedAnalysisService, AnalysisStats, DeepAnalysisData } from '../../services/unifiedAnalysisService'
import type { ComprehensiveAnalytics } from '../../types'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { calculateAverageAccuracy } from '../../utils/accuracyCalculator'
import { normalizeOpeningName } from '../../utils/openingUtils'
import { getOpeningColor } from '../../utils/openingColorClassification'
import { PersonalityRadar } from '../deep/PersonalityRadar'
import { LongTermPlanner } from '../deep/LongTermPlanner'
import { EnhancedOpeningPlayerCard } from '../deep/EnhancedOpeningPlayerCard'
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

interface AnalyticsDataState {
  data: AnalysisStats | null
  comprehensiveData: ComprehensiveAnalytics | null
  deepAnalysisData: DeepAnalysisData | null
  loading: boolean
  refreshing: boolean
  error: string | null
}

type AnalyticsAction =
  | { type: 'FETCH_START'; isRefresh: boolean }
  | { type: 'FETCH_SUCCESS'; data: AnalysisStats; comprehensiveData: ComprehensiveAnalytics }
  | { type: 'DEEP_ANALYSIS_SUCCESS'; deepAnalysisData: DeepAnalysisData }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'FETCH_DONE' }
  | { type: 'RESET' }

const initialAnalyticsState: AnalyticsDataState = {
  data: null,
  comprehensiveData: null,
  deepAnalysisData: null,
  loading: true,
  refreshing: false,
  error: null,
}

function analyticsReducer(state: AnalyticsDataState, action: AnalyticsAction): AnalyticsDataState {
  switch (action.type) {
    case 'FETCH_START':
      return {
        ...state,
        error: null,
        loading: !action.isRefresh,
        refreshing: action.isRefresh,
      }
    case 'FETCH_SUCCESS':
      return {
        ...state,
        data: action.data,
        comprehensiveData: action.comprehensiveData,
      }
    case 'DEEP_ANALYSIS_SUCCESS':
      return { ...state, deepAnalysisData: action.deepAnalysisData }
    case 'FETCH_ERROR':
      return { ...state, error: action.error }
    case 'FETCH_DONE':
      return { ...state, loading: false, refreshing: false }
    case 'RESET':
      return { ...initialAnalyticsState, loading: false }
    default:
      return state
  }
}

export function SimpleAnalytics({ userId, platform, fromDate, toDate, onOpeningClick, onOpponentClick, forceRefresh = false, viewMode = 'single', secondaryUserId, secondaryPlatform }: SimpleAnalyticsProps) {
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(analyticsReducer, initialAnalyticsState)
  const { data, comprehensiveData, deepAnalysisData, loading, error, refreshing } = state
  const [selectedTimeControl, setSelectedTimeControl] = useState<string | null>(null)
  const [eloGraphGamesUsed, setEloGraphGamesUsed] = useState<number>(0)
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
  // Deep analysis is excluded - it's fetched separately in the background.
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
      dispatch({ type: 'FETCH_START', isRefresh: forceRefresh })

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

      // Treat analysisResult as missing if total_games_analyzed is 0 (backend returns
      // all-zeros AnalysisStats object when no Stockfish data exists, which is truthy)
      const hasRealAnalysis = analysisResult && analysisResult.total_games_analyzed > 0
      const enhancedData = hasRealAnalysis ? {
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

      dispatch({
        type: 'FETCH_SUCCESS',
        data: enhancedData,
        comprehensiveData: {
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
        } as ComprehensiveAnalytics,
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

      // Fetch deep analysis in background (5-7s) - don't block page render
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
          dispatch({ type: 'DEEP_ANALYSIS_SUCCESS', deepAnalysisData: deepAnalysis })
        } catch (err) {
          console.warn('Deep analysis failed (non-fatal):', err)
        }
      }
      fetchDeep()
    } catch (err) {
      console.error('Failed to load analytics:', err)
      dispatch({ type: 'FETCH_ERROR', error: err instanceof Error ? err.message : 'Failed to load analytics' })
    } finally {
      dispatch({ type: 'FETCH_DONE' })
      isLoadingRef.current = false
    }
  }, [userId, platform, fromDate, toDate, viewMode, secondaryUserId, secondaryPlatform, fetchPlatformData])

  useEffect(() => {
    if (!userId) {
      dispatch({ type: 'RESET' })
      return
    }
    loadData()
  }, [userId, platform, fromDate, toDate, viewMode, secondaryUserId, secondaryPlatform, loadData])

  // Derive most played opening from comprehensive data (no separate query needed)
  const mostPlayedOpening = useMemo(() => {
    if (!comprehensiveData?.openingStats?.length || !selectedTimeControl) return null
    const mostPlayed = comprehensiveData.openingStats[0]
    return { opening: mostPlayed.opening, games: mostPlayed.games }
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

  const cardClass = 'rounded-lg bg-surface-1 shadow-card'
  const subtleCardClass = 'rounded-lg bg-white/[0.02] p-3'

  // Helper: section break divider
  const SectionBreak = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 mt-7 mb-[18px]">
      <div className="flex-1 h-px bg-white/[0.04]" />
      <span className="text-[11px] uppercase tracking-[0.1em] text-[#2a3040] whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  )

  return (
    <div className="space-y-[10px] text-gray-300" data-testid="analytics-container">
      {/* Warnings - kept minimal */}
      {isMockData && (
        <div className={`${cardClass} p-4`}>
          <p className="text-xs text-amber-400/80">Demo data shown — no analysis has been performed yet.</p>
        </div>
      )}

      {safeData.validation_issues && safeData.validation_issues.length > 0 && (
        <div className={`${cardClass} p-4`}>
          <p className="text-xs text-orange-400/80">ELO data quality issues detected — some ratings may be inaccurate.</p>
        </div>
      )}

      {/* Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[10px]">
        <div className={`${cardClass} px-[18px] py-4`}>
          <div className="text-[11px] uppercase tracking-[0.07em] text-[#3a4250] mb-1.5">Games Analyzed</div>
          <div className="text-[26px] font-medium tracking-tight text-[#e4e8ed] leading-none">{safeData.total_games_analyzed}</div>
          <div className="text-[11px] text-[#3a4250] mt-1">of {safeComprehensive?.totalGames?.toLocaleString() || '—'} total</div>
        </div>
        <div className={`${cardClass} px-[18px] py-4`}>
          <div className="text-[11px] uppercase tracking-[0.07em] text-[#3a4250] mb-1.5">Avg Accuracy</div>
          <div className="text-[26px] font-medium tracking-tight text-[#e4e8ed] leading-none">{safeData.average_accuracy}%</div>
          <div className="text-[11px] text-[#3a4250] mt-1">across analyzed games</div>
        </div>
        <div className={`${cardClass} px-[18px] py-4`}>
          <div className="text-[11px] uppercase tracking-[0.07em] text-[#3a4250] mb-1.5">Peak Rating</div>
          <div className="text-[26px] font-medium tracking-tight text-[#e4e8ed] leading-none">{safeComprehensive?.highestElo?.toLocaleString() || 'N/A'}</div>
          <div className="text-[11px] text-[#3a4250] mt-1">{safeComprehensive?.timeControlWithHighestElo ? getTimeControlCategory(safeComprehensive.timeControlWithHighestElo) : ''} all-time high</div>
        </div>
        <div className={`${cardClass} px-[18px] py-4`}>
          <div className="text-[11px] uppercase tracking-[0.07em] text-[#3a4250] mb-1.5">Time Control</div>
          <div className="text-[26px] font-medium tracking-tight text-[#e4e8ed] leading-none">
            {safeComprehensive?.timeControlWithHighestElo ? getTimeControlCategory(safeComprehensive.timeControlWithHighestElo) : safeData.most_played_time_control ? getTimeControlCategory(safeData.most_played_time_control) : '—'}
          </div>
          <div className="text-[11px] text-[#3a4250] mt-1">highest rated</div>
        </div>
      </div>

      {/* Backend Analysis Status */}
      {!data && safeComprehensive && safeComprehensive.totalGames > 0 && (
        <div className={`${cardClass} p-4`}>
          <p className="text-xs text-sky-400/80">Analysis in progress — comprehensive stats available below.</p>
        </div>
      )}

      {/* Comprehensive Analytics Section */}
      {safeComprehensive && safeComprehensive.totalGames > 0 && (
        <div className="space-y-[10px]">
          {/* Results + Color - 2 column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">

            {/* Overall Results (WDL) */}
            <div className={`${cardClass} p-[18px_20px]`}>
              <div className="flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">
                <span>Overall Results</span>
                <span className="text-[11px] font-normal normal-case tracking-normal text-[#3a4250]">{safeComprehensive.totalGames.toLocaleString()} games</span>
              </div>
              {/* WDL bar */}
              <div className="flex gap-0.5 h-1 rounded-sm overflow-hidden mb-3.5">
                <div className="bg-green-500 rounded-sm" style={{ width: `${safeComprehensive.winRate}%` }} />
                <div className="bg-[#4a5260] rounded-sm" style={{ width: `${safeComprehensive.drawRate}%` }} />
                <div className="bg-red-500 rounded-sm" style={{ width: `${safeComprehensive.lossRate}%` }} />
              </div>
              <div className="flex">
                <div className="flex-1">
                  <div className="text-[11px] text-[#3a4250] mb-0.5">Win</div>
                  <div className="text-[22px] font-medium tracking-tight leading-none text-emerald-400">{formatPercent(safeComprehensive.winRate, 1)}%</div>
                  <div className="text-[11px] text-[#3a4250] mt-0.5">{Math.round(safeComprehensive.totalGames * safeComprehensive.winRate / 100).toLocaleString()} games</div>
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-[#3a4250] mb-0.5">Draw</div>
                  <div className="text-[22px] font-medium tracking-tight leading-none text-[#5a6270]">{formatPercent(safeComprehensive.drawRate, 1)}%</div>
                  <div className="text-[11px] text-[#3a4250] mt-0.5">{Math.round(safeComprehensive.totalGames * safeComprehensive.drawRate / 100).toLocaleString()} games</div>
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-[#3a4250] mb-0.5">Loss</div>
                  <div className="text-[22px] font-medium tracking-tight leading-none text-red-400">{formatPercent(safeComprehensive.lossRate, 1)}%</div>
                  <div className="text-[11px] text-[#3a4250] mt-0.5">{Math.round(safeComprehensive.totalGames * safeComprehensive.lossRate / 100).toLocaleString()} games</div>
                </div>
              </div>
            </div>

            {/* Color Performance */}
            <div className={`${cardClass} p-[18px_20px]`}>
              <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">Color Performance</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.02] rounded-[7px] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#5a6270] mb-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#c8cdd4] shrink-0" />White
                  </div>
                  <div className="flex justify-between items-center mb-1"><span className="text-xs text-[#4a5260]">Games</span><span className="text-[13px] font-medium text-[#c8cdd4]">{safeColorStats.white.games.toLocaleString()}</span></div>
                  <div className="flex justify-between items-center mb-1"><span className="text-xs text-[#4a5260]">Win rate</span><span className="text-[13px] font-medium text-emerald-400">{formatPercent(safeColorStats.white.winRate, 1)}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-xs text-[#4a5260]">Avg ELO</span><span className="text-[13px] font-medium text-[#c8cdd4]">{formatPercent(safeColorStats.white.averageElo, 0)}</span></div>
                </div>
                <div className="bg-white/[0.02] rounded-[7px] p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#5a6270] mb-2.5">
                    <span className="w-2 h-2 rounded-full border-[1.5px] border-[#4a5260] shrink-0" />Black
                  </div>
                  <div className="flex justify-between items-center mb-1"><span className="text-xs text-[#4a5260]">Games</span><span className="text-[13px] font-medium text-[#c8cdd4]">{safeColorStats.black.games.toLocaleString()}</span></div>
                  <div className="flex justify-between items-center mb-1"><span className="text-xs text-[#4a5260]">Win rate</span><span className="text-[13px] font-medium text-emerald-400">{formatPercent(safeColorStats.black.winRate, 1)}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-xs text-[#4a5260]">Avg ELO</span><span className="text-[13px] font-medium text-[#c8cdd4]">{formatPercent(safeColorStats.black.averageElo, 0)}</span></div>
                </div>
              </div>
            </div>

          </div>

          {/* Opening Performance - Winning vs Losing */}
          <div className={`${cardClass} p-[18px_20px]`}>
            <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">Opening Performance</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              {/* Winning Openings */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-[#3a4250] mb-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />Winning Openings
                </div>
                {safeOpeningStats && safeOpeningStats.filter((stat: any) => stat.winRate >= 50).length > 0 ? (
                  safeOpeningStats.filter((stat: any) => stat.winRate >= 50).slice(0, 3).map((stat: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-[9px] border-b border-white/[0.04] last:border-b-0 last:pb-0 cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors"
                      onClick={() =>
                        onOpeningClick?.(
                          buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, {
                            openingFamily: stat.openingFamily,
                            opening: stat.opening,
                          })
                        )
                      }
                    >
                      <div>
                        <div className="text-[13px] text-[#8a9299]">{normalizeOpeningName(stat.opening)}</div>
                        <div className="text-[11px] text-[#3a4250]">Avg ELO {formatPercent(stat.averageElo, 0)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-400/[0.08] text-emerald-400">{formatPercent(stat.winRate, 1)}%</span>
                        <div className="text-[11px] text-[#3a4250] mt-0.5">{stat.games} games</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#3a4250] py-4">No winning openings yet</p>
                )}
              </div>
              {/* Losing Openings */}
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-[#3a4250] mb-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />Losing Openings
                </div>
                {safeOpeningStats && safeOpeningStats.filter((stat: any) => stat.winRate < 50).length > 0 ? (
                  safeOpeningStats.filter((stat: any) => stat.winRate < 50).sort((a: any, b: any) => b.games - a.games).slice(0, 3).map((stat: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-[9px] border-b border-white/[0.04] last:border-b-0 last:pb-0 cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors"
                      onClick={() =>
                        onOpeningClick?.(
                          buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, {
                            openingFamily: stat.openingFamily,
                            opening: stat.opening,
                          })
                        )
                      }
                    >
                      <div>
                        <div className="text-[13px] text-[#8a9299]">{normalizeOpeningName(stat.opening)}</div>
                        <div className="text-[11px] text-[#3a4250]">Avg ELO {formatPercent(stat.averageElo, 0)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-400/[0.08] text-red-400">{formatPercent(stat.winRate, 1)}%</span>
                        <div className="text-[11px] text-[#3a4250] mt-0.5">{stat.games} games</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#3a4250] py-4">All openings above 50% win rate</p>
                )}
              </div>
            </div>
          </div>

          {/* Opening Performance by Color */}
          <div className={`${cardClass} p-[18px_20px]`}>
            <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">Opening Performance by Color</div>
            {safeOpeningColorStats &&
             (safeOpeningColorStats.white.length > 0 || safeOpeningColorStats.black.length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                {/* White */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-[#3a4250] mb-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#c8cdd4] shrink-0" />Most Played as White
                  </div>
                  {safeOpeningColorStats.white.slice(0, 3).map((stat: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-[9px] border-b border-white/[0.04] last:border-b-0 last:pb-0 cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors"
                      onClick={() =>
                        onOpeningClick?.(
                          buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, undefined, 'white')
                        )
                      }
                    >
                      <div>
                        <div className="text-[13px] text-[#8a9299]">{stat.opening}</div>
                        <div className="text-[11px] text-[#3a4250]">{stat.games} games &middot; {stat.wins}W-{stat.losses}L-{stat.draws}D</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${
                        stat.winRate >= 60 ? 'bg-emerald-400/[0.08] text-emerald-400' :
                        stat.winRate >= 50 ? 'bg-amber-400/[0.08] text-amber-400' :
                        'bg-red-400/[0.08] text-red-400'
                      }`}>{formatPercent(stat.winRate, 1)}%</span>
                    </div>
                  ))}
                  {safeOpeningColorStats.white.length === 0 && (
                    <p className="text-xs text-[#3a4250] py-4">No white opening data</p>
                  )}
                </div>
                {/* Black */}
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.07em] text-[#3a4250] mb-2.5">
                    <span className="w-2 h-2 rounded-full border-[1.5px] border-[#4a5260] shrink-0" />Most Played as Black
                  </div>
                  {safeOpeningColorStats.black.slice(0, 3).map((stat: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-[9px] border-b border-white/[0.04] last:border-b-0 last:pb-0 cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors"
                      onClick={() =>
                        onOpeningClick?.(
                          buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers, undefined, 'black')
                        )
                      }
                    >
                      <div>
                        <div className="text-[13px] text-[#8a9299]">{stat.opening}</div>
                        <div className="text-[11px] text-[#3a4250]">{stat.games} games &middot; {stat.wins}W-{stat.losses}L-{stat.draws}D</div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 ${
                        stat.winRate >= 60 ? 'bg-emerald-400/[0.08] text-emerald-400' :
                        stat.winRate >= 50 ? 'bg-amber-400/[0.08] text-amber-400' :
                        'bg-red-400/[0.08] text-red-400'
                      }`}>{formatPercent(stat.winRate, 1)}%</span>
                    </div>
                  ))}
                  {safeOpeningColorStats.black.length === 0 && (
                    <p className="text-xs text-[#3a4250] py-4">No black opening data</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#3a4250] py-4">No opening data available</p>
            )}
          </div>

          {/* Section Break: Recent Performance */}
          <SectionBreak label="Recent Performance" />

          {/* Recent Performance - 1fr 2fr grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-[10px]">
            {/* Left stats column */}
            <div className="flex flex-col gap-2">
              <div className="bg-white/[0.02] rounded-[7px] p-3">
                <div className="text-[11px] uppercase tracking-[0.06em] text-[#3a4250] mb-1">Recent Win Rate</div>
                <div className="text-[20px] font-medium tracking-tight text-emerald-400 leading-none">
                  {activePerformance ? formatPercent(activePerformance.recentWinRate, 1) : '--'}%
                  <span className="text-xs font-normal text-[#4a5260] ml-1">{activePerformance?.timeControlUsed || ''}</span>
                </div>
                <div className="text-[11px] text-[#3a4250] mt-0.5">{activePerformance?.sampleSize || 0} games</div>
              </div>
              <div className="bg-white/[0.02] rounded-[7px] p-3">
                <div className="text-[11px] uppercase tracking-[0.06em] text-[#3a4250] mb-1">Current Rating</div>
                <div className="text-[20px] font-medium tracking-tight text-[#e4e8ed] leading-none">
                  {selectedTimeControl && comprehensiveData?.currentEloPerTimeControl?.[selectedTimeControl]
                    ? safeComprehensive.currentEloPerTimeControl[selectedTimeControl]?.toLocaleString()
                    : (comprehensiveData?.currentElo?.toLocaleString() || '--')}
                  <span className="text-xs font-normal text-[#4a5260] ml-1">{activePerformance?.timeControlUsed || ''}</span>
                </div>
                <div className="text-[11px] text-[#3a4250] mt-0.5">
                  {activePerformance ? `Avg ${formatPercent(activePerformance.recentAverageElo, 0)} · last ${activePerformance.sampleSize} games` : ''}
                </div>
              </div>
              <div className="bg-white/[0.02] rounded-[7px] p-3">
                <div className="text-[11px] uppercase tracking-[0.06em] text-[#3a4250] mb-1">Most Played Opening</div>
                {mostPlayedOpening ? (
                  <>
                    <div className="text-[15px] font-medium text-[#8a9299] underline decoration-white/10 underline-offset-2 break-words leading-tight">
                      {normalizeOpeningName(mostPlayedOpening.opening)}
                    </div>
                    <div className="text-[11px] text-[#3a4250] mt-0.5">{mostPlayedOpening.games} games · {selectedTimeControl || 'all'}</div>
                  </>
                ) : (
                  <div className="text-[13px] text-[#3a4250]">No data</div>
                )}
              </div>
              <div className="bg-white/[0.02] rounded-[7px] p-3">
                <div className="text-[11px] uppercase tracking-[0.06em] text-[#3a4250] mb-1">Rating Trend</div>
                <div className="text-[20px] font-medium tracking-tight leading-none">
                  {(() => {
                    const trend = activePerformance?.eloTrend || 'stable'
                    const label = trend.charAt(0).toUpperCase() + trend.slice(1)
                    const color = trend === 'improving' ? 'text-emerald-400' : trend === 'declining' ? 'text-red-400' : 'text-[#e4e8ed]'
                    return <span className={color}>{label}</span>
                  })()}
                </div>
                <div className="text-[11px] text-[#3a4250] mt-0.5">
                  {activePerformance ? `${activePerformance.sampleSize} games · ${activePerformance.timeControlUsed || 'all'}` : ''}
                </div>
              </div>
            </div>

            {/* ELO Trend Chart */}
            <div className={`${cardClass} p-[18px_20px]`}>
              {viewMode === 'combined' && secondaryUserId && secondaryPlatform ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-1">
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
                    <div className="text-xs font-medium text-amber-400 uppercase tracking-wide mb-1">
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

          {/* Time Spent - Standalone Card */}
          {comprehensiveData?.games && userId && platform && (
            <div className={`${cardClass} p-[18px_20px]`}>
              <TimeSpentSummary
                userId={userId}
                platform={platform as 'lichess' | 'chess.com'}
                fallbackGames={comprehensiveData.games}
              />
            </div>
          )}

          {/* Enhanced Opponent Analysis */}
          {comprehensiveData?.opponentStats && (
            <EnhancedOpponentAnalysis
              userId={userId}
              opponentStats={safeOpponentStats}
              platform={(platform as 'lichess' | 'chess.com') || 'lichess'}
              onOpponentClick={onOpponentClick}
            />
          )}

          {/* Enhanced Game Length Insights */}
          {(safeComprehensive?.gameLengthStats || safeComprehensive?.marathonPerformance || safeComprehensive?.recentTrend || safeComprehensive?.personalRecords || safeComprehensive?.resignationTiming) && (
            <div className={`${cardClass} p-[18px_20px]`}>
              <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">Enhanced Game Length Insights</div>

              {/* Marathon Performance */}
              {safeComprehensive?.marathonPerformance && safeComprehensive.marathonPerformance.count > 0 && (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#5a6270] mb-2.5">
                    <span className="text-[10px] px-[7px] py-px rounded-[3px] bg-white/[0.05] text-[#4a5260] tracking-[0.04em]">Marathon</span>
                    Games 80+ moves
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-white/[0.02] rounded-[7px] p-2.5">
                      <div className="text-[11px] text-[#3a4250] mb-0.5">Games</div>
                      <div className="text-[17px] font-medium tracking-tight text-[#c8cdd4]">{safeComprehensive.marathonPerformance.count}</div>
                    </div>
                    {safeComprehensive.marathonPerformance.average_accuracy != null && (
                      <div className="bg-white/[0.02] rounded-[7px] p-2.5">
                        <div className="text-[11px] text-[#3a4250] mb-0.5">Avg Accuracy</div>
                        <div className="text-[17px] font-medium tracking-tight text-emerald-400">
                          {formatPercent(safeComprehensive.marathonPerformance.average_accuracy, 1)}%
                          {safeComprehensive.marathonPerformance.analyzed_count && safeComprehensive.marathonPerformance.analyzed_count < safeComprehensive.marathonPerformance.count && (
                            <span className="text-[11px] font-normal text-[#4a5260]"> ({safeComprehensive.marathonPerformance.analyzed_count} analyzed)</span>
                          )}
                        </div>
                      </div>
                    )}
                    {safeComprehensive.marathonPerformance.average_blunders != null && (
                      <div className="bg-white/[0.02] rounded-[7px] p-2.5">
                        <div className="text-[11px] text-[#3a4250] mb-0.5">Avg Blunders</div>
                        <div className="text-[17px] font-medium tracking-tight text-red-400">
                          {formatPercent(safeComprehensive.marathonPerformance.average_blunders, 1)}
                          {safeComprehensive.marathonPerformance.analyzed_count && safeComprehensive.marathonPerformance.analyzed_count < safeComprehensive.marathonPerformance.count && (
                            <span className="text-[11px] font-normal text-[#4a5260]"> ({safeComprehensive.marathonPerformance.analyzed_count} analyzed)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Recent Trend */}
              {safeComprehensive?.recentTrend && safeComprehensive.recentTrend.recent_average_moves && (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#5a6270] mb-2.5">
                    <span className="text-[10px] px-[7px] py-px rounded-[3px] bg-white/[0.05] text-[#4a5260] tracking-[0.04em]">Recent Trend</span>
                    Game length
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div>
                      <div className="text-[11px] text-[#3a4250] mb-0.5">Last 100 games</div>
                      <div className="text-[15px] font-medium text-[#c8cdd4]">{formatPercent(safeComprehensive.recentTrend.recent_average_moves, 1)} <span className="text-[11px] font-normal text-[#4a5260]">moves</span></div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#3a4250] mb-0.5">Baseline</div>
                      <div className="text-[15px] font-medium text-[#c8cdd4]">{formatPercent(safeComprehensive.recentTrend.baseline_average_moves, 1)} <span className="text-[11px] font-normal text-[#4a5260]">moves</span></div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#3a4250] mb-0.5">Change</div>
                      <div className={`text-[15px] font-medium ${safeComprehensive.recentTrend.difference < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {safeComprehensive.recentTrend.difference > 0 ? '+' : safeComprehensive.recentTrend.difference < 0 ? '\u2212' : ''}{Math.abs(safeComprehensive.recentTrend.difference).toFixed(1)} <span className="text-[11px] font-normal text-[#4a5260]">moves</span>
                      </div>
                      {safeComprehensive.recentTrend.difference !== 0 && (
                        <div className="text-[11px] text-[#3a4250] italic mt-0.5">
                          Games are {Math.abs(safeComprehensive.recentTrend.difference).toFixed(1)} moves {safeComprehensive.recentTrend.difference > 0 ? 'longer' : 'shorter'} than usual
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Personal Records */}
              {safeComprehensive?.personalRecords && (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#5a6270] mb-2.5">
                    <span className="text-[10px] px-[7px] py-px rounded-[3px] bg-white/[0.05] text-[#4a5260] tracking-[0.04em]">Personal Records</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {comprehensiveData.personal_records?.fastest_win && comprehensiveData.personal_records.fastest_win.moves > 0 && (
                      <div
                        className="bg-white/[0.02] rounded-[7px] p-2.5 text-center cursor-pointer hover:bg-white/[0.04] transition-colors"
                        onClick={() => {
                          const gameId = safeComprehensive.personalRecords.fastest_win.game_id
                          if (gameId) navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                        }}
                      >
                        <div className="text-[11px] text-[#3a4250] mb-1">Fastest Win</div>
                        <div className="text-[18px] font-medium tracking-tight text-[#c8cdd4]">{safeComprehensive.personalRecords.fastest_win.moves} <span className="text-[11px] font-normal text-[#4a5260]">moves</span></div>
                      </div>
                    )}
                    {safeComprehensive.personalRecords.highest_accuracy_win && (
                      <div
                        className="bg-white/[0.02] rounded-[7px] p-2.5 text-center cursor-pointer hover:bg-white/[0.04] transition-colors"
                        onClick={() => {
                          const gameId = safeComprehensive.personalRecords.highest_accuracy_win.game_id
                          if (gameId) navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                        }}
                      >
                        <div className="text-[11px] text-[#3a4250] mb-1">Most Accurate Win</div>
                        <div className="text-[18px] font-medium tracking-tight text-emerald-400">{formatPercent(safeComprehensive.personalRecords.highest_accuracy_win.accuracy, 1)}%</div>
                      </div>
                    )}
                    {comprehensiveData.personal_records?.longest_game && comprehensiveData.personal_records.longest_game.moves > 0 && (
                      <div
                        className="bg-white/[0.02] rounded-[7px] p-2.5 text-center cursor-pointer hover:bg-white/[0.04] transition-colors"
                        onClick={() => {
                          const gameId = safeComprehensive.personalRecords.longest_game.game_id
                          if (gameId) navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}`)
                        }}
                      >
                        <div className="text-[11px] text-[#3a4250] mb-1">Longest Game</div>
                        <div className="text-[18px] font-medium tracking-tight text-[#c8cdd4]">{safeComprehensive.personalRecords.longest_game.moves} <span className="text-[11px] font-normal text-[#4a5260]">moves</span></div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Resignation Timing */}
              {comprehensiveData?.resignation_timing && comprehensiveData.resignation_timing.my_average_resignation_move != null && (
                <>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-[#5a6270] mb-2.5">
                    <span className="text-[10px] px-[7px] py-px rounded-[3px] bg-white/[0.05] text-[#4a5260] tracking-[0.04em]">Resignation Timing</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] text-[#3a4250] mb-0.5">Last 50 games</div>
                      <div className="text-[15px] font-medium text-[#c8cdd4]">
                        {comprehensiveData.resignation_timing.recent_average_resignation_move != null
                          ? <>{formatPercent(comprehensiveData.resignation_timing.recent_average_resignation_move, 1)} <span className="text-[11px] font-normal text-[#4a5260]">moves</span></>
                          : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#3a4250] mb-0.5">Baseline</div>
                      <div className="text-[15px] font-medium text-[#c8cdd4]">{formatPercent(comprehensiveData.resignation_timing.my_average_resignation_move, 1)} <span className="text-[11px] font-normal text-[#4a5260]">moves</span></div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#3a4250] mb-0.5">Change</div>
                      <div className={`text-[15px] font-medium ${
                        comprehensiveData.resignation_timing.change != null && comprehensiveData.resignation_timing.change < 0
                          ? 'text-red-400'
                          : comprehensiveData.resignation_timing.change != null && comprehensiveData.resignation_timing.change > 0
                            ? 'text-emerald-400'
                            : 'text-[#c8cdd4]'
                      }`}>
                        {comprehensiveData.resignation_timing.change != null
                          ? <>{comprehensiveData.resignation_timing.change > 0 ? '+' : comprehensiveData.resignation_timing.change < 0 ? '\u2212' : ''}{Math.abs(comprehensiveData.resignation_timing.change).toFixed(1)} <span className="text-[11px] font-normal text-[#4a5260]">moves</span></>
                          : 'N/A'}
                      </div>
                      {comprehensiveData.resignation_timing.insight && (
                        <div className="text-[11px] text-[#3a4250] italic mt-0.5">{safeComprehensive.resignationTiming?.insight}</div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Deep Analysis Section */}
      {deepAnalysisData && (
        <>
          {/* Section Break: Style & Personality */}
          <SectionBreak label="Style & Personality" />

          {/* Game Style (LongTermPlanner) */}
          <LongTermPlanner data={deepAnalysisData} userId={userId} />

          {/* Personality Radar + Player Match */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-[10px]">
            {deepAnalysisData.personality_scores && (
              <div className={`${cardClass} p-[18px_20px]`}>
                <PersonalityRadar scores={deepAnalysisData.personality_scores} />
              </div>
            )}
            <div className={`${cardClass} p-[18px_20px]`}>
              <div className="text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">Player with Similar Style</div>
              {deepAnalysisData.famous_players?.primary ? (
                <>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#4a5260] shrink-0" />
                      <span className="text-[15px] font-medium text-[#c8cdd4]">{deepAnalysisData.famous_players.primary.name}</span>
                    </div>
                    {deepAnalysisData.famous_players.primary.similarity_score && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-400/[0.08] text-emerald-400">
                        {deepAnalysisData.famous_players.primary.similarity_score.toFixed(0)}% match
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#4a5260] mb-0.5">{deepAnalysisData.famous_players.primary.description}</div>
                  <div className="text-[11px] uppercase tracking-[0.07em] text-[#3a4250] mb-3">Era: {deepAnalysisData.famous_players.primary.era}</div>
                  {/* Data-driven insights */}
                  {deepAnalysisData.famous_players.primary.trait_similarities && deepAnalysisData.personality_scores && (() => {
                    const ts = deepAnalysisData.famous_players!.primary!.trait_similarities!
                    const ps = deepAnalysisData.personality_scores!
                    const name = deepAnalysisData.famous_players!.primary!.name
                    const traits = (['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness'] as const)
                      .map(t => ({
                        trait: t,
                        yours: Math.round(ps[t] ?? 0),
                        theirs: Math.round(ts[t]),
                        match: Math.round(Math.max(0, 100 - Math.abs((ps[t] ?? 0) - ts[t]) * 2))
                      }))
                      .filter(t => t.theirs != null)
                    const closest = [...traits].sort((a, b) => b.match - a.match)[0]
                    const furthest = [...traits].sort((a, b) => a.match - b.match)[0]
                    const strongestShared = [...traits].filter(t => t.yours >= 70 && t.theirs >= 70).sort((a, b) => b.yours - a.yours)[0]
                    const insights: string[] = []
                    if (closest) {
                      insights.push(`Your ${closest.trait} (${closest.yours}) closely mirrors ${name}'s ${closest.theirs} — ${closest.match}% match`)
                    }
                    if (strongestShared && strongestShared.trait !== closest?.trait) {
                      insights.push(`You both share strong ${strongestShared.trait} play (yours: ${strongestShared.yours}, ${name}: ${strongestShared.theirs})`)
                    }
                    if (furthest && furthest.match < 70) {
                      insights.push(`Biggest gap in ${furthest.trait}: yours ${furthest.yours} vs ${name}'s ${furthest.theirs} (${furthest.match}% match)`)
                    }
                    return insights.length > 0 ? (
                      <ul className="flex flex-col gap-1.5 mb-3">
                        {insights.map((line, i) => (
                          <li key={i} className="text-xs text-[#4a5260] flex gap-2 leading-relaxed">
                            <span className="text-[#2a3040] shrink-0">-</span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null
                  })()}
                  {/* Trait Similarity Breakdown */}
                  {deepAnalysisData.famous_players.primary.trait_similarities && deepAnalysisData.personality_scores && (
                    <div className="mt-4 mb-3">
                      <div className="text-[11px] uppercase tracking-[0.07em] text-[#3a4250] mb-2.5">Trait Comparison</div>
                      <div className="flex flex-col gap-2">
                        {(['tactical', 'positional', 'aggressive', 'patient', 'novelty', 'staleness'] as const).map((trait) => {
                          const playerScore = Math.round(deepAnalysisData.personality_scores?.[trait] ?? 0)
                          const famousScore = Math.round(deepAnalysisData.famous_players!.primary!.trait_similarities![trait])
                          if (famousScore == null) return null
                          const diff = Math.abs(playerScore - famousScore)
                          const matchPct = Math.round(Math.max(0, 100 - diff * 2))
                          return (
                            <div key={trait} className="flex items-center gap-3">
                              <div className="text-[11px] text-[#4a5260] w-[70px] capitalize shrink-0">{trait}</div>
                              <div className="flex-1 flex items-center gap-2">
                                <div className="flex-1 h-[3px] rounded-full bg-white/[0.04] overflow-hidden relative">
                                  <div
                                    className="absolute top-0 left-0 h-full rounded-full bg-emerald-400/30"
                                    style={{ width: `${playerScore}%` }}
                                  />
                                  <div
                                    className="absolute top-0 h-full w-[2px] bg-[#5a6270]"
                                    style={{ left: `${famousScore}%` }}
                                  />
                                </div>
                              </div>
                              <div className="text-[11px] text-[#4a5260] w-[52px] text-right shrink-0">
                                <span className="text-[#8a9299]">{playerScore}</span>
                                <span className="text-[#2a3040] mx-0.5">/</span>
                                <span>{famousScore}</span>
                              </div>
                              <span className={`text-[10px] font-medium w-[36px] text-right shrink-0 ${
                                matchPct >= 90 ? 'text-emerald-400' : matchPct >= 70 ? 'text-amber-400' : 'text-[#4a5260]'
                              }`}>{matchPct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {deepAnalysisData.famous_players.primary.strengths && deepAnalysisData.famous_players.primary.strengths.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {deepAnalysisData.famous_players.primary.strengths.map((s, i) => (
                        <span key={i} className="px-2.5 py-[3px] rounded-full bg-white/[0.04] shadow-card text-[11px] text-[#5a6270]">{s}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-xs text-[#3a4250] py-4">Famous player comparison will appear once deep analysis is complete.</div>
              )}
            </div>
          </div>

          {/* Section Break: Opening Analysis */}
          <SectionBreak label="Opening Analysis" />

          {/* Enhanced Opening Analysis - Full Width */}
          <div className={`${cardClass} p-[18px_20px]`}>
            <EnhancedOpeningPlayerCard
              score={deepAnalysisData.phase_accuracies?.opening || 0}
              phaseAccuracy={deepAnalysisData.phase_accuracies?.opening || 0}
              openingStats={comprehensiveData?.openingStats || []}
              totalGames={deepAnalysisData.total_games || 0}
              enhancedAnalysis={deepAnalysisData.enhanced_opening_analysis}
              personalityScores={deepAnalysisData.personality_scores}
            />
          </div>
        </>
      )}

      {/* Section Break: Analysis Statistics */}
      <SectionBreak label="Analysis Statistics" />

      {/* Analysis Stats - Compact 2-col grid */}
      <div className={`${cardClass} p-[18px_20px]`}>
        <div className="flex items-center justify-between text-[12px] font-medium uppercase tracking-[0.07em] text-[#5a6270] mb-3.5">
          <span>Breakdown by Game Phase</span>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-transparent shadow-card rounded-[7px] text-[11px] font-normal normal-case tracking-normal text-[#5a6270] cursor-pointer hover:text-[#8a9299] transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <div className="flex items-center justify-between px-3 py-[9px] bg-white/[0.02] rounded-[7px]">
            <span className="text-xs text-[#4a5260]">Opening Accuracy</span>
            <span className="text-[13px] font-medium text-emerald-400">{safeData.average_opening_accuracy ? Number(safeData.average_opening_accuracy).toFixed(1) : 'N/A'}%</span>
          </div>
          <div className="flex items-center justify-between px-3 py-[9px] bg-white/[0.02] rounded-[7px]">
            <span className="text-xs text-[#4a5260]">Blunders per Game</span>
            <span className="text-[13px] font-medium text-red-400">{Number(safeData.blunders_per_game).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-[9px] bg-white/[0.02] rounded-[7px]">
            <span className="text-xs text-[#4a5260]">Middlegame Accuracy</span>
            <span className="text-[13px] font-medium text-emerald-400">{safeData.average_middle_game_accuracy ? Number(safeData.average_middle_game_accuracy).toFixed(1) : 'N/A'}%</span>
          </div>
          <div className="flex items-center justify-between px-3 py-[9px] bg-white/[0.02] rounded-[7px]">
            <span className="text-xs text-[#4a5260]">Inaccuracies per Game</span>
            <span className="text-[13px] font-medium text-red-400">{Number(safeData.inaccuracies_per_game).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-[9px] bg-white/[0.02] rounded-[7px]">
            <span className="text-xs text-[#4a5260]">Endgame Accuracy</span>
            <span className="text-[13px] font-medium text-emerald-400">{safeData.average_endgame_accuracy ? Number(safeData.average_endgame_accuracy).toFixed(1) : 'N/A'}%</span>
          </div>
          <div className="flex items-center justify-between px-3 py-[9px] bg-white/[0.02] rounded-[7px]">
            <span className="text-xs text-[#4a5260]">Brilliant Moves per Game</span>
            <span className="text-[13px] font-medium text-[#c8cdd4]">{Number(safeData.brilliant_moves_per_game).toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
