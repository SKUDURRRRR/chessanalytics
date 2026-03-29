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
      <div className="max-w-[1040px] mx-auto px-6 py-7 pb-24 content-fade space-y-0">
        {/* Player Header */}
        {userId && (
          <div className="pb-0">
            <div className="flex items-center justify-between pb-4">
              {/* Left: Avatar + Name + Meta */}
              <div className="flex items-center gap-3.5">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[18px] font-medium tracking-tight text-[#e4e8ed]">
                      {viewMode === 'combined' ? `${userId} + ${getSecondaryUser() || ''}` : userId}
                    </span>
                    {hasBothAccounts ? (
                      <div className="inline-flex items-center rounded-md bg-surface-2 shadow-input p-0.5 text-[10px] font-medium">
                        <button
                          onClick={() => handlePlatformSwitch('chess.com')}
                          className={`rounded px-2 py-0.5 transition-colors ${
                            viewMode === 'single' && platform === 'chess.com'
                              ? 'bg-cta text-[#111]' : 'text-[#4a5260] hover:text-[#8a9299]'
                          }`}
                        >chess.com</button>
                        <button
                          onClick={() => handlePlatformSwitch('lichess')}
                          className={`rounded px-2 py-0.5 transition-colors ${
                            viewMode === 'single' && platform === 'lichess'
                              ? 'bg-cta text-[#111]' : 'text-[#4a5260] hover:text-[#8a9299]'
                          }`}
                        >lichess</button>
                        <button
                          onClick={() => handlePlatformSwitch('combined')}
                          className={`rounded px-2 py-0.5 transition-colors ${
                            viewMode === 'combined'
                              ? 'bg-cta text-[#111]' : 'text-[#4a5260] hover:text-[#8a9299]'
                          }`}
                        >combined</button>
                      </div>
                    ) : (
                      <span className="px-2 py-px rounded bg-white/[0.05] shadow-card text-[10px] font-medium uppercase tracking-[0.07em] text-[#4a5260]">
                        {platform === 'lichess' ? 'lichess' : 'chess.com'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#3a4250]">
                    {gameCount > 0 ? `${gameCount.toLocaleString()} games` : ''}
                    {analyzedGameIds.size > 0 && <> &middot; {analyzedGameIds.size} analyzed</>}
                    {lastRefresh && <> &middot; updated {lastRefresh.toLocaleTimeString()}</>}
                  </div>
                  {/* Link prompt */}
                  {!hasBothAccounts && !isOwnProfile && (
                    <div className="mt-1">
                      {showLinkInput ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={linkInputValue}
                            onChange={e => { setLinkInputValue(e.target.value); setLinkError('') }}
                            onKeyDown={e => e.key === 'Enter' && handleCreateLink()}
                            placeholder={`${platform === 'chess.com' ? 'Lichess' : 'Chess.com'} username`}
                            className="rounded-md bg-surface-2 shadow-input px-2 py-0.5 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:shadow-input-focus w-32"
                          />
                          <button onClick={handleCreateLink} disabled={linkLoading || !linkInputValue.trim()} className="text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50">{linkLoading ? '...' : 'Link'}</button>
                          <button onClick={() => { setShowLinkInput(false); setLinkError(''); setLinkInputValue('') }} className="text-[11px] text-[#3a4250] hover:text-[#5a6270]">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowLinkInput(true)} className="text-[11px] text-[#3a4250] hover:text-[#5a6270] transition-colors">
                          Link {platform === 'chess.com' ? 'Lichess' : 'Chess.com'} account
                        </button>
                      )}
                      {linkError && <p className="text-[11px] text-rose-400 mt-0.5">{linkError}</p>}
                    </div>
                  )}
                </div>
              </div>
              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-1.5 px-3 py-[7px] bg-transparent shadow-card rounded-[7px] text-xs text-[#5a6270] cursor-pointer hover:text-[#8a9299] transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                  Back to search
                </button>
                {viewMode !== 'combined' && (
                  !hasGames ? (
                    <button
                      onClick={importGames}
                      disabled={importing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-[7px] bg-[#e4e8ed] rounded-[7px] text-xs font-medium text-[#0c0d0f] cursor-pointer disabled:opacity-60"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      {importing ? 'Importing...' : 'Import Games'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (gameCount >= 5000) { setShowDateRangePicker(true) } else { startLargeImport() }
                      }}
                      disabled={
                        largeImportProgress?.status === 'importing' ||
                        !user ||
                        (usageStats?.account_tier === 'free' || usageStats?.account_tier === undefined)
                      }
                      title={
                        !user ? 'Sign in to import more games'
                          : usageStats?.account_tier === 'free' || usageStats?.account_tier === undefined
                          ? 'Upgrade to Pro to import more games' : undefined
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-[7px] bg-[#e4e8ed] rounded-[7px] text-xs font-medium text-[#0c0d0f] cursor-pointer disabled:opacity-60"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      {largeImportProgress?.status === 'importing' ? 'Importing...' : 'Import More Games'}
                    </button>
                  )
                )}
              </div>
            </div>
            {importStatus && <div className="text-[11px] text-emerald-400 mb-2">{importStatus}</div>}
          </div>
        )}

        {/* Auto-Sync Progress */}
        {autoSyncing && (
          <div className="rounded-lg bg-surface-1 shadow-card p-4 mt-[10px]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-emerald-400">{autoSyncProgress.message}</p>
              {autoSyncProgress.status === 'importing' && (
                <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-emerald-400 border-t-transparent" />
              )}
              {autoSyncProgress.status === 'complete' && autoSyncProgress.importedGames > 0 && (
                <span className="text-[11px] text-[#3a4250]">{autoSyncProgress.importedGames} imported</span>
              )}
            </div>
          </div>
        )}

        {/* Large Import Progress */}
        {largeImportProgress && largeImportProgress.status !== 'idle' && (
          <div className="rounded-lg bg-surface-1 shadow-card p-4 mt-[10px]">
            <div className="flex items-center justify-between mb-1.5">
              <p className={`text-xs ${
                largeImportProgress.status === 'error' ? 'text-red-400' : 'text-[#8a9299]'
              }`}>{largeImportProgress.message}</p>
              <div className="flex items-center gap-2">
                {largeImportProgress.status === 'importing' && (
                  <>
                    <span className="text-[11px] text-[#3a4250]">{largeImportProgress.importedGames} / {largeImportProgress.totalToImport}</span>
                    <button onClick={cancelLargeImport} className="text-[11px] text-red-400 hover:text-red-300 transition-colors">Cancel</button>
                  </>
                )}
                {(largeImportProgress.status === 'completed' || largeImportProgress.status === 'error') && (
                  <button onClick={dismissImportProgress} className="text-[11px] text-[#3a4250] hover:text-[#5a6270] transition-colors">Dismiss</button>
                )}
              </div>
            </div>
            {largeImportProgress.status === 'importing' && (
              <div className="h-1 w-full rounded-sm bg-white/[0.04] overflow-hidden">
                <div className="h-1 rounded-sm bg-[#c8cdd4] transition-all duration-300" style={{ width: `${largeImportProgress.progress}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Tabs removed — navigation happens via top nav bar */}

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
              <p className="text-xs text-[#3a4250] mb-4">Redirecting to Coach dashboard...</p>
              <button
                onClick={() => navigate(`/coach?userId=${encodeURIComponent(userId)}&platform=${platform}`)}
                className="inline-flex items-center gap-1.5 px-3.5 py-[7px] bg-[#e4e8ed] rounded-[7px] text-xs font-medium text-[#0c0d0f] cursor-pointer"
              >
                Go to Coach
              </button>
            </div>
          </ErrorBoundary>
        )}

        {importError && (
          <div className="rounded-lg bg-surface-1 shadow-card p-4 mt-[10px]">
            <p className="text-xs text-amber-400/80">{importError}</p>
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
