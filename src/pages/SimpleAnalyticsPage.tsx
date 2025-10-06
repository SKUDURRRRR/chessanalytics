// Simple Analytics Page - One page, everything you need
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom'
import { SimpleAnalytics } from '../components/simple/SimpleAnalytics'
import { MatchHistory } from '../components/simple/MatchHistory'
import { AnalysisProgressBar } from '../components/simple/AnalysisProgressBar'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { AutoImportService } from '../services/autoImportService'
import { UnifiedAnalysisService } from '../services/unifiedAnalysisService'
import DatabaseDiagnosticsComponent from '../components/debug/DatabaseDiagnostics'
import { EloDataDebugger } from '../components/debug/EloDataDebugger'
import { EloStatsOptimizer } from '../components/debug/EloStatsOptimizer'
import { ComprehensiveAnalytics } from '../components/debug/ComprehensiveAnalytics'
import { OpeningFilter, OpeningIdentifierSets } from '../types'

const ANALYSIS_TEST_LIMIT = 10

const serializeOpeningIdentifiers = (identifiers: OpeningIdentifierSets): string => {
  try {
    return encodeURIComponent(JSON.stringify(identifiers))
  } catch (err) {
    console.error('Failed to serialize opening identifiers', err)
    return ''
  }
}

const parseOpeningIdentifiers = (serialized: string | null): OpeningIdentifierSets => {
  if (!serialized) {
    return { openingFamilies: [], openings: [] }
  }

  try {
    const decoded = decodeURIComponent(serialized)
    const parsed = JSON.parse(decoded)

    const openingFamilies = Array.isArray(parsed.openingFamilies)
      ? parsed.openingFamilies.filter((value: unknown) => typeof value === 'string')
      : []

    const openings = Array.isArray(parsed.openings)
      ? parsed.openings.filter((value: unknown) => typeof value === 'string')
      : []

    return {
      openingFamilies,
      openings,
    }
  } catch (err) {
    console.error('Failed to parse opening identifiers', err)
    return { openingFamilies: [], openings: [] }
  }
}

export default function SimpleAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [userId, setUserId] = useState('')
  const [platform, setPlatform] = useState<'lichess' | 'chess.com'>('lichess')
  const [activeTab, setActiveTab] = useState<'analytics' | 'matchHistory'>(
    'analytics'
  )
  const [refreshKey, setRefreshKey] = useState(0)
  const [openingFilter, setOpeningFilter] = useState<OpeningFilter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [apiAvailable, setApiAvailable] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [analysisProgress, setAnalysisProgress] = useState<{
    analyzed_games: number
    total_games: number
    progress_percentage: number
    is_complete: boolean
    current_phase: string
  } | null>(null)
  const [progressStatus, setProgressStatus] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check for route parameters first, then URL parameters
    const routeUser = params.userId
    const routePlatform = params.platform as 'lichess' | 'chess.com'
    const urlUser = searchParams.get('user')
    const urlPlatform = searchParams.get('platform') as 'lichess' | 'chess.com'
    const urlTab = searchParams.get('tab') as 'analytics' | 'matchHistory'
    const urlOpening = searchParams.get('opening')
    const urlOpeningIdentifiers = searchParams.get('openingIdentifiers')

    const finalUser = routeUser || urlUser
    const finalPlatform = routePlatform || urlPlatform

    // Set tab from URL parameter, default to 'analytics' if not specified or invalid
    if (urlTab && ['analytics', 'matchHistory'].includes(urlTab)) {
      setActiveTab(urlTab)
    }

    // Set opening filter from URL parameter
    if (urlOpening) {
      const parsedIdentifiers = parseOpeningIdentifiers(urlOpeningIdentifiers)
      setOpeningFilter({
        normalized: urlOpening,
        identifiers: parsedIdentifiers,
      })
    }

    if (finalUser && finalPlatform) {
      // Trim and canonicalize user ID to prevent URL encoding issues
      const trimmedUser = finalUser.trim()
      setUserId(trimmedUser)
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
    console.log('🔍 Checking API health...')
    const available = await UnifiedAnalysisService.checkHealth()
    console.log('🔍 API health check result:', available)
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

  const handleTabChange = (tab: 'analytics' | 'matchHistory') => {
    setActiveTab(tab)
    // Update URL search params to persist tab state
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('tab', tab)
    setSearchParams(newSearchParams, { replace: true })
  }

  const handleOpeningClick = (filter: OpeningFilter) => {
    setOpeningFilter(filter)
    setActiveTab('matchHistory')
    // Update URL search params to persist tab state and filter
    const newSearchParams = new URLSearchParams(searchParams)
    newSearchParams.set('tab', 'matchHistory')
    newSearchParams.set('opening', filter.normalized)
    newSearchParams.set('openingIdentifiers', serializeOpeningIdentifiers(filter.identifiers))
    setSearchParams(newSearchParams, { replace: true })
  }

  const importGames = async () => {
    if (!userId) {
      return
    }

    try {
      setImporting(true)
      setImportError(null)
      setImportStatus('Checking for new games...')

      const result = await AutoImportService.importSmartGames(userId, platform, progress => {
        setImportStatus(progress.message)
      })

      if (result.success) {
        if (result.importedGames > 0) {
          setImportStatus(`Import complete! ${result.message}. Refreshing analytics...`)
          handleRefresh()
        } else {
          setImportStatus(`Import complete! No new games found. You already have all recent games imported.`)
        }
        setTimeout(() => setImportStatus(null), 5000) // Show success message longer
      } else {
        const message = result.message || 'Import failed'
        setImportError(message)
      }
    } catch (error) {
      console.error('Error importing games:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      setImportError(message)
    } finally {
      setImporting(false)
    }
  }

  const fetchProgress = async () => {
    if (!userId) {
      return
    }

    try {
      console.log('[SimpleAnalytics] fetchProgress triggered', { userId, platform })
      const progress = await UnifiedAnalysisService.getRealtimeAnalysisProgress(userId, platform, 'stockfish')

      if (progress) {
        setAnalysisProgress(progress)
        setProgressStatus(
          progress.is_complete
            ? (progress.status_message || 'Analysis complete! Refreshing your insights...')
            : 'Crunching games with Stockfish and updating live...'
        )

        if (progress.is_complete) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          setAnalyzing(false)
          setTimeout(() => setProgressStatus(null), 2500)
          handleRefresh()
        } else {
          setAnalyzing(true)
        }
      } else {
        setProgressStatus('Waiting for the engine to report progress...')
        setAnalyzing(true)
      }
    } catch (error) {
      console.error('Error fetching progress:', error)
      setProgressStatus('Still waiting for updates from the analysis engine...')
      setAnalyzing(true)
    }
  }

  const startAnalysis = async () => {
    try {
      console.log('Analyze My Games button clicked! SimpleAnalyticsPage.')
      console.log('Starting analysis for:', { userId, platform, limit: ANALYSIS_TEST_LIMIT })
      console.log('User ID type:', typeof userId, 'Value:', JSON.stringify(userId))
      console.log('API available:', apiAvailable)
      console.log('Current analyzing state:', analyzing)

      setAnalyzing(true)
      setAnalysisError(null)
      setAnalysisProgress(null)
      setProgressStatus('Connecting to the analysis engine...')

      const result = await UnifiedAnalysisService.startBatchAnalysis(userId, platform, 'stockfish', ANALYSIS_TEST_LIMIT)
      console.log('Analysis result:', result)
      console.log('Analysis success:', result.success)

      if (result.success) {
        console.log('Analysis started successfully, starting progress monitoring...')
        setProgressStatus('Waiting for the engine to report progress...')
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
        }

        setAnalyzing(true)
        console.log('[SimpleAnalytics] Setting progress polling interval (1s)')
        progressIntervalRef.current = setInterval(fetchProgress, 1000) // Check every 1 second for more responsive updates

        setTimeout(() => {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          setAnalyzing(false)
          setProgressStatus('Timed out waiting for live updates. Refreshing your data...')
          handleRefresh()
        }, 10 * 60 * 1000) // 10 minutes timeout

        console.log('[SimpleAnalytics] Calling initial fetchProgress immediately')
        await fetchProgress()
      } else {
        console.log('Analysis failed to start:', result.message)
        const message = result.message || 'Failed to start analysis'
        setAnalysisError(message)
        setProgressStatus(message)
        setAnalyzing(false)
      }
    } catch (err) {
      console.error('Error starting analysis:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      const friendlyMessage = `Failed to start analysis: ${errorMessage}. Please ensure the Python backend server is running.`
      setAnalysisError(friendlyMessage)
      setProgressStatus(friendlyMessage)
      setAnalyzing(false)
    }
  }

  // Cleanup interval on unmount
  useEffect(() => {
    console.log('[SimpleAnalytics] cleanup effect registered')
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

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
              <span className="text-gray-400">???</span>
              <span className="capitalize font-medium">{platform}</span>
            </div>
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={importGames}
                disabled={importing}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {importing ? 'Importing...' : 'Import Games'}
              </button>
              <button
                onClick={() => {
                  console.log('🔘 Analyze My Games button clicked!')
                  console.log('🔘 Button state - analyzing:', analyzing, 'apiAvailable:', apiAvailable)
                  startAnalysis()
                }}
                disabled={analyzing || !apiAvailable}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {analyzing ? 'Analyzing...' : 'Analyze My Games'}
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                {showDebug ? 'Hide Debug' : 'Debug'}
              </button>
              {lastRefresh && (
                <span className="text-xs text-gray-500">
                  Updated: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
            </div>
            {importStatus && (
              <div className="text-xs text-blue-600 pt-2">{importStatus}</div>
            )}
          </div>
          <div className="w-32"></div> {/* Spacer for centering */}
        </div>
      )}

      {/* Progress Bar */}
      <AnalysisProgressBar analyzing={analyzing} progress={analysisProgress} statusMessage={progressStatus} />

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg max-w-md mx-auto">
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
          {/* Analytics Display */}
          <SimpleAnalytics
            key={`simple-analytics-${refreshKey}`}
            userId={userId}
            platform={platform}
            onOpeningClick={handleOpeningClick}
          />
        </div>
      )}

      {activeTab === 'matchHistory' && (
        <ErrorBoundary>
          <MatchHistory 
            key={`match-history-${refreshKey}`} 
            userId={userId} 
            platform={platform} 
            openingFilter={openingFilter}
            onClearFilter={() => {
              setOpeningFilter(null)
              const newSearchParams = new URLSearchParams(searchParams)
              newSearchParams.delete('opening')
              newSearchParams.delete('openingIdentifiers')
              setSearchParams(newSearchParams, { replace: true })
            }}
            onGameSelect={(game) => {
              // Navigate to game analysis page
              navigate(`/analysis/${platform}/${userId}/${game.provider_game_id}`, {
                state: { from: { pathname: location.pathname, search: location.search }, game }
              })
            }}
          />
        </ErrorBoundary>
      )}

        {/* Debug Panel */}
        {showDebug && userId && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Debug Information</h2>
            <ComprehensiveAnalytics userId={userId} platform={platform} />
            <EloStatsOptimizer userId={userId} platform={platform} />
            <EloDataDebugger userId={userId} platform={platform} />
            <DatabaseDiagnosticsComponent
              userId={userId}
              platform={platform}
              onDiagnosticsComplete={(diagnostics) => {
                console.log('Diagnostics completed:', diagnostics)
              }}
            />
          </div>
        )}

      {/* Import Error Message */}
      {importError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="text-yellow-600">!</div>
            <span className="text-yellow-800">{importError}</span>
          </div>
        </div>
      )}
      {/* Analysis Error Message */}
      {analysisError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <div className="text-red-500">???</div>
            <span className="text-red-700">{analysisError}</span>
          </div>
        </div>
      )}
    </div>
  )
}
