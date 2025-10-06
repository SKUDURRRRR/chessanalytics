// Match History Component - Shows recent games in a table format
import { useState, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { normalizeOpeningName } from '../../utils/openingUtils'
import { MatchHistoryProps, MatchHistoryGameSummary } from '../../types'
import UnifiedAnalysisService from '../../services/unifiedAnalysisService'
import { config } from '../../lib/config'

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
  provider_game_id?: string | null
  played_at: string
  result: 'win' | 'loss' | 'draw'
  color: 'white' | 'black'
  opponent: string
  time_control: string
  opening_family: string
  opening?: string | null
  moves: number | null
  rating: number | null
  opponent_rating: number | null
  accuracy?: number | null
}

const mapGameRow = (raw: any): Game => {
  const result: Game['result'] = raw.result === 'loss' || raw.result === 'draw' ? raw.result : 'win'
  const color: Game['color'] = raw.color === 'black' ? 'black' : 'white'

  return {
    id: raw.id,
    provider_game_id: raw.provider_game_id ?? null,
    played_at: raw.played_at,
    result,
    color,
    opponent: raw.opponent_name ?? raw.opponent ?? 'Unknown opponent',
    time_control: raw.time_control ?? 'Unknown',
    opening_family: raw.opening_family ?? raw.opening ?? 'Unknown',
    opening: raw.opening ?? null,
    moves: typeof raw.total_moves === 'number' ? raw.total_moves : (typeof raw.moves === 'number' ? raw.moves : null),
    rating: typeof raw.my_rating === 'number' ? raw.my_rating : (typeof raw.rating === 'number' ? raw.rating : null),
    opponent_rating: typeof raw.opponent_rating === 'number' ? raw.opponent_rating : null,
    accuracy: typeof raw.accuracy === 'number' ? raw.accuracy : null,
  }
}

export function MatchHistory({ userId, platform, openingFilter, opponentFilter, onClearFilter, onGameSelect }: MatchHistoryProps) {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [analyzedGameIds, setAnalyzedGameIds] = useState<Set<string>>(new Set())
  const [analysisLoadingIds, setAnalysisLoadingIds] = useState<Set<string>>(new Set())
  const [queuedGameIds, setQueuedGameIds] = useState<Set<string>>(new Set())
  const [analysisNotification, setAnalysisNotification] = useState<{ id: number; type: 'success' | 'error'; message: string } | null>(null)
  const [gameAnalyses, setGameAnalyses] = useState<Map<string, number>>(new Map())
  const gamesPerPage = 20
  const escapeFilterValue = (value: string) => {
    const sanitized = value.replace(/"/g, '\\"')
    return `"${sanitized}"`
  }

  const filterKey = useMemo(() => {
    const openingKey = openingFilter ? `${openingFilter.normalized}::${openingFilter.identifiers.openingFamilies.join('|')}::${openingFilter.identifiers.openings.join('|')}` : 'none'
    const opponentKey = opponentFilter || 'none'
    return `${openingKey}::${opponentKey}`
  }, [openingFilter, opponentFilter])

  const previousContextRef = useRef<{ userId: string; platform: string; filterKey: string }>(
    { userId: '', platform: '', filterKey: '' }
  )

  const markGameAsAnalyzed = (gameId: string, accuracy?: number) => {
    setAnalyzedGameIds(prev => {
      const next = new Set(prev)
      next.add(gameId)
      return next
    })
    setAnalysisLoadingIds(prev => {
      const next = new Set(prev)
      next.delete(gameId)
      return next
    })
    setQueuedGameIds(prev => {
      const next = new Set(prev)
      next.delete(gameId)
      return next
    })
    if (typeof accuracy === 'number') {
      setGameAnalyses(prev => {
        const next = new Map(prev)
        next.set(gameId, accuracy)
        return next
      })
    }
  }

  const markGameAsPending = (gameId: string) => {
    setAnalysisLoadingIds(prev => {
      const next = new Set(prev)
      next.add(gameId)
      return next
    })
  }

  const clearGamePending = (gameId: string) => {
    setAnalysisLoadingIds(prev => {
      const next = new Set(prev)
      next.delete(gameId)
      return next
    })
  }

  const markGameQueued = (gameId: string) => {
    setQueuedGameIds(prev => {
      const next = new Set(prev)
      next.add(gameId)
      return next
    })
  }

  const clearGameQueued = (gameId: string) => {
    setQueuedGameIds(prev => {
      const next = new Set(prev)
      next.delete(gameId)
      return next
    })
  }

  const triggerNotification = (type: 'success' | 'error', message: string) => {
    const notificationId = Date.now()
    setAnalysisNotification({ id: notificationId, type, message })
    setTimeout(() => {
      setAnalysisNotification(current => (current?.id === notificationId ? null : current))
    }, 5000)
  }

  const buildGameSummary = (game: Game): MatchHistoryGameSummary => ({
    id: game.id,
    provider_game_id: game.provider_game_id ?? null,
    played_at: game.played_at,
    result: game.result,
    color: game.color,
    opponent: game.opponent,
    time_control: game.time_control,
    opening_family: game.opening_family,
    opening: normalizeOpeningName(game.opening_family || game.opening || 'Unknown'),
    moves: game.moves,
    rating: game.rating,
    opponent_rating: game.opponent_rating,
  })

  const handleGameSelectInternal = (game: Game) => {
    if (!onGameSelect) {
      return
    }
    onGameSelect(buildGameSummary(game))
  }

  const isGameAnalyzed = (game: Game) => {
    const candidateIds = [game.provider_game_id, game.id].filter((id): id is string => Boolean(id))
    return candidateIds.some(id => analyzedGameIds.has(id))
  }

  const isAnalysisLoading = (game: Game) => {
    const candidateIds = [game.provider_game_id, game.id].filter((id): id is string => Boolean(id))
    return candidateIds.some(id => analysisLoadingIds.has(id))
  }

  const isQueuedForAnalysis = (game: Game) => {
    const candidateIds = [game.provider_game_id, game.id].filter((id): id is string => Boolean(id))
    return candidateIds.some(id => queuedGameIds.has(id))
  }

  const getGameAccuracy = (game: Game): number | null => {
    const candidateIds = [game.provider_game_id, game.id].filter((id): id is string => Boolean(id))
    for (const id of candidateIds) {
      const accuracy = gameAnalyses.get(id)
      if (typeof accuracy === 'number') {
        return accuracy
      }
    }
    return null
  }

  const requestAnalysis = async (event: ReactMouseEvent<HTMLButtonElement>, game: Game) => {
    event.stopPropagation()
    const gameIdentifier = game.provider_game_id || game.id
    if (!gameIdentifier) {
      triggerNotification('error', 'Missing game identifier for analysis request.')
      return
    }

    markGameAsPending(gameIdentifier)
    try {
      const { baseUrl } = config.getApi()
      const response = await fetch(`${baseUrl}/api/v1/analyze?use_parallel=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          platform,
          analysis_type: 'stockfish',
          game_id: gameIdentifier,
          provider_game_id: game.provider_game_id ?? null,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `Analysis request failed: ${response.status}`)
      }

      const payload = await response.json()
      const status = payload?.data?.status || 'started'

      if (status === 'queued') {
        markGameQueued(gameIdentifier)
        triggerNotification('success', 'Game queued for Stockfish analysis.')
      } else {
        markGameAsAnalyzed(gameIdentifier)
        triggerNotification('success', 'Stockfish analysis started successfully.')
        // Refresh analysis data after a short delay to get the accuracy
        setTimeout(async () => {
          try {
            const analyses = await UnifiedAnalysisService.getGameAnalyses(userId, platform, 'stockfish')
            const accuracyMap = new Map<string, number>()
            
            analyses.forEach(analysis => {
              const id = analysis?.game_id
              if (typeof id === 'string' && typeof analysis?.accuracy === 'number') {
                accuracyMap.set(id, analysis.accuracy)
              }
              const providerId = analysis?.provider_game_id
              if (typeof providerId === 'string' && typeof analysis?.accuracy === 'number') {
                accuracyMap.set(providerId, analysis.accuracy)
              }
            })
            
            setGameAnalyses(prev => {
              const next = new Map(prev)
              accuracyMap.forEach((accuracy, id) => next.set(id, accuracy))
              return next
            })
          } catch (error) {
            console.error('Error refreshing analysis data:', error)
          }
        }, 2000)
      }
    } catch (error) {
      console.error('Failed to request analysis:', error)
      triggerNotification('error', error instanceof Error ? error.message : 'Failed to request analysis.')
      clearGameQueued(gameIdentifier)
    } finally {
      clearGamePending(gameIdentifier)
    }
  }

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

      // Apply opponent filter if provided
      if (opponentFilter) {
        query = query.eq('opponent_name', opponentFilter)
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

        const mappedData = filteredData.map(mapGameRow)
        const isReset = reset || page === 1
        if (isReset) {
          setGames(mappedData)
        } else {
          setGames(prev => [...prev, ...mappedData])
        }
        setHasMore(mappedData.length === gamesPerPage)

        if (isReset) {
          const providerIds = mappedData
            .map(game => game.provider_game_id || game.id)
            .filter((id): id is string => Boolean(id))

          if (providerIds.length > 0) {
            try {
              const analyses = await UnifiedAnalysisService.getGameAnalyses(userId, platform, 'stockfish')
              const analyzedIds = new Set<string>()
              const accuracyMap = new Map<string, number>()

              analyses.forEach(analysis => {
                const id = analysis?.game_id
                if (typeof id === 'string') {
                  analyzedIds.add(id)
                  if (typeof analysis?.accuracy === 'number') {
                    accuracyMap.set(id, analysis.accuracy)
                  }
                }

                const providerId = analysis?.provider_game_id
                if (typeof providerId === 'string') {
                  analyzedIds.add(providerId)
                  if (typeof analysis?.accuracy === 'number') {
                    accuracyMap.set(providerId, analysis.accuracy)
                  }
                }
              })

              setAnalyzedGameIds(analyzedIds)
              setGameAnalyses(accuracyMap)
            } catch (analysisError) {
              console.error('Error fetching analysis states:', analysisError)
            }
          } else {
            setAnalyzedGameIds(new Set())
            setGameAnalyses(new Map())
          }
        }
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
        return 'Y'
      case 'loss':
        return 'N'
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
          <div className="text-red-500">X</div>
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="text-4xl mb-4">Chess</div>
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
                  X
                </button>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500">{games.length} games loaded</div>
        </div>

        {analysisNotification && (
          <div
            className={`mb-4 flex items-start justify-between rounded border px-3 py-2 text-sm ${
              analysisNotification.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">{analysisNotification.type === 'success' ? 'Knight' : 'Warning'}</span>
              <span>{analysisNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnalysisNotification(null)}
              className="ml-3 text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
        )}

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
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Accuracy</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-gray-700">Rating</th>
              </tr>
            </thead>
            <tbody>
              {games.map(game => {
                const isClickable = Boolean(onGameSelect)
                const baseRowClasses = 'border-b border-gray-100 hover:bg-gray-50'
                const interactiveExtras = 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                const rowClasses = isClickable ? `${baseRowClasses} ${interactiveExtras}` : baseRowClasses
                const handleKeyDown = (event: ReactKeyboardEvent<HTMLTableRowElement>) => {
                  if (!isClickable) {
                    return
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleGameSelectInternal(game)
                  }
                }

                const analyzed = isGameAnalyzed(game)
                const pending = isAnalysisLoading(game)
                const queued = isQueuedForAnalysis(game)

                return (
                  <tr
                    key={game.id}
                    className={rowClasses}
                    onClick={isClickable ? () => handleGameSelectInternal(game) : undefined}
                    onKeyDown={handleKeyDown}
                    tabIndex={isClickable ? 0 : undefined}
                    role={isClickable ? 'button' : undefined}
                  >
                    <td className="py-3 px-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div>
                          <div>{formatDate(game.played_at)}</div>
                          <div className="text-xs text-gray-400">{formatTime(game.played_at)}</div>
                        </div>
                        {queued && !analyzed && (
                          <span className="inline-flex items-center rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            In queue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${getResultColor(game.result)}`}>
                          {getResultIcon(game.result)} {game.result.toUpperCase()}
                        </span>
                      </div>
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
                      {(() => {
                        const accuracy = getGameAccuracy(game)
                        if (accuracy !== null) {
                          return (
                            <span className={`font-medium ${
                              accuracy >= 90 ? 'text-green-600' :
                              accuracy >= 80 ? 'text-blue-600' :
                              accuracy >= 70 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {accuracy.toFixed(1)}%
                            </span>
                          )
                        }
                        return <span className="text-gray-400">?%</span>
                      })()}
                    </td>
                    <td className="py-3 px-2 text-sm text-gray-600" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <div onClick={(e) => { e.stopPropagation(); if (isClickable) handleGameSelectInternal(game) }} className="cursor-pointer">
                          <div title={game.rating ? `Your rating: ${game.rating}` : 'Rating not available'}>
                            {game.rating ?? '--'}
                          </div>
                          <div className="text-xs text-gray-400" title={game.opponent_rating ? `Opponent rating: ${game.opponent_rating}` : 'Opponent rating not available'}>
                            vs {game.opponent_rating ?? '--'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={event => requestAnalysis(event, game)}
                          disabled={pending || analyzed}
                          className={`flex items-center gap-2 rounded px-2 py-1 text-xs font-medium transition-colors ${
                            analyzed
                              ? 'bg-green-100 text-green-700 cursor-default'
                              : pending
                                ? 'bg-gray-200 text-gray-500 cursor-wait'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          {pending ? (
                            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                          ) : (
                            <span>{analyzed ? 'Analyzed' : 'Analyze'}</span>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
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
