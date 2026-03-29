// Player Search Component - Search for players and open their profiles
import React, { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { ProfileService } from '../../services/profileService'
import { AutoImportService, ImportProgress } from '../../services/autoImportService'
import { getRecentPlayers, addRecentPlayer, clearRecentPlayers, RecentPlayer } from '../../utils/recentPlayers'
import { retryWithBackoff } from '../../lib/errorHandling'
import { useAuth } from '../../contexts/AuthContext'
import { AnonymousUsageTracker } from '../../services/anonymousUsageTracker'
import LimitReachedModal from '../LimitReachedModal'

interface PlayerSearchProps {
  onPlayerSelect: (userId: string, platform: 'lichess' | 'chess.com') => void
}

export function PlayerSearch({ onPlayerSelect }: PlayerSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<'lichess' | 'chess.com'>('chess.com')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)
  const [isAutoImporting, setIsAutoImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [showImportPrompt, setShowImportPrompt] = useState(false)
  const [recentPlayers, setRecentPlayers] = useState<RecentPlayer[]>([])
  const [showRecentPlayers, setShowRecentPlayers] = useState(false)
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Auth and usage tracking
  const { user, usageStats, refreshUsageStats } = useAuth()
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitType, setLimitType] = useState<'import' | 'analyze'>('import')

  // Load recent players on mount
  useEffect(() => {
    setRecentPlayers(getRecentPlayers())
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setImportProgress(null)

    try {
      // First search for existing profiles on the selected platform
      const profiles = await ProfileService.getProfilesByPlatform(selectedPlatform)
      const filtered = profiles.filter(
        profile =>
          profile.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (profile.display_name &&
            profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
      )

      // If no results on selected platform, also search other platforms
      let otherResults: any[] = []
      if (filtered.length === 0) {
        const otherPlatform = selectedPlatform === 'lichess' ? 'chess.com' : 'lichess'
        const otherProfiles = await ProfileService.getProfilesByPlatform(otherPlatform)
        const otherFiltered = otherProfiles.filter(
          profile =>
            profile.user_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (profile.display_name &&
              profile.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
        )

        // Add a note to results from other platform
        otherResults = otherFiltered.map(profile => ({
          ...profile,
          platform_mismatch: true,
          original_platform: profile.platform,
        }))

        setSearchResults([...filtered, ...otherResults])
      } else {
        setSearchResults(filtered)
      }

      setShowResults(true)

      // If no results found on any platform, automatically trigger import
      if (filtered.length === 0 && otherResults.length === 0) {
        setShowImportPrompt(false)
        // Automatically start import process for player not in database
        await handleAutoImport()
      } else {
        setShowImportPrompt(false)
      }
    } catch (error) {
      console.error('Error searching players:', error)
      setSearchResults([])
      setShowResults(true)
      // If there's an error, show import prompt as fallback
      setShowImportPrompt(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handlePlayerSelect = async (userId: string, platform: 'lichess' | 'chess.com', displayName?: string, rating?: number) => {
    try {
      // Use retry logic for ProfileService with exponential backoff
      // Don't retry on validation errors or 404s
      const profile = await retryWithBackoff(
        () => ProfileService.getOrCreateProfile(userId, platform),
        {
          maxRetries: 3,
          baseDelay: 1000,
          context: 'PlayerSearch.handlePlayerSelect',
          shouldRetry: (error: Error) => {
            const msg = error.message.toLowerCase()
            // Don't retry on validation errors or 404s
            return !(
              msg.includes('not found') ||
              msg.includes('404') ||
              msg.includes('invalid')
            )
          }
        }
      );

      // Add to recent players
      addRecentPlayer({
        userId,
        platform,
        displayName: displayName || profile.display_name || userId,
        rating: rating || profile.current_rating
      })

      // Update recent players state
      setRecentPlayers(getRecentPlayers())

      // Select the player
      onPlayerSelect(userId, platform)

      // Reset search
      setSearchQuery('')
      setSearchResults([])
      setShowResults(false)
      setImportProgress(null)
    } catch (error) {
      console.error('Error selecting player:', error)

      // Provide specific, helpful error messages
      let errorMessage = 'Failed to select player. Please try again.';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();

        if (msg.includes('timeout') || msg.includes('etimedout')) {
          errorMessage = `Connection timeout while loading profile for "${userId}". The server is taking too long to respond. Please try again.`;
        } else if (msg.includes('network') || msg.includes('fetch failed') || msg.includes('failed to fetch')) {
          errorMessage = 'Network error. Please check your internet connection and try again.';
        } else if (msg.includes('not found') || msg.includes('404')) {
          errorMessage = `Profile for "${userId}" could not be found or created. Please verify the username is correct.`;
        } else if (msg.includes('503') || msg.includes('service unavailable')) {
          errorMessage = 'The server is temporarily unavailable. Please try again in a moment.';
        } else if (msg.includes('500') || msg.includes('server error')) {
          errorMessage = `Server error: ${error.message}. Please try again or contact support if the problem persists.`;
        } else {
          errorMessage = `Error loading profile: ${error.message}`;
        }
      }

      setNotification({ message: errorMessage, type: 'error' })
      setTimeout(() => setNotification(null), 5000)
    }
  }

  // Shared import logic for both manual and automatic imports
  const performImport = async () => {
    if (!searchQuery.trim()) return

    setIsAutoImporting(true)
    setShowImportPrompt(false)
    setImportProgress({
      status: 'starting',
      message: 'Validating user on platform...',
      progress: 0,
      importedGames: 0,
    })

    try {
      // First validate that the user exists on the platform
      // This ensures we show proper error messages even if limits are reached
      let validation
      try {
        validation = await AutoImportService.validateUserOnPlatform(
          searchQuery,
          selectedPlatform
        )
      } catch (validationError) {
        // Handle validation errors (timeouts, connectivity issues)
        setImportProgress({
          status: 'error',
          message: validationError instanceof Error ? validationError.message : 'Validation failed',
          progress: 0,
          importedGames: 0,
        })
        return
      }

      if (!validation.exists) {
        const otherPlatform = selectedPlatform === 'chess.com' ? 'Lichess' : 'Chess.com'
        setImportProgress({
          status: 'error',
          message: `${validation.message || `User "${searchQuery}" not found on ${selectedPlatform === 'chess.com' ? 'Chess.com' : 'Lichess'}`}. Try searching on ${otherPlatform} instead, or check the username spelling.`,
          progress: 0,
          importedGames: 0,
        })
        return
      }

      console.log('[PlayerSearch] User validated successfully, checking limits...', { user: !!user, usageStats })

      // User exists on platform - now check limits before importing
      // Check anonymous user limits first
      if (!user) {
        const canImport = AnonymousUsageTracker.canImport()
        console.log('[PlayerSearch] Anonymous user limit check:', { canImport })
        if (!canImport) {
          console.log('[PlayerSearch] Anonymous user reached import limit - showing modal')
          // Clear import progress and show modal popup (same as guest users)
          setImportProgress(null)
          setIsAutoImporting(false)
          setLimitType('import')
          setShowLimitModal(true)
          console.log('[PlayerSearch] Modal state set:', { showLimitModal: true })
          return
        }
      }

      // Check usage limits for authenticated users
      if (user && usageStats) {
        const hasRemaining = usageStats.imports && !usageStats.imports.unlimited && usageStats.imports.remaining === 0
        console.log('[PlayerSearch] Authenticated user limit check:', {
          hasImports: !!usageStats.imports,
          unlimited: usageStats.imports?.unlimited,
          remaining: usageStats.imports?.remaining,
          hasRemaining
        })
        // Check if user has remaining imports
        if (hasRemaining) {
          console.log('[PlayerSearch] Authenticated user reached import limit - showing modal')
          // Clear import progress and show modal popup (same as guest users)
          setImportProgress(null)
          setIsAutoImporting(false)
          setLimitType('import')
          setShowLimitModal(true)
          console.log('[PlayerSearch] Modal state set:', { showLimitModal: true })
          return
        }
      }

      // Check if user already exists in our database
      const userExists = await AutoImportService.checkUserExists(searchQuery, selectedPlatform)

      if (userExists) {
        // User already exists, just select them
        await handlePlayerSelect(searchQuery, selectedPlatform)
        return
      }

      // Proceed with import
      const result = await AutoImportService.importLast100Games(
        searchQuery,
        selectedPlatform,
        setImportProgress
      )

      if (result.success) {
        // Increment anonymous usage after successful import
        if (!user && result.games_imported) {
          AnonymousUsageTracker.incrementImports(result.games_imported)
        }

        // Import successful, refresh usage stats for authenticated users
        if (user) {
          await refreshUsageStats()
        }

        // Now select the player
        await handlePlayerSelect(searchQuery, selectedPlatform)
      } else {
        setImportProgress({
          status: 'error',
          message: result.message,
          progress: 0,
          importedGames: 0,
        })
      }
    } catch (error) {
      console.error('Import error:', error)
      setImportProgress({
        status: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        progress: 0,
        importedGames: 0,
      })
    } finally {
      setIsAutoImporting(false)
    }
  }

  // Automatic import when player is not found in database
  const handleAutoImport = async () => {
    await performImport()
  }

  // Manual import triggered by button click
  const handleManualImport = async () => {
    await performImport()
  }


  return (
    <>
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 flex items-center justify-between rounded-lg px-4 py-3 text-[13px] shadow-card ${notification.type === 'error' ? 'bg-rose-500/10 text-rose-100' : 'bg-sky-500/10 text-sky-100'}`} style={{ boxShadow: `0 0 0 1px ${notification.type === 'error' ? 'rgba(251,113,133,0.2)' : 'rgba(56,189,248,0.2)'}, 0 4px 12px rgba(0,0,0,0.3)` }}>
          <span className="flex-1">{notification.message}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-3 text-[11px] font-medium text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0d0f]/50 px-4">
          <div className="max-w-sm w-full rounded-lg bg-surface-1 p-6 shadow-card">
            <h3 className="text-section font-semibold text-white mb-3">Clear Recent Players</h3>
            <p className="text-gray-400 text-[13px] mb-6">
              Are you sure you want to clear all recent players?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-md px-5 py-2 text-[13px] font-medium text-gray-400 transition-colors hover:text-gray-300"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearRecentPlayers()
                  setRecentPlayers([])
                  setShowRecentPlayers(false)
                  setShowClearConfirm(false)
                }}
                className="rounded-md bg-rose-500/10 px-5 py-2 text-[13px] font-medium text-rose-300 transition-colors hover:bg-rose-500/15"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative text-gray-300">
      <form onSubmit={handleSearch}>
        {/* Input + Search button row */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-md bg-surface-2 pl-10 pr-4 py-3 text-[13px] text-gray-300 placeholder:text-gray-500 focus:outline-none transition-colors"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
              onFocus={(e) => { e.target.style.boxShadow = '0 0 0 1px rgba(228,232,237,0.12)' }}
              onBlur={(e) => { e.target.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.04)' }}
              placeholder="Enter player username..."
              required
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || isAutoImporting || !searchQuery.trim()}
            className="flex-shrink-0 rounded-md px-6 py-3 text-[13px] font-medium tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            style={{
              background: '#e4e8ed',
              color: '#111',
              boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#f0f2f5' }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#e4e8ed' }}
          >
            {isSearching || isAutoImporting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-gray-300"></div>
                <span>{isAutoImporting ? 'Importing...' : 'Searching...'}</span>
              </div>
            ) : (
              'Search'
            )}
          </button>
        </div>

        {/* Platform toggle - ghost style */}
        <div className="flex justify-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedPlatform('lichess')}
            className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${
              selectedPlatform === 'lichess'
                ? 'bg-white/[0.06] text-[#f0f0f0]'
                : 'text-gray-500 hover:text-gray-400 hover:bg-white/[0.03]'
            }`}
          >
            Lichess
          </button>
          <button
            type="button"
            onClick={() => setSelectedPlatform('chess.com')}
            className={`rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors ${
              selectedPlatform === 'chess.com'
                ? 'bg-white/[0.06] text-[#f0f0f0]'
                : 'text-gray-500 hover:text-gray-400 hover:bg-white/[0.03]'
            }`}
          >
            Chess.com
          </button>
        </div>
      </form>

      {/* Search Results */}
      {showResults && (
        <div className="mt-6">
          <h3 className="mb-3 text-section font-semibold text-white">
            Search Results ({searchResults.length})
          </h3>

          {searchResults.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              {isAutoImporting ? (
                <div className="space-y-3">
                  <div className="text-[28px] text-gray-600">&#9816;</div>
                  <p className="text-[13px] font-medium text-gray-300">Importing games for &ldquo;{searchQuery}&rdquo;...</p>
                  <p className="text-small text-gray-500">This may take a few moments</p>
                </div>
              ) : showImportPrompt ? (
                <div className="space-y-3">
                  <p className="text-[13px] font-medium text-gray-300">
                    Player &ldquo;{searchQuery}&rdquo; is not in our database yet.
                  </p>
                  <p className="text-small text-gray-500">
                    Please import games
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleManualImport}
                      disabled={isAutoImporting}
                      className="rounded-md px-5 py-2 text-[13px] font-medium tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      style={{
                        background: '#e4e8ed',
                        color: '#111',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
                      }}
                    >
                      Import 100 Games
                    </button>
                    <button
                      onClick={() => {
                        setShowImportPrompt(false)
                        setSearchQuery('')
                        setSearchResults([])
                        setShowResults(false)
                      }}
                      className="rounded-md px-5 py-2 text-[13px] font-medium text-gray-400 transition-colors hover:text-gray-300"
                      style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-[13px] text-gray-400">No players found matching &ldquo;{searchQuery}&rdquo;</p>
                  <p className="text-small text-gray-500">Try a different search term</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {searchResults.map(player => (
                <div
                  key={`${player.user_id}-${player.platform}`}
                  onClick={() => handlePlayerSelect(player.user_id, player.platform, player.display_name, player.current_rating)}
                  className="cursor-pointer rounded-md p-3 text-gray-300 transition-colors hover:bg-white/[0.03]"
                  style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-surface-3 flex items-center justify-center text-[13px] text-gray-400 flex-shrink-0">
                      {(player.display_name || player.user_id).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[13px] font-medium text-[#f0f0f0]">
                        {player.display_name || player.user_id}
                      </div>
                      <div className="truncate text-caption text-gray-500">
                        {player.platform} &middot; {player.current_rating || 'Unrated'} &middot; {player.total_games} games
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Import Progress */}
      {importProgress && (
        <div className="mt-6 rounded-lg bg-surface-1 p-5" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.2)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[13px] font-semibold text-[#f0f0f0]">
              {importProgress.status === 'starting' && 'Starting Import...'}
              {importProgress.status === 'importing' && 'Importing Games...'}
              {importProgress.status === 'completed' && 'Import Complete'}
              {importProgress.status === 'error' && 'Import Failed'}
            </h4>
            <span className="text-caption text-gray-500">
              {importProgress.importedGames} games
            </span>
          </div>

          <div className="mb-2">
            <div className="h-1 w-full rounded-full bg-white/[0.04]">
              <div
                className={`h-1 rounded-full transition-colors duration-300 ${
                  importProgress.status === 'error'
                    ? 'bg-rose-400/50'
                    : importProgress.status === 'completed'
                      ? 'bg-emerald-400/50'
                      : 'bg-gray-400/40'
                }`}
                style={{ width: `${importProgress.progress}%` }}
              />
            </div>
          </div>

          <p className={`text-small ${
            importProgress.status === 'error' ? 'text-rose-300/80' : importProgress.status === 'completed' ? 'text-emerald-300/80' : 'text-gray-500'
          }`}>
            {importProgress.message}
          </p>

          {importProgress.status === 'completed' && (
            <p className="mt-3 text-[13px] font-medium text-emerald-300/80 text-center">
              {importProgress.importedGames} games imported successfully - you can now view analytics.
            </p>
          )}

          {importProgress.status === 'error' && (
            <p className="mt-3 text-[13px] font-medium text-rose-300/80 text-center">
              Import failed. Please try again or check the username.
            </p>
          )}
        </div>
      )}

      {/* Quick Access to Recent Players */}
      <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-caption font-medium text-gray-500" style={{ letterSpacing: '0.06em', fontVariant: 'all-small-caps' }}>
            Quick Access
          </span>
          {recentPlayers.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-caption font-medium text-gray-500 hover:text-gray-400 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {recentPlayers.length === 0 ? (
          <div>
            <p className="text-small text-gray-500 mb-3">
              Try it out - click any player to see their analysis instantly
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { userId: 'hikaru', platform: 'chess.com' as const, displayName: 'Hikaru Nakamura', rating: 3228 },
                { userId: 'DrNykterstein', platform: 'lichess' as const, displayName: 'Magnus Carlsen', rating: 2830 },
                { userId: 'DanielNaroditsky', platform: 'chess.com' as const, displayName: 'Daniel Naroditsky', rating: 3004 },
              ].map(player => (
                <div
                  key={`${player.userId}-${player.platform}`}
                  onClick={() => handlePlayerSelect(player.userId, player.platform, player.displayName, player.rating)}
                  className="cursor-pointer rounded-md p-3 transition-colors hover:bg-white/[0.03]"
                  style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-surface-3 flex items-center justify-center text-caption text-gray-400 flex-shrink-0">
                      {player.displayName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[13px] font-medium text-[#f0f0f0]">
                        {player.displayName}
                      </div>
                      <div className="truncate text-caption text-gray-500">
                        {player.platform} &middot; {player.rating}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-3">
              <button
                onClick={() => setShowRecentPlayers(!showRecentPlayers)}
                className="text-[13px] font-medium text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showRecentPlayers ? 'Hide' : 'Show'} Recent Players ({recentPlayers.length})
              </button>
            </div>

            {showRecentPlayers && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {recentPlayers.map(player => (
                  <div
                    key={`${player.userId}-${player.platform}`}
                    onClick={() => handlePlayerSelect(player.userId, player.platform, player.displayName, player.rating)}
                    className="cursor-pointer rounded-md p-3 transition-colors hover:bg-white/[0.03]"
                    style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-surface-3 flex items-center justify-center text-caption text-gray-400 flex-shrink-0">
                        {(player.displayName || player.userId).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#f0f0f0]">
                          {player.displayName || player.userId}
                        </div>
                        <div className="truncate text-caption text-gray-500">
                          {player.platform}{player.rating ? ` \u00b7 ${player.rating}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* Usage Limit Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType={limitType}
      />
    </>
  )
}
