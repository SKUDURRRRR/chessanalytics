// Admin Dashboard Page - Analytics and metrics for platform admins
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { AnalyticsService, DashboardMetrics, RegistrationStats, UserAnalysisStats, PlayerSearchStats, AnalyzedPlayersStats, RegistrationDetails } from '../services/analyticsService'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type TimeRange = '1h' | '3h' | '12h' | '24h' | '7d' | '30d' | '90d'
type Granularity = 'hour' | 'day' | 'week' | 'month'

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [registrationStats, setRegistrationStats] = useState<RegistrationStats | null>(null)
  const [userAnalysisStats, setUserAnalysisStats] = useState<UserAnalysisStats | null>(null)
  const [playerSearchStats, setPlayerSearchStats] = useState<PlayerSearchStats | null>(null)
  const [analyzedPlayersStats, setAnalyzedPlayersStats] = useState<AnalyzedPlayersStats | null>(null)
  const [registrationDetails, setRegistrationDetails] = useState<RegistrationDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set())

  // Calculate date range based on selected time range
  const getDateRange = (): { startDate: Date; endDate: Date } => {
    const endDate = new Date()
    const startDate = new Date()

    switch (timeRange) {
      case '1h':
        startDate.setHours(endDate.getHours() - 1)
        break
      case '3h':
        startDate.setHours(endDate.getHours() - 3)
        break
      case '12h':
        startDate.setHours(endDate.getHours() - 12)
        break
      case '24h':
        startDate.setHours(endDate.getHours() - 24)
        break
      case '7d':
        startDate.setDate(endDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(endDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(endDate.getDate() - 90)
        break
    }

    return { startDate, endDate }
  }

  // Auto-select appropriate granularity based on time range
  useEffect(() => {
    switch (timeRange) {
      case '1h':
      case '3h':
      case '12h':
      case '24h':
        setGranularity('hour')
        break
      case '7d':
      case '30d':
        setGranularity('day')
        break
      case '90d':
        setGranularity('week')
        break
    }
  }, [timeRange])

  // Fetch metrics when component mounts or time range changes
  useEffect(() => {
    // For local development, allow fetching without login
    // if (!user) return

    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const { startDate, endDate } = getDateRange()

        // Fetch all analytics data in parallel
        const [metricsData, statsData, userStatsData, playerStatsData, analyzedPlayersData, registrationDetailsData] = await Promise.all([
          AnalyticsService.getDashboardMetrics(startDate, endDate, granularity),
          AnalyticsService.getRegistrationStats(startDate, endDate),
          AnalyticsService.getUserAnalysisStats(startDate, endDate, 50),
          AnalyticsService.getPlayerSearchStats(startDate, endDate, 20),
          AnalyticsService.getAnalyzedPlayersStats(startDate, endDate, 50),
          AnalyticsService.getRegistrationDetails(startDate, endDate, 100),
        ])

        setMetrics(metricsData)
        setRegistrationStats(statsData)
        setUserAnalysisStats(userStatsData)
        setPlayerSearchStats(playerStatsData)
        setAnalyzedPlayersStats(analyzedPlayersData)
        setRegistrationDetails(registrationDetailsData)
      } catch (err) {
        console.error('Error fetching analytics:', err)
        const errorMessage = err instanceof Error ? err.message : 'Failed to load analytics'
        setError(errorMessage)

        // Log more details for debugging
        console.log('Full error details:', {
          error: err,
          apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8002',
          startDate: getDateRange().startDate,
          endDate: getDateRange().endDate,
          granularity
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, timeRange, granularity])

  const handleRefreshViews = async () => {
    setIsRefreshing(true)
    try {
      await AnalyticsService.refreshAnalyticsViews()
      // Refetch data after refresh
      const { startDate, endDate } = getDateRange()
      const [metricsData, statsData, userStatsData, playerStatsData, analyzedPlayersData, registrationDetailsData] = await Promise.all([
        AnalyticsService.getDashboardMetrics(startDate, endDate, granularity),
        AnalyticsService.getRegistrationStats(startDate, endDate),
        AnalyticsService.getUserAnalysisStats(startDate, endDate, 50),
        AnalyticsService.getPlayerSearchStats(startDate, endDate, 20),
        AnalyticsService.getAnalyzedPlayersStats(startDate, endDate, 50),
        AnalyticsService.getRegistrationDetails(startDate, endDate, 100),
      ])
      setMetrics(metricsData)
      setRegistrationStats(statsData)
      setUserAnalysisStats(userStatsData)
      setPlayerSearchStats(playerStatsData)
      setAnalyzedPlayersStats(analyzedPlayersData)
      setRegistrationDetails(registrationDetailsData)
    } catch (err) {
      console.error('Error refreshing analytics views:', err)
      setError('Failed to refresh analytics views')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Transform data for charts
  const getChartData = () => {
    if (!metrics) return []

    // Combine all metrics into a single array keyed by time_bucket
    const combinedData: Record<string, any> = {}

    // Add each event type to the combined data
    Object.entries(metrics.metrics).forEach(([eventType, data]) => {
      data.forEach((point) => {
        const timeKey = new Date(point.time_bucket).toLocaleString()
        if (!combinedData[timeKey]) {
          combinedData[timeKey] = {
            time: timeKey,
            timestamp: new Date(point.time_bucket).getTime() // Add timestamp for sorting
          }
        }
        combinedData[timeKey][eventType] = point.event_count
      })
    })

    // Sort by timestamp (oldest to newest)
    return Object.values(combinedData).sort((a, b) => a.timestamp - b.timestamp)
  }

  // Calculate summary statistics
  const getSummaryStats = () => {
    if (!metrics) return null

    const playerSearches = metrics.metrics.player_search?.reduce(
      (sum, point) => sum + point.event_count,
      0
    ) || 0

    const gameAnalyses = metrics.metrics.game_analysis?.reduce(
      (sum, point) => sum + point.event_count,
      0
    ) || 0

    const pricingPageViews = metrics.metrics.pricing_page_view?.reduce(
      (sum, point) => sum + point.event_count,
      0
    ) || 0

    // Calculate total unique IPs across all event types
    const uniqueIPs = new Set<number>()
    Object.values(metrics.metrics).forEach(events => {
      events.forEach(point => {
        if (point.unique_ips) uniqueIPs.add(point.unique_ips)
      })
    })

    // Get max unique IPs from any single time bucket
    const maxUniqueIPs = Math.max(
      ...Object.values(metrics.metrics).flatMap(events =>
        events.map(point => point.unique_ips || 0)
      ),
      0
    )

    return {
      playerSearches,
      gameAnalyses,
      pricingPageViews,
      uniqueIPs: maxUniqueIPs,
    }
  }

  const summaryStats = getSummaryStats()
  const chartData = getChartData()

  // For local development, allow access without login
  // TODO: Re-enable authentication check for production
  // if (!user) {
  //   return (
  //     <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20 px-4">
  //       <div className="max-w-4xl mx-auto text-center">
  //         <h1 className="text-3xl font-bold text-white mb-4">Access Denied</h1>
  //         <p className="text-slate-300">You must be logged in to view the admin dashboard.</p>
  //       </div>
  //     </div>
  //   )
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pt-20 px-4 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-slate-300">Platform analytics and user metrics</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex flex-wrap gap-4 mb-8">
            <div className="flex gap-2 flex-wrap">
              {['1h', '3h', '12h', '24h', '7d', '30d', '90d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range as TimeRange)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    timeRange === range
                      ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
                      : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {range === '1h' && 'Last Hour'}
                  {range === '3h' && 'Last 3 Hours'}
                  {range === '12h' && 'Last 12 Hours'}
                  {range === '24h' && 'Last 24 Hours'}
                  {range === '7d' && 'Last 7 Days'}
                  {range === '30d' && 'Last 30 Days'}
                  {range === '90d' && 'Last 90 Days'}
                </button>
              ))}
            </div>

            <button
              onClick={handleRefreshViews}
              disabled={isRefreshing}
              className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold transition bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-8 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-rose-200">
              <p>{error}</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-400"></div>
            </div>
          )}

          {/* Dashboard Content */}
          {!isLoading && metrics && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Unique IPs */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className="text-sm text-slate-400 mb-2">Unique Visitors (IPs)</div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {summaryStats?.uniqueIPs.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-slate-500">Unique IP addresses</div>
                </div>

                {/* Player Searches */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className="text-sm text-slate-400 mb-2">Player Searches</div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {summaryStats?.playerSearches.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-slate-500">Total searches in period</div>
                </div>

                {/* Game Analyses */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className="text-sm text-slate-400 mb-2">Game Analyses</div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {summaryStats?.gameAnalyses.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-slate-500">Total analyses performed</div>
                </div>

                {/* Pricing Page Views */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className="text-sm text-slate-400 mb-2">Pricing Page Views</div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {summaryStats?.pricingPageViews.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-slate-500">Users checked pricing</div>
                </div>

                {/* User Registrations */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className="text-sm text-slate-400 mb-2">User Registrations</div>
                  <div className="text-3xl font-bold text-white mb-1">
                    {registrationStats?.stats.total_registrations.toLocaleString() || 0}
                  </div>
                  <div className="text-xs text-slate-500">
                    {registrationStats?.stats.completed_registrations || 0} completed,{' '}
                    {registrationStats?.stats.incomplete_registrations || 0} incomplete
                  </div>
                </div>
              </div>

              {/* Registration Details */}
              {registrationStats && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
                  <h3 className="text-xl font-bold text-white mb-4">Registration Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Total Registrations</div>
                      <div className="text-2xl font-bold text-white">
                        {registrationStats.stats.total_registrations}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Completed</div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {registrationStats.stats.completed_registrations}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400 mb-1">Incomplete</div>
                      <div className="text-2xl font-bold text-amber-400">
                        {registrationStats.stats.incomplete_registrations}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-sm text-slate-400 mb-2">Completion Rate</div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${registrationStats.stats.completion_rate || 0}%` }}
                        />
                      </div>
                      <div className="text-lg font-bold text-white">
                        {registrationStats.stats.completion_rate ? registrationStats.stats.completion_rate.toFixed(1) : '0.0'}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Chart */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Activity Over Time</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="player_search"
                        name="Player Searches"
                        stroke="#38bdf8"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="game_analysis"
                        name="Game Analyses"
                        stroke="#22c55e"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="pricing_page_view"
                        name="Pricing Views"
                        stroke="#a78bfa"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="user_registration"
                        name="Registrations"
                        stroke="#fb923c"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Event Comparison Bar Chart */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Event Comparison</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend />
                      <Bar dataKey="player_search" name="Player Searches" fill="#38bdf8" />
                      <Bar dataKey="game_analysis" name="Game Analyses" fill="#22c55e" />
                      <Bar dataKey="pricing_page_view" name="Pricing Views" fill="#a78bfa" />
                      <Bar dataKey="user_registration" name="Registrations" fill="#fb923c" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* User Analysis Statistics */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">User Analysis Activity</h3>
                <p className="text-sm text-slate-400 mb-4">Users who performed analyses during the selected period (click to expand player details)</p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold w-8"></th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">User</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Analyses</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Platforms</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userAnalysisStats && userAnalysisStats.users.length > 0 ? (
                        userAnalysisStats.users.map((userStat, index) => {
                          const isExpanded = expandedUsers.has(index)
                          const hasPlayers = userStat.players_analyzed && userStat.players_analyzed.length > 0

                          return (
                            <React.Fragment key={index}>
                              <tr
                                className="border-b border-white/5 hover:bg-white/5 transition cursor-pointer"
                                onClick={() => {
                                  const newExpanded = new Set(expandedUsers)
                                  if (isExpanded) {
                                    newExpanded.delete(index)
                                  } else {
                                    newExpanded.add(index)
                                  }
                                  setExpandedUsers(newExpanded)
                                }}
                              >
                                <td className="py-3 px-4">
                                  {hasPlayers && (
                                    <span className="text-slate-400">
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-slate-200">
                                  {userStat.user_email === 'Anonymous User' ? (
                                    <span className="text-slate-500 italic">{userStat.user_email}</span>
                                  ) : (
                                    <span className="font-medium">{userStat.user_email}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                                    {userStat.analysis_count} analyses
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-300">
                                  {userStat.platforms?.join(', ') || 'N/A'}
                                </td>
                                <td className="py-3 px-4 text-slate-400 text-xs">
                                  {new Date(userStat.last_analysis).toLocaleString()}
                                </td>
                              </tr>

                              {isExpanded && hasPlayers && (
                                <tr className="bg-white/3">
                                  <td colSpan={5} className="py-4 px-8">
                                    <div className="text-xs text-slate-300 font-semibold mb-3">
                                      Players Analyzed ({userStat.players_analyzed.length} unique players):
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {userStat.players_analyzed.map((player, pIndex) => (
                                        <div
                                          key={pIndex}
                                          className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3 border border-white/5"
                                        >
                                          <div className="flex-1">
                                            <div className="font-semibold text-sky-300">{player.username}</div>
                                            <div className="text-xs text-slate-500">{player.platform}</div>
                                          </div>
                                          <div className="ml-3">
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300">
                                              {player.count}x
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No user analysis data for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Most Searched Players */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-bold text-white mb-4">Most Searched Players</h3>
                <p className="text-sm text-slate-400 mb-4">Players that were searched for most often</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {playerSearchStats && playerSearchStats.players.length > 0 ? (
                    playerSearchStats.players.map((player, index) => (
                      <div key={index} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-white">#{index + 1}</span>
                              <span className="font-semibold text-sky-300">{player.username}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {player.platform} • {player.search_count} searches
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-emerald-400">
                              {player.search_count}
                            </div>
                            <div className="text-xs text-slate-500">searches</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-8 text-center text-slate-400">
                      No player search data for this period
                    </div>
                  )}
                </div>
              </div>

              {/* Players Whose Games Were Analyzed */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
                <h3 className="text-xl font-bold text-white mb-4">Players Whose Games Were Analyzed</h3>
                <p className="text-sm text-slate-400 mb-4">Which chess players had their games analyzed during this period</p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Player</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Platform</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Times Analyzed</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Analyzed By</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Last Analyzed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyzedPlayersStats && analyzedPlayersStats.players.length > 0 ? (
                        analyzedPlayersStats.players.map((player, index) => (
                          <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-sky-300">{player.player_username}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {player.platform}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300">
                                {player.analysis_count} times
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-xs">
                              {player.analyzer_emails?.join(', ') || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-xs">
                              {new Date(player.last_analyzed).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No analyzed players data for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registration Details */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-bold text-white mb-4">User Registrations</h3>
                <p className="text-sm text-slate-400 mb-4">Detailed registration information with completion status</p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Email</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Registration Date</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Status</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-semibold">Profile</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrationDetails && registrationDetails.registrations.length > 0 ? (
                        registrationDetails.registrations.map((reg, index) => (
                          <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition">
                            <td className="py-3 px-4">
                              <span className="font-medium text-slate-200">{reg.user_email}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-xs">
                              {new Date(reg.registration_date).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              {reg.is_completed ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                                  Completed
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300">
                                  Incomplete
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {reg.has_profile ? (
                                <span className="text-emerald-400 text-xs">✓ Created</span>
                              ) : (
                                <span className="text-slate-500 text-xs">✗ Missing</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400">
                            No registrations for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
    </div>
  )
}
