// @ts-nocheck
// ELO Data Debugger Component - Shows ELO data analysis and debugging
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getOpeningNameWithFallback } from '../../utils/openingIdentification'
import { getTimeControlCategory } from '../../utils/timeControlUtils'

interface EloDataDebuggerProps {
  userId: string
  platform: 'lichess' | 'chess.com'
}

interface EloData {
  gameId: string
  date: string
  userElo: number
  opponentElo: number
  result: string
  timeControl: string
  opening: string
}

export function EloDataDebugger({ userId, platform }: EloDataDebuggerProps) {
  const [data, setData] = useState<EloData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const fetchEloData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch ELO data from games
        const { data: games, error: gamesError } = await supabase
          .from('games')
          .select('id, played_at, my_rating, opponent_rating, result, time_control, opening')
          .eq('user_id', userId)
          .eq('platform', platform)
          .order('played_at', { ascending: false })
          .limit(100)

        if (gamesError) throw gamesError

        const eloData: EloData[] = games.map(game => ({
          gameId: game.id,
          date: game.played_at,
          userElo: game.my_rating || 0,
          opponentElo: game.opponent_rating || 0,
          result: game.result || 'unknown',
          timeControl: getTimeControlCategory(game.time_control || 'unknown'),
          opening: getOpeningNameWithFallback(game.opening || 'unknown')
        }))

        setData(eloData)

        // Calculate stats
        if (eloData.length > 0) {
          const userElos = eloData.map(d => d.userElo).filter(e => e > 0)
          const opponentElos = eloData.map(d => d.opponentElo).filter(e => e > 0)
          
          const stats = {
            totalGames: eloData.length,
            validUserElos: userElos.length,
            validOpponentElos: opponentElos.length,
            userEloRange: userElos.length > 0 ? Math.max(...userElos) - Math.min(...userElos) : 0,
            opponentEloRange: opponentElos.length > 0 ? Math.max(...opponentElos) - Math.min(...opponentElos) : 0,
            averageUserElo: userElos.length > 0 ? userElos.reduce((a, b) => a + b, 0) / userElos.length : 0,
            averageOpponentElo: opponentElos.length > 0 ? opponentElos.reduce((a, b) => a + b, 0) / opponentElos.length : 0,
            currentUserElo: userElos[0] || 0,
            highestUserElo: userElos.length > 0 ? Math.max(...userElos) : 0,
            lowestUserElo: userElos.length > 0 ? Math.min(...userElos) : 0
          }
          
          setStats(stats)
        }

      } catch (err) {
        console.error('Error fetching ELO data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch ELO data')
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchEloData()
    }
  }, [userId, platform])

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">ELO Data Debugger</h3>
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
        <h3 className="mb-4 text-lg font-semibold text-white">ELO Data Debugger</h3>
        <div>{error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
      <h3 className="text-lg font-semibold text-white">ELO Data Debugger</h3>
      
      {stats && (
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-5">
          <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-sky-200">Total Games</div>
            <div className="text-lg font-semibold text-white">{stats.totalGames}</div>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-200">Valid User ELOs</div>
            <div className="text-lg font-semibold text-white">{stats.validUserElos}</div>
          </div>
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-rose-200">Highest ELO</div>
            <div className="text-lg font-semibold text-white">{stats.highestUserElo}</div>
          </div>
          <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-purple-200">Current ELO</div>
            <div className="text-lg font-semibold text-white">{stats.currentUserElo}</div>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3">
            <div className="text-xs uppercase tracking-wide text-amber-200">ELO Range</div>
            <div className="text-lg font-semibold text-white">{stats.userEloRange}</div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-300">User ELO</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Opponent ELO</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Result</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Time Control</th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-300">Opening</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 bg-white/[0.02]">
            {data.slice(0, 20).map((game, index) => (
              <tr key={game.gameId} className={index % 2 === 0 ? 'bg-white/[0.03]' : 'bg-white/[0.01]'}>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-200">
                  {new Date(game.date).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm font-semibold text-sky-300">
                  {game.userElo || 'N/A'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-200">
                  {game.opponentElo || 'N/A'}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                    game.result === 'win'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : game.result === 'draw'
                        ? 'bg-amber-500/20 text-amber-200'
                        : game.result === 'loss'
                          ? 'bg-rose-500/20 text-rose-200'
                          : 'bg-slate-500/20 text-slate-200'
                  }`}>
                    {game.result}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-slate-200">
                  {game.timeControl}
                </td>
                <td className="max-w-xs truncate whitespace-nowrap px-3 py-2 text-sm text-slate-200">
                  {getOpeningNameWithFallback(game.opening)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data.length > 20 && (
        <div className="mt-4 text-center text-sm text-slate-400">
          Showing first 20 games of {data.length} total
        </div>
      )}

      {/* Top 5 Highest ELO Games Verification */}
      {data.length > 0 && (
        <div className="mt-6 space-y-2 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">
          <h4 className="text-lg font-semibold text-white">Top 5 Highest ELO Games (Verification)</h4>
          <div className="space-y-2">
            {data
              .sort((a, b) => b.userElo - a.userElo)
              .slice(0, 5)
              .map((game, index) => (
                <div key={game.gameId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400">#{index + 1}</span>
                    <span className="text-lg font-semibold text-white">{game.userElo}</span>
                    <span className="text-xs text-slate-300">{new Date(game.date).toLocaleDateString()}</span>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                      game.result === 'win'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : game.result === 'draw'
                          ? 'bg-amber-500/20 text-amber-200'
                          : 'bg-rose-500/20 text-rose-200'
                    }`}>
                      {game.result}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {game.timeControl}
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-3 text-xs text-amber-100">
            <strong className="text-white">Verification:</strong> The highest ELO shown above should match the "Highest ELO" in the main analytics display.
          </div>
        </div>
      )}
    </div>
  )
}
