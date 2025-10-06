// Simple Analytics Bar - Shows key statistics at a glance
import { useState, useEffect } from 'react'
import { UnifiedAnalysisService, AnalysisStats } from '../../services/unifiedAnalysisService'
import { calculateAverageAccuracy } from '../../utils/accuracyCalculator'

interface AnalyticsBarProps {
  userId: string
  platform: 'lichess' | 'chess.com'
}

export function AnalyticsBar({ userId, platform }: AnalyticsBarProps) {
  const [analytics, setAnalytics] = useState<AnalysisStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setAnalytics(null)
      setError(null)
      setLoading(false)
      return
    }

    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get both the stats and the raw game data
        const [statsData, gamesData] = await Promise.all([
          UnifiedAnalysisService.getAnalysisStats(userId, platform, 'stockfish'),
          UnifiedAnalysisService.getGameAnalyses(userId, platform, 'stockfish')
        ])

        // Use backend accuracy if available, otherwise calculate from raw game data
        let finalAccuracy = statsData?.average_accuracy ?? 0

        // Only calculate from raw data if backend accuracy is 0 or missing
        if (finalAccuracy === 0 && gamesData && gamesData.length > 0) {
          const playerRating = statsData?.current_rating
          const calculatedAccuracy = calculateAverageAccuracy(gamesData, playerRating)
          if (calculatedAccuracy > 0) {
            finalAccuracy = calculatedAccuracy
          }
        }

        if (statsData) {
          setAnalytics({ ...statsData, average_accuracy: finalAccuracy })
        } else {
          setAnalytics(null)
        }
      } catch (err) {
        console.error('Error fetching analytics:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [userId, platform])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex items-center justify-center space-x-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="text-gray-600">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2">
          <div className="text-red-500">Warning</div>
          <span className="text-red-700">Error loading analytics: {error}</span>
        </div>
      </div>
    )
  }

  if (!analytics || analytics.total_games_analyzed === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="text-center text-gray-600">
          <div className="text-2xl mb-2">Stats</div>
          <p>
            No analysis data found for {userId} on {platform}
          </p>
          <p className="text-sm">Start analysis to see your chess insights!</p>
        </div>
      </div>
    )
  }

  // Check if we're showing mock data - look for actual mock patterns, not just specific values
  const isMockData = analytics && (
    analytics.total_games_analyzed === 15 && 
    analytics.average_accuracy === 78.5 && 
    analytics.total_blunders === 3 && 
    analytics.total_mistakes === 8 &&
    analytics.average_opening_accuracy === 82.3
  )

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
      {isMockData && (
        <div className="bg-yellow-100 border border-yellow-300 rounded p-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600">Warning</span>
            <span className="text-yellow-800 text-sm font-medium">Demo Data - Click "Analyze My Games" to see real analytics</span>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Quick Stats</h3>
        <div className="text-sm text-gray-600">
          {platform === 'chess.com' ? 'Chess.com' : 'Lichess'} - {userId}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Games Analyzed */}
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{analytics.total_games_analyzed}</div>
          <div className="text-sm text-gray-600">Games Analyzed</div>
        </div>

        {/* Average Accuracy */}
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{analytics.average_accuracy}%</div>
          <div className="text-sm text-gray-600">Avg Accuracy</div>
        </div>

        {/* Blunders */}
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{analytics.total_blunders}</div>
          <div className="text-sm text-gray-600">Blunders</div>
        </div>

        {/* Mistakes */}
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600">{analytics.total_mistakes}</div>
          <div className="text-sm text-gray-600">Mistakes</div>
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="mt-4 pt-4 border-t border-blue-200">
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-1">Analysis Summary</div>
          <div className="text-sm text-gray-700">
            {analytics.total_brilliant_moves} brilliant moves - {analytics.total_inaccuracies}{' '}
            inaccuracies
          </div>
        </div>
      </div>
    </div>
  )
}
