/**
 * Time Spent Analysis Component
 * Displays comprehensive statistics about time spent playing chess
 */

import { useState, useEffect } from 'react'
import type { Game } from '../../types'
import {
  calculateTimeSpent,
  getTimeSpentTrend
} from '../../utils/timeSpentCalculator'
import { getTimeControlColor } from '../../utils/timeControlUtils'
import { supabase } from '../../lib/supabase'

interface TimeSpentAnalysisProps {
  games: Game[]
  className?: string
}

export function TimeSpentAnalysis({ games, className = '' }: TimeSpentAnalysisProps) {
  const timeStats = calculateTimeSpent(games)
  const timeTrend = getTimeSpentTrend(games)

  // Get recent months (last 6 months)
  const recentTrend = timeTrend.slice(-6)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold">Time Spent Playing Chess</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-sm opacity-90 mb-1">Estimated Total Time</div>
            <div className="text-3xl font-bold">
              {timeStats.breakdown.hours > 0 && `${timeStats.breakdown.hours}h `}
              {timeStats.breakdown.minutes > 0 && `${timeStats.breakdown.minutes}m`}
            </div>
            <div className="text-xs opacity-75 mt-1">
              {timeStats.estimatedActualTime.totalTimeFormatted}
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-sm opacity-90 mb-1">Total Games</div>
            <div className="text-3xl font-bold">{games.length}</div>
            <div className="text-xs opacity-75 mt-1">
              Avg: {games.length > 0 ? Math.round(timeStats.estimatedActualTime.totalTimeSeconds / games.length / 60) : 0} min/game
            </div>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="text-sm opacity-90 mb-1">Max Possible Time</div>
            <div className="text-3xl font-bold">
              {Math.floor(timeStats.totalTimeSeconds / 3600)}h
            </div>
            <div className="text-xs opacity-75 mt-1">
              {timeStats.totalTimeFormatted}
            </div>
          </div>
        </div>
        <div className="mt-4 text-sm opacity-90">
          <p>{timeStats.estimatedActualTime.description}</p>
        </div>
      </div>

      {/* Time by Control Type */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Time by Game Type
        </h3>
        <div className="space-y-3">
          {timeStats.byTimeControl.map((tc, index) => {
            const colorClass = getTimeControlColor(tc.category)
            const percentage = (tc.totalTimeSeconds / timeStats.estimatedActualTime.totalTimeSeconds) * 100

            return (
              <div key={index} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-32">
                  <span className={`font-medium ${colorClass}`}>{tc.category}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">
                      {tc.gameCount} games · {tc.totalTimeFormatted}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full bg-gradient-to-r ${
                        tc.category === 'Bullet' ? 'from-red-500 to-red-600' :
                        tc.category === 'Blitz' ? 'from-orange-500 to-orange-600' :
                        tc.category === 'Rapid' ? 'from-blue-500 to-blue-600' :
                        tc.category === 'Classical' ? 'from-purple-500 to-purple-600' :
                        'from-green-500 to-green-600'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Longest and Shortest Games */}
      {(timeStats.longestGame || timeStats.shortestGame) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {timeStats.longestGame && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                Longest Game
              </h3>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-blue-600">
                  {timeStats.longestGame.estimatedDurationFormatted}
                </div>
                <div className="text-sm text-gray-600">
                  <div>Game ID: {timeStats.longestGame.gameId}</div>
                  <div>Time Control: {timeStats.longestGame.timeControl}</div>
                  <div>Total Moves: {timeStats.longestGame.totalMoves}</div>
                </div>
              </div>
            </div>
          )}
          {timeStats.shortestGame && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                Shortest Game
              </h3>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-orange-600">
                  {timeStats.shortestGame.estimatedDurationFormatted}
                </div>
                <div className="text-sm text-gray-600">
                  <div>Game ID: {timeStats.shortestGame.gameId}</div>
                  <div>Time Control: {timeStats.shortestGame.timeControl}</div>
                  <div>Total Moves: {timeStats.shortestGame.totalMoves}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Trend Over Recent Months */}
      {recentTrend.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Recent Activity (Last 6 Months)
          </h3>
          <div className="space-y-3">
            {recentTrend.map((trend, index) => {
              const maxTime = Math.max(...recentTrend.map(t => t.totalTimeSeconds))
              const barWidth = maxTime > 0 ? (trend.totalTimeSeconds / maxTime) * 100 : 0
              const hoursSpent = Math.round(trend.totalTimeSeconds / 3600)

              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-24 text-sm font-medium text-gray-700">
                    {trend.month} {trend.year}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">
                        {trend.gameCount} games
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {hoursSpent}h {Math.round((trend.totalTimeSeconds % 3600) / 60)}m
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          How is this calculated?
        </h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            • <strong>Estimated Time:</strong> Based on time controls and actual move counts (matches Lichess calculation)
          </p>
          <p>
            • <strong>Max Possible Time:</strong> The theoretical maximum if all allocated time (including increments) was used
          </p>
          <p>
            • <strong>Per Game:</strong> Calculated as base time + (increment × moves made)
          </p>
          <p className="mt-2 text-xs opacity-75">
            Note: This represents the time allocated/available in your games, not necessarily the actual thinking time used.
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact version for dashboard
 */
interface TimeSpentSummaryProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  fallbackGames?: Game[]
  className?: string
}

export function TimeSpentSummary({ userId, platform, fallbackGames = [], className = '' }: TimeSpentSummaryProps) {
  const [games, setGames] = useState<Game[]>(fallbackGames)
  const [loading, setLoading] = useState(true)
  const [totalGamesCount, setTotalGamesCount] = useState(0)

  useEffect(() => {
    async function fetchAllGames() {
      try {
        setLoading(true)

        console.log('🔍 Fetching ALL games for time calculation...')

        // Supabase has a default limit of 1000, so we need to paginate
        let allGames: Game[] = []
        let from = 0
        const pageSize = 1000
        let hasMore = true

        while (hasMore) {
          const { data, error, count } = await supabase
            .from('games')
            .select('id, time_control, total_moves, played_at, provider_game_id', { count: 'exact' })
            .eq('user_id', userId)
            .eq('platform', platform)
            .order('played_at', { ascending: false })
            .range(from, from + pageSize - 1)

          if (error) {
            console.error('Error fetching games for time calculation:', error)
            setGames(fallbackGames)
            setTotalGamesCount(fallbackGames.length)
            return
          }

          if (data && data.length > 0) {
            allGames = [...allGames, ...data]
            from += pageSize
            hasMore = data.length === pageSize

            // Log progress for large datasets
            if (from % 1000 === 0) {
              console.log(`📊 Loaded ${allGames.length} games...`)
            }
          } else {
            hasMore = false
          }

          // Set the count from the first request
          if (from === pageSize && count) {
            setTotalGamesCount(count)
          }
        }

        console.log(`✅ Loaded ${allGames.length} total games for time calculation`)
        console.log('📊 Sample games:', allGames.slice(0, 3).map(g => ({
          time_control: g.time_control,
          total_moves: g.total_moves
        })))
        setGames(allGames as Game[])

      } catch (err) {
        console.error('Error in fetchAllGames:', err)
        setGames(fallbackGames)
        setTotalGamesCount(fallbackGames.length)
      } finally {
        setLoading(false)
      }
    }

    fetchAllGames()
  }, [userId, platform]) // Remove fallbackGames from dependencies to prevent re-fetching

  const timeStats = calculateTimeSpent(games)

  // Debug logging
  useEffect(() => {
    if (!loading && games.length > 0) {
      console.log('📊 Time Stats Debug:', {
        totalGames: games.length,
        totalEstimatedHours: Math.floor(timeStats.estimatedActualTime.totalTimeSeconds / 3600),
        totalEstimatedMinutes: Math.floor((timeStats.estimatedActualTime.totalTimeSeconds % 3600) / 60),
        breakdown: timeStats.breakdown,
        byTimeControl: timeStats.byTimeControl.map(tc => ({
          category: tc.category,
          hours: Math.floor(tc.totalTimeSeconds / 3600),
          games: tc.gameCount
        }))
      })
    }
  }, [loading, games.length, timeStats])

  if (loading) {
    return (
      <div className={`rounded-xl border border-white/10 bg-white/10 p-6 shadow-inner shadow-black/30 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm uppercase tracking-wide text-slate-400 font-semibold">Time Spent Playing</h3>
        </div>
        <div className="text-center text-slate-400 py-8">
          <div className="text-xl animate-pulse">Calculating total time...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/10 p-6 shadow-inner shadow-black/30 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm uppercase tracking-wide text-slate-400 font-semibold">Time Spent Playing</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <div className="text-3xl font-bold text-cyan-300">
            {timeStats.breakdown.hours > 0 && `${timeStats.breakdown.hours}h `}
            {timeStats.breakdown.minutes}m
          </div>
          <div className="text-xs text-slate-400 mt-2">Estimated Total Time</div>
          <div className="text-xs text-slate-500 mt-1">
            {timeStats.estimatedActualTime.totalTimeFormatted}
          </div>
        </div>
        <div>
          <div className="text-3xl font-bold text-white">
            {games.length > 0 ? Math.round(timeStats.estimatedActualTime.totalTimeSeconds / games.length / 60) : 0} min
          </div>
          <div className="text-xs text-slate-400 mt-2">Average per Game</div>
          <div className="text-xs text-slate-500 mt-1">
            Based on {totalGamesCount.toLocaleString()} games
          </div>
        </div>
        {timeStats.byTimeControl.length > 0 && (
          <div>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-lg font-bold text-white">{timeStats.byTimeControl[0].category}</div>
                <div className="text-xs text-slate-400 mt-1">Most Time Spent</div>
                <div className="text-xs text-slate-500 mt-2">
                  {Math.round(timeStats.byTimeControl[0].totalTimeSeconds / 3600)}h · {timeStats.byTimeControl[0].gameCount.toLocaleString()} games
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
