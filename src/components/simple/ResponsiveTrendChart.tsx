import { useMemo, useState, useEffect } from 'react'
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
  isLargeChange?: boolean
}

const TREND_COLORS = {
  improving: '#059669',
  declining: '#dc2626',
  stable: '#6b7280'
} as const

const formatYAxis = (value: number) => Math.round(value)

// Threshold for detecting suspiciously large rating changes
const LARGE_CHANGE_THRESHOLD = 50

const buildChartData = (data: TrendChartProps['data']): ChartEntry[] => {
  const chartData = data.map((point, index) => {
    const previousRating = index > 0 ? data[index - 1].rating : point.rating
    const change = point.rating - previousRating
    const isLargeChange = index > 0 && Math.abs(change) > LARGE_CHANGE_THRESHOLD

    return {
      index,
      rating: point.rating,
      change,
      trendColor: change > 0 ? TREND_COLORS.improving : change < 0 ? TREND_COLORS.declining : TREND_COLORS.stable,
      displayChange: `${change > 0 ? '+' : ''}${change} ELO`,
      isLargeChange
    }
  })

  // Log warning for large changes (potential data quality issues)
  const largeChanges = chartData.filter(entry => entry.isLargeChange)
  if (largeChanges.length > 0) {
    console.warn(
      `⚠️ ELO Graph Data Quality Issues:`,
      {
        largeChanges: largeChanges.length,
        changes: largeChanges.map(entry => ({
          game: entry.index + 1,
          change: entry.displayChange,
          rating: entry.rating
        })),
        suggestion: 'Check if games are missing from database. Consider re-importing or verifying game history.'
      }
    )
  }

  // Log summary for diagnostics
  if (chartData.length > 0) {
    console.log('ELO Graph Summary:', {
      gamesDisplayed: chartData.length,
      ratingRange: [Math.min(...chartData.map(d => d.rating)), Math.max(...chartData.map(d => d.rating))],
      currentRating: chartData[chartData.length - 1]?.rating,
      largeChangeCount: largeChanges.length,
      averageChange: (chartData.reduce((sum, d) => sum + Math.abs(d.change), 0) / chartData.length).toFixed(1)
    })
  }

  return chartData
}

export function ResponsiveTrendChart({ className = '', selectedTimeControlLabel, trendDirection, data }: TrendChartProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [chartHeight, setChartHeight] = useState(256)
  
  const chartData = useMemo(() => buildChartData(data), [data])

  // Mobile detection and responsive height calculation
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      
      // Calculate responsive height based on screen size
      if (mobile) {
        const screenHeight = window.innerHeight
        const screenWidth = window.innerWidth
        
        // More aggressive height calculation for very small screens
        if (screenWidth < 480) {
          const availableHeight = screenHeight - 150 // Less padding for very small screens
          const calculatedHeight = Math.max(180, Math.min(250, availableHeight * 0.35))
          setChartHeight(calculatedHeight)
        } else {
          const availableHeight = screenHeight - 200 // Account for header, padding, etc.
          const calculatedHeight = Math.max(200, Math.min(300, availableHeight * 0.4))
          setChartHeight(calculatedHeight)
        }
      } else {
        setChartHeight(256)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

    // Adjust dot size for mobile
    const dotRadius = isMobile ? 4 : 5
    const innerRadius = isMobile ? 2 : 2.5
    const strokeWidth = isMobile ? 2 : 2.5

    return (
      <g key={`dot-${index}-${payload.index}`}>
        <circle cx={cx} cy={cy} r={dotRadius} fill="#fff" stroke={payload.trendColor} strokeWidth={strokeWidth} />
        <circle cx={cx} cy={cy} r={innerRadius} fill={payload.trendColor} />
      </g>
    )
  }

  const activeDotRenderer = (props: DotProps) => {
    const payload = props.payload as ChartEntry | undefined
    if (!payload) return null

    const { cx, cy, index } = props
    if (cx == null || cy == null) return null

    // Adjust active dot size for mobile
    const activeRadius = isMobile ? 5.5 : 6.5
    const activeInnerRadius = isMobile ? 3 : 3.5
    const activeStrokeWidth = isMobile ? 2.2 : 2.6

    return (
      <g key={`active-dot-${index}-${payload.index}`}>
        <circle cx={cx} cy={cy} r={activeRadius} fill="#fff" stroke={payload.trendColor} strokeWidth={activeStrokeWidth} />
        <circle cx={cx} cy={cy} r={activeInnerRadius} fill={payload.trendColor} />
      </g>
    )
  }

  return (
    <div className={`overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] shadow-xl shadow-black/40 ${className} ${isMobile ? 'touch-manipulation' : ''}`}>
      <div className={`p-4 ${isMobile ? 'px-2 py-2' : 'px-2 py-2'}`}>
        <div className={`mb-3 flex items-center justify-between ${isMobile ? 'flex-col gap-2 sm:flex-row sm:gap-0' : ''}`}>
          <div className="min-w-0 flex-1">
            <h3 className={`font-semibold text-white ${isMobile ? 'text-base' : 'text-lg'}`}>ELO Trend</h3>
            {selectedTimeControlLabel && (
              <p className={`uppercase tracking-wide text-slate-400 truncate ${isMobile ? 'text-xs' : 'text-xs'}`}>{selectedTimeControlLabel}</p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white ${
              trendDirection === 'improving'
                ? 'bg-emerald-500'
                : trendDirection === 'declining'
                  ? 'bg-rose-500'
                  : 'bg-slate-600'
            } ${isMobile ? 'self-start' : ''}`}
          >
            {trendDirection === 'improving'
              ? 'Improving'
              : trendDirection === 'declining'
                ? 'Declining'
                : 'Stable'}
          </span>
        </div>

        <div 
          className={`relative ${isMobile ? 'select-none' : ''}`}
          style={{ 
            height: `${chartHeight}px`,
            touchAction: isMobile ? 'manipulation' : 'auto',
            WebkitTouchCallout: isMobile ? 'none' : 'auto',
            WebkitUserSelect: isMobile ? 'none' : 'auto',
            marginLeft: isMobile ? '-12px' : '-12px',
            marginBottom: isMobile ? '-12px' : '-12px',
            transform: 'translate(-2px, 2px)'
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              data={chartData} 
              margin={isMobile ? { top: 10, right: 15, bottom: 0, left: 0 } : { top: 15, right: 25, bottom: 0, left: 0 }}
              style={{ userSelect: isMobile ? 'none' : 'auto' }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TREND_COLORS[trendDirection]} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={TREND_COLORS[trendDirection]} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis 
                dataKey="index" 
                tickFormatter={(_, index) => `#${index + 1}`} 
                stroke="rgba(226,232,240,0.5)" 
                fontSize={isMobile ? 10 : 12}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={formatYAxis} 
                stroke="rgba(226,232,240,0.5)" 
                fontSize={isMobile ? 10 : 12}
                tick={{ fontSize: isMobile ? 10 : 12 }}
                domain={[displayMin, displayMax]}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: '#CBD5F5', strokeWidth: 1, strokeDasharray: '6 3' }}
                content={(tooltipProps: TooltipProps<number, string>) => {
                  const payload = tooltipProps.payload?.[0]?.payload as ChartEntry | undefined
                  if (!payload) {
                    return null
                  }

                  return (
                    <div className={`rounded-lg bg-gray-900/95 px-3 py-2 text-white shadow-lg ${isMobile ? 'text-xs max-w-[200px]' : 'text-xs'}`}>
                      <div className="font-semibold">Game {payload.index + 1}</div>
                      <div className="text-gray-300">Rating: {payload.rating}</div>
                      {payload.index > 0 && (
                        <>
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
                          {payload.isLargeChange && (
                            <div className="mt-1 text-[10px] text-yellow-400 flex items-center gap-1">
                              <span>⚠</span>
                              <span>Large change - possible data gap</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                }}
                position={isMobile ? { x: 0, y: 0 } : undefined}
                allowEscapeViewBox={{ x: false, y: false }}
                wrapperStyle={isMobile ? { 
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  zIndex: 1000
                } : undefined}
              />

              <Area
                type="monotone"
                dataKey="rating"
                stroke="none"
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={false}
                key="elo-trend-area"
              />
              <Line
                type="monotone"
                dataKey="rating"
                stroke={TREND_COLORS[trendDirection]}
                strokeWidth={isMobile ? 2 : 2.4}
                dot={dotRenderer}
                activeDot={activeDotRenderer}
                connectNulls
                key="elo-trend-line"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`flex flex-col gap-2 border-t border-white/10 bg-white/[0.03] text-slate-400 ${isMobile ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-xs'}`}>
        <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-2 sm:flex-row sm:gap-0' : ''}`}>
          <div className={`flex items-center gap-2 min-w-0 ${isMobile ? 'flex-col sm:flex-row' : ''}`}>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-xs font-semibold text-slate-200 whitespace-nowrap">
              {trendDirection === 'improving' ? 'Upward trend' : trendDirection === 'declining' ? 'Downward trend' : 'Stable trend'}
            </span>
            <span className="whitespace-nowrap">
              Average rating: <span className="font-semibold text-white">{averageRating}</span>
            </span>
          </div>
          <div className="text-slate-300 font-semibold">{data[data.length - 1]?.rating}</div>
        </div>
        <div className={`flex justify-between items-center ${isMobile ? 'flex-col gap-1 sm:flex-row sm:gap-0' : ''}`}>
          <span className="whitespace-nowrap">Range: {displayMin} - {displayMax}</span>
          <span className="whitespace-nowrap">{data.length} key points</span>
        </div>
      </div>
    </div>
  )
}
