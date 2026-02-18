/**
 * Coach Dashboard Page
 * Main overview page for Coach tab
 */

import { WeaknessCard } from '../../components/coach/WeaknessCard'
import { StrengthCard } from '../../components/coach/StrengthCard'
import { useCoachDashboard } from '../../hooks/useCoachingData'
import { Link } from 'react-router-dom'
import LoadingModal from '../../components/LoadingModal'
import { useCoachUser } from '../../hooks/useCoachUser'

export default function CoachDashboardPage() {
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
            Link your Chess.com or Lichess account to get personalized coaching, lessons, and puzzles based on your games.
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
    <CoachDashboardContent userId={authenticatedUserId} platformUsername={platformUsername} platform={platform} />
  )
}

function CoachDashboardContent({
  userId,
  platformUsername,
  platform
}: {
  userId: string
  platformUsername: string
  platform: 'lichess' | 'chess.com'
}) {
  // Use authenticated user's UUID for premium check, but platform username for data
  const { dashboard, loading, error } = useCoachDashboard(platformUsername, platform)

  if (loading) {
    return <LoadingModal isOpen={true} message="Loading Coach dashboard..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-slate-300 mb-6">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Coach Dashboard</h1>
          <p className="text-slate-400">Personalized chess coaching based on your games</p>
        </div>

        {/* Quick Links */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Link
              to="/coach/play"
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 p-5 hover:bg-emerald-500/30 transition-colors text-center shadow-[0_0_8px_rgba(16,185,129,0.15)]"
            >
              <div className="text-2xl mb-1.5">&#9823;</div>
              <h3 className="font-semibold text-emerald-100 text-sm mb-0.5">Play with Tal</h3>
              <p className="text-xs text-emerald-200/70">Practice against AI</p>
            </Link>
            <Link
              to="/coach/review"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-5 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9813;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Game Review</h3>
              <p className="text-xs text-slate-400">Review with Coach</p>
            </Link>
            <Link
              to="/coach/puzzles"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-5 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9816;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Puzzles</h3>
              <p className="text-xs text-slate-400">Practice tactics</p>
            </Link>
            <Link
              to="/coach/progress"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-5 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9815;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Progress</h3>
              <p className="text-xs text-slate-400">Track improvement</p>
            </Link>
            <Link
              to="/coach/study-plan"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-5 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9814;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Study Plan</h3>
              <p className="text-xs text-slate-400">Weekly training</p>
            </Link>
            <Link
              to="/coach/openings"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-5 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9812;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Openings</h3>
              <p className="text-xs text-slate-400">Repertoire trainer</p>
            </Link>
            <Link
              to="/coach/positions"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-5 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9817;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Positions</h3>
              <p className="text-xs text-slate-400">Saved positions</p>
            </Link>
          </div>
        </div>

        {/* Game Review CTA */}
        <div className="mb-8">
          <Link
            to="/coach/review"
            className="block rounded-2xl border border-emerald-400/20 bg-emerald-500/5 hover:bg-emerald-500/10 p-6 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">&#9813;</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  Review Your Games with Coach Tal
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Walk through key mistakes in your analyzed games and learn how to improve
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Weaknesses and Strengths */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Your Top Weaknesses</h2>
            <div className="space-y-4">
              {dashboard?.top_weaknesses && Array.isArray(dashboard.top_weaknesses) && dashboard.top_weaknesses.length > 0 ? (
                dashboard.top_weaknesses.map((weakness, index) => (
                  <WeaknessCard key={index} weakness={weakness} />
                ))
              ) : (
                <p className="text-slate-400">No weaknesses identified yet. Keep playing to get personalized insights!</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Your Top Strengths</h2>
            <div className="space-y-4">
              {dashboard?.top_strengths && Array.isArray(dashboard.top_strengths) && dashboard.top_strengths.length > 0 ? (
                dashboard.top_strengths.map((strength, index) => (
                  <StrengthCard key={index} strength={strength} />
                ))
              ) : (
                <p className="text-slate-400">No strengths identified yet. Complete some analyses to see your strengths!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
