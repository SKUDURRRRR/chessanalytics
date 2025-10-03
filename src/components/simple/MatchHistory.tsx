// Match History Component - Shows recent games in a table format
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { normalizeOpeningName } from '../../utils/openingUtils'
import { MatchHistoryProps } from '../../types'

// Canonicalize user ID to match backend logic
function canonicalizeUserId(userId: string, platform: string): string {
  if (platform === 'chess.com') {
    return userId.trim().toLowerCase()
  } else { // lichess
    return userId.trim()
  }
}

interface Game {
  id: string
  played_at: string
  result: 'win' | 'loss' | 'draw'
  color: 'white' | 'black'
  opponent: string
  time_control: string
  opening_family: string
  moves: number
  rating: number
  opponent_rating: number
}


export function MatchHistory({ userId, platform, openingFilter, onClearFilter }: MatchHistoryProps) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const gamesPerPage = 20
  const escapeFilterValue = (value: string) => {
    const sanitized = value.replace(/"/g, '\\"')
    return `"${sanitized}"`
  }

  const filterKey = useMemo(() => {
    if (!openingFilter) {
      return 'none'
    }
    const families = openingFilter.identifiers.openingFamilies.join('|')
    const openings = openingFilter.identifiers.openings.join('|')
    return `${openingFilter.normalized}::${families}::${openings}`
  }, [openingFilter])

  const previousContextRef = useRef<{ userId: string; platform: string; filterKey: string }>(
    { userId: '', platform: '', filterKey: '' }
  )

  useEffect(() => {
    const previous = previousContextRef.current
    const contextChanged = previous.userId !== userId || previous.platform !== platform || previous.filterKey !== filterKey

    if (contextChanged && page !== 1) {
      setPage(1)
      return
    }

    const shouldReset = contextChanged || page === 1
    loadGames(shouldReset).finally(() => {
      previousContextRef.current = { userId, platform, filterKey }
    })
  }, [userId, platform, page, filterKey])

  const loadGames = async (reset: boolean = false) => {
    try {
      setLoading(true)
      setError(null)

      if (reset) {
        setGames([])
        setHasMore(true)
      }

      const canonicalUserId = canonicalizeUserId(userId, platform)
      let query = supabase
        .from('games')
        .select('*')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)

      // Apply opening filter if provided
      if (openingFilter) {
        const conditions: string[] = []
        openingFilter.identifiers.openingFamilies.forEach(family => {
          const formatted = escapeFilterValue(family)
          conditions.push(`opening_family.eq.${formatted}`)
        })
        openingFilter.identifiers.openings.forEach(opening => {
          const formatted = escapeFilterValue(opening)
          conditions.push(`opening.eq.${formatted}`)
        })

        if (conditions.length > 0) {
          // Combine conditions with or() using raw strings. Supabase requires each condition to be parentheses-safe.
          query = query.or(conditions.join(','))
        }
      }

      const currentPage = reset ? 1 : page
      const pageStart = (currentPage - 1) * gamesPerPage
      const pageEnd = currentPage * gamesPerPage - 1
      const { data, error: dbError } = await query
        .order('played_at', { ascending: false })
        .range(pageStart, pageEnd)

      if (dbError) {
        throw dbError
      }

      if (data) {
        // Additional client-side filtering for normalized opening names
        let filteredData = data
        if (openingFilter) {
          filteredData = data.filter(game => {
            const gameOpening = normalizeOpeningName(game.opening_family || game.opening || 'Unknown')
            return gameOpening === openingFilter.normalized
          })
        }

        const isReset = reset || page === 1
        if (isReset) {
          setGames(filteredData)
        } else {
          setGames(prev => [...prev, ...filteredData])
        }
        setHasMore(filteredData.length === gamesPerPage)
      }
    } catch (err) {
      console.error('Error loading games:', err)
      setError('Failed to load match history')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
  }

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win':
        return 'text-green-600'
      case 'loss':
        return 'text-red-600'
      case 'draw':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'win':
        return '✓'
      case 'loss':
        return '✗'
      case 'draw':
        return '='
      default:
        return '?'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading && games.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="text-gray-600">Loading match history...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <div className="text-red-500">❌</div>
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">♟️</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Games Found</h3>
          <p className="text-gray-600">No match history available for this user</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-800">Match History</h2>
            {openingFilter && (
              <div className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                <span>Filtered by: {openingFilter.normalized}</span>
                <button
                  onClick={onClearFilter}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                  title="Clear filter"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">{games.length} games loaded</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Date</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Result</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Color</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Opponent</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">
                  Time Control
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Opening</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Moves</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Rating</th>
              </tr>
            </thead>
            <tbody>
              {games.map(game => (
                <tr key={game.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2 text-sm text-gray-600">
                    <div>{formatDate(game.played_at)}</div>
                    <div className="text-xs text-gray-400">{formatTime(game.played_at)}</div>
                  </td>
                  <td className="py-3 px-2">
                    <span className={`font-medium ${getResultColor(game.result)}`}>
                      {getResultIcon(game.result)} {game.result.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600 capitalize">{game.color}</td>
                  <td className="py-3 px-2 text-sm text-gray-900">{game.opponent}</td>
                  <td className="py-3 px-2 text-sm text-gray-600">{getTimeControlCategory(game.time_control)}</td>
                  <td className="py-3 px-2 text-sm text-gray-600">
                    <div className="max-w-32 truncate" title={normalizeOpeningName(game.opening_family || 'Unknown')}>
                      {normalizeOpeningName(game.opening_family || 'Unknown')}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm text-gray-600">{game.moves}</td>
                  <td className="py-3 px-2 text-sm text-gray-600">
                    <div>{game.rating}</div>
                    <div className="text-xs text-gray-400">vs {game.opponent_rating}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Loading...' : 'Load More Games'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
