// Simple Analytics Page - One page, everything you need
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useParams, useNavigate, useLocation } from 'react-router-dom'
import { SimpleAnalytics } from '../components/simple/SimpleAnalytics'
import { MatchHistory } from '../components/simple/MatchHistory'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { AutoImportService, LargeImportProgress, GameDiscovery, DateRange } from '../services/autoImportService'
import { UnifiedAnalysisService } from '../services/unifiedAnalysisService'
import { ProfileService } from '../services/profileService'
import { supabase } from '../lib/supabase'
import { clearUserCache } from '../utils/apiCache'
import { useAuth } from '../contexts/AuthContext'
import { AnonymousUsageTracker } from '../services/anonymousUsageTracker'
import LimitReachedModal from '../components/LimitReachedModal'
import { config } from '../lib/config'
// Debug components removed from production
import { OpeningFilter, OpeningIdentifierSets, ViewMode } from '../types'

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
  const [activeTab, setActiveTab] = useState<'analytics' | 'matchHistory' | 'coach'>(
    'analytics'
  )
  const [refreshKey, setRefreshKey] = useState(0)
  const [forceDataRefresh, setForceDataRefresh] = useState(false)
  const [openingFilter, setOpeningFilter] = useState<OpeningFilter | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [analyzedGameIds, setAnalyzedGameIds] = useState<Set<string>>(new Set())
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const forceRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [hasGames, setHasGames] = useState(false)
  const [gameCount, setGameCount] = useState(0)
  const [userNotFound, setUserNotFound] = useState(false)
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

  // Auth and usage tracking
  const { user, usageStats, refreshUsageStats } = useAuth()
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitType, setLimitType] = useState<'import' | 'analyze'>('import')

  // Cross-platform link state
  const [crossPlatformLink, setCrossPlatformLink] = useState<{
    chessComUsername: string
    lichessUsername: string
  } | null>(null)
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkInputValue, setLinkInputValue] = useState('')
  const [linkError, setLinkError] = useState('')
  const [linkLoading, setLinkLoading] = useState(false)

  // Platform switcher
  const isOwnProfile = !!(user && userId && (
    (user.chessComUsername && canonicalizeUserId(userId, 'chess.com') === canonicalizeUserId(user.chessComUsername, 'chess.com')) ||
    (user.lichessUsername && userId === user.lichessUsername)
  ))
  const hasBothAccounts =
    (isOwnProfile && !!(user?.chessComUsername && user?.lichessUsername)) ||
    !!crossPlatformLink
  const viewMode = searchParams.get('view') === 'combined' ? 'combined' as const : 'single' as const

  // Look up cross-platform link when viewing a player
  useEffect(() => {
    if (!userId || !platform) return
    // Skip lookup for own profile (already handled by auth)
    if (isOwnProfile && user?.chessComUsername && user?.lichessUsername) return

    const apiUrl = config.getApi().baseUrl
    fetch(`${apiUrl}/api/v1/player-links/${encodeURIComponent(platform)}/${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.linked) {
          setCrossPlatformLink({
            chessComUsername: data.chess_com_username,
            lichessUsername: data.lichess_username
          })
        } else {
          setCrossPlatformLink(null)
        }
      })
      .catch(() => setCrossPlatformLink(null))
  }, [userId, platform, isOwnProfile, user?.chessComUsername, user?.lichessUsername])

  // Helper to resolve the secondary platform username for combined view
  const getSecondaryUser = (): string | undefined => {
    if (isOwnProfile) {
      return platform === 'chess.com' ? user?.lichessUsername : user?.chessComUsername
    }
    if (crossPlatformLink) {
      return platform === 'chess.com'
        ? crossPlatformLink.lichessUsername
        : crossPlatformLink.chessComUsername
    }
    return undefined
  }
  const getSecondaryPlatform = (): 'lichess' | 'chess.com' => platform === 'chess.com' ? 'lichess' : 'chess.com'

  const handlePlatformSwitch = (target: 'chess.com' | 'lichess' | 'combined') => {
    const newParams = new URLSearchParams()
    if (activeTab !== 'analytics') newParams.set('tab', activeTab)

    if (target === 'combined') {
      // Keep current user/platform as primary, add view=combined
      newParams.set('user', userId)
      newParams.set('platform', platform)
      newParams.set('view', 'combined')
    } else {
      let username: string
      if (isOwnProfile && user) {
        // Own profile: use linked account usernames
        username = target === 'chess.com' ? user.chessComUsername! : user.lichessUsername!
      } else if (crossPlatformLink) {
        // Other player: use cross-platform link
        username = target === 'chess.com'
          ? crossPlatformLink.chessComUsername
          : crossPlatformLink.lichessUsername
      } else {
        return
      }
      newParams.set('user', username)
      newParams.set('platform', target)
    }
    setSearchParams(newParams, { replace: true })
  }

  const handleCreateLink = async () => {
    if (!linkInputValue.trim()) return
    setLinkLoading(true)
    setLinkError('')
    try {
      const apiUrl = config.getApi().baseUrl
      const body = platform === 'chess.com'
        ? { chess_com_username: userId, lichess_username: linkInputValue.trim() }
        : { chess_com_username: linkInputValue.trim(), lichess_username: userId }

      const res = await fetch(`${apiUrl}/api/v1/player-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.success) {
        setCrossPlatformLink({
          chessComUsername: data.chess_com_username,
          lichessUsername: data.lichess_username
        })
        setShowLinkInput(false)
        setLinkInputValue('')
      } else {
        setLinkError(data.message || 'Failed to create link')
      }
    } catch {
      setLinkError('Network error')
    } finally {
      setLinkLoading(false)
    }
  }

  // Slow loading popup state
  const [showSlowLoadingPopup, setShowSlowLoadingPopup] = useState(false)
  const slowLoadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check for route parameters first, then URL parameters
    const routeUser = params.userId
    const routePlatform = params.platform as 'lichess' | 'chess.com'
    const urlUser = searchParams.get('user')
    const urlPlatform = searchParams.get('platform') as 'lichess' | 'chess.com'
    const urlTab = searchParams.get('tab') as 'analytics' | 'matchHistory' | 'coach'
    const urlOpening = searchParams.get('opening')
    const urlOpeningIdentifiers = searchParams.get('openingIdentifiers')

    const finalUser = routeUser || urlUser
    const finalPlatform = routePlatform || urlPlatform

    // Set tab from URL parameter, default to 'analytics' if not specified or invalid
    // If Coach tab is selected, redirect to Coach route
    if (urlTab === 'coach' && finalUser && finalPlatform) {
      navigate(`/coach?userId=${encodeURIComponent(finalUser)}&platform=${finalPlatform}`, { replace: true })
      return
    }
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

  // Track last visited player for quick navigation
  useEffect(() => {
    if (userId && platform) {
      try {
        localStorage.setItem('lastVisitedPlayer', JSON.stringify({
          userId: userId,
          platform: platform,
          timestamp: Date.now()
        }))
      } catch (error) {
        console.error('Failed to save last visited player:', error)
      }
    }
  }, [userId, platform])


  // Show popup if loading takes more than 1 second
  useEffect(() => {
    // Clear any existing timeout
    if (slowLoadingTimeoutRef.current) {
      clearTimeout(slowLoadingTimeoutRef.current)
      slowLoadingTimeoutRef.current = null
    }

    // If we're loading, set a timeout to show popup after 1 second
    if (isLoading) {
      slowLoadingTimeoutRef.current = setTimeout(() => {
        // Use a function to get the latest state
        setShowSlowLoadingPopup(prev => {
          // Double-check if still loading (this will be checked again in the render)
          return true
        })
      }, 1000)
    } else {
      // If not loading, hide the popup immediately
      setShowSlowLoadingPopup(false)
    }

    // Cleanup timeout on unmount or when loading state changes
    return () => {
      if (slowLoadingTimeoutRef.current) {
        clearTimeout(slowLoadingTimeoutRef.current)
        slowLoadingTimeoutRef.current = null
      }
    }
  }, [isLoading])

  // Auto-sync effect - triggers when userId and platform are set
  useEffect(() => {
    // Auto-sync for both authenticated and anonymous users
    // Anonymous users have import limits (50 imports per 24 hours)
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

      setUserNotFound(false)

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

        // If no games found locally, validate user exists on the platform
        if (gameCount === 0) {
          try {
            const validation = await AutoImportService.validateUserOnPlatform(canonicalUserId, platform)
            if (!validation.exists) {
              setUserNotFound(true)
            }
          } catch {
            // Validation failed (e.g. network error) - don't block the page
            console.warn('[checkGamesExist] Could not validate user on platform')
          }
        }
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
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      if (forceRefreshTimeoutRef.current) clearTimeout(forceRefreshTimeoutRef.current)
      if (slowLoadingTimeoutRef.current) clearTimeout(slowLoadingTimeoutRef.current)

      // Clear intervals
      if (largeImportIntervalRef.current) clearInterval(largeImportIntervalRef.current)
      if (importStuckTimeoutRef.current) clearTimeout(importStuckTimeoutRef.current)
      if (largeImportDismissTimeoutRef.current) clearTimeout(largeImportDismissTimeoutRef.current)
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current)
    }
  }, [])


  const loadMostRecentUser = async () => {
    // For now, just set loading to false
    // In the future, we could implement a "recent users" feature
    setIsLoading(false)
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    setLastRefresh(new Date())
  }

  const handleTabChange = (tab: 'analytics' | 'matchHistory' | 'coach') => {
    // Redirect to Coach route if Coach tab is selected
    if (tab === 'coach') {
      navigate(`/coach?userId=${encodeURIComponent(userId)}&platform=${platform}`)
      return
    }
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

    // Check anonymous user limits first
    if (!user) {
      // Check daily import limit for anonymous users (50 per day)
      if (!AnonymousUsageTracker.canImport()) {
        console.log('[SimpleAnalytics] Anonymous user reached daily import limit (50 per day)')
        setLimitType('import')
        setShowLimitModal(true)
        return
      }
    }

    // Check usage limits before importing (authenticated users)
    if (user && usageStats?.imports && !usageStats.imports.unlimited && usageStats.imports.remaining === 0) {
      setLimitType('import')
      setShowLimitModal(true)
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
        // Increment anonymous usage after successful import
        if (!user && result.importedGames) {
          AnonymousUsageTracker.incrementImports(result.importedGames)
        }

        if (result.importedGames > 0) {
          setImportStatus(`Import complete! ${result.message}. Refreshing analytics...`)
          // Clear cache to force fresh data load after import
          clearUserCache(userId, platform)
          handleRefresh()
          // Refresh usage stats after import for authenticated users
          if (user) {
            refreshUsageStats()
          }
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

      // Check if it's a 429 error (rate limit / usage limit)
      // Check both status code in message and common limit-related phrases
      const isLimitError = error instanceof Error && (
        message.includes('429') ||
        message.includes('limit reached') ||
        message.includes('Import limit reached') ||
        message.includes('Too many requests')
      )

      if (isLimitError) {
        setLimitType('import')
        setShowLimitModal(true)
      } else {
        setImportError(message)
      }
    } finally {
      setImporting(false)
    }
  }

  const startLargeImport = async () => {
    if (!userId) return

    // Check anonymous user limits first
    if (!user) {
      // Check daily import limit for anonymous users (50 per day)
      if (!AnonymousUsageTracker.canImport()) {
        console.log('[SimpleAnalytics] Anonymous user reached daily import limit (50 per day)')
        setLimitType('import')
        setShowLimitModal(true)
        return
      }
    }

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

      // Check if it's a 429 error (rate limit / usage limit)
      const isLimitError = error instanceof Error && (
        errorMessage.includes('429') ||
        errorMessage.includes('limit reached') ||
        errorMessage.includes('Import limit reached') ||
        errorMessage.includes('Too many requests')
      )

      if (isLimitError) {
        setLimitType('import')
        setShowLimitModal(true)
        setLargeImportProgress({
          status: 'error',
          importedGames: 0,
          totalToImport: 0,
          progress: 0,
          message: 'Import limit reached'
        })
      } else {
        setLargeImportProgress({
          status: 'error',
          importedGames: 0,
          totalToImport: 0,
          progress: 0,
          message: `Import failed: ${errorMessage}`
        })
      }
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

    // Check anonymous user limits (if not authenticated)
    if (!user) {
      if (!AnonymousUsageTracker.canImport()) {
        console.log('[Auto-sync] Anonymous user reached import limit, skipping auto-sync')
        return
      }
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
        // Track anonymous user usage
        if (!user) {
          AnonymousUsageTracker.incrementImports(actualNewGames)
        }

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


  if (isLoading && !showSlowLoadingPopup) {
    // Show background while waiting for popup to appear after 1 second
    return (
      <div className="min-h-screen bg-surface-base" />
    )
  }

  if (isLoading && showSlowLoadingPopup) {
    return (
      <div className="min-h-screen bg-surface-base" />
    )
  }

  if (userNotFound) {
    return (
      <div className="min-h-screen bg-surface-base text-gray-300">
        <div className="container-responsive space-responsive py-8 content-fade">
          <div className="max-w-md mx-auto text-center mt-20">
            <div className="rounded-lg bg-surface-1 shadow-card p-8">
              <h2 className="text-xl font-semibold text-white mb-3">Player not found</h2>
              <p className="text-gray-400 mb-6">
                The username &ldquo;{userId}&rdquo; was not found on {platform === 'chess.com' ? 'Chess.com' : 'Lichess'}. Please check the spelling and try again.
              </p>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium px-6 py-2.5 transition-colors"
              >
                Back to Search
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base text-gray-300">
      <div className="container-responsive space-responsive py-8 content-fade">
        {userId && (
          <section className="relative overflow-hidden rounded-lg bg-surface-1 shadow-card px-6 py-4 sm:px-8 sm:py-5">
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center justify-end">
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-2 rounded-md bg-surface-2 shadow-input px-4 py-2 text-caption font-medium uppercase tracking-label text-gray-400 transition-colors hover:text-gray-300 hover:shadow-card-hover"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19L3 12m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to search
                </button>
              </div>

              <div className="text-center">
                {hasBothAccounts ? (
                  /* Platform switcher for users with both accounts linked */
                  <div className="inline-flex items-center rounded-md bg-surface-2 shadow-input p-1 text-caption font-medium">
                    <button
                      onClick={() => handlePlatformSwitch('chess.com')}
                      className={`rounded-md px-3.5 py-1.5 transition-colors ${
                        viewMode === 'single' && platform === 'chess.com'
                          ? 'bg-cta text-[#111] shadow-btn-primary'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Chess.com
                    </button>
                    <button
                      onClick={() => handlePlatformSwitch('lichess')}
                      className={`rounded-md px-3.5 py-1.5 transition-colors ${
                        viewMode === 'single' && platform === 'lichess'
                          ? 'bg-cta text-[#111] shadow-btn-primary'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Lichess
                    </button>
                    <button
                      onClick={() => handlePlatformSwitch('combined')}
                      className={`rounded-md px-3.5 py-1.5 transition-colors ${
                        viewMode === 'combined'
                          ? 'bg-cta text-[#111] shadow-btn-primary'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      Combined
                    </button>
                  </div>
                ) : (
                  /* Static platform badge for single-account users */
                  <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-1 text-xs uppercase tracking-wide font-semibold ${
                    platform === 'lichess'
                      ? 'border-amber-500/30 bg-amber-600/20 text-amber-100'
                      : 'border-emerald-500/30 bg-emerald-600/20 text-emerald-100'
                  }`}>
                    {platform === 'lichess' ? 'Lichess' : 'Chess.com'}
                  </div>
                )}
                {/* Link other platform prompt */}
                {!hasBothAccounts && !isOwnProfile && (
                  <div className="mt-2">
                    {showLinkInput ? (
                      <div className="flex items-center gap-2 justify-center">
                        <input
                          type="text"
                          value={linkInputValue}
                          onChange={e => { setLinkInputValue(e.target.value); setLinkError('') }}
                          onKeyDown={e => e.key === 'Enter' && handleCreateLink()}
                          placeholder={`${platform === 'chess.com' ? 'Lichess' : 'Chess.com'} username`}
                          className="rounded-md bg-surface-2 shadow-input px-3 py-1 text-caption text-gray-300 placeholder-gray-600 focus:outline-none focus:shadow-input-focus w-40"
                        />
                        <button
                          onClick={handleCreateLink}
                          disabled={linkLoading || !linkInputValue.trim()}
                          className="rounded-full shadow-card bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                        >
                          {linkLoading ? '...' : 'Link'}
                        </button>
                        <button
                          onClick={() => { setShowLinkInput(false); setLinkError(''); setLinkInputValue('') }}
                          className="text-xs text-gray-500 hover:text-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowLinkInput(true)}
                        className="text-xs text-gray-500 hover:text-gray-400 transition"
                      >
                        Know their {platform === 'chess.com' ? 'Lichess' : 'Chess.com'} username? Link it
                      </button>
                    )}
                    {linkError && <p className="text-xs text-rose-400 mt-1">{linkError}</p>}
                  </div>
                )}
                <h1 className="mt-2 text-title font-semibold text-white sm:text-title">
                  {viewMode === 'combined'
                    ? `${userId} + ${getSecondaryUser() || ''}`
                    : userId}
                </h1>
                <p className="mt-1.5 text-sm text-gray-400">
                  {viewMode === 'combined'
                    ? 'Combined analytics from both Chess.com and Lichess.'
                    : 'Import games, trigger fresh Stockfish evaluations, and explore openings without leaving this dashboard.'}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 text-sm">
                {viewMode === 'combined' ? (
                  <p className="text-xs text-gray-500">Switch to a single platform to import games</p>
                ) : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!hasGames ? (
                    <button
                      onClick={importGames}
                      disabled={importing}
                      className="inline-flex items-center gap-2 rounded-full shadow-card bg-emerald-500/10 px-4 py-2 font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                      disabled={
                        largeImportProgress?.status === 'importing' ||
                        !user ||
                        (usageStats?.account_tier === 'free' || usageStats?.account_tier === undefined)
                      }
                      title={
                        !user
                          ? 'Sign in to import more games'
                          : usageStats?.account_tier === 'free' || usageStats?.account_tier === undefined
                          ? 'Upgrade to Pro to import more games'
                          : undefined
                      }
                      className="inline-flex items-center gap-2 rounded-full shadow-card bg-purple-500/10 px-4 py-2 font-medium text-purple-200 transition-colors hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                </div>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {lastRefresh && <span>Updated · {lastRefresh.toLocaleTimeString()}</span>}
                </div>
                {importStatus && <div className="text-xs text-emerald-300">{importStatus}</div>}
              </div>
            </div>
          </section>
        )}

        {/* Auto-Sync Progress Bar */}
        {autoSyncing && (
          <div className="rounded-lg shadow-card bg-emerald-500/10 p-4">
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
                  <div className="h-2 rounded-full bg-emerald-400 transition-colors duration-300 animate-pulse" />
                </div>
              </div>
            )}

            <p className="text-sm text-emerald-200">{autoSyncProgress.message}</p>
          </div>
        )}

        {/* Large Import Progress Display */}
        {largeImportProgress && largeImportProgress.status !== 'idle' && (
          <div className={`rounded-lg border p-4 ${
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
                    className="text-sm text-gray-400 hover:text-white transition"
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
                    className="h-2 rounded-full bg-purple-400 transition-colors duration-300"
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

        <div className="mx-auto flex max-w-2xl items-center justify-between rounded-lg bg-surface-1 p-1 shadow-card">
          <button
            onClick={() => handleTabChange('analytics')}
            className={`flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-cta text-[#111] shadow-btn-primary'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Analytics
          </button>
          <button
            onClick={() => handleTabChange('matchHistory')}
            className={`flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors ${
              activeTab === 'matchHistory'
                ? 'bg-cta text-[#111] shadow-btn-primary'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Games Analysis
          </button>
          <button
            onClick={() => handleTabChange('coach')}
            className={`flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors ${
              activeTab === 'coach'
                ? 'bg-cta text-[#111] shadow-btn-primary'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Coach
          </button>
        </div>

        {activeTab === 'analytics' && (
          <SimpleAnalytics
            key={`simple-analytics-${refreshKey}-${viewMode}`}
            userId={userId}
            platform={platform}
            onOpeningClick={handleOpeningClick}
            forceRefresh={forceDataRefresh}
            viewMode={viewMode}
            secondaryUserId={viewMode === 'combined' ? getSecondaryUser() || '' : undefined}
            secondaryPlatform={viewMode === 'combined' ? getSecondaryPlatform() : undefined}
          />
        )}

        {activeTab === 'matchHistory' && (
          <ErrorBoundary>
            <MatchHistory
              key={`match-history-${refreshKey}-${viewMode}`}
              userId={userId}
              platform={platform}
              openingFilter={openingFilter}
              viewMode={viewMode}
              secondaryUserId={viewMode === 'combined' ? (platform === 'chess.com' ? user?.lichessUsername : user?.chessComUsername) || '' : undefined}
              secondaryPlatform={viewMode === 'combined' ? (platform === 'chess.com' ? 'lichess' : 'chess.com') : undefined}
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

        {activeTab === 'coach' && (
          <ErrorBoundary>
            <div className="rounded-lg bg-surface-1 shadow-card p-8 text-center">
              <div className="text-4xl text-gray-600 mb-4">&#9812;</div>
              <h3 className="text-section font-semibold tracking-section text-[#f0f0f0] mb-2">Coach</h3>
              <p className="text-small text-gray-500 mb-4">Redirecting to Coach dashboard...</p>
              <button
                onClick={() => navigate(`/coach?userId=${encodeURIComponent(userId)}&platform=${platform}`)}
                className="bg-cta hover:bg-cta-hover text-[#111] font-medium py-2 px-5 rounded-md shadow-btn-primary transition-colors"
              >
                Go to Coach
              </button>
            </div>
          </ErrorBoundary>
        )}

        {importError && (
          <div className="rounded-lg shadow-card bg-amber-500/10 p-4 text-sm text-amber-200">
            <span className="font-semibold">Import warning:</span> {importError}
          </div>
        )}
      </div>

      {/* Date Range Picker Modal */}
      {showDateRangePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-surface-1 shadow-modal p-6 max-w-sm w-full mx-4">
            <h3 className="text-section font-semibold tracking-section text-[#f0f0f0] mb-4">Select Date Range</h3>

            <div className="space-y-4">
              <div>
                <label className="label text-gray-500 mb-1.5 block">From Date (optional)</label>
                <input
                  type="date"
                  value={dateRange.fromDate || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, fromDate: e.target.value }))}
                  className="w-full bg-surface-2 shadow-input rounded-md px-3.5 py-2.5 text-body text-gray-300 focus:shadow-input-focus focus:outline-none transition-shadow"
                />
              </div>

              <div>
                <label className="label text-gray-500 mb-1.5 block">To Date (optional)</label>
                <input
                  type="date"
                  value={dateRange.toDate || ''}
                  onChange={(e) => setDateRange(prev => ({ ...prev, toDate: e.target.value }))}
                  className="w-full bg-surface-2 shadow-input rounded-md px-3.5 py-2.5 text-body text-gray-300 focus:shadow-input-focus focus:outline-none transition-shadow"
                />
              </div>

              <p className="text-caption text-gray-600">
                Leave dates empty to import all available games (up to 5,000). You can import more by selecting different date ranges after.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  startLargeImport()
                  setShowDateRangePicker(false)
                }}
                className="flex-1 rounded-md bg-cta px-4 py-2 text-[#111] font-medium shadow-btn-primary hover:bg-cta-hover transition-colors"
              >
                Start Import
              </button>
              <button
                onClick={() => setShowDateRangePicker(false)}
                className="flex-1 rounded-md bg-surface-2 shadow-input px-4 py-2 text-gray-400 font-medium hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Limit Reached Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType={limitType}
      />

    </div>
  )
}
