/**
 * Puzzles Page
 * Displays puzzle trainer interface
 */

import { useNavigate, Link } from 'react-router-dom'
import { usePuzzles, useDailyPuzzle } from '../../hooks/useCoachingData'
import LoadingModal from '../../components/LoadingModal'
import { useAuth } from '../../contexts/AuthContext'
import { useCoachUser } from '../../hooks/useCoachUser'

export default function PuzzlesPage() {
  const { usageStats } = useAuth()
  const { platform, platformUsername, authenticatedUserId } = useCoachUser()

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to access puzzles</p>
      </div>
    )
  }

  if (!platformUsername) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Connect your chess account</h2>
          <p className="text-slate-300 mb-6">
            Link your Chess.com or Lichess account to get personalized puzzles.
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

  // Check coach puzzle limits
  const coachPuzzles = usageStats?.coach_puzzles
  const puzzlesExhausted = coachPuzzles && !coachPuzzles.unlimited && (coachPuzzles.remaining ?? 0) <= 0

  return (
    <>
      {puzzlesExhausted && (
        <div className="bg-amber-900/30 border-b border-amber-500/30 px-4 py-3 text-center">
          <p className="text-amber-200 text-sm">
            You've used your free puzzles today.{' '}
            <Link to="/pricing" className="text-amber-300 underline hover:text-amber-100 font-medium">
              Upgrade to Pro
            </Link>{' '}
            for unlimited puzzles.
          </p>
        </div>
      )}
      <PuzzlesPageContent userId={platformUsername} platform={platform} />
    </>
  )
}

function PuzzlesPageContent({ userId, platform }: { userId: string; platform: 'lichess' | 'chess.com' }) {
  const navigate = useNavigate()
  const { puzzleSet, loading: puzzlesLoading } = usePuzzles(userId, platform)
  const { dailyPuzzle, loading: dailyLoading } = useDailyPuzzle(userId, platform)

  if (puzzlesLoading || dailyLoading) {
    return <LoadingModal isOpen={true} message="Loading puzzles..." />
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Puzzle Trainer</h1>
          <p className="text-slate-400">Practice puzzles generated from your game mistakes</p>
        </div>

        {/* Daily Puzzle */}
        {dailyPuzzle && (
          <div className="mb-8 rounded-3xl border border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⭐</span>
              <h2 className="text-2xl font-bold text-white">Daily Puzzle</h2>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 mb-4">
              <p className="text-slate-300 mb-2">{dailyPuzzle.explanation}</p>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <span>Category: {dailyPuzzle.puzzle_category}</span>
                {dailyPuzzle.tactical_theme && <span>Theme: {dailyPuzzle.tactical_theme}</span>}
                <span>Difficulty: {dailyPuzzle.difficulty_rating}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/coach/puzzles/solve', { state: { puzzle: dailyPuzzle } })}
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-6 rounded-xl transition-colors"
            >
              Solve Puzzle →
            </button>
          </div>
        )}

        {/* Puzzle Sets */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Your Puzzle Sets</h2>
          {puzzleSet && puzzleSet.total > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(puzzleSet.categorized).map(([category, puzzles]) => {
                if (puzzles.length === 0) return null
                return (
                  <div
                    key={category}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 cursor-pointer hover:bg-white/[0.08] transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-white mb-2 capitalize">{category}</h3>
                    <p className="text-slate-400 text-sm mb-4">{puzzles.length} puzzles</p>
                    <button
                      onClick={() => navigate('/coach/puzzles/solve', { state: { puzzles, category } })}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-xl transition-colors"
                    >
                      Start Practice
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-400">No puzzles available yet. Complete some game analyses to generate personalized puzzles.</p>
          )}
        </div>

        {/* Stats */}
        {puzzleSet && puzzleSet.total > 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <h2 className="text-xl font-bold text-white mb-4">Your Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 text-sm">Total Puzzles</p>
                <p className="text-2xl font-bold text-white">{puzzleSet.total}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Categories</p>
                <p className="text-2xl font-bold text-white">
                  {Object.values(puzzleSet.categorized).filter(p => p.length > 0).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
