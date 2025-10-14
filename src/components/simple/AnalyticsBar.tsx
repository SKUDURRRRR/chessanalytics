// Simple Analytics Bar - Shows key statistics at a glance
import { useState, useEffect } from 'react'
import { UnifiedAnalysisService, AnalysisStats } from '../../services/unifiedAnalysisService'
import { calculateAverageAccuracy } from '../../utils/accuracyCalculator'
import { CHESS_ANALYSIS_COLORS } from '../../utils/chessColors'

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

        // Get stats first (this contains the accuracy we need)
        const statsData = await UnifiedAnalysisService.getAnalysisStats(userId, platform, 'stockfish')

        // Use backend accuracy directly - no need to fetch all game data for this component
        const finalAccuracy = statsData?.average_accuracy ?? 0

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
      <div className="bg-white/[0.08] border border-white/10 rounded-lg shadow-2xl shadow-black/50 p-4 mb-6">
        <div className="flex items-center justify-center space-x-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-400"></div>
          <span className="text-slate-300">Loading analytics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4 mb-6">
        <div className="flex items-center space-x-2">
          <div className="text-rose-400">Warning</div>
          <span className="text-rose-300">Error loading analytics: {error}</span>
        </div>
      </div>
    )
  }

  if (!analytics || analytics.total_games_analyzed === 0) {
    return (
      <div className="bg-white/[0.05] border border-white/10 rounded-lg p-4 mb-6">
        <div className="text-center text-slate-300">
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
    <div className="bg-gradient-to-r from-white/[0.08] to-white/[0.05] border border-white/10 rounded-lg p-6 mb-6 shadow-2xl shadow-black/50">
      {isMockData && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-amber-400">Warning</span>
            <span className="text-amber-300 text-sm font-medium">Demo Data - Click "Analyze My Games" to see real analytics</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-200">Quick Stats</h3>
        <div className="text-sm text-slate-300">
          {platform === 'chess.com' ? 'Chess.com' : 'Lichess'} - {userId}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Games Analyzed */}
        <div className="text-center">
          <div className="text-2xl font-bold text-sky-400">{analytics.total_games_analyzed}</div>
          <div className="text-sm text-slate-300">Games Analyzed</div>
        </div>

        {/* Average Accuracy */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${CHESS_ANALYSIS_COLORS.accuracy}`}>{analytics.average_accuracy}%</div>
          <div className="text-sm text-slate-300">Avg Accuracy</div>
        </div>

        {/* Blunders */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${CHESS_ANALYSIS_COLORS.blunders}`}>{analytics.total_blunders}</div>
          <div className="text-sm text-slate-300">Blunders</div>
        </div>

        {/* Mistakes */}
        <div className="text-center">
          <div className={`text-2xl font-bold ${CHESS_ANALYSIS_COLORS.mistakes}`}>{analytics.total_mistakes}</div>
          <div className="text-sm text-slate-300">Mistakes</div>
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-center">
          <div className="text-sm text-slate-300 mb-1">Analysis Summary</div>
          <div className="text-sm text-slate-200">
            {analytics.total_brilliant_moves} brilliant moves - {analytics.total_inaccuracies}{' '}
            inaccuracies
          </div>
        </div>
      </div>
    </div>
  )
}
