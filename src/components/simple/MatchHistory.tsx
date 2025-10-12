// Match History Component - Shows recent games in a table format
import { useState, useEffect, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { getOpeningNameWithFallback } from '../../utils/openingIdentification'
import { normalizeOpeningName } from '../../utils/openingUtils'
import { MatchHistoryProps, MatchHistoryGameSummary } from '../../types'
import UnifiedAnalysisService from '../../services/unifiedAnalysisService'
import { config } from '../../lib/config'
import { CHESS_ANALYSIS_COLORS } from '../../utils/chessColors'

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
  opening_normalized?: string | null
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

export function MatchHistory({ userId, platform, openingFilter, opponentFilter, onClearFilter, onGameSelect, onAnalyzedGamesChange }: MatchHistoryProps) {
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

  // Notify parent component when analyzed games change
  useEffect(() => {
    if (onAnalyzedGamesChange) {
      onAnalyzedGamesChange(analyzedGameIds)
    }
  }, [analyzedGameIds, onAnalyzedGamesChange])

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
    
    // Check if game is already analyzed
    const isAnalyzed = isGameAnalyzed(game)
    
    if (isAnalyzed) {
      // If analyzed, navigate to analysis page
      onGameSelect(buildGameSummary(game))
    } else {
      // If not analyzed, trigger analysis directly
      if (import.meta.env.DEV) {
        console.log('Game not analyzed, triggering analysis directly:', game.provider_game_id || game.id)
      }
      requestAnalysis(new Event('click'), game)
    }
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
        let errorMessage = `Analysis request failed: ${response.status}`
        
        // Try to extract error message from response
        try {
          const errorData = JSON.parse(text)
          if (errorData.message) {
            errorMessage = errorData.message
          } else if (errorData.detail) {
            errorMessage = errorData.detail
          }
        } catch {
          // If parsing fails, use the raw text if it's not too long
          if (text && text.length < 200) {
            errorMessage = text
          }
        }
        
        throw new Error(errorMessage)
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
          } catch (refreshError) {
            // Extract just the error message to avoid circular references
            const refreshErrorMsg = refreshError instanceof Error ? refreshError.message : String(refreshError)
            console.error('Error refreshing analysis data:', refreshErrorMsg)
          }
        }, 2000)
      }
    } catch (error) {
      // Extract just the error message to avoid any circular reference issues
      const errorMessage = error instanceof Error ? error.message : String(error) || 'Failed to request analysis.'
      console.error('Failed to request analysis:', errorMessage)
      triggerNotification('error', errorMessage)
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
        .select('id, user_id, platform, result, color, opening, opening_family, opening_normalized, accuracy, opponent_rating, my_rating, time_control, played_at, created_at, provider_game_id, total_moves, opponent_name')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)

      // Apply opening filter at database level using opening_normalized column
      if (openingFilter) {
        query = query.eq('opening_normalized', openingFilter.normalized)
      }

      // Apply opponent filter if provided
      if (opponentFilter) {
        query = query.eq('opponent_name', opponentFilter)
      }

      // When filtering by opening, fetch ALL games without limit
      // This is necessary because we filter client-side after fetching
      // TODO: Once opening_normalized column exists, restore pagination for filtered queries
      const currentPage = reset ? 1 : page
      const pageStart = (currentPage - 1) * gamesPerPage
      const pageEnd = currentPage * gamesPerPage - 1
      
      // Database filtering works now, use normal pagination
      const { data, error: dbError } = await query
        .order('played_at', { ascending: false })
        .range(pageStart, pageEnd)

      if (dbError) {
        throw dbError
      }

      if (data) {
        // Database filtering via opening_normalized - no client-side filtering needed
        const mappedData = data.map(mapGameRow)
        const isReset = reset || page === 1
        if (isReset) {
          setGames(mappedData)
        } else {
          setGames(prev => [...prev, ...mappedData])
        }
        
        // Normal pagination for all cases
        setHasMore(data.length === gamesPerPage)

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
              const errorMsg = analysisError instanceof Error ? analysisError.message : String(analysisError)
              console.error('Error fetching analysis states:', errorMsg)
            }
          } else {
            setAnalyzedGameIds(new Set())
            setGameAnalyses(new Map())
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('Error loading games:', errorMessage)
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
        return 'text-yellow-600'
      default:
        return 'text-slate-300'
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-slate-200">
        <div className="flex items-center justify-center gap-3 text-sm">
          <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <span className="text-slate-200">Loading match history…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        <div className="flex items-center gap-2">
          <span className="text-lg">!</span>
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 text-center text-slate-200">
        <div className="text-4xl text-slate-500">♘</div>
        <h3 className="mt-4 text-lg font-semibold text-white">No Games Found</h3>
        <p className="mt-2 text-sm text-slate-400">We couldn’t locate any games for this filter yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-slate-200">
      <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 shadow-xl shadow-black/50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-white">Match History</h2>
            {openingFilter && (
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-200">
                <span>Filtered by {openingFilter.normalized}</span>
                <button
                  onClick={onClearFilter}
                  className="text-sky-100 transition hover:text-white"
                  title="Clear filter"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="py-4 text-xs uppercase tracking-wider text-slate-400">{games.length} games loaded</div>

        {analysisNotification && (
          <div className={`mb-4 flex items-start justify-between rounded-2xl border px-3 py-3 text-sm ${analysisNotification.type === 'success' ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100' : 'border-rose-400/40 bg-rose-500/10 text-rose-100'}`}>
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">{analysisNotification.type === 'success' ? '✓' : '!'}</span>
              <span>{analysisNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setAnalysisNotification(null)}
              className="ml-3 text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
        )}

        {/* Mobile: Card Layout */}
        <div className="block lg:hidden space-y-3">
          {games.map(game => {
            const analyzed = isGameAnalyzed(game)
            const pending = isAnalysisLoading(game)
            const queued = isQueuedForAnalysis(game)
            const accuracy = getGameAccuracy(game)

            return (
              <div
                key={game.id}
                onClick={onGameSelect ? () => handleGameSelectInternal(game) : undefined}
                className={`card-responsive cursor-pointer transition hover:bg-white/[0.08] ${
                  onGameSelect ? 'hover:scale-[1.02]' : ''
                } ${
                  !analyzed && onGameSelect ? 'border-l-4 border-l-sky-400/60' : ''
                }`}
                title={onGameSelect ? (analyzed ? 'View analysis' : 'Click to analyze this game') : undefined}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${getResultColor(game.result)}`}>
                        {game.result.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">{game.color}</span>
                      {queued && !analyzed && (
                        <span className="inline-flex items-center rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                          In queue
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-white truncate">{game.opponent}</div>
                    <div className="text-xs text-slate-400">
                      {formatDate(game.played_at)} • {formatTime(game.played_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">{game.rating ?? '--'}</div>
                    <div className="text-xs text-slate-400">vs {game.opponent_rating ?? '--'}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Time Control:</span>
                    <div className="font-medium text-slate-200">{getTimeControlCategory(game.time_control)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Moves:</span>
                    <div className="font-medium text-slate-200">{game.moves}</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Opening:</span>
                    <div className="font-medium text-slate-200 truncate" title={getOpeningNameWithFallback(game.opening_family, game)}>
                      {getOpeningNameWithFallback(game.opening_family, game)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400">Accuracy:</span>
                    <div className="font-medium">
                      {accuracy !== null ? (
                        <span className={
                          accuracy >= 90 ? CHESS_ANALYSIS_COLORS.accuracy :
                          accuracy >= 80 ? 'text-blue-600' :
                          accuracy >= 70 ? CHESS_ANALYSIS_COLORS.inaccuracies :
                          CHESS_ANALYSIS_COLORS.blunders
                        }>
                          {accuracy.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-500">?%</span>
                      )}
                    </div>
                  </div>
                </div>

                {onGameSelect && (
                  <div className="mt-3 flex items-center justify-between">
                    {!analyzed && !pending && (
                      <div className="text-xs text-sky-300/80">
                        Click to analyze
                      </div>
                    )}
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={event => {
                          event.stopPropagation()
                          requestAnalysis(event, game)
                        }}
                        disabled={pending || analyzed}
                        className={`btn-touch-sm rounded-full text-xs font-medium transition ${
                          analyzed
                            ? 'cursor-default border border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                            : pending
                              ? 'cursor-wait border border-white/10 bg-white/5 text-slate-400'
                              : 'border border-sky-400/40 bg-sky-500/10 text-sky-200 hover:border-sky-300/60 hover:bg-sky-500/20'
                        }`}
                      >
                        {pending ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-flex h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                            Analyzing...
                          </span>
                        ) : (
                          <span>{analyzed ? 'Analyzed' : 'Analyze'}</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Desktop: Table Layout */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-3 px-2 text-left">Date</th>
                <th className="py-3 px-2 text-left">Result</th>
                <th className="py-3 px-2 text-left">Color</th>
                <th className="py-3 px-2 text-left">Opponent</th>
                <th className="py-3 px-2 text-left">Time Control</th>
                <th className="py-3 px-2 text-left">Opening</th>
                <th className="py-3 px-2 text-left">Moves</th>
                <th className="py-3 px-2 text-left">Accuracy</th>
                <th className="py-3 px-2 text-left">Rating</th>
              </tr>
            </thead>
            <tbody>
              {games.map(game => {
                const isClickable = Boolean(onGameSelect)
                const analyzed = isGameAnalyzed(game)
                const baseRowClasses = 'border-b border-white/5 transition'
                const interactiveExtras = 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 hover:bg-white/[0.07]'
                const unanalyzedIndicator = !analyzed && isClickable ? 'border-l-4 border-l-sky-400/60' : ''
                const rowClasses = isClickable ? `${baseRowClasses} ${interactiveExtras} ${unanalyzedIndicator}` : baseRowClasses
                const handleKeyDown = (event: ReactKeyboardEvent<HTMLTableRowElement>) => {
                  if (!isClickable) {
                    return
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    handleGameSelectInternal(game)
                  }
                }

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
                    title={isClickable ? (analyzed ? 'View analysis' : 'Click to analyze this game') : undefined}
                  >
                    <td className="py-3 px-2 text-sm text-slate-300">
                      <div className="flex items-center gap-2">
                        <div>
                          <div>{formatDate(game.played_at)}</div>
                          <div className="text-xs text-slate-500">{formatTime(game.played_at)}</div>
                        </div>
                        {queued && !analyzed && (
                          <span className="inline-flex items-center rounded bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300">
                            In queue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${getResultColor(game.result)}`}>
                          {game.result.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-300 capitalize">{game.color}</td>
                    <td className="py-3 px-2 text-sm text-slate-100">{game.opponent}</td>
                    <td className="py-3 px-2 text-sm text-slate-300">{getTimeControlCategory(game.time_control)}</td>
                    <td className="py-3 px-2 text-sm text-slate-300">
                      <div className="max-w-32 truncate" title={getOpeningNameWithFallback(game.opening_family, game)}>
                        {getOpeningNameWithFallback(game.opening_family, game)}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-300">{game.moves}</td>
                    <td className="py-3 px-2 text-sm text-slate-300">
                      {(() => {
                        const accuracy = getGameAccuracy(game)
                        if (accuracy !== null) {
                          return (
                            <span className={`font-medium ${
                              accuracy >= 90 ? CHESS_ANALYSIS_COLORS.accuracy :
                              accuracy >= 80 ? 'text-blue-600' :
                              accuracy >= 70 ? CHESS_ANALYSIS_COLORS.inaccuracies :
                              CHESS_ANALYSIS_COLORS.blunders
                            }`}>
                              {accuracy.toFixed(1)}%
                            </span>
                          )
                        }
                        return <span className="text-slate-500">?%</span>
                      })()}
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-300" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <div
                          onClick={e => {
                            e.stopPropagation()
                            if (isClickable) handleGameSelectInternal(game)
                          }}
                          className="cursor-pointer"
                        >
                          <div title={game.rating ? `Your rating: ${game.rating}` : 'Rating not available'}>
                            {game.rating ?? '--'}
                          </div>
                          <div
                            className="text-xs text-slate-500"
                            title={game.opponent_rating ? `Opponent rating: ${game.opponent_rating}` : 'Opponent rating not available'}
                          >
                            vs {game.opponent_rating ?? '--'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={event => requestAnalysis(event, game)}
                          disabled={pending || analyzed}
                          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition ${
                            analyzed
                              ? 'cursor-default border border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                              : pending
                                ? 'cursor-wait border border-white/10 bg-white/5 text-slate-400'
                                : 'border border-sky-400/40 bg-sky-500/10 text-sky-200 hover:border-sky-300/60 hover:bg-sky-500/20'
                          }`}
                        >
                          {pending ? (
                            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
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
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Loading...' : 'Load More Games'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
