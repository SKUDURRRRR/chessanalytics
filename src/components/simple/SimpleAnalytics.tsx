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
      console.log('Player stats (highest ELO & time control):', playerStats)
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
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Chess Analytics</h2>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-28"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Error</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => loadData(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data && !comprehensiveData) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">No Data</h2>
        <p>No games found for this user.</p>
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

  return (
    <div className="space-y-4" data-testid="analytics-container">
      {/* ELO Optimization Status */}
      {safeData.elo_optimization_active && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-green-600 text-xl">*</div>
            <div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">ELO Optimization Active</h3>
              <p className="text-green-700 mb-3">
                Your ELO statistics are calculated using the optimized approach for maximum performance.
                This ensures accurate results even with thousands of games!
              </p>
              <div className="bg-green-100 p-3 rounded border border-green-300">
                <p className="text-green-800 font-medium mb-1">Optimization Benefits:</p>
                <ul className="text-green-700 text-sm space-y-1 list-disc list-inside">
                  <li>* Fast ELO calculations (single database query)</li>
                  <li>* Complete coverage of all imported games</li>
                  <li>* No analysis dependency - ELO data available immediately after import</li>
                  <li>* Handles players with thousands of games efficiently</li>
                </ul>
                {safeData.total_games_with_elo > 0 && (
                  <p className="text-green-800 text-sm mt-2">
                    <strong>Total games processed:</strong> {safeData.total_games_with_elo}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mock Data Warning */}
      {isMockData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-yellow-600 text-xl">!</div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Demo Data Shown</h3>
              <p className="text-yellow-700 mb-3">
                You're seeing sample analytics data because no analysis has been performed on your games yet.
              </p>
              <div className="bg-yellow-100 p-3 rounded border border-yellow-300">
                <p className="text-yellow-800 font-medium mb-1">To see your real analytics:</p>
                <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
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
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-orange-600 text-xl">!</div>
            <div>
              <h3 className="text-lg font-semibold text-orange-800 mb-2">ELO Data Quality Issues Detected</h3>
              <p className="text-orange-700 mb-3">
                Some of your game data may have incorrect ELO ratings. This could affect the accuracy of your highest ELO calculation.
              </p>
              <div className="bg-orange-100 p-3 rounded border border-orange-300">
                <p className="text-orange-800 font-medium mb-2">Issues found:</p>
                <ul className="text-orange-700 text-sm space-y-1 list-disc list-inside">
                  {safeData.validation_issues.slice(0, 3).map((issue: string, index: number) => (
                    <li key={index}>{issue}</li>
                  ))}
                  {safeData.validation_issues.length > 3 && (
                    <li>... and {safeData.validation_issues.length - 3} more issues</li>
                  )}
                </ul>
                <p className="text-orange-800 text-sm mt-2">
                  <strong>Note:</strong> The highest ELO shown may not be accurate. Consider re-importing your games to fix these issues.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Games Analyzed</h3>
          <div className="text-2xl font-bold">{safeData.total_games_analyzed}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Average Accuracy</h3>
          <div className="text-2xl font-bold text-green-600">{safeData.average_accuracy}%</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Highest Rating</h3>
          <div className="text-2xl font-bold text-blue-600">{comprehensiveData?.highestElo || safeData.current_rating || 'N/A'}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Time Control (Highest ELO)</h3>
          <div className="text-2xl font-bold text-yellow-600">
            {safeData.most_played_time_control ? getTimeControlCategory(safeData.most_played_time_control) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Backend Analysis Status */}
      {!data && comprehensiveData && comprehensiveData.totalGames > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-blue-600 text-xl">...</div>
            <div>
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Analysis in Progress</h3>
              <p className="text-blue-700">
                Your comprehensive game statistics are available below. Detailed move analysis is currently being processed by the backend.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Analytics Section */}
      {comprehensiveData && comprehensiveData.totalGames > 0 && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-blue-600 text-xl">[]</div>
              <div>
                <h3 className="text-lg font-semibold text-blue-800 mb-2">Comprehensive Game Analytics</h3>
                <p className="text-blue-700 text-sm mb-3">
                  Detailed insights extracted with single queries - no analysis required! 
                  All data available immediately after import.
                </p>
              </div>
            </div>
          </div>

          {/* Basic Statistics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Basic Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Total Games:</span>
                <div className="text-xl font-bold text-blue-600">{comprehensiveData.totalGames}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Win Rate:</span>
                <div className="text-xl font-bold text-green-600">{comprehensiveData.winRate.toFixed(1)}%</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Draw Rate:</span>
                <div className="text-xl font-bold text-yellow-600">{comprehensiveData.drawRate.toFixed(1)}%</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Loss Rate:</span>
                <div className="text-xl font-bold text-red-600">{comprehensiveData.lossRate.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* ELO Statistics */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Highest:</span>
                <div className="text-lg font-bold text-green-600">{comprehensiveData.highestElo || 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Lowest:</span>
                <div className="text-lg font-bold text-red-600">{comprehensiveData.lowestElo || 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Current:</span>
                <div className="text-lg font-bold text-blue-600">{comprehensiveData.currentElo || 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Average:</span>
                <div className="text-lg font-bold text-purple-600">{comprehensiveData.averageElo?.toFixed(0) || 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Range:</span>
                <div className="text-lg font-bold text-orange-600">{comprehensiveData.eloRange || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Color Performance */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Color Performance</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">White</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Games:</span>
                    <span className="font-medium">{comprehensiveData.colorStats.white.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Win Rate:</span>
                    <span className="font-medium text-green-600">{comprehensiveData.colorStats.white.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg ELO:</span>
                    <span className="font-medium">{comprehensiveData.colorStats.white.averageElo.toFixed(0)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-2">Black</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Games:</span>
                    <span className="font-medium">{comprehensiveData.colorStats.black.games}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Win Rate:</span>
                    <span className="font-medium text-green-600">{comprehensiveData.colorStats.black.winRate.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg ELO:</span>
                    <span className="font-medium">{comprehensiveData.colorStats.black.averageElo.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Time Controls */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Time Control Performance</h3>
            <div className="space-y-3">
              {comprehensiveData.timeControlStats.slice(0, 3).map((stat: any, index: number) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{stat.timeControl}</span>
                    <span className="text-sm text-gray-600">{stat.games} games</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Win Rate:</span>
                      <span className="ml-2 font-medium text-green-600">{stat.winRate.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg ELO:</span>
                      <span className="ml-2 font-medium">{stat.averageElo.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opening Performance - Winning vs Losing */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Opening Performance</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Winning Openings */}
              <div>
                <h4 className="text-md font-semibold text-green-700 mb-4">
                  Winning Openings
                </h4>
                <div className="space-y-3">
                  {comprehensiveData.openingStats.slice(0, 3).map((stat: any, index: number) => (
                    <div 
                      key={index} 
                      className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400 cursor-pointer hover:bg-green-100 transition-colors"
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
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-medium text-gray-800">
                          {normalizeOpeningName(stat.opening)}
                        </span>
                        <span className="text-sm text-gray-600">{stat.games} games</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Win Rate:</span>
                          <span className="ml-2 font-medium text-green-600">{stat.winRate.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Avg ELO:</span>
                          <span className="ml-2 font-medium">{stat.averageElo.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losing Openings */}
              <div>
                <h4 className="text-md font-semibold text-orange-700 mb-4">
                  Losing Openings
                </h4>
                <div className="space-y-3">
                  {worstOpenings.length > 0 ? (
                    worstOpenings.slice(0, 3).map((stat: any, index: number) => (
                      <div 
                        key={index} 
                        className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-400 cursor-pointer hover:bg-orange-100 transition-colors"
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
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-medium text-gray-800">
                            {normalizeOpeningName(stat.opening)}
                          </span>
                          <span className="text-sm text-gray-600">{stat.games} games</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Win Rate:</span>
                            <span className="ml-2 font-medium text-orange-600">{stat.winRate.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Avg ELO:</span>
                            <span className="ml-2 font-medium">{stat.averageElo.toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">--</div>
                      <p>No losing openings data</p>
                      <p className="text-sm">Need more games to identify patterns</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Opening Color Performance */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Opening Performance by Color</h3>
            
            {comprehensiveData.openingColorStats && 
             (comprehensiveData.openingColorStats.white.length > 0 || comprehensiveData.openingColorStats.black.length > 0) ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Best White Openings */}
                <div>
                  <h4 className="text-md font-semibold text-gray-700 mb-3">
                    Best White Openings
                  </h4>
                  <div className="space-y-3">
                    {comprehensiveData.openingColorStats.white.slice(0, 3).map((stat: any, index: number) => (
                      <div 
                        key={index} 
                        className="bg-gray-50 p-4 rounded-lg border cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers)
                          )
                        }
                        title="Click to view games with this opening"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800 text-sm leading-tight">
                            {normalizeOpeningName(stat.opening)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            stat.winRate >= 60 ? 'bg-green-100 text-green-800' :
                            stat.winRate >= 50 ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {stat.winRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>{stat.games} games</span>
                          <span className="font-medium">
                            {stat.wins}W-{stat.losses}L-{stat.draws}D
                          </span>
                        </div>
                      </div>
                    ))}
                    {comprehensiveData.openingColorStats.white.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No white opening data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Best Black Openings */}
                <div>
                  <h4 className="text-md font-semibold text-gray-700 mb-3">
                    Best Black Openings
                  </h4>
                  <div className="space-y-3">
                    {comprehensiveData.openingColorStats.black.slice(0, 3).map((stat: any, index: number) => (
                      <div 
                        key={index} 
                        className="bg-gray-50 p-4 rounded-lg border cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() =>
                          onOpeningClick?.(
                            buildOpeningFilter(normalizeOpeningName(stat.opening), stat.identifiers)
                          )
                        }
                        title="Click to view games with this opening"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-gray-800 text-sm leading-tight">
                            {normalizeOpeningName(stat.opening)}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            stat.winRate >= 60 ? 'bg-green-100 text-green-800' :
                            stat.winRate >= 50 ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {stat.winRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>{stat.games} games</span>
                          <span className="font-medium">
                            {stat.wins}W-{stat.losses}L-{stat.draws}D
                          </span>
                        </div>
                      </div>
                    ))}
                    {comprehensiveData.openingColorStats.black.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        No black opening data available
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">--</div>
                <p>No opening data available</p>
                <p className="text-sm">Games need to have opening names to show color performance</p>
              </div>
            )}
          </div>

          {/* Recent Performance */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Performance</h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Recent Win Rate:</span>
                    <div className="text-lg font-bold text-green-600">{activePerformance ? activePerformance.recentWinRate.toFixed(1) : '--'}%</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {activePerformance
                        ? `${activePerformance.sampleSize} games • ${activePerformance.timeControlUsed}`
                        : 'No data'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Recent Avg ELO:</span>
                    <div className="text-lg font-bold text-blue-600">{activePerformance ? activePerformance.recentAverageElo.toFixed(0) : '--'}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {activePerformance
                        ? `${activePerformance.sampleSize} games • ${activePerformance.timeControlUsed}`
                        : 'No data'}
                    </div>
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
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Game Length Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Avg Length:</span>
                <div className="text-lg font-bold text-blue-600">{comprehensiveData.gameLengthStats.averageGameLength.toFixed(1)} moves</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Shortest:</span>
                <div className="text-lg font-bold text-green-600">{comprehensiveData.gameLengthStats.shortestGame} moves</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Longest:</span>
                <div className="text-lg font-bold text-red-600">{comprehensiveData.gameLengthStats.longestGame} moves</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Quick Victories:</span>
                <div className="text-lg font-bold text-purple-600">{comprehensiveData.gameLengthStats.quickVictories} games</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Long Games:</span>
                <div className="text-lg font-bold text-orange-600">{comprehensiveData.gameLengthStats.longGames} games</div>
              </div>
            </div>
          </div>

          {/* Temporal Analysis */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Temporal Analysis</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">First Game:</span>
                <div className="text-sm font-medium">{comprehensiveData.temporalStats.firstGame ? new Date(comprehensiveData.temporalStats.firstGame).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Last Game:</span>
                <div className="text-sm font-medium">{comprehensiveData.temporalStats.lastGame ? new Date(comprehensiveData.temporalStats.lastGame).toLocaleDateString() : 'N/A'}</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">This Month:</span>
                <div className="text-lg font-bold text-blue-600">{comprehensiveData.temporalStats.gamesThisMonth} games</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">This Week:</span>
                <div className="text-lg font-bold text-green-600">{comprehensiveData.temporalStats.gamesThisWeek} games</div>
              </div>
              <div>
                <span className="font-medium text-gray-600">Avg/Day:</span>
                <div className="text-lg font-bold text-purple-600">{comprehensiveData.temporalStats.averageGamesPerDay.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deep Analysis Section */}
      {deepAnalysisData && (
        <div className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-purple-600 text-xl">*</div>
              <div>
                <h3 className="text-lg font-semibold text-purple-800 mb-2">Deep Analysis Insights</h3>
                <p className="text-purple-700 text-sm mb-3">
                  Advanced personality analysis and strategic insights based on your game patterns.
                </p>
              </div>
            </div>
          </div>

          {/* Long-term Planner */}
          <LongTermPlanner data={deepAnalysisData} userId={userId} />

          {/* Main Analysis Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Personality Radar */}
            {deepAnalysisData.personality_scores && (
              <PersonalityRadar scores={deepAnalysisData.personality_scores} />
            )}

            {/* Opening Player Card */}
            <OpeningPlayerCard
              score={deepAnalysisData.phase_accuracies?.opening || 0}
              phaseAccuracy={deepAnalysisData.phase_accuracies?.opening || 0}
              openingStats={comprehensiveData?.openingStats || []}
              totalGames={deepAnalysisData.total_games || 0}
            />
          </div>

        </div>
      )}

      {/* Analysis Stats */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Analysis Statistics</h2>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Opening Accuracy:</span>
              <span className="font-medium">{safeData.average_opening_accuracy || 'N/A'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Middle Game Accuracy:</span>
              <span className="font-medium">{safeData.average_middle_game_accuracy || 'N/A'}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Endgame Accuracy:</span>
              <span className="font-medium">{safeData.average_endgame_accuracy || 'N/A'}%</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Blunders per Game:</span>
              <span className="font-medium">{safeData.blunders_per_game}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Inaccuracies per Game:</span>
              <span className="font-medium">{safeData.inaccuracies_per_game}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Brilliant Moves per Game:</span>
              <span className="font-medium text-green-600">{safeData.brilliant_moves_per_game}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
