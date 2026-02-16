/**
 * Progress Tracking Page
 * Displays rating trends, accuracy charts, streaks, and weakness evolution
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  AreaChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'
import { useCoachProgress } from '../../hooks/useCoachingData'
import { useCoachUser } from '../../hooks/useCoachUser'
import LoadingModal from '../../components/LoadingModal'
import { Link } from 'react-router-dom'

const PERIOD_OPTIONS = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: 'All' },
]

const CHART_COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  purple: '#a855f7',
  cyan: '#06b6d4',
  slate: '#94a3b8',
}

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="h-64">
        {children}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-slate-500 text-sm">Not enough data yet</p>
    </div>
  )
}

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
  },
}

export default function ProgressPage() {
  const { platform, platformUsername, authenticatedUserId } = useCoachUser()
  const navigate = useNavigate()

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
            Link your Chess.com or Lichess account to track your progress.
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

  return <ProgressContent platformUsername={platformUsername} platform={platform} />
}

function ProgressContent({
  platformUsername,
  platform,
}: {
  platformUsername: string
  platform: 'lichess' | 'chess.com'
}) {
  const navigate = useNavigate()
  const [periodDays, setPeriodDays] = useState(90)
  const { progress, loading, error } = useCoachProgress(platformUsername, platform, periodDays)

  if (loading) {
    return <LoadingModal isOpen={true} message="Loading progress data..." />
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

  const streaks = progress?.streaks
  const timeSeries = progress?.time_series
  const weaknessEvolution = progress?.weakness_evolution

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
            <h1 className="text-3xl md:text-4xl font-bold text-white">Your Progress</h1>
            <p className="text-slate-400 mt-1">Track your chess improvement over time</p>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriodDays(opt.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  periodDays === opt.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Streaks Section */}
        {streaks && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Current Streak" value={`${streaks.current_streak}d`} subtitle="consecutive days" />
            <StatCard label="Best Streak" value={`${streaks.best_streak}d`} subtitle="all time" />
            <StatCard label="Days Active" value={streaks.days_active} />
            <StatCard label="Lessons Done" value={streaks.lessons_completed} />
            <StatCard label="Puzzles Solved" value={streaks.puzzles_solved} />
            <StatCard
              label="Puzzle Rate"
              value={`${Math.round(streaks.puzzle_solve_rate * 100)}%`}
              subtitle="solve rate"
            />
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Rating Trend */}
          <ChartCard title="Rating Trend">
            {timeSeries?.rating_trend && timeSeries.rating_trend.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeSeries.rating_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 20', 'dataMax + 20']} />
                  <Tooltip {...chartTooltipStyle} />
                  <Area type="monotone" dataKey="avg_rating" stroke="none" fill="url(#ratingGradient)" />
                  <Line type="monotone" dataKey="avg_rating" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.emerald }} name="Avg Rating" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Accuracy by Phase */}
          <ChartCard title="Accuracy by Phase">
            {timeSeries?.accuracy_by_phase && timeSeries.accuracy_by_phase.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries.accuracy_by_phase} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="opening" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 2 }} name="Opening" />
                  <Line type="monotone" dataKey="middlegame" stroke={CHART_COLORS.amber} strokeWidth={2} dot={{ r: 2 }} name="Middlegame" />
                  <Line type="monotone" dataKey="endgame" stroke={CHART_COLORS.purple} strokeWidth={2} dot={{ r: 2 }} name="Endgame" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Blunder Rate Trend */}
          <ChartCard title="Blunder Rate Trend">
            {timeSeries?.blunder_rate_trend && timeSeries.blunder_rate_trend.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeSeries.blunder_rate_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="blunderGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={CHART_COLORS.rose} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip {...chartTooltipStyle} />
                  <Area type="monotone" dataKey="blunders_per_game" stroke={CHART_COLORS.rose} strokeWidth={2} fill="url(#blunderGradient)" dot={{ r: 2, fill: CHART_COLORS.rose }} name="Blunders/Game" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </ChartCard>

          {/* Weakness Evolution */}
          <ChartCard title="Weakness Evolution">
            {weaknessEvolution && weaknessEvolution.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weaknessEvolution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    {...chartTooltipStyle}
                    formatter={(value: number, name: string) => [`${value.toFixed(1)}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                  {weaknessEvolution.length > 0 && Object.keys(weaknessEvolution[0].scores).map((key, i) => {
                    const colors = [CHART_COLORS.rose, CHART_COLORS.amber, CHART_COLORS.blue, CHART_COLORS.purple, CHART_COLORS.cyan, CHART_COLORS.emerald]
                    return (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={`scores.${key}`}
                        stroke={colors[i % colors.length]}
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        name={key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' ')}
                      />
                    )
                  })}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </ChartCard>
        </div>

        {/* Personality Trends (full width) */}
        {timeSeries?.personality_trends && timeSeries.personality_trends.length > 1 && (
          <div className="mb-8">
            <ChartCard title="Playing Style Trends">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries.personality_trends} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="tactical" stroke={CHART_COLORS.rose} strokeWidth={2} dot={{ r: 2 }} name="Tactical" />
                  <Line type="monotone" dataKey="positional" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 2 }} name="Positional" />
                  <Line type="monotone" dataKey="aggressive" stroke={CHART_COLORS.amber} strokeWidth={2} dot={{ r: 2 }} name="Aggressive" />
                  <Line type="monotone" dataKey="patient" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 2 }} name="Patient" />
                  <Line type="monotone" dataKey="novelty" stroke={CHART_COLORS.purple} strokeWidth={2} dot={{ r: 2 }} name="Novelty" />
                  <Line type="monotone" dataKey="staleness" stroke={CHART_COLORS.slate} strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 4" name="Staleness" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  )
}
