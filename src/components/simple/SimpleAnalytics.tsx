// Simple Analytics Component - One component, everything you need
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { UnifiedAnalysisService, AnalysisStats, DeepAnalysisData } from '../../services/unifiedAnalysisService'
import { getPlayerStats } from '../../utils/playerStats'
import {
  getComprehensiveGameAnalytics,
  getWorstOpeningPerformance,
  type PerformanceTrendSummary
} from '../../utils/comprehensiveGameAnalytics'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { calculateAverageAccuracy } from '../../utils/accuracyCalculator'
import { normalizeOpeningName } from '../../utils/openingUtils'
import { getOpeningNameWithFallback } from '../../utils/openingIdentification'
import { CHESS_ANALYSIS_COLORS } from '../../utils/chessColors'
import { PersonalityRadar } from '../deep/PersonalityRadar'
import { LongTermPlanner } from '../deep/LongTermPlanner'
import { OpeningPlayerCard } from '../deep/OpeningPlayerCard'
import { ScoreCards } from '../deep/ScoreCards'
import { EloTrendGraph } from './EloTrendGraph'
import { EnhancedOpponentAnalysis } from './EnhancedOpponentAnalysis'
import { OpeningFilter, OpeningIdentifierSets } from '../../types'

interface SimpleAnalyticsProps {
  userId: string
  platform?: string
  fromDate?: string
  toDate?: string
  onOpeningClick?: (filter: OpeningFilter) => void
  onOpponentClick?: (opponentName: string) => void
}

export function SimpleAnalytics({ userId, platform, fromDate, toDate, onOpeningClick, onOpponentClick }: SimpleAnalyticsProps) {
  const [data, setData] = useState<AnalysisStats | null>(null)
  const [comprehensiveData, setComprehensiveData] = useState<any>(null)
  const [deepAnalysisData, setDeepAnalysisData] = useState<DeepAnalysisData | null>(null)
  const [worstOpenings, setWorstOpenings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTimeControl, setSelectedTimeControl] = useState<string | null>(null)
  const [eloGraphGamesUsed, setEloGraphGamesUsed] = useState<number>(0)
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
      console.log('Already loading data, skipping duplicate call')
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

      // Fetch analysis stats, player stats, comprehensive analytics, deep analysis, and worst openings in parallel
      // Using the unified analysis service for all data
      const [analysisResult, gamesData, playerStats, comprehensiveAnalytics, deepAnalysis, worstOpeningsData] = await Promise.all([
        UnifiedAnalysisService.getAnalysisStats(
          userId,
          (platform as 'lichess' | 'chess.com') || 'lichess',
          'stockfish'
        ),
        UnifiedAnalysisService.getGameAnalyses(
          userId,
          (platform as 'lichess' | 'chess.com') || 'lichess',
          'stockfish'
        ),
        getPlayerStats(userId, (platform as 'lichess' | 'chess.com') || 'lichess'),
        getComprehensiveGameAnalytics(userId, (platform as 'lichess' | 'chess.com') || 'lichess'),
        UnifiedAnalysisService.fetchDeepAnalysis(userId, (platform as 'lichess' | 'chess.com') || 'lichess'),
        getWorstOpeningPerformance(userId, (platform as 'lichess' | 'chess.com') || 'lichess', 5)
      ])
      
      // Set default values for removed services
      const optimizedEloStats = null

      console.log('SimpleAnalytics received data:', analysisResult)
      console.log('Comprehensive analytics:', comprehensiveAnalytics)
      console.log('Opening accuracy:', analysisResult?.average_opening_accuracy)
      console.log('Middle game accuracy:', analysisResult?.average_middle_game_accuracy)
      console.log('Endgame accuracy:', analysisResult?.average_endgame_accuracy)

      // Log validation issues if any
      if (playerStats.validationIssues && playerStats.validationIssues.length > 0) {
        console.warn('ELO data validation issues detected:', playerStats.validationIssues)
      }

      // Log comprehensive analytics benefits
      if (comprehensiveAnalytics && comprehensiveAnalytics.totalGames > 0) {
        console.log(`Comprehensive analytics: ${comprehensiveAnalytics.totalGames} games analyzed with single query`)
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
      } : null

      // Debug: Compare the data sources
      console.log('Data Comparison Debug:', {
        comprehensiveAnalytics: {
          totalGames: comprehensiveAnalytics?.totalGames,
          openingStats: comprehensiveAnalytics?.openingStats?.slice(0, 3).map(o => ({
            opening: o.opening,
            games: o.games,
            winRate: o.winRate
          }))
        },
        worstOpeningsData: {
          count: worstOpeningsData?.length,
          openings: worstOpeningsData?.slice(0, 3).map(o => ({
            opening: o.opening,
            games: o.games,
            winRate: o.winRate
          }))
        }
      })

      setData(enhancedData)
      setComprehensiveData(comprehensiveAnalytics)
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
      setWorstOpenings(worstOpeningsData)
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

  const buildOpeningFilter = (
    normalizedName: string,
    identifiers?: OpeningIdentifierSets,
    fallback?: { openingFamily?: string | null; opening?: string | null }
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
          <div className="mt-3 text-2xl font-semibold text-sky-300">{comprehensiveData?.highestElo || safeData.current_rating || 'N/A'}</div>
        </div>

        <div className={cardClass}>
          <h3 className="text-xs uppercase tracking-wide text-slate-300">Time Control (Highest ELO)</h3>
          <div className="mt-3 text-2xl font-semibold text-amber-300">
            {safeData.most_played_time_control ? getTimeControlCategory(safeData.most_played_time_control) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Backend Analysis Status */}
      {!data && comprehensiveData && comprehensiveData.totalGames > 0 && (
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
      {comprehensiveData && comprehensiveData.totalGames > 0 && (
        <div className="space-y-4">
          {/* Basic Statistics */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Basic Statistics</h3>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Total Games</span>
                <div className="text-xl font-semibold text-sky-300">{comprehensiveData.totalGames}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Win Rate</span>
                <div className="text-xl font-semibold text-emerald-300">{comprehensiveData.winRate.toFixed(1)}%</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Draw Rate</span>
                <div className="text-xl font-semibold text-amber-300">{comprehensiveData.drawRate.toFixed(1)}%</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Loss Rate</span>
                <div className="text-xl font-semibold text-rose-300">{comprehensiveData.lossRate.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* ELO Statistics */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">ELO Statistics</h3>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Highest</span>
                <div className="text-lg font-semibold text-emerald-300">{comprehensiveData.highestElo || 'N/A'}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Lowest</span>
                <div className="text-lg font-semibold text-rose-300">{comprehensiveData.lowestElo || 'N/A'}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Current</span>
                <div className="text-lg font-semibold text-sky-300">{comprehensiveData.currentElo || 'N/A'}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Average</span>
                <div className="text-lg font-semibold text-purple-300">{comprehensiveData.averageElo?.toFixed(0) || 'N/A'}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Range</span>
                <div className="text-lg font-semibold text-amber-300">{comprehensiveData.eloRange || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Color Performance */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Color Performance</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className={subtleCardClass}>
                <h4 className="mb-2 text-sm font-semibold text-white">White</h4>
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Games:</span>
                    <span className="font-semibold text-white">{comprehensiveData.colorStats.white.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="font-semibold text-emerald-300">{comprehensiveData.colorStats.white.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg ELO:</span>
                    <span className="font-semibold text-white">{comprehensiveData.colorStats.white.averageElo.toFixed(0)}</span>
                  </div>
                </div>
              </div>
              <div className={subtleCardClass}>
                <h4 className="mb-2 text-sm font-semibold text-white">Black</h4>
                <div className="space-y-2 text-sm text-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Games:</span>
                    <span className="font-semibold text-white">{comprehensiveData.colorStats.black.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Win Rate:</span>
                    <span className="font-semibold text-emerald-300">{comprehensiveData.colorStats.black.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg ELO:</span>
                    <span className="font-semibold text-white">{comprehensiveData.colorStats.black.averageElo.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Time Controls */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Time Control Performance</h3>
            <div className="space-y-3">
              {comprehensiveData.timeControlStats.slice(0, 3).map((stat: any, index: number) => (
                <div key={index} className={subtleCardClass}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium text-white">{stat.timeControl}</span>
                    <span className="text-xs uppercase tracking-wide text-slate-400">{stat.games} games</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-200">
                    <div>
                      <span className="text-slate-400">Win Rate:</span>
                      <span className="ml-2 font-semibold text-emerald-300">{stat.winRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Avg ELO:</span>
                      <span className="ml-2 font-semibold text-white">{stat.averageElo.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opening Performance - Winning vs Losing */}
          <div className={cardClass}>
            <h3 className="mb-6 text-lg font-semibold text-white">Opening Performance</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Winning Openings */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-emerald-200">Winning Openings</h4>
                <div className="space-y-3">
                  {comprehensiveData.openingStats.slice(0, 3).map((stat: any, index: number) => (
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
                          <span className="ml-2 font-semibold">{stat.winRate.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-emerald-100/70">Avg ELO:</span>
                          <span className="ml-2 font-semibold">{stat.averageElo.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losing Openings */}
              <div>
                <h4 className="mb-4 text-sm font-semibold text-amber-200">Losing Openings</h4>
                <div className="space-y-3">
                  {worstOpenings.length > 0 ? (
                    worstOpenings.slice(0, 3).map((stat: any, index: number) => (
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
                            <span className="ml-2 font-semibold">{stat.winRate.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-amber-100/70">Avg ELO:</span>
                            <span className="ml-2 font-semibold">{stat.averageElo.toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-slate-400">
                      <div className="mb-2 text-4xl text-slate-600">♘</div>
                      <p>No losing openings data</p>
                      <p className="text-xs">Need more games to identify patterns</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Opening Color Performance */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Opening Performance by Color</h3>
            
            {comprehensiveData.openingColorStats && 
             (comprehensiveData.openingColorStats.white.length > 0 || comprehensiveData.openingColorStats.black.length > 0) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Best White Openings */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-emerald-200">Best White Openings</h4>
                  <div className="space-y-3">
                    {comprehensiveData.openingColorStats.white.slice(0, 3).map((stat: any, index: number) => (
                      <div 
                        key={index} 
                        className="cursor-pointer rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 transition hover:border-emerald-300/60 hover:bg-emerald-500/20"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers)
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
                            {stat.winRate.toFixed(1)}%
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
                    {comprehensiveData.openingColorStats.white.length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No white opening data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Best Black Openings */}
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-sky-200">Best Black Openings</h4>
                  <div className="space-y-3">
                    {comprehensiveData.openingColorStats.black.slice(0, 3).map((stat: any, index: number) => (
                      <div 
                        key={index} 
                        className="cursor-pointer rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4 transition hover:border-sky-300/60 hover:bg-sky-500/20"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers)
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
                            {stat.winRate.toFixed(1)}%
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
                    {comprehensiveData.openingColorStats.black.length === 0 && (
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
                    <div className="text-lg font-semibold text-emerald-300">{activePerformance ? activePerformance.recentWinRate.toFixed(1) : '--'}%</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {activePerformance
                        ? `${activePerformance.sampleSize} games • ${activePerformance.timeControlUsed}`
                        : 'No data'}
                    </div>
                  </div>
                </div>
                <div className={subtleCardClass}>
                  <span className="text-xs uppercase tracking-wide text-slate-400">Recent Avg ELO</span>
                  <div className="text-lg font-semibold text-sky-300">{activePerformance ? activePerformance.recentAverageElo.toFixed(0) : '--'}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {activePerformance
                      ? `${activePerformance.sampleSize} games • ${activePerformance.timeControlUsed}`
                      : 'No data'}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2">
                <EloTrendGraph
                  userId={userId}
                  platform={platform as 'lichess' | 'chess.com'}
                  className="w-full"
                  selectedTimeControl={selectedTimeControl}
                  onTimeControlChange={setSelectedTimeControl}
                  onGamesUsedChange={setEloGraphGamesUsed}
                />
              </div>
            </div>
          </div>

          {/* Enhanced Opponent Analysis */}
          <EnhancedOpponentAnalysis 
            userId={userId}
            opponentStats={comprehensiveData.opponentStats} 
            platform={(platform as 'lichess' | 'chess.com') || 'lichess'}
            onOpponentClick={onOpponentClick}
          />

          {/* Game Length Analysis */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Game Length Analysis</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-200 md:grid-cols-5">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Avg Length</span>
                <div className="text-lg font-semibold text-sky-300">{comprehensiveData.gameLengthStats.averageGameLength.toFixed(1)} moves</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Shortest</span>
                <div className="text-lg font-semibold text-emerald-300">{comprehensiveData.gameLengthStats.shortestGame} moves</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Longest</span>
                <div className="text-lg font-semibold text-rose-300">{comprehensiveData.gameLengthStats.longestGame} moves</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Quick Victories</span>
                <div className="text-lg font-semibold text-purple-300">{comprehensiveData.gameLengthStats.quickVictories} games</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Long Games</span>
                <div className="text-lg font-semibold text-amber-300">{comprehensiveData.gameLengthStats.longGames} games</div>
              </div>
            </div>
          </div>

          {/* Temporal Analysis */}
          <div className={cardClass}>
            <h3 className="mb-4 text-lg font-semibold text-white">Temporal Analysis</h3>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-200 md:grid-cols-5">
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">First Game</span>
                <div className="text-sm font-medium text-white">{comprehensiveData.temporalStats.firstGame ? new Date(comprehensiveData.temporalStats.firstGame).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Last Game</span>
                <div className="text-sm font-medium text-white">{comprehensiveData.temporalStats.lastGame ? new Date(comprehensiveData.temporalStats.lastGame).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">This Month</span>
                <div className="text-lg font-semibold text-sky-300">{comprehensiveData.temporalStats.gamesThisMonth} games</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">This Week</span>
                <div className="text-lg font-semibold text-emerald-300">{comprehensiveData.temporalStats.gamesThisWeek} games</div>
              </div>
              <div>
                <span className="text-xs uppercase tracking-wide text-slate-400">Avg / Day</span>
                <div className="text-lg font-semibold text-purple-300">{comprehensiveData.temporalStats.averageGamesPerDay.toFixed(2)}</div>
              </div>
            </div>
          </div>
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

            {/* Opening Player Card */}
            <div className={cardClass}>
              <OpeningPlayerCard
                score={deepAnalysisData.phase_accuracies?.opening || 0}
                phaseAccuracy={deepAnalysisData.phase_accuracies?.opening || 0}
                openingStats={comprehensiveData?.openingStats || []}
                totalGames={deepAnalysisData.total_games || 0}
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
