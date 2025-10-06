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

  const { domainMin, domainMax, displayMin, displayMax } = useMemo(() => {
    const ratings = data.map(point => point.rating)
    const rawMin = Math.min(...ratings)
    const rawMax = Math.max(...ratings)
    const range = rawMax - rawMin
    const padding = Math.max(20, range * 0.05)

    return {
      domainMin: Math.floor(Math.max(0, rawMin - padding)),
      domainMax: Math.ceil(rawMax + padding),
      displayMin: Math.round(rawMin),
      displayMax: Math.round(rawMax)
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
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-gray-700">ELO Trend</h4>
          {selectedTimeControlLabel && (
            <p className="mt-1 text-xs text-gray-500">{selectedTimeControlLabel} games only</p>
          )}
        </div>
        <span
          className={`text-xs px-2 py-1 rounded font-medium ${
            trendDirection === 'improving'
              ? 'bg-green-100 text-green-800'
              : trendDirection === 'declining'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {trendDirection}
        </span>
      </div>

      <div className="relative rounded-lg border border-gray-200 bg-white p-4">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TREND_COLORS[trendDirection]} stopOpacity={0.12} />
                <stop offset="100%" stopColor={TREND_COLORS[trendDirection]} stopOpacity={0.04} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#f0f2f5" vertical={false} />
            <XAxis
              dataKey="index"
              tickFormatter={(value: number) => `#${value + 1}`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              interval={chartData.length > 12 ? Math.ceil(chartData.length / 12) : 0}
              padding={{ left: 6, right: 6 }}
            />
            <YAxis
              domain={[domainMin, domainMax]}
              tickFormatter={formatYAxis}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={{ stroke: '#e5e7eb' }}
              tickLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip
              cursor={{ stroke: '#cbd5f5', strokeDasharray: '4 2' }}
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

            <Area type="monotone" dataKey="rating" stroke="none" fill={`url(#${gradientId})`} key="elo-trend-area" />
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

        <div className="absolute top-2 right-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-800 shadow-sm">
          {data[data.length - 1]?.rating}
        </div>
      </div>

      <div className="mt-3 flex justify-between text-xs text-gray-500">
        <span>
          Range: {displayMin} - {displayMax}
        </span>
        <span>{data.length} key points</span>
      </div>
    </div>
  )
}
