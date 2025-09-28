// ELO Data Debugger Component - Shows ELO data analysis and debugging
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
          opening: game.opening || 'unknown'
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
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Data Debugger</h3>
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
        <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Data Debugger</h3>
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">ELO Data Debugger</h3>
      
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 p-3 rounded">
            <div className="text-sm text-blue-600">Total Games</div>
            <div className="text-lg font-semibold text-blue-800">{stats.totalGames}</div>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <div className="text-sm text-green-600">Valid User ELOs</div>
            <div className="text-lg font-semibold text-green-800">{stats.validUserElos}</div>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <div className="text-sm text-red-600">Highest ELO</div>
            <div className="text-lg font-semibold text-red-800">{stats.highestUserElo}</div>
          </div>
          <div className="bg-purple-50 p-3 rounded">
            <div className="text-sm text-purple-600">Current ELO</div>
            <div className="text-lg font-semibold text-purple-800">{stats.currentUserElo}</div>
          </div>
          <div className="bg-orange-50 p-3 rounded">
            <div className="text-sm text-orange-600">ELO Range</div>
            <div className="text-lg font-semibold text-orange-800">{stats.userEloRange}</div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ELO</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opponent ELO</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Control</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Opening</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.slice(0, 20).map((game, index) => (
              <tr key={game.gameId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {new Date(game.date).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-blue-600">
                  {game.userElo || 'N/A'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {game.opponentElo || 'N/A'}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    game.result === 'win' ? 'bg-green-100 text-green-800' :
                    game.result === 'draw' ? 'bg-yellow-100 text-yellow-800' :
                    game.result === 'loss' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {game.result}
                  </span>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {game.timeControl}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 truncate max-w-xs">
                  {game.opening}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {data.length > 20 && (
        <div className="mt-4 text-sm text-gray-500 text-center">
          Showing first 20 games of {data.length} total
        </div>
      )}

      {/* Top 5 Highest ELO Games Verification */}
      {data.length > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-yellow-800 mb-3">🏆 Top 5 Highest ELO Games (Verification)</h4>
          <div className="space-y-2">
            {data
              .sort((a, b) => b.userElo - a.userElo)
              .slice(0, 5)
              .map((game, index) => (
                <div key={game.gameId} className="flex justify-between items-center bg-white p-2 rounded border">
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                    <span className="text-lg font-bold text-red-600">{game.userElo}</span>
                    <span className="text-sm text-gray-600">{new Date(game.date).toLocaleDateString()}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      game.result === 'win' ? 'bg-green-100 text-green-800' :
                      game.result === 'draw' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {game.result}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {game.timeControl}
                  </div>
                </div>
              ))}
          </div>
          <div className="mt-3 text-sm text-yellow-700">
            <strong>Verification:</strong> The highest ELO shown above should match the "Highest ELO" in the main analytics display.
          </div>
        </div>
      )}
    </div>
  )
}
