// Simple Analytics Component - One component, everything you need
import { useState, useEffect } from 'react'
import { AnalysisService, AnalysisStats } from '../../services/analysisService'

interface SimpleAnalyticsProps {
  userId: string
  platform?: string
  fromDate?: string
  toDate?: string
}

export function SimpleAnalytics({ userId, platform, fromDate, toDate }: SimpleAnalyticsProps) {
  const [data, setData] = useState<AnalysisStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const result = await AnalysisService.getAnalysisStats(
        userId,
        (platform as 'lichess' | 'chess.com') || 'lichess',
        'basic' // Use basic analysis type
      )
      setData(result)
    } catch (err) {
      console.error('Failed to load analytics:', err)
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId, platform, fromDate, toDate])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Chess Analytics</h2>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-28"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Error</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => loadData(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">No Data</h2>
        <p>No games found for this user.</p>
      </div>
    )
  }

  // Check if we're showing mock data
  const isMockData = data.total_games_analyzed === 15 && data.average_accuracy === 78.5

  return (
    <div className="space-y-4" data-testid="analytics-container">
      {/* Mock Data Warning */}
      {isMockData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-yellow-600 text-xl">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Demo Data Shown</h3>
              <p className="text-yellow-700 mb-3">
                You're seeing sample analytics data because no analysis has been performed on your games yet.
              </p>
              <div className="bg-yellow-100 p-3 rounded border border-yellow-300">
                <p className="text-yellow-800 font-medium mb-1">To see your real analytics:</p>
                <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
                  <li>Click the "Analyze My Games" button above</li>
                  <li>Wait for the analysis to complete (this may take a few minutes)</li>
                  <li>Refresh the page to see your real analytics data</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Games Analyzed</h3>
          <div className="text-2xl font-bold">{data.total_games_analyzed}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Average Accuracy</h3>
          <div className="text-2xl font-bold text-green-600">{data.average_accuracy}%</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Blunders</h3>
          <div className="text-2xl font-bold text-red-600">{data.total_blunders}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Mistakes</h3>
          <div className="text-2xl font-bold text-orange-600">{data.total_mistakes}</div>
        </div>
      </div>

      {/* Analysis Stats */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Analysis Statistics</h2>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Opening Accuracy:</span>
              <span className="font-medium">{data.average_opening_accuracy}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Middle Game Accuracy:</span>
              <span className="font-medium">{data.average_middle_game_accuracy}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Endgame Accuracy:</span>
              <span className="font-medium">{data.average_endgame_accuracy}%</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Blunders per Game:</span>
              <span className="font-medium">{data.blunders_per_game}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Inaccuracies per Game:</span>
              <span className="font-medium">{data.inaccuracies_per_game}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Brilliant Moves per Game:</span>
              <span className="font-medium text-green-600">{data.brilliant_moves_per_game}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
