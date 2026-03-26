/**
 * Coach Dashboard Page
 * Main overview page for Coach tab
 */

import { Link } from 'react-router-dom'
import { WeaknessCard } from '../../components/coach/WeaknessCard'
import { StrengthCard } from '../../components/coach/StrengthCard'
import { useCoachDashboard } from '../../hooks/useCoachingData'
import { useCoachUser } from '../../hooks/useCoachUser'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'

export default function CoachDashboardPage() {
  const { platform, platformUsername, authenticatedUserId, isLoading } = useCoachUser()

  return (
    <CoachPageGuard isLoading={isLoading} authenticatedUserId={authenticatedUserId} platformUsername={platformUsername}>
      <CoachDashboardContent userId={authenticatedUserId!} platformUsername={platformUsername!} platform={platform} />
    </CoachPageGuard>
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
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading Coach dashboard...</p>
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
            onClick={() => window.location.reload()}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-white mb-2">Coach Dashboard</h1>
          <p className="text-gray-500">Personalized chess coaching based on your games</p>
        </div>

        {/* Quick Links */}
        <div className="rounded-lg shadow-card bg-surface-1 p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Link
              to="/coach/play"
              className="rounded-lg shadow-card bg-emerald-500/20 p-5 hover:bg-emerald-500/30 transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9823;</div>
              <h3 className="font-semibold text-emerald-100 text-sm mb-0.5">Play with Tal</h3>
              <p className="text-xs text-emerald-200/70">Practice against AI</p>
            </Link>
            <Link
              to="/coach/review"
              className="rounded-lg shadow-card bg-surface-1 p-5 hover:bg-white/[0.04] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9813;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Game Review</h3>
              <p className="text-xs text-gray-500">Review with Coach</p>
            </Link>
            <Link
              to="/coach/puzzles"
              className="rounded-lg shadow-card bg-surface-1 p-5 hover:bg-white/[0.04] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9816;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Puzzles</h3>
              <p className="text-xs text-gray-500">Practice tactics</p>
            </Link>
            <Link
              to="/coach/progress"
              className="rounded-lg shadow-card bg-surface-1 p-5 hover:bg-white/[0.04] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9815;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Progress</h3>
              <p className="text-xs text-gray-500">Track improvement</p>
            </Link>
            <Link
              to="/coach/study-plan"
              className="rounded-lg shadow-card bg-surface-1 p-5 hover:bg-white/[0.04] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9814;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Study Plan</h3>
              <p className="text-xs text-gray-500">Weekly training</p>
            </Link>
            <Link
              to="/coach/openings"
              className="rounded-lg shadow-card bg-surface-1 p-5 hover:bg-white/[0.04] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9812;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Openings</h3>
              <p className="text-xs text-gray-500">Repertoire trainer</p>
            </Link>
            <Link
              to="/coach/positions"
              className="rounded-lg shadow-card bg-surface-1 p-5 hover:bg-white/[0.04] transition-colors text-center"
            >
              <div className="text-2xl mb-1.5">&#9817;</div>
              <h3 className="font-semibold text-white text-sm mb-0.5">Positions</h3>
              <p className="text-xs text-gray-500">Saved positions</p>
            </Link>
          </div>
        </div>

        {/* Game Review CTA */}
        <div className="mb-8">
          <Link
            to="/coach/review"
            className="block rounded-lg shadow-card bg-emerald-500/5 hover:bg-emerald-500/10 p-6 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">&#9813;</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  Review Your Games with Coach Tal
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Walk through key mistakes in your analyzed games and learn how to improve
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-500 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Weaknesses and Strengths */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-4">Your Top Weaknesses</h2>
            <div className="space-y-4">
              {dashboard?.top_weaknesses && Array.isArray(dashboard.top_weaknesses) && dashboard.top_weaknesses.length > 0 ? (
                dashboard.top_weaknesses.map((weakness, index) => (
                  <WeaknessCard key={index} weakness={weakness} />
                ))
              ) : (
                <p className="text-gray-500">No weaknesses identified yet. Keep playing to get personalized insights!</p>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-4">Your Top Strengths</h2>
            <div className="space-y-4">
              {dashboard?.top_strengths && Array.isArray(dashboard.top_strengths) && dashboard.top_strengths.length > 0 ? (
                dashboard.top_strengths.map((strength, index) => (
                  <StrengthCard key={index} strength={strength} />
                ))
              ) : (
                <p className="text-gray-500">No strengths identified yet. Complete some analyses to see your strengths!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
