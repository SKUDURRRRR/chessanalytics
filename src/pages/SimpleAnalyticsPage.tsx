// Simple Analytics Page - One page, everything you need
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom'
import { SimpleAnalytics } from '../components/simple/SimpleAnalytics'
import { MatchHistory } from '../components/simple/MatchHistory'
import { AnalysisProgressBar } from '../components/simple/AnalysisProgressBar'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { AutoImportService, LargeImportProgress, GameDiscovery, DateRange } from '../services/autoImportService'
import { UnifiedAnalysisService } from '../services/unifiedAnalysisService'
import { ProfileService } from '../services/profileService'
import { supabase } from '../lib/supabase'
import { clearUserCache } from '../utils/apiCache'
// DatabaseDiagnosticsComponent is development-only, imported conditionally below
// Debug components removed from production
// import { EloGapFiller } from '../components/debug/EloGapFiller' // Debug component - commented out for production
import { OpeningFilter, OpeningIdentifierSets } from '../types'

const ANALYSIS_TEST_LIMIT = 5

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

// Canonicalize user ID to match backend logic
function canonicalizeUserId(userId: string, platform: string): string {
  if (platform === 'chess.com') {
    return userId.trim().toLowerCase()
  } else { // lichess
    return userId.trim()
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
  const [forceDataRefresh, setForceDataRefresh] = useState(false)
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
  const [analyzedGameIds, setAnalyzedGameIds] = useState<Set<string>>(new Set())
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const forceRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [hasGames, setHasGames] = useState(false)
  const [gameCount, setGameCount] = useState(0)
  const [largeImportProgress, setLargeImportProgress] = useState<LargeImportProgress | null>(null)
  const [showDateRangePicker, setShowDateRangePicker] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>({})
  const [gameDiscovery, setGameDiscovery] = useState<GameDiscovery | null>(null)
  const largeImportIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastImportProgressRef = useRef<number>(0)
  const importStuckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const largeImportDismissTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-sync state management
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [autoSyncProgress, setAutoSyncProgress] = useState<{
    status: 'idle' | 'checking' | 'importing' | 'complete' | 'error'
    message: string
    importedGames: number
  }>({
    status: 'idle',
    message: '',
    importedGames: 0
  })
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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

  // Auto-sync effect - triggers when userId and platform are set
  useEffect(() => {
    if (userId && platform && !isLoading) {
      // Small delay to ensure page is fully loaded
      const timeoutId = setTimeout(() => {
        checkAndSyncNewGames()
      }, 1000)

      return () => clearTimeout(timeoutId)
    }
  }, [userId, platform, isLoading])

  useEffect(() => {
    const checkGamesExist = async () => {
      if (!userId || !platform) return

      try {
        const canonicalUserId = canonicalizeUserId(userId, platform)
        console.log('[checkGamesExist] Original userId:', JSON.stringify(userId))
        console.log('[checkGamesExist] Canonical userId:', JSON.stringify(canonicalUserId))
        console.log('[checkGamesExist] Platform:', platform)

        // Use backend API to get total games count (instead of direct Supabase query)
        const eloStats = await UnifiedAnalysisService.getEloStats(canonicalUserId, platform as 'lichess' | 'chess.com')
        const gameCount = eloStats.total_games || 0

        console.log('[checkGamesExist] Game count found:', gameCount)

        setGameCount(gameCount)
        setHasGames(gameCount > 0)
      } catch (error) {
        console.error('Error checking games:', error)
      }
    }

    checkGamesExist()
  }, [userId, platform, refreshKey])

  // Cleanup effect for timeouts and intervals
  useEffect(() => {
    return () => {
      // Clear all timeouts
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      if (forceRefreshTimeoutRef.current) clearTimeout(forceRefreshTimeoutRef.current)

      // Clear intervals
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
      if (largeImportIntervalRef.current) clearInterval(largeImportIntervalRef.current)
      if (importStuckTimeoutRef.current) clearTimeout(importStuckTimeoutRef.current)
      if (largeImportDismissTimeoutRef.current) clearTimeout(largeImportDismissTimeoutRef.current)
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current)
    }
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
          // Clear cache to force fresh data load after import
          clearUserCache(userId, platform)
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

  const startLargeImport = async () => {
    if (!userId) return

    try {
      // Start import with default limit of 5000
      // Skip discovery to avoid 404 errors - backend will handle duplicate detection
      setLargeImportProgress({
        status: 'importing',
        importedGames: 0,
        totalToImport: 5000,
        progress: 0,
        message: 'Starting import of up to 5,000 games...'
      })

      await AutoImportService.importMoreGames(userId, platform, 5000, dateRange)

      // Start polling
      startLargeImportPolling()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setLargeImportProgress({
        status: 'error',
        importedGames: 0,
        totalToImport: 0,
        progress: 0,
        message: `Import failed: ${errorMessage}`
      })
    }
  }

  const startLargeImportPolling = () => {
    if (largeImportIntervalRef.current) {
      clearInterval(largeImportIntervalRef.current)
    }

    // Reset progress tracking
    lastImportProgressRef.current = 0

    // Start stuck detection timeout
    const checkStuckImport = () => {
      if (importStuckTimeoutRef.current) {
        clearTimeout(importStuckTimeoutRef.current)
      }

      importStuckTimeoutRef.current = setTimeout(() => {
        console.error('Import appears stuck - no progress in 5 minutes')
        setLargeImportProgress(prev => prev ? {
          ...prev,
          status: 'error',
          message: 'Import timed out - no response from server in 5 minutes. Please refresh the page.'
        } : null)

        if (largeImportIntervalRef.current) {
          clearInterval(largeImportIntervalRef.current)
          largeImportIntervalRef.current = null
        }
      }, 300000) // 5 minutes timeout (300 seconds) - allows for rate-limited imports
    }

    checkStuckImport()

    largeImportIntervalRef.current = setInterval(async () => {
      try {
        const progress = await AutoImportService.getImportProgress(userId, platform)
        setLargeImportProgress(progress)

        // Check if progress has changed
        if (progress.importedGames !== lastImportProgressRef.current) {
          lastImportProgressRef.current = progress.importedGames
          // Reset timeout since we have progress
          checkStuckImport()
        }

        // Refresh analytics every 500 games
        if (progress.triggerRefresh) {
          handleRefresh()
        }

        // Stop polling when complete
        if (progress.status === 'completed' || progress.status === 'cancelled' || progress.status === 'error') {
          if (largeImportIntervalRef.current) {
            clearInterval(largeImportIntervalRef.current)
            largeImportIntervalRef.current = null
          }
          if (importStuckTimeoutRef.current) {
            clearTimeout(importStuckTimeoutRef.current)
            importStuckTimeoutRef.current = null
          }

          // Auto-dismiss completion messages after 3 seconds
          if (progress.status === 'completed') {
            largeImportDismissTimeoutRef.current = setTimeout(() => setLargeImportProgress(null), 3000)
          }

          // Clear cache to force fresh data load after large import
          clearUserCache(userId, platform)
          handleRefresh() // Final refresh
          setHasGames(true) // Update hasGames state
        }
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 2000)
  }

  const cancelLargeImport = async () => {
    try {
      await AutoImportService.cancelImport(userId, platform)
      setLargeImportProgress(prev => prev ? { ...prev, message: 'Cancelling...' } : null)
    } catch (error) {
      console.error('Cancel error:', error)
    }
  }

  const dismissImportProgress = () => {
    if (largeImportDismissTimeoutRef.current) {
      clearTimeout(largeImportDismissTimeoutRef.current)
      largeImportDismissTimeoutRef.current = null
    }
    setLargeImportProgress(null)
  }

  const checkAndSyncNewGames = async () => {
    if (!userId || !platform) return

    // Create unique key for this user/platform combination
    const syncKey = `${userId}-${platform}`

    // Check if auto-sync is already running to prevent duplicate simultaneous runs
    if (autoSyncing) {
      console.log('Auto-sync already in progress, skipping')
      return
    }

    // Skip auto-sync if we synced within the last 10 minutes (saves 2-3 seconds)
    const lastSyncKey = `lastSync_${syncKey}`
    const lastSyncTime = localStorage.getItem(lastSyncKey)
    if (lastSyncTime) {
      const timeSinceLastSync = Date.now() - parseInt(lastSyncTime)
      const TEN_MINUTES = 10 * 60 * 1000
      if (timeSinceLastSync < TEN_MINUTES) {
        console.log(`Auto-sync skipped - last sync was ${Math.round(timeSinceLastSync / 1000)}s ago`)
        return
      }
    }

    try {
      console.log('Starting auto-sync for:', { userId, platform })
      setAutoSyncing(true)
      setAutoSyncProgress({
        status: 'checking',
        message: 'Checking for new games...',
        importedGames: 0
      })

      // Check if user profile exists in database
      const profileExists = await ProfileService.checkUserExists(userId, platform)

      if (!profileExists) {
        console.log('No profile found, skipping auto-sync')
        setAutoSyncing(false)
        setAutoSyncProgress({ status: 'idle', message: '', importedGames: 0 })
        return
      }

      // Update progress to importing
      setAutoSyncProgress({
        status: 'importing',
        message: 'Importing new games...',
        importedGames: 0
      })

      // Run smart import
      const result = await AutoImportService.importSmartGames(userId, platform, (progress) => {
        setAutoSyncProgress({
          status: 'importing',
          message: progress.message,
          importedGames: progress.importedGames
        })
      })

      // Check if we actually imported NEW games (not just updated existing ones)
      // Use newGamesCount explicitly - if it's 0, we want 0 (not importedGames as fallback)
      const actualNewGames = result.newGamesCount ?? 0
      console.log('[Auto-sync] Import result:', { importedGames: result.importedGames, newGamesCount: result.newGamesCount, actualNewGames })

      // Update last sync timestamp
      localStorage.setItem(lastSyncKey, Date.now().toString())

      if (result.success && actualNewGames > 0) {
        // Show success message
        setAutoSyncProgress({
          status: 'complete',
          message: `Imported ${actualNewGames} new games!`,
          importedGames: actualNewGames
        })

        // Auto-refresh analytics to show new data
        handleRefresh()

        // Auto-dismiss after 4 seconds
        autoSyncTimeoutRef.current = setTimeout(() => {
          setAutoSyncing(false)
          setAutoSyncProgress({ status: 'idle', message: '', importedGames: 0 })
        }, 4000)
      } else {
        // No new games - silently dismiss without showing notification
        console.log('[Auto-sync] No new games found, dismissing silently')
        setAutoSyncing(false)
        setAutoSyncProgress({ status: 'idle', message: '', importedGames: 0 })
      }
    } catch (error) {
      console.error('Auto-sync error:', error)
      setAutoSyncProgress({
        status: 'error',
        message: 'Auto-sync failed',
        importedGames: 0
      })

      // Auto-dismiss error after 3 seconds
      autoSyncTimeoutRef.current = setTimeout(() => {
        setAutoSyncing(false)
        setAutoSyncProgress({ status: 'idle', message: '', importedGames: 0 })
      }, 3000)
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
        console.log('[SimpleAnalytics] Progress received:', progress)
        setAnalysisProgress(progress)

        // Check if this is a real completion or just no analysis running
        const isRealCompletion = progress.is_complete && progress.total_games > 0
        const isNoAnalysisRunning = progress.is_complete && progress.total_games === 0 && progress.analyzed_games === 0

        setProgressStatus(
          isRealCompletion
            ? (progress.status_message || 'Analysis complete! Refreshing your insights...')
            : isNoAnalysisRunning
            ? null
            : 'Crunching games with Stockfish and updating live...'
        )

        if (isRealCompletion) {
          console.log('[SimpleAnalytics] Analysis complete, stopping progress polling')
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          setAnalyzing(false)

          // Clear any existing timeouts before setting new ones
          if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
          if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
          if (forceRefreshTimeoutRef.current) clearTimeout(forceRefreshTimeoutRef.current)

          statusTimeoutRef.current = setTimeout(() => setProgressStatus(null), 2500)
          // Clear cache to force fresh data load after analysis
          clearUserCache(userId, platform)
          // Set force refresh flag to bypass cache on next load
          setForceDataRefresh(true)
          // Add small delay to ensure database has finished writing analysis results
          refreshTimeoutRef.current = setTimeout(() => {
            console.log('[SimpleAnalytics] Refreshing data after analysis completion with force refresh')
            handleRefresh()
            // Reset force refresh flag after a brief moment
            forceRefreshTimeoutRef.current = setTimeout(() => setForceDataRefresh(false), 2000)
          }, 1500)
        } else if (isNoAnalysisRunning) {
          console.log('[SimpleAnalytics] No analysis running, stopping progress polling')
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          setAnalyzing(false)
        } else {
          setAnalyzing(true)
        }
      } else {
        console.log('[SimpleAnalytics] No progress data received')
        setProgressStatus('Waiting for the engine to report progress...')
        setAnalyzing(true)

        // Fallback: Check if analysis data is available even without progress
        // This helps detect completion when progress tracking fails
        try {
          console.log('[SimpleAnalytics] Checking for analysis data as fallback...')
          const analysisData = await UnifiedAnalysisService.getAnalysisStats(userId, platform, 'stockfish')
          if (analysisData && analysisData.total_games > 0) {
            console.log('[SimpleAnalytics] Found analysis data, assuming analysis complete')
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current)
              progressIntervalRef.current = null
            }
            setAnalyzing(false)
            setProgressStatus('Analysis complete! Refreshing your insights...')

            // Clear any existing timeouts before setting new ones
            if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
            if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)

            statusTimeoutRef.current = setTimeout(() => setProgressStatus(null), 2500)
            // Add small delay to ensure database has finished writing analysis results
            refreshTimeoutRef.current = setTimeout(() => {
              console.log('[SimpleAnalytics] Refreshing data after fallback detection')
              handleRefresh()
            }, 1500)
            return
          }
        } catch (fallbackError) {
          console.log('[SimpleAnalytics] Fallback check failed:', fallbackError)
        }
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
          setProgressStatus('Analysis is taking longer than expected. Refreshing your data...')
          handleRefresh()
        }, 3 * 60 * 1000) // 3 minutes timeout - reduced for faster recovery

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
      if (largeImportIntervalRef.current) {
        clearInterval(largeImportIntervalRef.current)
      }
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current)
      }
      if (largeImportDismissTimeoutRef.current) {
        clearTimeout(largeImportDismissTimeoutRef.current)
      }
      if (importStuckTimeoutRef.current) {
        clearTimeout(importStuckTimeoutRef.current)
      }
    }
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-8 py-10 text-center shadow-2xl shadow-black/50">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
            <p className="text-base text-slate-200">Loading your chess analytics...</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Fetching player profile</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="container-responsive space-responsive py-8">
        {userId && (
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-6 py-6 shadow-2xl shadow-black/60 sm:px-8 sm:py-8">
            <div className="absolute inset-x-10 top-0 h-40 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="relative flex flex-col gap-6">
              <div className="flex items-center justify-between">
                {/* Logo in top left */}
                <div className="flex items-center gap-3">
                  <img
                    src="/chesdata.svg"
                    alt="Chess Analytics"
                    className="h-8 w-auto sm:h-10 opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={() => navigate('/')}
                    title="Back to home"
                  />
                </div>

                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-200 transition hover:border-white/30 hover:bg-white/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19L3 12m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to search
                </button>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-1 text-xs uppercase tracking-wide text-slate-300">
                  {platform}
                </div>
                <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{userId}</h1>
                <p className="mt-2 text-sm text-slate-300">
                  Import games, trigger fresh Stockfish evaluations, and explore openings without leaving this dashboard.
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 text-sm">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!hasGames ? (
                    <button
                      onClick={importGames}
                      disabled={importing}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 font-medium text-emerald-200 transition hover:border-emerald-300/60 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {importing ? 'Importing…' : 'Import Games (100)'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        // If user has 5000+ games, show date picker for targeted import
                        // Otherwise, directly import up to 5000 games
                        if (gameCount >= 5000) {
                          setShowDateRangePicker(true)
                        } else {
                          startLargeImport()
                        }
                      }}
                      disabled={largeImportProgress?.status === 'importing'}
                      className="inline-flex items-center gap-2 rounded-full border border-purple-400/40 bg-purple-500/10 px-4 py-2 font-medium text-purple-200 transition hover:border-purple-300/60 hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {largeImportProgress?.status === 'importing' ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-purple-200" />
                          Importing More Games...
                        </>
                      ) : (
                        'Import More Games'
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      console.log('🔘 Analyze My Games button clicked!')
                      console.log('🔘 Button state - analyzing:', analyzing, 'apiAvailable:', apiAvailable)
                      startAnalysis()
                    }}
                    disabled={analyzing || !apiAvailable}
                    className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 font-medium text-sky-200 transition hover:border-sky-300/60 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {analyzing ? 'Analyzing…' : 'Analyze My Games'}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className={apiAvailable ? 'text-emerald-300' : 'text-rose-300'}>
                    Engine {apiAvailable ? 'online' : 'offline'}
                  </span>
                  {lastRefresh && <span>Updated · {lastRefresh.toLocaleTimeString()}</span>}
                </div>
                {importStatus && <div className="text-xs text-sky-300">{importStatus}</div>}
              </div>
            </div>
          </section>
        )}

        <AnalysisProgressBar analyzing={analyzing} progress={analysisProgress} statusMessage={progressStatus} />

        {/* Auto-Sync Progress Bar */}
        {autoSyncing && (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-lg font-semibold text-emerald-200">
                {autoSyncProgress.status === 'complete' ? 'Auto-Sync Complete' :
                 autoSyncProgress.status === 'error' ? 'Auto-Sync Error' : 'Auto-Sync Progress'}
              </h4>
              <div className="flex items-center gap-2">
                {autoSyncProgress.status === 'importing' && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-transparent" />
                )}
                {autoSyncProgress.status === 'complete' && autoSyncProgress.importedGames > 0 && (
                  <div className="text-sm text-emerald-300">
                    {autoSyncProgress.importedGames} games imported
                  </div>
                )}
              </div>
            </div>

            {autoSyncProgress.status === 'importing' && (
              <div className="mb-2">
                <div className="h-2 w-full rounded-full bg-emerald-900/30">
                  <div className="h-2 rounded-full bg-emerald-400 transition-all duration-300 animate-pulse" />
                </div>
              </div>
            )}

            <p className="text-sm text-emerald-200">{autoSyncProgress.message}</p>
          </div>
        )}

        {/* Large Import Progress Display */}
        {largeImportProgress && largeImportProgress.status !== 'idle' && (
          <div className={`rounded-2xl border p-4 ${
            largeImportProgress.status === 'completed' && largeImportProgress.importedGames === 0
              ? 'border-amber-400/40 bg-amber-500/10'
              : largeImportProgress.status === 'error'
              ? 'border-rose-400/40 bg-rose-500/10'
              : 'border-purple-400/40 bg-purple-500/10'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h4 className={`text-lg font-semibold ${
                largeImportProgress.status === 'completed' && largeImportProgress.importedGames === 0
                  ? 'text-amber-200'
                  : largeImportProgress.status === 'error'
                  ? 'text-rose-200'
                  : 'text-purple-200'
              }`}>
                {largeImportProgress.status === 'completed' && largeImportProgress.importedGames === 0
                  ? 'Import Complete'
                  : largeImportProgress.status === 'error'
                  ? 'Import Error'
                  : 'Import Progress'}
              </h4>
              <div className="flex items-center gap-2">
                {largeImportProgress.status === 'importing' && (
                  <>
                    <div className="text-sm text-purple-300">
                      {largeImportProgress.importedGames} / {largeImportProgress.totalToImport} games
                    </div>
                    <button
                      onClick={cancelLargeImport}
                      className="text-sm text-rose-300 hover:text-rose-200 transition"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {(largeImportProgress.status === 'completed' || largeImportProgress.status === 'error') && (
                  <button
                    onClick={dismissImportProgress}
                    className="text-sm text-slate-300 hover:text-white transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {largeImportProgress.status === 'importing' && (
              <div className="mb-2">
                <div className="h-2 w-full rounded-full bg-purple-900/30">
                  <div
                    className="h-2 rounded-full bg-purple-400 transition-all duration-300"
                    style={{ width: `${largeImportProgress.progress}%` }}
                  />
                </div>
              </div>
            )}

            <p className={`text-sm ${
              largeImportProgress.status === 'completed' && largeImportProgress.importedGames === 0
                ? 'text-amber-200'
                : largeImportProgress.status === 'error'
                ? 'text-rose-200'
                : 'text-purple-200'
            }`}>{largeImportProgress.message}</p>
          </div>
        )}

        <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-white/10 bg-white/[0.08] p-1 shadow-lg shadow-black/40">
          <button
            onClick={() => handleTabChange('analytics')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === 'analytics'
                ? 'bg-white text-slate-900 shadow-inner'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => handleTabChange('matchHistory')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              activeTab === 'matchHistory'
                ? 'bg-white text-slate-900 shadow-inner'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Match History
          </button>
        </div>

        {activeTab === 'analytics' && (
          <SimpleAnalytics
            key={`simple-analytics-${refreshKey}`}
            userId={userId}
            platform={platform}
            onOpeningClick={handleOpeningClick}
            forceRefresh={forceDataRefresh}
          />
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
              onAnalyzedGamesChange={setAnalyzedGameIds}
              onGameSelect={game => {
                // Check if game is already analyzed
                const gameId = game.provider_game_id || game.id
                const isAnalyzed = analyzedGameIds.has(gameId)

                if (isAnalyzed) {
                  // If analyzed, navigate to analysis page
                  navigate(`/analysis/${platform}/${userId}/${gameId}`, {
                    state: { from: { pathname: location.pathname, search: location.search }, game },
                  })
                } else {
                  // If not analyzed, trigger analysis directly without navigation
                  console.log('Game not analyzed, triggering analysis directly:', gameId)
                  // The MatchHistory component will handle the analysis request
                  // We don't need to do anything here as the analyze button will be shown
                }
              }}
            />
          </ErrorBoundary>
        )}

        {importError && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            <span className="font-semibold">Import warning:</span> {importError}
          </div>
        )}
        {analysisError && (
          <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            <span className="font-semibold">Analysis error:</span> {analysisError}
          </div>
        )}
      </div>

      {/* Date Range Picker Modal */}
      {showDateRangePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">Select Date Range</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">From Date (optional)</label>
                <input
                  type="date"
                  value={dateRange.fromDate || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">To Date (optional)</label>
                <input
                  type="date"
                  value={dateRange.toDate || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/40"
                />
              </div>

              <p className="text-xs text-slate-400">
                Leave dates empty to import all available games (up to 5,000). You can import more games by selecting different date ranges after this import completes.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  startLargeImport()
                  setShowDateRangePicker(false)
                }}
                className="flex-1 rounded-lg bg-purple-500 px-4 py-2 text-white font-medium hover:bg-purple-600 transition"
              >
                Start Import
              </button>
              <button
                onClick={() => setShowDateRangePicker(false)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-slate-300 hover:bg-white/5 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
