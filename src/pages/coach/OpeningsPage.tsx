/**
 * Openings Page
 * Opening repertoire trainer with stats, deviations, and drill mode
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { OpeningRepertoire, OpeningDetail, Platform } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { useCoachUser } from '../../hooks/useCoachUser'
import { OpeningCard } from '../../components/coach/OpeningCard'
import { DrillMode } from '../../components/coach/DrillMode'
import LoadingModal from '../../components/LoadingModal'

export default function OpeningsPage() {
  const { platform, platformUsername, authenticatedUserId } = useCoachUser()

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to access Coach features</p>
      </div>
    )
  }

  if (!platformUsername) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Connect your chess account</h2>
          <p className="text-slate-300 mb-6">
            Link your Chess.com or Lichess account to analyze your opening repertoire.
          </p>
          <Link
            to="/profile"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Go to Profile to Connect
          </Link>
        </div>
      </div>
    )
  }

  return (
    <OpeningsContent
      platformUsername={platformUsername}
      platform={platform}
      authUserId={authenticatedUserId}
    />
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
  platformUsername,
  platform,
  authUserId,
}: {
  platformUsername: string
  platform: 'lichess' | 'chess.com'
  authUserId: string
}) {
  const navigate = useNavigate()
  const [repertoire, setRepertoire] = useState<OpeningRepertoire[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [expandedOpening, setExpandedOpening] = useState<string | null>(null)
  const [expandedDetail, setExpandedDetail] = useState<OpeningDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [drillPositions, setDrillPositions] = useState<DrillPosition[] | null>(null)
  const [drillOpening, setDrillOpening] = useState<OpeningRepertoire | null>(null)

  const fetchRepertoire = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      const data = await CoachingService.getRepertoire(platformUsername, platform, authUserId, refresh)
      setRepertoire(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load repertoire'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [platformUsername, platform, authUserId])

  useEffect(() => {
    fetchRepertoire()
  }, [fetchRepertoire])

  const handleOpeningClick = async (opening: OpeningRepertoire) => {
    const key = `${opening.opening_family}|${opening.color}`
    if (expandedOpening === key) {
      setExpandedOpening(null)
      setExpandedDetail(null)
      return
    }

    setExpandedOpening(key)
    setDetailLoading(true)
    try {
      const detail = await CoachingService.getOpeningDetail(
        platformUsername, platform, opening.opening_family, opening.color, authUserId
      )
      setExpandedDetail(detail)
    } catch {
      setExpandedDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const startDrill = async (opening: OpeningRepertoire) => {
    try {
      const positions = await CoachingService.getDrillPositions(
        platformUsername, platform, opening.opening_family, opening.color, authUserId
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

  const whiteOpenings = repertoire.filter((o) => o.color === 'white')
  const blackOpenings = repertoire.filter((o) => o.color === 'black')

  if (loading) {
    return <LoadingModal isOpen={true} message="Analyzing your opening repertoire..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-slate-300 mb-6">{error.message}</p>
          <button
            onClick={() => navigate('/coach')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
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
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
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
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <button
              onClick={() => navigate('/coach')}
              className="mb-2 text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-2 text-sm"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Opening Repertoire</h1>
            <p className="text-slate-400 mt-1">
              {repertoire.length} opening{repertoire.length !== 1 ? 's' : ''} tracked
            </p>
          </div>

          <button
            onClick={() => fetchRepertoire(true)}
            disabled={refreshing}
            className="px-4 py-2 text-sm font-medium bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 border border-white/10 rounded-xl transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Analysis'}
          </button>
        </div>

        {repertoire.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <p className="text-slate-400 text-lg mb-2">No openings analyzed yet</p>
            <p className="text-slate-500 text-sm">
              Play and analyze more games to build your opening repertoire.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* White Repertoire */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>&#9812;</span> White Repertoire
                <span className="text-sm font-normal text-slate-500">({whiteOpenings.length})</span>
              </h2>
              <div className="space-y-3">
                {whiteOpenings.map((opening) => {
                  const key = `${opening.opening_family}|${opening.color}`
                  return (
                    <div key={key}>
                      <OpeningCard
                        opening={opening}
                        onClick={() => handleOpeningClick(opening)}
                        isExpanded={expandedOpening === key}
                      />
                      {expandedOpening === key && (
                        <ExpandedDetail
                          detail={expandedDetail}
                          loading={detailLoading}
                          opening={opening}
                          onStartDrill={() => startDrill(opening)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Black Repertoire */}
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span>&#9818;</span> Black Repertoire
                <span className="text-sm font-normal text-slate-500">({blackOpenings.length})</span>
              </h2>
              <div className="space-y-3">
                {blackOpenings.map((opening) => {
                  const key = `${opening.opening_family}|${opening.color}`
                  return (
                    <div key={key}>
                      <OpeningCard
                        opening={opening}
                        onClick={() => handleOpeningClick(opening)}
                        isExpanded={expandedOpening === key}
                      />
                      {expandedOpening === key && (
                        <ExpandedDetail
                          detail={expandedDetail}
                          loading={detailLoading}
                          opening={opening}
                          onStartDrill={() => startDrill(opening)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
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
  opening,
  onStartDrill,
}: {
  detail: OpeningDetail | null
  loading: boolean
  opening: OpeningRepertoire
  onStartDrill: () => void
}) {
  if (loading) {
    return (
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm text-slate-500 animate-pulse">Loading details...</p>
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {detail.total_games} total games with {opening.opening_family}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStartDrill()
          }}
          className="text-sm font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 py-1.5 px-4 rounded-lg transition-colors"
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
                <span className="text-slate-500">Move {dev.move_number}</span>
                <span className="text-white font-medium">{dev.expected_move}</span>
                <span className="text-slate-600">→</span>
                <span className="text-amber-300">{dev.actual_move}</span>
                <span className="text-slate-500 ml-auto">
                  {dev.deviation_frequency}% of games
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Games */}
      {detail.recent_games && detail.recent_games.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Recent Games</h4>
          <div className="space-y-1">
            {detail.recent_games.slice(0, 5).map((game, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-slate-400">
                <span className={`font-medium ${
                  game.result === 'win' ? 'text-emerald-400' : game.result === 'loss' ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {game.result === 'win' ? 'W' : game.result === 'loss' ? 'L' : 'D'}
                </span>
                <span>vs {game.opponent_rating || '?'}</span>
                {game.played_at && (
                  <span className="text-slate-600 ml-auto">
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
