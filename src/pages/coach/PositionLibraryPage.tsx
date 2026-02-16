/**
 * Position Library Page
 * Grid of saved chess positions with mini board previews
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { SavedPosition, Platform } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { useCoachUser } from '../../hooks/useCoachUser'
import { useAuth } from '../../contexts/AuthContext'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import LoadingModal from '../../components/LoadingModal'

export default function PositionLibraryPage() {
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
            Link your Chess.com or Lichess account to use the position library.
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
    <PositionLibraryContent
      platformUsername={platformUsername}
      platform={platform}
      authUserId={authenticatedUserId}
    />
  )
}

function PositionLibraryContent({
  platformUsername,
  platform,
  authUserId,
}: {
  platformUsername: string
  platform: 'lichess' | 'chess.com'
  authUserId: string
}) {
  const navigate = useNavigate()
  const [positions, setPositions] = useState<SavedPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const theme = getDarkChessBoardTheme()

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await CoachingService.getSavedPositions(platformUsername, platform, authUserId)
      setPositions(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load positions'))
    } finally {
      setLoading(false)
    }
  }, [platformUsername, platform, authUserId])

  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

  const handleDelete = async (positionId: string) => {
    if (!confirm('Delete this saved position?')) return
    try {
      await CoachingService.deletePosition(positionId, authUserId)
      setPositions((prev) => prev.filter((p) => p.id !== positionId))
      if (expandedId === positionId) setExpandedId(null)
    } catch {
      alert('Failed to delete position')
    }
  }

  const handleUpdateNotes = async (positionId: string) => {
    try {
      await CoachingService.updatePosition(positionId, { notes: editingNotes }, authUserId)
      setPositions((prev) =>
        prev.map((p) => (p.id === positionId ? { ...p, notes: editingNotes } : p))
      )
    } catch {
      alert('Failed to update notes')
    }
  }

  const filtered = positions.filter((p) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (p.title || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q) ||
      (p.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  })

  if (loading) {
    return <LoadingModal isOpen={true} message="Loading position library..." />
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
            <h1 className="text-3xl md:text-4xl font-bold text-white">Position Library</h1>
            <p className="text-slate-400 mt-1">{positions.length} saved position{positions.length !== 1 ? 's' : ''}</p>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search positions..."
            className="w-full md:w-64 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <p className="text-slate-400 text-lg mb-2">
              {positions.length === 0 ? 'No saved positions yet' : 'No positions match your search'}
            </p>
            <p className="text-slate-500 text-sm">
              Save positions from game analysis to build your library.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((pos) => (
              <div
                key={pos.id}
                className={`rounded-2xl border transition-all cursor-pointer ${
                  expandedId === pos.id
                    ? 'border-emerald-500/50 bg-white/[0.06] col-span-1 sm:col-span-2'
                    : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                }`}
                onClick={() => {
                  if (expandedId === pos.id) {
                    setExpandedId(null)
                  } else {
                    setExpandedId(pos.id)
                    setEditingNotes(pos.notes || '')
                  }
                }}
              >
                <div className="p-4">
                  <div className={`${expandedId === pos.id ? 'flex gap-6 flex-col sm:flex-row' : ''}`}>
                    {/* Mini board */}
                    <div className={`${expandedId === pos.id ? 'w-full sm:w-64 flex-shrink-0' : 'w-full'} aspect-square mb-3`}>
                      <Chessboard
                        position={pos.fen}
                        boardWidth={expandedId === pos.id ? 256 : 200}
                        arePiecesDraggable={false}
                        customDarkSquareStyle={theme.customDarkSquareStyle}
                        customLightSquareStyle={theme.customLightSquareStyle}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white truncate mb-1">
                        {pos.title || 'Untitled Position'}
                      </h3>

                      {pos.tags && pos.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {pos.tags.map((t, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {expandedId === pos.id ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <textarea
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            placeholder="Add notes about this position..."
                            rows={4}
                            className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500/50 resize-none mb-3"
                          />
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleUpdateNotes(pos.id)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              Save Notes
                            </button>
                            <button
                              onClick={() => handleDelete(pos.id)}
                              className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-600 mt-2 font-mono truncate">{pos.fen}</p>
                        </div>
                      ) : (
                        pos.notes && (
                          <p className="text-xs text-slate-400 line-clamp-2">{pos.notes}</p>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
