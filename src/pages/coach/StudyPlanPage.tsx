/**
 * Study Plan Page
 * Weekly structured training plan with daily activities and goal tracking
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { StudyPlan, UserGoal, DailyActivity } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { useCoachUser } from '../../hooks/useCoachUser'
import LoadingModal from '../../components/LoadingModal'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const ACTIVITY_ICONS: Record<string, string> = {
  puzzle: '&#9823;',
  lesson: '&#9813;',
  review: '&#9814;',
  play: '&#9812;',
}

const ACTIVITY_COLORS: Record<string, string> = {
  puzzle: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
  lesson: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
  review: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  play: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
}

export default function StudyPlanPage() {
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
            Link your Chess.com or Lichess account to get a personalized study plan.
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
    <StudyPlanContent
      platformUsername={platformUsername}
      platform={platform}
      authUserId={authenticatedUserId}
    />
  )
}

function StudyPlanContent({
  platformUsername,
  platform,
  authUserId,
}: {
  platformUsername: string
  platform: 'lichess' | 'chess.com'
  authUserId: string
}) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const [goals, setGoals] = useState<UserGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const today = new Date().getDay()
  // Convert to Monday=0 format
  const todayIndex = today === 0 ? 6 : today - 1

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true)
      const [planData, goalsData] = await Promise.all([
        CoachingService.getStudyPlan(platformUsername, platform, authUserId),
        CoachingService.getGoals(platformUsername, platform, authUserId),
      ])
      setPlan(planData)
      setGoals(goalsData)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load study plan'))
    } finally {
      setLoading(false)
    }
  }, [platformUsername, platform, authUserId])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const newPlan = await CoachingService.createStudyPlan(platformUsername, platform, authUserId)
      setPlan(newPlan)
      // Refresh goals
      const goalsData = await CoachingService.getGoals(platformUsername, platform, authUserId)
      setGoals(goalsData)
    } catch {
      alert('Failed to generate study plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleCompleteActivity = async (day: number, activityIndex: number) => {
    if (!plan?.id) return
    try {
      const updatedPlan = await CoachingService.completeActivity(plan.id, day, activityIndex, authUserId)
      setPlan(updatedPlan)
    } catch {
      alert('Failed to mark activity as complete')
    }
  }

  if (loading) {
    return <LoadingModal isOpen={true} message="Loading study plan..." />
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

  const dailyActivities = plan?.daily_activities || {}

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <button
              onClick={() => navigate('/coach')}
              className="mb-2 text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-2 text-sm"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Study Plan</h1>
            {plan && (
              <p className="text-slate-400 mt-1">
                Week {plan.week_number} - {plan.week_start}
              </p>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : plan ? 'New Plan' : 'Generate Plan'}
          </button>
        </div>

        {!plan ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-12 text-center">
            <p className="text-slate-400 text-lg mb-2">No active study plan</p>
            <p className="text-slate-500 text-sm mb-6">
              Generate a personalized weekly plan based on your weaknesses.
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Study Plan'}
            </button>
          </div>
        ) : (
          <>
            {/* Goals Section */}
            {plan.goals && plan.goals.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4">Weekly Goals</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plan.goals.map((goal, i) => {
                    const matchingGoal = goals.find((g) => g.goal_type === goal.type)
                    const current = matchingGoal?.current_value || 0
                    const target = goal.target || 1
                    const pct = Math.min(100, Math.round((current / target) * 100))

                    return (
                      <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                        <p className="text-sm font-medium text-white mb-2">{goal.description}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap">
                            {current}/{target}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Weekly Calendar */}
            <h2 className="text-xl font-bold text-white mb-4">Daily Activities</h2>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-8">
              {DAY_NAMES.map((dayName, dayIdx) => {
                const activities = (dailyActivities[String(dayIdx)] || []) as DailyActivity[]
                const isToday = dayIdx === todayIndex
                const completedCount = activities.filter((a) => a.completed).length

                return (
                  <div
                    key={dayIdx}
                    className={`rounded-2xl border p-4 ${
                      isToday
                        ? 'border-emerald-500/50 bg-emerald-500/[0.06]'
                        : 'border-white/10 bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`text-sm font-semibold ${isToday ? 'text-emerald-300' : 'text-white'}`}>
                        {dayName.slice(0, 3)}
                      </h3>
                      {activities.length > 0 && (
                        <span className="text-[10px] text-slate-500">
                          {completedCount}/{activities.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {activities.map((activity, actIdx) => (
                        <button
                          key={actIdx}
                          onClick={() => !activity.completed && handleCompleteActivity(dayIdx, actIdx)}
                          disabled={activity.completed}
                          className={`w-full text-left rounded-lg border p-2 text-[11px] transition-all ${
                            activity.completed
                              ? 'opacity-50 border-white/5 bg-white/[0.02] line-through text-slate-500'
                              : ACTIVITY_COLORS[activity.type] || 'bg-white/[0.05] border-white/10 text-slate-300'
                          }`}
                        >
                          <span
                            className="mr-1"
                            dangerouslySetInnerHTML={{
                              __html: ACTIVITY_ICONS[activity.type] || '&#9823;',
                            }}
                          />
                          {activity.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
