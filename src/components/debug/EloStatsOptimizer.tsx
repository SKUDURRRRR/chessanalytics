// @ts-nocheck
// ELO Stats Optimizer Component - Shows ELO statistics optimization
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface EloStatsOptimizerProps {
  userId: string
  platform: 'lichess' | 'chess.com'
}

interface EloStats {
  totalGames: number
  currentRating: number
  highestRating: number
  lowestRating: number
  averageRating: number
  ratingRange: number
  recentGames: number
  recentAverage: number
  improvement: number
  volatility: number
}

export function EloStatsOptimizer({ userId, platform }: EloStatsOptimizerProps) {
  const [stats, setStats] = useState<EloStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEloStats = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch ELO data from games
        const { data: games, error: gamesError } = await supabase
          .from('games')
          .select('my_rating, played_at')
          .eq('user_id', userId)
          .eq('platform', platform)
          .not('my_rating', 'is', null)
          .order('played_at', { ascending: false })

        if (gamesError) throw gamesError

        if (!games || games.length === 0) {
          setStats(null)
          return
        }

        const elos = games.map(g => g.my_rating).filter(e => e && e > 0)
        
        if (elos.length === 0) {
          setStats(null)
          return
        }

        // Calculate comprehensive ELO statistics
        const totalGames = elos.length
        const currentRating = elos[0] || 0
        const highestRating = Math.max(...elos)
        const lowestRating = Math.min(...elos)
        const averageRating = elos.reduce((a, b) => a + b, 0) / elos.length
        const ratingRange = highestRating - lowestRating

        // Recent games (last 10)
        const recentGames = Math.min(10, elos.length)
        const recentElos = elos.slice(0, recentGames)
        const recentAverage = recentElos.reduce((a, b) => a + b, 0) / recentElos.length

        // Calculate improvement (recent vs overall)
        const improvement = recentAverage - averageRating

        // Calculate volatility (standard deviation)
        const variance = elos.reduce((acc, elo) => acc + Math.pow(elo - averageRating, 2), 0) / elos.length
        const volatility = Math.sqrt(variance)

        setStats({
          totalGames,
          currentRating,
          highestRating,
          lowestRating,
          averageRating,
          ratingRange,
          recentGames,
          recentAverage,
          improvement,
          volatility
        })

      } catch (err) {
        console.error('Error fetching ELO stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch ELO stats')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchEloStats()
    }
  }, [userId, platform])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Stats Optimizer</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Stats Optimizer</h3>
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Stats Optimizer</h3>
        <div className="text-gray-500">No ELO data available</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Stats Optimizer</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Current Status */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Current Status</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Current Rating:</span>
              <span className="font-medium text-blue-600">{stats.currentRating}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Games:</span>
              <span className="font-medium">{stats.totalGames}</span>
            </div>
            <div className="flex justify-between">
              <span>Recent Games:</span>
              <span className="font-medium">{stats.recentGames}</span>
            </div>
          </div>
        </div>

        {/* Rating Range */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Rating Range</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Highest:</span>
              <span className="font-medium text-green-600">{stats.highestRating}</span>
            </div>
            <div className="flex justify-between">
              <span>Lowest:</span>
              <span className="font-medium text-red-600">{stats.lowestRating}</span>
            </div>
            <div className="flex justify-between">
              <span>Range:</span>
              <span className="font-medium text-orange-600">{stats.ratingRange}</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Performance Metrics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Average Rating:</span>
              <span className="font-medium text-purple-600">{stats.averageRating.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Recent Average:</span>
              <span className="font-medium text-indigo-600">{stats.recentAverage.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Improvement:</span>
              <span className={`font-medium ${stats.improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.improvement >= 0 ? '+' : ''}{stats.improvement.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Volatility:</span>
              <span className="font-medium text-gray-600">{stats.volatility.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-700 mb-2">Insights</h4>
        <div className="text-sm text-gray-600 space-y-1">
          {stats.improvement > 0 && (
            <div className="text-green-600">Improving: Recent performance is {stats.improvement.toFixed(0)} points above average.</div>
          )}
          {stats.improvement < 0 && (
            <div className="text-red-600">Warning: Recent performance is {Math.abs(stats.improvement).toFixed(0)} points below average.</div>
          )}
          {stats.volatility > 100 && (
            <div className="text-orange-600">Warning: High rating volatility ({stats.volatility.toFixed(0)}) suggests inconsistent performance.</div>
          )}
          {stats.volatility < 50 && (
            <div className="text-green-600">Steady: Low rating volatility ({stats.volatility.toFixed(0)}) indicates consistent performance.</div>
          )}
          {stats.ratingRange > 200 && (
            <div className="text-blue-600">Trend: Large rating range ({stats.ratingRange}) shows significant improvement potential.</div>
          )}
        </div>
      </div>
    </div>
  )
}
