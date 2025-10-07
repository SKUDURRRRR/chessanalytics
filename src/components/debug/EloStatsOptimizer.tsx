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
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">ELO Stats Optimizer</h3>
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
        <h3 className="mb-4 text-lg font-semibold text-white">ELO Stats Optimizer</h3>
        <div>{error}</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">ELO Stats Optimizer</h3>
        <div className="text-slate-400">No ELO data available</div>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
      <h3 className="mb-4 text-lg font-semibold text-white">ELO Stats Optimizer</h3>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Current Status */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-300">Current Status</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Current Rating:</span>
              <span className="font-semibold text-sky-300">{stats.currentRating}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Games:</span>
              <span className="font-semibold text-white">{stats.totalGames}</span>
            </div>
            <div className="flex justify-between">
              <span>Recent Games:</span>
              <span className="font-semibold text-white">{stats.recentGames}</span>
            </div>
          </div>
        </div>

        {/* Rating Range */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-300">Rating Range</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Highest:</span>
              <span className="font-semibold text-emerald-300">{stats.highestRating}</span>
            </div>
            <div className="flex justify-between">
              <span>Lowest:</span>
              <span className="font-semibold text-rose-300">{stats.lowestRating}</span>
            </div>
            <div className="flex justify-between">
              <span>Range:</span>
              <span className="font-semibold text-amber-300">{stats.ratingRange}</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-300">Performance Metrics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Average Rating:</span>
              <span className="font-semibold text-purple-300">{stats.averageRating.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Recent Average:</span>
              <span className="font-semibold text-indigo-300">{stats.recentAverage.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Improvement:</span>
              <span className={`font-semibold ${stats.improvement >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {stats.improvement >= 0 ? '+' : ''}{stats.improvement.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Volatility:</span>
              <span className="font-semibold text-slate-300">{stats.volatility.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.05] p-4">
        <h4 className="mb-2 font-medium text-slate-200">Insights</h4>
        <div className="space-y-2 text-sm">
          {stats.improvement > 0 && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-100">
              Improving: Recent performance is {stats.improvement.toFixed(0)} points above average.
            </div>
          )}
          {stats.improvement < 0 && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2 text-rose-100">
              Warning: Recent performance is {Math.abs(stats.improvement).toFixed(0)} points below average.
            </div>
          )}
          {stats.volatility > 100 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-2 text-amber-100">
              Warning: High rating volatility ({stats.volatility.toFixed(0)}) suggests inconsistent performance.
            </div>
          )}
          {stats.volatility < 50 && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-2 text-emerald-100">
              Steady: Low rating volatility ({stats.volatility.toFixed(0)}) indicates consistent performance.
            </div>
          )}
          {stats.ratingRange > 200 && (
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-2 text-sky-100">
              Trend: Large rating range ({stats.ratingRange}) shows significant improvement potential.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
