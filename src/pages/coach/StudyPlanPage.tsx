/**
 * Study Plan Page
 * Weekly structured training plan with daily activities, weakness radar,
 * weekly summary, streak tracking, and clickable links to real content.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import { StudyPlan, UserGoal, DailyActivity, WeeklySummary } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { useCoachUser } from '../../hooks/useCoachUser'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const ACTIVITY_ICONS: Record<string, string> = {
  puzzle: '\u2659',
  lesson: '\u2655',
  review: '\u2656',
  play: '\u2654',
  opening: '\u265E',
}

const ACTIVITY_COLORS: Record<string, string> = {
  puzzle: 'border-cyan-500/30 text-cyan-300',
  lesson: 'border-blue-500/30 text-blue-300',
  review: 'border-amber-500/30 text-amber-300',
  play: 'border-emerald-500/30 text-emerald-300',
  opening: 'border-violet-500/30 text-violet-300',
}

const ACTIVITY_BG: Record<string, string> = {
  puzzle: 'bg-cyan-500/10 hover:bg-cyan-500/20',
  lesson: 'bg-blue-500/10 hover:bg-blue-500/20',
  review: 'bg-amber-500/10 hover:bg-amber-500/20',
  play: 'bg-emerald-500/10 hover:bg-emerald-500/20',
  opening: 'bg-violet-500/10 hover:bg-violet-500/20',
}

const RADAR_LABELS: Record<string, string> = {
  tactical: 'Tactical',
  positional: 'Positional',
  opening: 'Opening',
  middlegame: 'Middlegame',
  endgame: 'Endgame',
  blunders: 'Blunders',
}

export default function StudyPlanPage() {
  const { platform, platformUsername, authenticatedUserId, isLoading } = useCoachUser()

  return (
    <CoachPageGuard
      isLoading={isLoading}
      authenticatedUserId={authenticatedUserId}
      platformUsername={platformUsername}
      connectMessage="Link your Chess.com or Lichess account to get a personalized study plan."
    >
      <StudyPlanContent
        platformUsername={platformUsername!}
        platform={platform}
        authUserId={authenticatedUserId!}
      />
    </CoachPageGuard>
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
  const [error, setError] = useState<string | null>(null)

  const today = new Date().getDay()
  const todayIndex = today === 0 ? 6 : today - 1

  const fetchPlan = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [planData, goalsData] = await Promise.allSettled([
        CoachingService.getStudyPlan(platformUsername, platform, authUserId),
        CoachingService.getGoals(platformUsername, platform, authUserId),
      ])
      if (planData.status === 'fulfilled') setPlan(planData.value)
      if (goalsData.status === 'fulfilled') setGoals(goalsData.value)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load study plan'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [platformUsername, platform, authUserId])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const newPlan = await CoachingService.createStudyPlan(platformUsername, platform, authUserId)
      setPlan(newPlan)
      const goalsData = await CoachingService.getGoals(platformUsername, platform, authUserId)
      setGoals(goalsData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate study plan'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  const handleCompleteActivity = async (day: number, activityIndex: number) => {
    if (!plan?.id) return
    try {
      const updatedPlan = await CoachingService.completeActivity(plan.id, day, activityIndex, authUserId)
      setPlan(updatedPlan)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark activity complete'
      setError(msg)
    }
  }

  const handleActivityClick = (activity: DailyActivity) => {
    if (!activity.route) return
    const url = activity.target_id
      ? `${activity.route}?focus=${encodeURIComponent(activity.target_id)}`
      : activity.route
    navigate(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading study plan...</p>
        </div>
      </div>
    )
  }

  // Compute aggregate stats
  const dailyActivities = plan?.daily_activities || {}
  const allActivities = Object.values(dailyActivities).flat()
  const totalActivities = allActivities.length
  const completedActivities = allActivities.filter((a) => a.completed).length
  const completionPct = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0

  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <button
              onClick={() => navigate('/coach')}
              className="mb-2 text-gray-500 hover:text-gray-400 transition-colors flex items-center gap-2 text-sm"
            >
              &larr; Back to Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-semibold text-white">Study Plan</h1>
            {plan && (
              <p className="text-gray-500 mt-1">
                Week {plan.week_number} &middot; {plan.week_start}
              </p>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-5 py-2.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? 'Generating...' : plan ? 'New Plan' : 'Generate Plan'}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 rounded-lg shadow-card bg-red-500/10 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!plan ? (
          <EmptyState generating={generating} onGenerate={handleGenerate} />
        ) : (
          <>
            {/* Weekly Summary + Radar Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2">
                <WeeklySummaryCard
                  summary={plan.weekly_summary}
                  completedActivities={completedActivities}
                  totalActivities={totalActivities}
                  completionPct={completionPct}
                  daysCompleted={plan.days_completed || 0}
                />
              </div>
              <div>
                <WeaknessRadar snapshot={plan.weakness_snapshot} />
              </div>
            </div>

            {/* Goals Section */}
            {plan.goals && plan.goals.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">Weekly Goals</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {plan.goals.map((goal, i) => {
                    const matchingGoal = goals.find((g) => g.goal_type === goal.type)
                    const current = matchingGoal?.current_value || 0
                    const target = goal.target || 1
                    const pct = Math.min(100, Math.round((current / target) * 100))

                    return (
                      <div key={i} className="rounded-lg shadow-card bg-surface-1 p-4">
                        <p className="text-sm font-medium text-white mb-2">{goal.description}</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-colors"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {current}/{target}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stats Row */}
            <StatsRow
              completedActivities={completedActivities}
              totalActivities={totalActivities}
              completionPct={completionPct}
              daysCompleted={plan.days_completed || 0}
              planStreak={plan.weekly_summary?.plan_streak || 0}
            />

            {/* Weekly Calendar */}
            <h2 className="text-lg font-semibold text-white mb-3">Daily Activities</h2>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-8">
              {DAY_NAMES.map((dayName, dayIdx) => {
                const activities = (dailyActivities[String(dayIdx)] || []) as DailyActivity[]
                const isToday = dayIdx === todayIndex
                const dayCompleted = activities.filter((a) => a.completed).length
                const allDone = activities.length > 0 && dayCompleted === activities.length

                return (
                  <div
                    key={dayIdx}
                    className={`rounded-lg p-3 transition-colors ${
                      isToday
                        ? 'shadow-[0_0_0_1px_rgba(16,185,129,0.5)] bg-emerald-500/[0.06]'
                        : allDone
                          ? 'shadow-[0_0_0_1px_rgba(16,185,129,0.2)] bg-emerald-500/[0.03]'
                          : 'shadow-card bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`text-xs font-semibold ${isToday ? 'text-emerald-300' : 'text-white'}`}>
                        {dayName.slice(0, 3)}
                        {isToday && <span className="ml-1 text-[10px] text-emerald-400">today</span>}
                      </h3>
                      {activities.length > 0 && (
                        <span className={`text-[10px] ${allDone ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {allDone ? '\u2713' : `${dayCompleted}/${activities.length}`}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {activities.map((activity, actIdx) => (
                        <ActivityCard
                          key={actIdx}
                          activity={activity}
                          onComplete={() => !activity.completed && handleCompleteActivity(dayIdx, actIdx)}
                          onNavigate={() => handleActivityClick(activity)}
                        />
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

// ===========================================================================
// Sub-components
// ===========================================================================

function EmptyState({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return (
    <div className="rounded-lg shadow-card bg-surface-1 p-12 text-center">
      <div className="text-4xl mb-4 opacity-60">{'\u265A'}</div>
      <p className="text-gray-400 text-lg mb-2">No active study plan</p>
      <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
        Generate a personalized weekly plan based on your game analysis.
        Activities link directly to puzzles, lessons, and openings tailored to your weaknesses.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors disabled:opacity-50"
      >
        {generating ? 'Analyzing your games...' : 'Generate Study Plan'}
      </button>
    </div>
  )
}

function WeeklySummaryCard({
  summary,
  completedActivities,
  totalActivities,
  completionPct,
  daysCompleted,
}: {
  summary?: WeeklySummary
  completedActivities: number
  totalActivities: number
  completionPct: number
  daysCompleted: number
}) {
  if (!summary) return null

  const hasLastWeek = summary.activities_total > 0
  const focusLabel = summary.focus_next_week
    ? RADAR_LABELS[summary.focus_next_week] || summary.focus_next_week
    : null

  return (
    <div className="rounded-lg shadow-card bg-surface-1 p-5">
      <h2 className="text-lg font-semibold text-white mb-3">Weekly Summary</h2>

      {/* Last week review */}
      {hasLastWeek && (
        <div className="mb-4 space-y-2">
          <p className="text-sm text-gray-500">
            Last week: {summary.activities_completed}/{summary.activities_total} activities
            ({Math.round(summary.completion_rate * 100)}% completion)
          </p>

          {summary.improved_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.improved_areas.map((a) => (
                <span key={a.area} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 shadow-card">
                  {RADAR_LABELS[a.area] || a.area} +{a.change.toFixed(1)}
                </span>
              ))}
            </div>
          )}

          {summary.declined_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.declined_areas.map((a) => (
                <span key={a.area} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 shadow-card">
                  {RADAR_LABELS[a.area] || a.area} {a.change.toFixed(1)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Focus area */}
      {focusLabel && (
        <div className="rounded-lg bg-white/[0.04] shadow-card p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">This week's priority</p>
          <p className="text-sm text-white font-medium">{focusLabel}</p>
        </div>
      )}

      {/* Plan streak */}
      {summary.plan_streak > 0 && (
        <p className="text-xs text-gray-500 mt-3">
          {summary.plan_streak} week streak of 50%+ plan completion
        </p>
      )}
    </div>
  )
}

function WeaknessRadar({ snapshot }: { snapshot?: Record<string, number> }) {
  const data = useMemo(() => {
    if (!snapshot || Object.keys(snapshot).length === 0) return null
    return Object.entries(snapshot)
      .filter(([key]) => key in RADAR_LABELS)
      .map(([key, value]) => ({
        subject: RADAR_LABELS[key] || key,
        value: Math.round(value),
        fullMark: 100,
      }))
  }, [snapshot])

  if (!data || data.length < 3) return null

  return (
    <div className="rounded-lg shadow-card bg-surface-1 p-4">
      <h3 className="text-sm font-semibold text-white mb-2">Weakness Profile</h3>
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function StatsRow({
  completedActivities,
  totalActivities,
  completionPct,
  daysCompleted,
  planStreak,
}: {
  completedActivities: number
  totalActivities: number
  completionPct: number
  daysCompleted: number
  planStreak: number
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <StatCard label="Activities Done" value={`${completedActivities}/${totalActivities}`} />
      <StatCard label="Completion" value={`${completionPct}%`} accent={completionPct >= 50} />
      <StatCard label="Days Completed" value={`${daysCompleted}/7`} />
      <StatCard label="Week Streak" value={`${planStreak}`} accent={planStreak >= 3} />
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg shadow-card bg-white/[0.04] p-3 text-center">
      <p className={`text-lg font-semibold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
  )
}

function ActivityCard({
  activity,
  onComplete,
  onNavigate,
}: {
  activity: DailyActivity
  onComplete: () => void
  onNavigate: () => void
}) {
  const icon = ACTIVITY_ICONS[activity.type] || '\u2659'
  const colorClass = ACTIVITY_COLORS[activity.type] || 'border-white/10 text-gray-400'
  const bgClass = ACTIVITY_BG[activity.type] || 'bg-white/[0.05] hover:bg-white/[0.08]'

  if (activity.completed) {
    return (
      <div className="w-full rounded-lg shadow-card bg-white/[0.02] p-1.5 text-[10px] text-gray-500 line-through opacity-50">
        <span className="mr-1">{icon}</span>
        {activity.label}
      </div>
    )
  }

  return (
    <div className={`w-full rounded-lg border ${colorClass} ${bgClass} transition-colors`}>
      <button
        onClick={onNavigate}
        className="w-full text-left p-1.5 text-[10px]"
        title={activity.description || activity.label}
      >
        <span className="mr-1">{icon}</span>
        {activity.label}
        {activity.time_estimate && (
          <span className="ml-1 text-[9px] opacity-50">~{activity.time_estimate}m</span>
        )}
      </button>
      <div className="flex justify-end px-1.5 pb-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onComplete()
          }}
          className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] hover:bg-emerald-500/20 text-gray-500 hover:text-emerald-300 transition-colors"
          title="Mark as done"
        >
          Done
        </button>
      </div>
    </div>
  )
}
