/**
 * Account Setup Modal
 * Shows on first login to prompt users to connect their chess platform accounts.
 */

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { CheckCircle2, X, Loader2 } from 'lucide-react'

export function AccountSetupModal() {
  const { user, completeOnboarding, linkChessAccount } = useAuth()
  const [chessComUsername, setChessComUsername] = useState('')
  const [lichessUsername, setLichessUsername] = useState('')
  const [chessComLinked, setChessComLinked] = useState(false)
  const [lichessLinked, setLichessLinked] = useState(false)
  const [chessComLoading, setChessComLoading] = useState(false)
  const [lichessLoading, setLichessLoading] = useState(false)
  const [chessComError, setChessComError] = useState('')
  const [lichessError, setLichessError] = useState('')
  const [chessComGamesClaimed, setChessComGamesClaimed] = useState<number | null>(null)
  const [lichessGamesClaimed, setLichessGamesClaimed] = useState<number | null>(null)
  const [closing, setClosing] = useState(false)

  // Don't show if user hasn't loaded, onboarding status unknown (still fetching), or already completed
  if (!user || user.onboardingCompleted !== false) return null

  const handleLinkChessCom = async () => {
    if (!chessComUsername.trim()) return
    setChessComLoading(true)
    setChessComError('')

    const { error, games_claimed } = await linkChessAccount('chess.com', chessComUsername.trim())

    if (error) {
      setChessComError(error.message)
    } else {
      setChessComLinked(true)
      setChessComGamesClaimed(games_claimed ?? 0)
    }
    setChessComLoading(false)
  }

  const handleLinkLichess = async () => {
    if (!lichessUsername.trim()) return
    setLichessLoading(true)
    setLichessError('')

    const { error, games_claimed } = await linkChessAccount('lichess', lichessUsername.trim())

    if (error) {
      setLichessError(error.message)
    } else {
      setLichessLinked(true)
      setLichessGamesClaimed(games_claimed ?? 0)
    }
    setLichessLoading(false)
  }

  const handleClose = async () => {
    setClosing(true)
    await completeOnboarding()
    setClosing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0d0f]/90 p-4">
      <div className="max-w-lg w-full rounded-lg bg-surface-1 p-8 shadow-card">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-2">Connect your chess account</h2>
            <p className="text-gray-500 text-sm">
              Link your Chess.com or Lichess username to get personalized analytics, coaching, and puzzles.
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={closing}
            className="text-gray-500 hover:text-gray-400 transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chess.com Section */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Chess.com username
          </label>
          {chessComLinked ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 shadow-card px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-200 font-medium">{chessComUsername}</span>
              {chessComGamesClaimed !== null && chessComGamesClaimed > 0 && (
                <span className="text-emerald-400/70 text-sm ml-auto">
                  {chessComGamesClaimed} games linked
                </span>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={chessComUsername}
                onChange={(e) => { setChessComUsername(e.target.value); setChessComError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkChessCom()}
                placeholder="e.g. RapidDude"
                disabled={chessComLoading}
                className="flex-1 rounded-lg bg-surface-2 shadow-card px-4 py-3 text-gray-300 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleLinkChessCom}
                disabled={chessComLoading || !chessComUsername.trim()}
                className="rounded-lg bg-emerald-500/10 shadow-card px-5 py-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {chessComLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </button>
            </div>
          )}
          {chessComError && (
            <p className="mt-2 text-sm text-rose-400">{chessComError}</p>
          )}
        </div>

        {/* Lichess Section */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Lichess username
          </label>
          {lichessLinked ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 shadow-card px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-200 font-medium">{lichessUsername}</span>
              {lichessGamesClaimed !== null && lichessGamesClaimed > 0 && (
                <span className="text-emerald-400/70 text-sm ml-auto">
                  {lichessGamesClaimed} games linked
                </span>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={lichessUsername}
                onChange={(e) => { setLichessUsername(e.target.value); setLichessError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleLinkLichess()}
                placeholder="e.g. DrNykterstein"
                disabled={lichessLoading}
                className="flex-1 rounded-lg bg-surface-2 shadow-card px-4 py-3 text-gray-300 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition-colors disabled:opacity-50"
              />
              <button
                onClick={handleLinkLichess}
                disabled={lichessLoading || !lichessUsername.trim()}
                className="rounded-lg bg-emerald-500/10 shadow-card px-5 py-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {lichessLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </button>
            </div>
          )}
          {lichessError && (
            <p className="mt-2 text-sm text-rose-400">{lichessError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleClose}
            disabled={closing}
            className="text-sm text-gray-500 hover:text-gray-400 transition-colors"
          >
            {closing ? 'Saving...' : 'Skip for now'}
          </button>

          {(chessComLinked || lichessLinked) && (
            <button
              onClick={handleClose}
              disabled={closing}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {closing ? 'Saving...' : 'Done'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
