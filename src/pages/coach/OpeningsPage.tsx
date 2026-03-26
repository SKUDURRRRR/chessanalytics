/**
 * Openings Page
 * Opening repertoire trainer with stats, deviations, and drill mode.
 * Aggregates data from all linked chess platforms.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { OpeningRepertoire, OpeningDetail } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { useCoachUser } from '../../hooks/useCoachUser'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'
import { OpeningCard } from '../../components/coach/OpeningCard'
import { DrillMode } from '../../components/coach/DrillMode'

export default function OpeningsPage() {
  const { platformUsername, authenticatedUserId, linkedAccounts, isLoading } = useCoachUser()

  return (
    <CoachPageGuard
      isLoading={isLoading}
      authenticatedUserId={authenticatedUserId}
      platformUsername={platformUsername || (linkedAccounts.length > 0 ? linkedAccounts[0].username : null)}
      connectMessage="Link your Chess.com or Lichess account to analyze your opening repertoire."
    >
      <OpeningsContent
        authUserId={authenticatedUserId!}
        linkedAccounts={linkedAccounts}
      />
    </CoachPageGuard>
  )
}

interface DrillPosition {
  fen: string
  move_number: number
  your_move: string
  classification: string
  description: string
}

function OpeningsContent({
  authUserId,
  linkedAccounts,
}: {
  authUserId: string
  linkedAccounts: Array<{ platform: 'chess.com' | 'lichess'; username: string }>
}) {
  const navigate = useNavigate()
  const [repertoire, setRepertoire] = useState<OpeningRepertoire[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [expandedOpening, setExpandedOpening] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<OpeningDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)
  const [drillPositions, setDrillPositions] = useState<DrillPosition[] | null>(null)
  const [drillOpening, setDrillOpening] = useState<OpeningRepertoire | null>(null)

  const fetchRepertoire = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)

      // Fetch from all linked platforms in parallel
      const results = await Promise.all(
        linkedAccounts.map(async (account) => {
          const data = await CoachingService.getRepertoire(
            account.username, account.platform, authUserId, refresh
          )
          // Tag each entry with its platform
          return data.map((entry) => ({ ...entry, platform: account.platform }))
        })
      )

      // Merge results from all platforms
      const merged = results.flat()

      // Sort by games_played descending
      merged.sort((a, b) => b.games_played - a.games_played)

      setRepertoire(merged)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load repertoire'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [linkedAccounts, authUserId])

  useEffect(() => {
    fetchRepertoire()
  }, [fetchRepertoire])

  const handleOpeningClick = async (opening: OpeningRepertoire) => {
    const key = `${opening.opening_family}|${opening.color}|${opening.platform}`
    if (expandedOpening === key) {
      setExpandedOpening(null)
      setExpandedDetail(null)
      return
    }

    const account = linkedAccounts.find((a) => a.platform === opening.platform)
    if (!account) return

    setExpandedOpening(key)
    setDetailLoading(true)
    setDetailError(false)
    try {
      const detail = await CoachingService.getOpeningDetail(
        account.username, account.platform, opening.opening_family, opening.color, authUserId
      )
      setExpandedDetail(detail)
    } catch {
      setExpandedDetail(null)
      setDetailError(true)
    } finally {
      setDetailLoading(false)
    }
  }

  const startDrill = async (opening: OpeningRepertoire) => {
    const account = linkedAccounts.find((a) => a.platform === opening.platform)
    if (!account) return

    try {
      const positions = await CoachingService.getDrillPositions(
        account.username, account.platform, opening.opening_family, opening.color, authUserId
      )
      setDrillPositions(positions)
      setDrillOpening(opening)
    } catch {
      alert('Failed to load drill positions')
    }
  }

  const handleDrillComplete = async (correct: number, total: number) => {
    if (!drillOpening?.id) return
    const delta = correct > total / 2 ? 10 : -10
    try {
      await CoachingService.completeDrill(drillOpening.id, delta, authUserId)
      fetchRepertoire()
    } catch {
      // Silently fail
    }
  }

  const whiteOpenings = useMemo(() => repertoire.filter((o) => o.color === 'white'), [repertoire])
  const blackOpenings = useMemo(() => repertoire.filter((o) => o.color === 'black'), [repertoire])
  const hasBothPlatforms = linkedAccounts.length > 1

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-sm text-gray-500">Analyzing your opening repertoire...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg shadow-card bg-surface-1 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Error</h2>
          <p className="text-gray-400 mb-6">{error.message}</p>
          <button
            onClick={() => navigate('/coach')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Drill mode
  if (drillPositions && drillOpening) {
    return (
      <div className="min-h-screen bg-surface-base p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <DrillMode
            positions={drillPositions}
            openingName={drillOpening.opening_family}
            onComplete={handleDrillComplete}
            onClose={() => {
              setDrillPositions(null)
              setDrillOpening(null)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <button
              onClick={() => navigate('/coach')}
              className="mb-2 text-gray-500 hover:text-gray-400 transition-colors flex items-center gap-2 text-sm"
            >
              &larr; Back to Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-semibold text-white">Opening Repertoire</h1>
            <p className="text-gray-500 mt-1">
              {repertoire.length} opening{repertoire.length !== 1 ? 's' : ''} tracked
              {hasBothPlatforms && (
                <span className="text-gray-500">
                  {' '}across {linkedAccounts.map((a) => a.platform).join(' & ')}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => fetchRepertoire(true)}
            disabled={refreshing}
            className="px-4 py-2 text-sm font-medium bg-white/[0.06] hover:bg-white/[0.10] text-gray-400 shadow-card rounded-lg transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Analysis'}
          </button>
        </div>

        {repertoire.length === 0 ? (
          <div className="rounded-lg shadow-card bg-surface-1 p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">No openings analyzed yet</p>
            <p className="text-gray-500 text-sm">
              Play and analyze more games to build your opening repertoire.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* White Repertoire */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>{'\u2654'}</span> White Repertoire
                <span className="text-sm font-normal text-gray-500">({whiteOpenings.length})</span>
              </h2>
              {whiteOpenings.length === 0 ? (
                <p className="text-sm text-gray-500 bg-white/[0.02] rounded-lg shadow-card p-4">
                  No white openings found yet. Analyze more games to see your white repertoire.
                </p>
              ) : (
                <div className="space-y-3">
                  {whiteOpenings.map((opening) => {
                    const key = `${opening.opening_family}|${opening.color}|${opening.platform}`
                    return (
                      <div key={key}>
                        <OpeningCard
                          opening={opening}
                          onClick={() => handleOpeningClick(opening)}
                          isExpanded={expandedOpening === key}
                          showPlatform={hasBothPlatforms}
                        />
                        {expandedOpening === key && (
                          <ExpandedDetail
                            detail={expandedDetail}
                            loading={detailLoading}
                            error={detailError}
                            opening={opening}
                            onStartDrill={() => startDrill(opening)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Black Repertoire */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>{'\u265A'}</span> Black Repertoire
                <span className="text-sm font-normal text-gray-500">({blackOpenings.length})</span>
              </h2>
              {blackOpenings.length === 0 ? (
                <p className="text-sm text-gray-500 bg-white/[0.02] rounded-lg shadow-card p-4">
                  No black openings found yet. Analyze more games to see your black repertoire.
                </p>
              ) : (
                <div className="space-y-3">
                  {blackOpenings.map((opening) => {
                    const key = `${opening.opening_family}|${opening.color}|${opening.platform}`
                    return (
                      <div key={key}>
                        <OpeningCard
                          opening={opening}
                          onClick={() => handleOpeningClick(opening)}
                          isExpanded={expandedOpening === key}
                          showPlatform={hasBothPlatforms}
                        />
                        {expandedOpening === key && (
                          <ExpandedDetail
                            detail={expandedDetail}
                            loading={detailLoading}
                            error={detailError}
                            opening={opening}
                            onStartDrill={() => startDrill(opening)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ExpandedDetail({
  detail,
  loading,
  error,
  opening,
  onStartDrill,
}: {
  detail: OpeningDetail | null
  loading: boolean
  error: boolean
  opening: OpeningRepertoire
  onStartDrill: () => void
}) {
  if (loading) {
    return (
      <div className="mt-2 rounded-lg shadow-card bg-white/[0.03] p-4">
        <p className="text-sm text-gray-500 animate-pulse">Loading details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-2 rounded-lg shadow-card bg-white/[0.03] p-4">
        <p className="text-sm text-gray-500">Failed to load details for {opening.opening_family}.</p>
      </div>
    )
  }

  if (!detail) return null

  // Type-safe access for fields the backend returns but aren't in the strict TS type
  const totalGames = (detail as Record<string, unknown>).total_games as number | undefined
  const recentGames = (detail as Record<string, unknown>).recent_games as Array<{
    result: string; opponent_rating?: number; played_at?: string
  }> | undefined

  return (
    <div className="mt-2 rounded-lg shadow-card bg-white/[0.03] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {totalGames ?? opening.games_played} total games with {opening.opening_family}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStartDrill()
          }}
          className="text-sm font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 shadow-card py-1.5 px-4 rounded-lg transition-colors"
        >
          Start Drill
        </button>
      </div>

      {/* Deviations */}
      {detail.deviations && detail.deviations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Deviation Points</h4>
          <div className="space-y-2">
            {detail.deviations.map((dev, i) => (
              <div key={i} className="flex items-center gap-3 text-xs bg-white/[0.03] rounded-lg p-2">
                <span className="text-gray-500">Move {dev.move_number}</span>
                <span className="text-white font-medium">{dev.expected_move}</span>
                <span className="text-gray-600">&rarr;</span>
                <span className="text-amber-300">{dev.actual_move}</span>
                <span className="text-gray-500 ml-auto">
                  {dev.deviation_frequency}% of games
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Games */}
      {recentGames && recentGames.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Recent Games</h4>
          <div className="space-y-1">
            {recentGames.slice(0, 5).map((game, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-gray-500">
                <span className={`font-medium ${
                  game.result === 'win' ? 'text-emerald-400' : game.result === 'loss' ? 'text-rose-400' : 'text-gray-500'
                }`}>
                  {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'D'}
                </span>
                <span>vs {game.opponent_rating || '?'}</span>
                {game.played_at && (
                  <span className="text-gray-600 ml-auto">
                    {new Date(game.played_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
