// @ts-nocheck
// Comprehensive Analytics Component - Shows detailed analytics tables
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getOpeningNameWithFallback } from '../../utils/openingIdentification'
import { shouldCountOpeningForColor } from '../../utils/openingColorClassification'
import { getTimeControlCategory } from '../../utils/timeControlUtils'

interface ComprehensiveAnalyticsProps {
  userId: string
  platform: 'lichess' | 'chess.com'
}

interface AnalyticsData {
  totalGames: number
  fetchedGames: number
  winRate: number
  drawRate: number
  lossRate: number
  highestElo: number
  lowestElo: number
  currentElo: number
  averageElo: number
  eloRange: number
  whiteGames: number
  whiteWinRate: number
  blackGames: number
  blackWinRate: number
  mostPlayedTimeControl: string
  mostPlayedOpening: string
}

export function ComprehensiveAnalytics({ userId, platform }: ComprehensiveAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        // First, get the total count of games
        const { count: totalGamesCount, error: countError } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('platform', platform)

        if (countError) {
          console.error('Error getting games count:', countError)
          throw countError
        }

        console.log(`Debug: Total games in database: ${totalGamesCount}`)

        // Fetch comprehensive analytics from the database
        const { data: games, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .eq('user_id', userId)
          .eq('platform', platform)
          .limit(10000) // Set a high limit to get all games

        if (gamesError) throw gamesError

        if (!games || games.length === 0) {
          setData(null)
          return
        }

        // Calculate comprehensive analytics
        const totalGames = totalGamesCount || games.length
        const wins = games.filter(g => g.result === 'win').length
        const draws = games.filter(g => g.result === 'draw').length
        const losses = games.filter(g => g.result === 'loss').length

        const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0
        const drawRate = totalGames > 0 ? (draws / totalGames) * 100 : 0
        const lossRate = totalGames > 0 ? (losses / totalGames) * 100 : 0

        const elos = games.map(g => g.my_rating).filter(e => e && e > 0)
        const highestElo = Math.max(...elos, 0)
        const lowestElo = Math.min(...elos, 0)
        const currentElo = elos[elos.length - 1] || 0
        const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0
        const eloRange = highestElo - lowestElo

        const whiteGames = games.filter(g => g.user_color === 'white').length
        const whiteWins = games.filter(g => g.user_color === 'white' && g.result === 'win').length
        const whiteWinRate = whiteGames > 0 ? (whiteWins / whiteGames) * 100 : 0

        const blackGames = games.filter(g => g.user_color === 'black').length
        const blackWins = games.filter(g => g.user_color === 'black' && g.result === 'win').length
        const blackWinRate = blackGames > 0 ? (blackWins / blackGames) * 100 : 0

        // Find most played time control
        const timeControls = games.reduce((acc, game) => {
          const tc = getTimeControlCategory(game.time_control || 'unknown')
          acc[tc] = (acc[tc] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const mostPlayedTimeControl = Object.entries(timeControls).reduce((a, b) =>
          timeControls[a[0]] > timeControls[b[0]] ? a : b, ['unknown', 0])[0]

        // Find most played opening (filtered by player color)
        const openings = games.reduce((acc, game) => {
          const rawOpening = game.opening || 'unknown'
          const opening = getOpeningNameWithFallback(rawOpening)
          const playerColor = game.color || game.my_color

          // Only count openings that match the player's color
          if (playerColor && !shouldCountOpeningForColor(opening, playerColor)) {
            return acc // Skip opponent's opening
          }

          acc[opening] = (acc[opening] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const mostPlayedOpening = Object.entries(openings).reduce((a, b) =>
          openings[a[0]] > openings[b[0]] ? a : b, ['unknown', 0])[0]

        setData({
          totalGames,
          fetchedGames: games.length,
          winRate,
          drawRate,
          lossRate,
          highestElo,
          lowestElo,
          currentElo,
          averageElo,
          eloRange,
          whiteGames,
          whiteWinRate,
          blackGames,
          blackWinRate,
          mostPlayedTimeControl,
          mostPlayedOpening
        })

      } catch (err) {
        console.error('Error fetching comprehensive analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchAnalytics()
    }
  }, [userId, platform])

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Comprehensive Analytics</h3>
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-3/4 rounded bg-white/10"></div>
          <div className="h-4 w-1/2 rounded bg-white/10"></div>
          <div className="h-4 w-2/3 rounded bg-white/10"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-400/40 bg-rose-500/10 p-6 text-rose-100 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Comprehensive Analytics</h3>
        <div>{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Comprehensive Analytics</h3>
        <div className="text-slate-400">No data available</div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
      <h3 className="mb-4 text-lg font-semibold text-white">Comprehensive Analytics</h3>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Basic Statistics */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-300">Basic Statistics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Total Games:</span>
              <span className="font-semibold text-white">{data.totalGames}</span>
            </div>
            {data.totalGames !== data.fetchedGames && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Fetched:</span>
                <span>{data.fetchedGames} games</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Win Rate:</span>
              <span className="font-semibold text-emerald-300">{data.winRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Draw Rate:</span>
              <span className="font-semibold text-amber-300">{data.drawRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Loss Rate:</span>
              <span className="font-semibold text-rose-300">{data.lossRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* ELO Statistics */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-300">ELO Statistics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Highest:</span>
              <span className="font-semibold text-emerald-300">{data.highestElo}</span>
            </div>
            <div className="flex justify-between">
              <span>Lowest:</span>
              <span className="font-semibold text-rose-300">{data.lowestElo}</span>
            </div>
            <div className="flex justify-between">
              <span>Current:</span>
              <span className="font-semibold text-sky-300">{data.currentElo}</span>
            </div>
            <div className="flex justify-between">
              <span>Average:</span>
              <span className="font-semibold text-purple-300">{data.averageElo.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Range:</span>
              <span className="font-semibold text-amber-300">{data.eloRange}</span>
            </div>
          </div>
        </div>

        {/* Color Performance */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-300">Color Performance</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>White Games:</span>
              <span className="font-medium">{data.whiteGames}</span>
            </div>
            <div className="flex justify-between">
              <span>White Win Rate:</span>
              <span className="font-medium text-green-600">{data.whiteWinRate.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Black Games:</span>
              <span className="font-medium">{data.blackGames}</span>
            </div>
            <div className="flex justify-between">
              <span>Black Win Rate:</span>
              <span className="font-medium text-green-600">{data.blackWinRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-300">Preferences</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Most Played TC:</span>
              <span className="font-medium text-blue-600">{data.mostPlayedTimeControl}</span>
            </div>
            <div className="flex justify-between">
              <span>Most Played Opening:</span>
              <span className="font-medium text-purple-600">{data.mostPlayedOpening}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
