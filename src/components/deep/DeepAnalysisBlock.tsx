import { useState, useEffect } from 'react'
import { fetchDeepAnalysis, DeepAnalysisData } from '../../services/deepAnalysisService'
import { PersonalityRadar } from './PersonalityRadar'
import { LongTermPlanner } from './LongTermPlanner'
import { OpeningPlayerCard } from './OpeningPlayerCard'
import { ScoreCards } from './ScoreCards'
import { DataGenerator } from '../admin/DataGenerator'

interface DeepAnalysisBlockProps {
  userId: string
  platform: 'lichess' | 'chess.com'
}

export function DeepAnalysisBlock({ userId, platform }: DeepAnalysisBlockProps) {
  const [data, setData] = useState<DeepAnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const analysisData = await fetchDeepAnalysis(userId, platform)
      setData(analysisData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId, platform, refreshKey])

  // Function to refresh data (can be called from parent components)
  const refreshData = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading deep analysis...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No analysis data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Deep Analysis</h2>
        <button
          onClick={refreshData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>🔄</span>
          Refresh Data
        </button>
      </div>

      {/* Data Generator for testing */}
      <DataGenerator userId={userId} platform={platform} onAnalysisComplete={refreshData} />

      {/* Long-term Planner */}
      <LongTermPlanner data={data} />

      {/* Main Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personality Radar */}
        <PersonalityRadar scores={data.personalityScores} />

        {/* Opening Player Card */}
        <OpeningPlayerCard
          score={data.personalityScores.opening}
          phaseAccuracy={data.phaseAccuracies.opening}
        />
      </div>

      {/* Score Cards */}
      <ScoreCards scores={data.personalityScores} />

      {/* Move Analyses Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Move Analyses Data</h3>
        <div className="text-sm text-gray-600 mb-4">
          This section shows the detailed move-by-move analysis data from Stockfish.
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-700">
            <p>
              <strong>Note:</strong> Move analyses data is stored in the database and used to
              calculate personality scores.
            </p>
            <p className="mt-2">
              The personality radar above is calculated from this detailed analysis data.
            </p>
            <p className="mt-2">
              To view individual game move analyses, use the Two-Tier Analysis Panel for specific
              games.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
