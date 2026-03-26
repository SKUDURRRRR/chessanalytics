/**
 * Progress Tracking Page
 * Displays rating trends, accuracy charts, streaks, weakness evolution,
 * and advanced metrics (advantage conversion, comeback/throw rate, phase eval)
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
  Bar,
  BarChart,
} from 'recharts'
import { useCoachProgress } from '../../hooks/useCoachingData'
import { useCoachUser } from '../../hooks/useCoachUser'
import { Link } from 'react-router-dom'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'
import type { AdvancedProgressMetrics } from '../../types'

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

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string; accent?: string }) {
  return (
    <div className="rounded-lg shadow-card bg-white/[0.04] p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg shadow-card bg-surface-1 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="h-64">
        {children}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4 mt-10 first:mt-0">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500 text-sm">Not enough data yet</p>
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
  const { platform, platformUsername, authenticatedUserId, isLoading } = useCoachUser()

  return (
    <CoachPageGuard
      isLoading={isLoading}
      authenticatedUserId={authenticatedUserId}
      platformUsername={platformUsername}
      connectMessage="Link your Chess.com or Lichess account to track your progress."
    >
      <ProgressContent platformUsername={platformUsername!} platform={platform} />
    </CoachPageGuard>
  )
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
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading progress data...</p>
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
            onClick={() => navigate('/coach')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
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
  const advanced = progress?.advanced_metrics
  const diagnostic = progress?.diagnostic

  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <button
              onClick={() => navigate('/coach')}
              className="mb-2 text-gray-500 hover:text-gray-400 transition-colors flex items-center gap-2 text-sm"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-semibold text-white">Your Progress</h1>
            <p className="text-gray-500 mt-1">Track your chess improvement over time</p>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriodDays(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodDays === opt.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/[0.05] text-gray-500 hover:bg-white/[0.08] hover:text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Diagnostic Card */}
        {diagnostic?.summary && (
          <div className="rounded-lg shadow-card bg-cyan-500/[0.04] p-6 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-cyan-400 text-sm font-semibold">C</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-white">Coach&apos;s Assessment</h3>
                  {diagnostic.key_insight && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                      {diagnostic.key_insight}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{diagnostic.summary}</p>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {advanced?.advantage_conversion && (
            <StatCard
              label="Conversion Rate"
              value={`${advanced.advantage_conversion.overall_rate}%`}
              subtitle={`${advanced.advantage_conversion.total_converted}/${advanced.advantage_conversion.total_opportunities} games`}
            />
          )}
          {advanced?.comeback_throw && (
            <>
              <StatCard
                label="Comeback Rate"
                value={`${advanced.comeback_throw.comeback_rate}%`}
                subtitle={`${advanced.comeback_throw.total_comebacks} comebacks`}
              />
              <StatCard
                label="Throw Rate"
                value={`${advanced.comeback_throw.throw_rate}%`}
                subtitle={`${advanced.comeback_throw.total_throws} thrown`}
              />
            </>
          )}
          {streaks && (
            <>
              <StatCard label="Current Streak" value={`${streaks.current_streak}d`} subtitle="consecutive days" />
              <StatCard label="Best Streak" value={`${streaks.best_streak}d`} subtitle="all time" />
              <StatCard label="Days Active" value={streaks.days_active} />
            </>
          )}
        </div>

        {/* Activity Stats */}
        {streaks && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <StatCard label="Lessons Done" value={streaks.lessons_completed} />
            <StatCard label="Puzzles Solved" value={streaks.puzzles_solved} />
            <StatCard
              label="Puzzle Rate"
              value={`${Math.round(streaks.puzzle_solve_rate * 100)}%`}
              subtitle="solve rate"
            />
          </div>
        )}

        {/* Core Charts Grid */}
        <SectionHeader title="Trends" subtitle="How your play is changing over time" />
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

        {/* Advanced Metrics Section */}
        {advanced && <AdvancedMetricsSection advanced={advanced} />}

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

function AdvancedMetricsSection({ advanced }: { advanced: AdvancedProgressMetrics }) {
  const conversion = advanced.advantage_conversion
  const comebackThrow = advanced.comeback_throw
  const phaseEval = advanced.win_loss_by_phase
  const openings = advanced.opening_repertoire
  const timeTrouble = advanced.time_trouble
  const criticalMoments = advanced.critical_moments
  const endgameTypes = advanced.endgame_types
  const missedTactics = advanced.missed_tactics

  const hasConversionTrend = conversion?.weekly_trend && conversion.weekly_trend.length > 1
  const hasComebackTrend = comebackThrow?.weekly_trend && comebackThrow.weekly_trend.length > 1
  const hasPhaseEvalTrend = phaseEval?.weekly_trend && phaseEval.weekly_trend.length > 1
  const hasOpenings = openings?.openings && openings.openings.length > 0
  const hasTimeTrouble = timeTrouble?.weekly_trend && timeTrouble.weekly_trend.length > 1
  const hasCritical = criticalMoments?.weekly_trend && criticalMoments.weekly_trend.length > 1
  const hasMissedTactics = missedTactics?.weekly_trend && missedTactics.weekly_trend.length > 1

  const hasAnyData = hasConversionTrend || hasComebackTrend || hasPhaseEvalTrend ||
    hasOpenings || hasTimeTrouble || hasCritical || hasMissedTactics

  if (!hasAnyData) {
    return null
  }

  return (
    <>
      {/* Phase 1: Game Outcome Analysis */}
      {(hasConversionTrend || hasComebackTrend || hasPhaseEvalTrend) && (
        <>
          <SectionHeader
            title="Game Outcome Analysis"
            subtitle="Where and how you're winning and losing games"
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Advantage Conversion">
              {hasConversionTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={conversion!.weekly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.emerald} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={CHART_COLORS.emerald} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="rate" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <YAxis yAxisId="count" orientation="right" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} hide />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value: number, name: string) => {
                        if (name === 'Conversion %') return [`${value}%`, name]
                        return [value, name]
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar yAxisId="count" dataKey="opportunities" fill="rgba(255,255,255,0.06)" name="Opportunities" radius={[4, 4, 0, 0]} />
                    <Area yAxisId="rate" type="monotone" dataKey="rate" stroke="none" fill="url(#conversionGradient)" />
                    <Line yAxisId="rate" type="monotone" dataKey="rate" stroke={CHART_COLORS.emerald} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.emerald }} name="Conversion %" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </ChartCard>

            <ChartCard title="Comebacks vs Throws">
              {hasComebackTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comebackThrow!.weekly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip {...chartTooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar dataKey="comebacks" fill={CHART_COLORS.emerald} name="Comebacks" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="throws" fill={CHART_COLORS.rose} name="Throws" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </ChartCard>

            <ChartCard title="Avg Eval at Phase Transitions">
              {hasPhaseEvalTrend ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={phaseEval!.weekly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value: number | null, name: string) => {
                        if (value === null) return ['N/A', name]
                        return [`${value > 0 ? '+' : ''}${value}cp`, name]
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Line type="monotone" dataKey="avg_opening_eval" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ r: 2 }} name="After Opening" connectNulls />
                    <Line type="monotone" dataKey="avg_middlegame_eval" stroke={CHART_COLORS.amber} strokeWidth={2} dot={{ r: 2 }} name="After Middlegame" connectNulls />
                    <Line type="monotone" dataKey="avg_endgame_eval" stroke={CHART_COLORS.purple} strokeWidth={2} dot={{ r: 2 }} name="Entering Endgame" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState />
              )}
            </ChartCard>

            {phaseEval?.summary && (
              <ChartCard title="Where Games Are Decided">
                <div className="flex flex-col justify-center h-full gap-4">
                  <HorizontalBar label="Opening Advantage Wins" value={phaseEval.summary.opening_advantage_wins} color={CHART_COLORS.blue} />
                  <HorizontalBar label="Middlegame Swings" value={phaseEval.summary.middlegame_decided} color={CHART_COLORS.amber} />
                  <HorizontalBar label="Endgame Swings" value={phaseEval.summary.endgame_decided} color={CHART_COLORS.purple} />
                </div>
              </ChartCard>
            )}
          </div>
        </>
      )}

      {/* Phase 2: Opening Repertoire */}
      {hasOpenings && (
        <>
          <SectionHeader
            title="Opening Repertoire"
            subtitle="How you perform with different openings"
          />
          {openings!.best_opening && openings!.worst_opening && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg shadow-card bg-emerald-500/[0.06] p-4">
                <p className="text-xs text-emerald-400 mb-1">Best Opening</p>
                <p className="text-lg font-semibold text-white">{openings!.best_opening.name}</p>
                <p className="text-sm text-gray-500">
                  as {openings!.best_opening.color} &middot; {openings!.best_opening.win_rate}% win rate
                </p>
              </div>
              <div className="rounded-lg shadow-card bg-rose-500/[0.06] p-4">
                <p className="text-xs text-rose-400 mb-1">Weakest Opening</p>
                <p className="text-lg font-semibold text-white">{openings!.worst_opening.name}</p>
                <p className="text-sm text-gray-500">
                  as {openings!.worst_opening.color} &middot; {openings!.worst_opening.win_rate}% win rate
                </p>
              </div>
            </div>
          )}
          <div className="rounded-lg shadow-card bg-surface-1 p-6 mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="text-left py-3 px-2 font-medium">Opening</th>
                  <th className="text-center py-3 px-2 font-medium">Color</th>
                  <th className="text-center py-3 px-2 font-medium">Games</th>
                  <th className="text-center py-3 px-2 font-medium">Win Rate</th>
                  <th className="text-center py-3 px-2 font-medium">Draw</th>
                  <th className="text-center py-3 px-2 font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {openings!.openings.map((o, i) => (
                  <tr key={`${o.opening_family}-${o.color}`} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                    <td className="py-2.5 px-2 text-white font-medium">{o.opening_family}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={`inline-block w-3 h-3 rounded-full ${o.color === 'white' ? 'bg-white' : 'bg-surface-3 border border-surface-3'}`} />
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-400">{o.games}</td>
                    <td className="py-2.5 px-2 text-center">
                      <span className={o.win_rate >= 50 ? 'text-emerald-400' : 'text-rose-400'}>{o.win_rate}%</span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-500">{o.draw_rate}%</td>
                    <td className="py-2.5 px-2 text-center text-gray-400">{o.avg_accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Phase 2: Time Trouble + Phase 3 charts */}
      {(hasTimeTrouble || hasCritical || hasMissedTactics || endgameTypes) && (
        <>
          <SectionHeader
            title="Deep Analysis"
            subtitle="Critical moments, endgame skills, and tactical awareness"
          />

          {/* Phase 3 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {criticalMoments && (
              <StatCard
                label="Critical Moment CPL"
                value={criticalMoments.avg_cpl_critical}
                subtitle={`vs ${criticalMoments.avg_cpl_normal} normal`}
              />
            )}
            {missedTactics && (
              <>
                <StatCard
                  label="Missed Tactics/Game"
                  value={missedTactics.per_game_rate}
                  subtitle={`${missedTactics.total_missed} total`}
                />
                {missedTactics.most_common_missed && (
                  <StatCard
                    label="Most Missed Pattern"
                    value={missedTactics.most_common_missed}
                  />
                )}
              </>
            )}
            {timeTrouble && (
              <StatCard
                label="Endgame Degradation"
                value={`${timeTrouble.avg_accuracy_degradation > 0 ? '+' : ''}${timeTrouble.avg_accuracy_degradation}%`}
                subtitle="accuracy drop in endgame"
              />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Time Control Performance */}
            {timeTrouble?.by_time_control && timeTrouble.by_time_control.length > 0 && (
              <ChartCard title="Win Rate by Time Control">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeTrouble.by_time_control} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <YAxis type="category" dataKey="category" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value: number, name: string) => {
                        if (name === 'Games') return [value, name]
                        return [`${value}%`, name]
                      }}
                    />
                    <Bar dataKey="win_rate" fill={CHART_COLORS.cyan} name="Win Rate" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Accuracy Degradation Trend */}
            {hasTimeTrouble && (
              <ChartCard title="Endgame Accuracy Degradation">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeTrouble!.weekly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="degradGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.rose} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={CHART_COLORS.rose} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value: number) => [`${value > 0 ? '+' : ''}${value}%`, 'Degradation']}
                    />
                    <Area type="monotone" dataKey="degradation" stroke={CHART_COLORS.rose} strokeWidth={2} fill="url(#degradGradient)" dot={{ r: 2, fill: CHART_COLORS.rose }} name="Degradation %" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Critical Moment Performance Trend */}
            {hasCritical && (
              <ChartCard title="Critical Moment Performance">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={criticalMoments!.weekly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="cpl" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="count" orientation="right" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} hide />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value: number, name: string) => {
                        if (name === 'Critical Moments') return [value, name]
                        return [`${value} cp`, name]
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar yAxisId="count" dataKey="critical_count" fill="rgba(255,255,255,0.06)" name="Critical Moments" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="cpl" type="monotone" dataKey="avg_cpl_critical" stroke={CHART_COLORS.amber} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.amber }} name="Avg CPL (Critical)" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Missed Tactics Trend */}
            {hasMissedTactics && (
              <ChartCard title="Missed Tactics Trend">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={missedTactics!.weekly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <defs>
                      <linearGradient id="missedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.amber} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={CHART_COLORS.amber} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value: number) => [value, 'Missed/Game']}
                    />
                    <Area type="monotone" dataKey="missed_per_game" stroke={CHART_COLORS.amber} strokeWidth={2} fill="url(#missedGradient)" dot={{ r: 2, fill: CHART_COLORS.amber }} name="Missed/Game" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Endgame Type Performance */}
            {endgameTypes?.types && endgameTypes.types.length > 0 && (
              <ChartCard title="Endgame Type Performance">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={endgameTypes.types} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <YAxis type="category" dataKey="type" stroke="rgba(226,232,240,0.4)" fontSize={11} tickLine={false} axisLine={false} width={75} />
                    <Tooltip
                      {...chartTooltipStyle}
                      formatter={(value: number, name: string) => {
                        if (name === 'Accuracy') return [`${value}%`, name]
                        return [`${value} cp`, name]
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                    <Bar dataKey="accuracy_estimate" fill={CHART_COLORS.purple} name="Accuracy" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </>
      )}

      {/* Phase 4: Peer Comparison */}
      {advanced.peer_comparison && advanced.peer_comparison.comparisons.length > 0 && (
        <>
          <SectionHeader
            title="How You Compare"
            subtitle={`vs ${advanced.peer_comparison.peer_count} players rated ${advanced.peer_comparison.peer_rating_range.min}-${advanced.peer_comparison.peer_rating_range.max}`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {advanced.peer_comparison.comparisons.map((c) => (
              <div
                key={c.metric}
                className="rounded-lg shadow-card bg-white/[0.04] p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      c.assessment === 'above_average'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : c.assessment === 'below_average'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-white/[0.04] text-gray-500'
                    }`}
                  >
                    {c.assessment === 'above_average' ? 'Above Avg' : c.assessment === 'below_average' ? 'Below Avg' : 'Average'}
                  </span>
                </div>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-white">{c.your_value}</p>
                    <p className="text-xs text-gray-500">You</p>
                  </div>
                  <div>
                    <p className="text-lg text-gray-500">{c.peer_avg}</p>
                    <p className="text-xs text-gray-500">Peer Avg</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function HorizontalBar({ label, value, color }: { label: string; value: number; color: string }) {
  const maxWidth = Math.max(value * 8, 4)
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-500 w-48 text-right">{label}</span>
      <div className="flex-1 flex items-center gap-3">
        <div
          className="h-8 rounded-lg flex items-center justify-end pr-3 min-w-[32px] transition-colors"
          style={{ width: `${Math.min(maxWidth, 100)}%`, backgroundColor: color + '30', borderLeft: `3px solid ${color}` }}
        >
          <span className="text-sm font-semibold text-white">{value}</span>
        </div>
      </div>
    </div>
  )
}
