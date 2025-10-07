import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts'
import type { DotProps, TooltipProps } from 'recharts'

interface TrendChartProps {
  className?: string
  selectedTimeControlLabel?: string
  trendDirection: 'improving' | 'declining' | 'stable'
  data: Array<{
    date: string
    rating: number
  }>
}

interface ChartEntry {
  index: number
  rating: number
  change: number
  trendColor: string
  displayChange: string
}

const TREND_COLORS = {
  improving: '#059669',
  declining: '#dc2626',
  stable: '#6b7280'
} as const

const formatYAxis = (value: number) => Math.round(value)

const buildChartData = (data: TrendChartProps['data']): ChartEntry[] =>
  data.map((point, index) => {
    const previousRating = index > 0 ? data[index - 1].rating : point.rating
    const change = point.rating - previousRating

    return {
      index,
      rating: point.rating,
      change,
      trendColor: change > 0 ? TREND_COLORS.improving : change < 0 ? TREND_COLORS.declining : TREND_COLORS.stable,
      displayChange: `${change > 0 ? '+' : ''}${change} ELO`
    }
  })

export function ResponsiveTrendChart({ className = '', selectedTimeControlLabel, trendDirection, data }: TrendChartProps) {
  const chartData = useMemo(() => buildChartData(data), [data])

  const { domainMin, domainMax, displayMin, displayMax, averageRating } = useMemo(() => {
    if (!data.length) {
      return {
        domainMin: 0,
        domainMax: 0,
        displayMin: 0,
        displayMax: 0,
        averageRating: 0,
      }
    }

    const ratings = data.map(point => point.rating)
    const rawMin = Math.min(...ratings)
    const rawMax = Math.max(...ratings)
    const range = rawMax - rawMin
    const padding = Math.max(20, range * 0.05)
    const sum = ratings.reduce((total, value) => total + value, 0)
    const average = Math.round(sum / ratings.length)

    return {
      domainMin: Math.floor(Math.max(0, rawMin - padding)),
      domainMax: Math.ceil(rawMax + padding),
      displayMin: Math.round(rawMin),
      displayMax: Math.round(rawMax),
      averageRating: average,
    }
  }, [data])

  const gradientId = useMemo(() => `eloTrendArea-${Math.random().toString(36).slice(2, 9)}`, [])

  const dotRenderer = (props: DotProps) => {
    const payload = props.payload as ChartEntry | undefined
    if (!payload) return null

    const { cx, cy, index } = props
    if (cx == null || cy == null) return null

    return (
      <g key={`dot-${index}-${payload.index}`}>
        <circle cx={cx} cy={cy} r={5} fill="#fff" stroke={payload.trendColor} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={2.5} fill={payload.trendColor} />
      </g>
    )
  }

  const activeDotRenderer = (props: DotProps) => {
    const payload = props.payload as ChartEntry | undefined
    if (!payload) return null

    const { cx, cy, index } = props
    if (cx == null || cy == null) return null

    return (
      <g key={`active-dot-${index}-${payload.index}`}>
        <circle cx={cx} cy={cy} r={6.5} fill="#fff" stroke={payload.trendColor} strokeWidth={2.6} />
        <circle cx={cx} cy={cy} r={3.5} fill={payload.trendColor} />
      </g>
    )
  }

  return (
    <div className={`overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-xl shadow-black/40 ${className}`}>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">ELO Trend</h3>
            {selectedTimeControlLabel && (
              <p className="text-xs uppercase tracking-wide text-slate-400">{selectedTimeControlLabel} games only</p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${
              trendDirection === 'improving'
                ? 'bg-emerald-500'
                : trendDirection === 'declining'
                  ? 'bg-rose-500'
                  : 'bg-slate-600'
            }`}
          >
            {trendDirection === 'improving'
              ? 'Improving'
              : trendDirection === 'declining'
                ? 'Declining'
                : 'Stable'}
          </span>
        </div>

        <div className="relative h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 15, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TREND_COLORS[trendDirection]} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={TREND_COLORS[trendDirection]} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="index" tickFormatter={(_, index) => `#${index + 1}`} stroke="rgba(226,232,240,0.5)" fontSize={12} />
              <YAxis tickFormatter={formatYAxis} stroke="rgba(226,232,240,0.5)" fontSize={12} domain={[displayMin, displayMax]} />
              <Tooltip
                cursor={{ stroke: '#CBD5F5', strokeWidth: 1, strokeDasharray: '6 3' }}
                content={(tooltipProps: TooltipProps<number, string>) => {
                  const payload = tooltipProps.payload?.[0]?.payload as ChartEntry | undefined
                  if (!payload) {
                    return null
                  }

                  return (
                    <div className="rounded-lg bg-gray-900/95 px-3 py-2 text-xs text-white shadow-lg">
                      <div className="font-semibold">Game {payload.index + 1}</div>
                      <div className="text-gray-300">Rating: {payload.rating}</div>
                      {payload.index > 0 && (
                        <div
                          className={`font-medium ${
                            payload.change > 0
                              ? 'text-green-400'
                              : payload.change < 0
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {payload.displayChange}
                        </div>
                      )}
                    </div>
                  )
                }}
              />

              <Area
                type="monotone"
                dataKey="rating"
                stroke="none"
                fill={`url(#${gradientId})`}
                key="elo-trend-area"
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke={TREND_COLORS[trendDirection]}
                strokeWidth={2.4}
                dot={dotRenderer}
                activeDot={activeDotRenderer}
                connectNulls
                key="elo-trend-line"
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 rounded-lg border border-white/10 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200">
            {trendDirection === 'improving' ? 'Upward trend' : trendDirection === 'declining' ? 'Downward trend' : 'Stable trend'}
          </span>
          <span>
            Average rating: <span className="font-semibold text-white">{averageRating}</span>
          </span>
        </div>
        <div className="text-slate-300">{data[data.length - 1]?.rating}</div>
      </div>

      <div className="mt-3 flex justify-between text-xs text-slate-400">
        <span>Range: {displayMin} - {displayMax}</span>
        <span>{data.length} key points</span>
      </div>
    </div>
  )
}
