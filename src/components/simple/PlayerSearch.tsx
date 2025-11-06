// Player Search Component - Search for players and open their profiles
import React, { useState, useEffect } from 'react'
import { ProfileService } from '../../services/profileService'
import { AutoImportService, ImportProgress } from '../../services/autoImportService'
import { getRecentPlayers, addRecentPlayer, clearRecentPlayers, RecentPlayer } from '../../utils/recentPlayers'
import { retryWithBackoff } from '../../lib/errorHandling'
import { useAuth } from '../../contexts/AuthContext'
import UsageLimitModal from '../UsageLimitModal'
import { AnonymousUsageTracker } from '../../services/anonymousUsageTracker'
import AnonymousLimitModal from '../AnonymousLimitModal'

// Add custom pulse animation style
const customPulseStyle = `
  @keyframes customPulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.70;
    }
  }
  .animate-custom-pulse {
    animation: customPulse 3s ease-in-out infinite;
  }
  input::placeholder {
    color: #B0B8C4 !important;
  }
`

interface PlayerSearchProps {
  onPlayerSelect: (userId: string, platform: 'lichess' | 'chess.com') => void
}

export function PlayerSearch({ onPlayerSelect }: PlayerSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<'lichess' | 'chess.com'>('lichess')
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

  // Anonymous user tracking
  const [anonymousLimitModalOpen, setAnonymousLimitModalOpen] = useState(false)
  const [anonymousLimitType, setAnonymousLimitType] = useState<'import' | 'analyze'>('import')

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

    // Check anonymous user limits first
    if (!user) {
      if (!AnonymousUsageTracker.canImport()) {
        console.log('[PlayerSearch] Anonymous user reached import limit')
        setAnonymousLimitType('import')
        setAnonymousLimitModalOpen(true)
        return
      }
    }

    // Check usage limits for authenticated users
    if (user && usageStats) {
      // Check if user has remaining imports
      if (usageStats.imports && !usageStats.imports.unlimited && usageStats.imports.remaining === 0) {
        setShowLimitModal(true)
        return
      }
    }

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

  const getPlatformIcon = (platform: 'lichess' | 'chess.com') => {
    return platform === 'chess.com' ? '♞' : '♟'
  }

  const getPlatformColor = (platform: 'lichess' | 'chess.com') => {
    return platform === 'chess.com' ? 'text-green-600' : 'text-blue-600'
  }

  return (
    <>
      <style>{customPulseStyle}</style>

      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 flex items-start justify-between rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${notification.type === 'error' ? 'border-rose-400/20 bg-rose-500/8 text-rose-100' : 'border-sky-400/20 bg-sky-500/8 text-sky-100'}`}>
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none">{notification.type === 'error' ? '⚠' : 'ℹ'}</span>
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-3 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            OK
          </button>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="max-w-md w-full rounded-[2rem] border border-white/[0.02] bg-slate-900/95 p-6 shadow-2xl backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-3">Clear Recent Players</h3>
            <p className="text-slate-300 text-sm mb-6">
              Are you sure you want to clear all recent players?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-3xl border border-white/[0.02] bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-slate-200 transition-all hover:bg-white/[0.06]"
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
                className="rounded-3xl border border-rose-400/25 bg-rose-500/15 px-6 py-2.5 text-sm font-semibold text-rose-100 transition-all hover:border-rose-300/40 hover:bg-rose-500/25"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative text-slate-100">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-white">Search Player</h2>
          <p className="mt-2 text-sm" style={{ color: '#B0B8C4' }}>Find and analyze any chess player's games</p>
        </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border px-4 py-3 text-white focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: '#2D3748',
                borderColor: 'rgba(176, 184, 196, 0.1)',
                color: '#FFFFFF',
              }}
              placeholder="Enter player username..."
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(176, 184, 196, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(176, 184, 196, 0.1)';
              }}
              required
            />
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <button
              type="button"
              onClick={() => setSelectedPlatform('lichess')}
              className={`flex-1 md:w-32 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
                selectedPlatform === 'lichess'
                  ? 'border border-yellow-500/30 bg-yellow-600/20 text-yellow-100 shadow-[0_0_12px_rgba(234,179,8,0.2)]'
                  : 'border border-slate-700/50 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60'
              }`}
              title="Lichess"
            >
              Lichess
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlatform('chess.com')}
              className={`flex-1 md:w-32 rounded-full px-6 py-3 text-sm font-semibold transition-all ${
                selectedPlatform === 'chess.com'
                  ? 'border border-green-500/30 bg-green-600/20 text-green-100 shadow-[0_0_12px_rgba(34,197,94,0.2)]'
                  : 'border border-slate-700/50 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/60'
              }`}
              title="Chess.com"
            >
              Chess.com
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:justify-center">
          <button
            type="submit"
            disabled={isSearching || isAutoImporting || !searchQuery.trim()}
            className="w-full md:w-44 rounded-full border border-slate-600/50 bg-slate-700/50 px-6 py-3 text-sm font-semibold text-slate-100 transition-all hover:border-slate-500 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSearching || isAutoImporting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-slate-200"></div>
                <span>{isAutoImporting ? 'Importing...' : 'Searching...'}</span>
              </div>
            ) : (
              'Search Player'
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('')
              setSearchResults([])
              setShowResults(false)
              setImportProgress(null)
              setShowImportPrompt(false)
            }}
            className="w-full md:w-44 rounded-full border border-slate-700/50 bg-slate-800/40 px-6 py-3 text-sm font-semibold text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/60"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Search Results */}
      {showResults && (
        <div className="mt-6">
          <h3 className="mb-3 text-lg font-semibold text-white">
            Search Results ({searchResults.length})
          </h3>

          {searchResults.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              {isAutoImporting ? (
                <div className="space-y-4">
                  <div className="text-4xl text-slate-600">♘</div>
                  <p className="text-lg font-medium text-slate-200">Importing games for "{searchQuery}"...</p>
                  <p className="text-sm">This may take a few moments</p>
                </div>
              ) : showImportPrompt ? (
                <div className="space-y-4">
                  <p className="text-lg font-medium text-slate-200 mb-2">
                    Player "{searchQuery}" is not in our database yet.
                  </p>
                  <p className="text-sm text-slate-400 mb-4">
                    Please import games
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-6">
                    <button
                      onClick={handleManualImport}
                      disabled={isAutoImporting}
                      className="w-full md:w-44 rounded-full border border-slate-600/50 bg-slate-700/50 px-6 py-2 text-sm font-semibold text-slate-100 transition-all hover:border-slate-500 hover:bg-slate-700/70 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="w-full md:w-44 rounded-full border border-slate-700/50 bg-slate-800/40 px-6 py-2 text-sm font-semibold text-slate-300 transition-all hover:border-slate-600 hover:bg-slate-800/60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p>No players found matching "{searchQuery}"</p>
                  <p className="text-sm">Try a different search term</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map(player => (
                <div
                  key={`${player.user_id}-${player.platform}`}
                  onClick={() => handlePlayerSelect(player.user_id, player.platform, player.display_name, player.current_rating)}
                  className="cursor-pointer rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4 text-slate-100 transition-all hover:border-slate-600/50 hover:bg-slate-800/50"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`text-2xl ${getPlatformColor(player.platform)}`}>
                      {getPlatformIcon(player.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-semibold text-white">
                        {player.display_name || player.user_id}
                      </div>
                      <div className="truncate text-sm text-slate-300">
                        {player.user_id} - {player.platform}
                      </div>
                      <div className="text-xs text-slate-400">
                        {player.total_games} games - {player.current_rating} rating
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
        <div className="mt-6 rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold text-white">
              {importProgress.status === 'starting' && 'Starting Import...'}
              {importProgress.status === 'importing' && 'Importing Games...'}
              {importProgress.status === 'completed' && 'Import Complete!'}
              {importProgress.status === 'error' && 'Import Failed'}
            </h4>
            <div className="text-sm text-slate-300">
              {importProgress.importedGames} games imported
            </div>
          </div>

          <div className="mb-2">
            <div className="h-2 w-full rounded-full bg-white/10">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  importProgress.status === 'error'
                    ? 'bg-rose-500'
                    : importProgress.status === 'completed'
                      ? 'bg-emerald-400'
                      : 'bg-sky-400'
                }`}
                style={{ width: `${importProgress.progress}%` }}
              ></div>
            </div>
          </div>

          <p
            className={`text-sm ${
              importProgress.status === 'error'
                ? 'text-rose-200'
                : importProgress.status === 'completed'
                  ? 'text-emerald-200'
                  : 'text-slate-300'
            }`}
          >
            {importProgress.message}
          </p>

          {importProgress.status === 'completed' && (
            <div className="mt-3 text-center">
              <div className="mb-2 text-2xl text-emerald-200">✓</div>
              <p className="font-medium text-emerald-200">
                {importProgress.importedGames} games imported successfully! You can now view
                analytics.
              </p>
            </div>
          )}

          {importProgress.status === 'error' && (
            <div className="mt-3 text-center">
              <div className="mb-2 text-2xl text-rose-200">!</div>
              <p className="font-medium text-rose-200">
                Import failed. Please try again or check if the username is correct.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Access to Recent Players */}
      <div className="mt-6 border-t border-white/10 pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Quick Access</h3>
          {recentPlayers.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-xs hover:opacity-80 transition-opacity"
              style={{ color: '#B0B8C4' }}
            >
              Clear All
            </button>
          )}
        </div>

        {recentPlayers.length === 0 ? (
          <p className="text-sm text-slate-400">
            No recent players yet. Search for a player to get started!
          </p>
        ) : (
          <>
            <div className="text-center mb-3">
              <button
                onClick={() => setShowRecentPlayers(!showRecentPlayers)}
                className="font-medium hover:opacity-80 text-sm transition-opacity"
                style={{ color: '#4299E1' }}
              >
                {showRecentPlayers ? 'Hide' : 'Show'} Recent Players ({recentPlayers.length})
              </button>
            </div>

            {showRecentPlayers && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {recentPlayers.map(player => (
                  <div
                    key={`${player.userId}-${player.platform}`}
                    onClick={() => handlePlayerSelect(player.userId, player.platform, player.displayName, player.rating)}
                    className="cursor-pointer rounded-2xl border border-slate-700/30 bg-slate-800/30 p-3 transition-all hover:border-slate-600/50 hover:bg-slate-800/50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`text-xl ${getPlatformColor(player.platform)}`}>
                        {getPlatformIcon(player.platform)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-white text-sm">
                          {player.displayName || player.userId}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          {player.platform}{player.rating ? ` • ${player.rating}` : ''}
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
      <UsageLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="import"
        isAuthenticated={!!user}
        currentUsage={usageStats?.imports ? {
          used: usageStats.imports.used,
          limit: usageStats.imports.limit,
          remaining: usageStats.imports.remaining,
          unlimited: usageStats.imports.unlimited
        } : undefined}
      />

      {/* Anonymous User Limit Modal */}
      <AnonymousLimitModal
        isOpen={anonymousLimitModalOpen}
        onClose={() => setAnonymousLimitModalOpen(false)}
        limitType={anonymousLimitType}
      />
    </>
  )
}
