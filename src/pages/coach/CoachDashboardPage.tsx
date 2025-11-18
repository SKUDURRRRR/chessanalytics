/**
 * Coach Dashboard Page
 * Main overview page for Coach tab
 */

import { useSearchParams, useNavigate } from 'react-router-dom'
import { PremiumGate } from '../../components/coach/PremiumGate'
import { DailyLessonCard } from '../../components/coach/DailyLessonCard'
import { WeaknessCard } from '../../components/coach/WeaknessCard'
import { StrengthCard } from '../../components/coach/StrengthCard'
import { useCoachDashboard } from '../../hooks/useCoachingData'
import { Link } from 'react-router-dom'
import LoadingModal from '../../components/LoadingModal'
import { useAuth } from '../../contexts/AuthContext'

export default function CoachDashboardPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  // For Coach, we need the authenticated user's UUID for premium check
  // But we also need the platform username for data lookup
  const platformUsername = searchParams.get('userId') || ''
  const platform = (searchParams.get('platform') || 'lichess') as 'lichess' | 'chess.com'
  const authenticatedUserId = user?.id || ''

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to access Coach features</p>
      </div>
    )
  }

  // Use authenticated user's UUID for API calls (premium check)
  // But pass platform username for data lookup if available
  const userIdForData = platformUsername || authenticatedUserId

  return (
    <PremiumGate>
      <CoachDashboardContent userId={authenticatedUserId} platformUsername={userIdForData} platform={platform} />
    </PremiumGate>
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

  // Debug logging
  if (dashboard) {
    console.log('[COACH_DASHBOARD] Dashboard data:', {
      hasDailyLesson: !!dashboard.daily_lesson,
      weaknessesCount: dashboard.top_weaknesses?.length || 0,
      strengthsCount: dashboard.top_strengths?.length || 0,
      activityCount: dashboard.recent_activity?.length || 0,
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Coach Dashboard</h1>
          <p className="text-slate-400">Personalized chess coaching based on your games</p>
        </div>

        {/* Daily Lesson */}
        <div className="mb-8">
          <DailyLessonCard lesson={dashboard?.daily_lesson || null} loading={loading} />
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

        {/* Quick Links */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold text-white mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link
              to="/coach/play"
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/20 p-6 hover:bg-emerald-500/30 transition-colors text-center shadow-[0_0_8px_rgba(16,185,129,0.15)]"
            >
              <div className="text-3xl mb-2">♟️</div>
              <h3 className="font-semibold text-emerald-100 mb-1">Play with Tal Coach</h3>
              <p className="text-sm text-emerald-200/80">Practice against AI</p>
            </Link>
            <Link
              to="/coach/lessons"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-6 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-3xl mb-2">📚</div>
              <h3 className="font-semibold text-white mb-1">Lessons</h3>
              <p className="text-sm text-slate-400">Personalized lessons</p>
            </Link>
            <Link
              to="/coach/puzzles"
              className="rounded-xl border border-white/10 bg-white/[0.05] p-6 hover:bg-white/[0.08] transition-colors text-center"
            >
              <div className="text-3xl mb-2">🧩</div>
              <h3 className="font-semibold text-white mb-1">Puzzles</h3>
              <p className="text-sm text-slate-400">Practice puzzles</p>
            </Link>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-6 text-center opacity-50">
              <div className="text-3xl mb-2">📊</div>
              <h3 className="font-semibold text-white mb-1">Progress</h3>
              <p className="text-sm text-slate-400">Coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
