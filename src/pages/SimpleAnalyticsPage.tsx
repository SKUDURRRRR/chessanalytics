// Simple Analytics Page - One page, everything you need
import { useState, useEffect } from 'react'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { SimpleAnalytics } from '../components/simple/SimpleAnalytics'
import { AnalyticsBar } from '../components/simple/AnalyticsBar'
import { MatchHistory } from '../components/simple/MatchHistory'
import { DeepAnalysisBlock } from '../components/deep/DeepAnalysisBlock'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { AnalysisService } from '../services/analysisService'

export default function SimpleAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useParams()
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [platform, setPlatform] = useState<'lichess' | 'chess.com'>('lichess')
  const [activeTab, setActiveTab] = useState<'analytics' | 'deepAnalysis' | 'matchHistory'>(
    'analytics'
  )
  const [refreshKey, setRefreshKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    // Check for route parameters first, then URL parameters
    const routeUser = params.userId
    const routePlatform = params.platform as 'lichess' | 'chess.com'
    const urlUser = searchParams.get('user')
    const urlPlatform = searchParams.get('platform') as 'lichess' | 'chess.com'
    const urlTab = searchParams.get('tab') as 'analytics' | 'deepAnalysis' | 'matchHistory'

    const finalUser = routeUser || urlUser
    const finalPlatform = routePlatform || urlPlatform

    // Set tab from URL parameter, default to 'analytics' if not specified or invalid
    if (urlTab && ['analytics', 'deepAnalysis', 'matchHistory'].includes(urlTab)) {
      setActiveTab(urlTab)
    }

    if (finalUser && finalPlatform) {
      setUserId(finalUser)
      setPlatform(finalPlatform)
      setIsLoading(false)
    } else {
      // Try to load the most recent user on app start
      loadMostRecentUser()
    }
  }, [searchParams, params])

  useEffect(() => {
    checkApiHealth()
  }, [])

  const checkApiHealth = async () => {
    const available = await AnalysisService.checkHealth()
    setApiAvailable(available)
  }

  const loadMostRecentUser = async () => {
    // For now, just set loading to false
    // In the future, we could implement a "recent users" feature
    setIsLoading(false)
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    setLastRefresh(new Date())
  }

  const handleTabChange = (tab: 'analytics' | 'deepAnalysis' | 'matchHistory') => {
    setActiveTab(tab)
    // Update URL search params to persist tab state
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('tab', tab)
    setSearchParams(newSearchParams, { replace: true })
  }

  const startAnalysis = async () => {
    try {
      setAnalyzing(true)
      setAnalysisError(null)

      const result = await AnalysisService.startAnalysis(userId, platform, 100)

      if (result.success) {
        // Refresh data after successful analysis
        handleRefresh()
      } else {
        setAnalysisError(result.message || 'Failed to start analysis')
      }
    } catch (err) {
      console.error('Error starting analysis:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setAnalysisError(
        `Failed to start analysis: ${errorMessage}. Please ensure the Python backend server is running.`
      )
    } finally {
      setAnalyzing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your chess analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {userId && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span>Back to Search</span>
          </button>
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2 text-lg text-gray-700">
              <span className="font-medium">{userId}</span>
              <span className="text-gray-400">•</span>
              <span className="capitalize font-medium">{platform}</span>
            </div>
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={startAnalysis}
                disabled={analyzing || !apiAvailable}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {analyzing ? 'Analyzing...' : 'Analyze My Games'}
              </button>
              {lastRefresh && (
                <span className="text-xs text-gray-500">
                  Updated: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
          <div className="w-32"></div> {/* Spacer for centering */}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg max-w-xl mx-auto">
        <button
          onClick={() => handleTabChange('analytics')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            activeTab === 'analytics'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Analytics
        </button>
        <button
          onClick={() => handleTabChange('deepAnalysis')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            activeTab === 'deepAnalysis'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Deep Analysis
        </button>
        <button
          onClick={() => handleTabChange('matchHistory')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            activeTab === 'matchHistory'
              ? 'bg-white text-gray-900 shadow'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Match History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {/* Quick Stats Bar */}
          <AnalyticsBar key={`analytics-bar-${refreshKey}`} userId={userId} platform={platform} />

          {/* Analytics Display */}
          <SimpleAnalytics
            key={`simple-analytics-${refreshKey}`}
            userId={userId}
            platform={platform}
          />
        </div>
      )}

      {activeTab === 'deepAnalysis' && (
        <ErrorBoundary>
          <DeepAnalysisBlock
            key={`deep-analysis-${refreshKey}`}
            userId={userId}
            platform={platform}
          />
        </ErrorBoundary>
      )}

      {activeTab === 'matchHistory' && (
        <ErrorBoundary>
          <MatchHistory key={`match-history-${refreshKey}`} userId={userId} platform={platform} />
        </ErrorBoundary>
      )}

      {/* Analysis Error Message */}
      {analysisError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="text-red-500">❌</div>
            <span className="text-red-700">{analysisError}</span>
          </div>
        </div>
      )}
    </div>
  )
}
