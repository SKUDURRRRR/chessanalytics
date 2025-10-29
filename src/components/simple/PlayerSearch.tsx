// Player Search Component - Search for players and open their profiles
import React, { useState, useEffect } from 'react'
import { ProfileService } from '../../services/profileService'
import { AutoImportService, ImportProgress } from '../../services/autoImportService'
import { getRecentPlayers, addRecentPlayer, clearRecentPlayers, RecentPlayer } from '../../utils/recentPlayers'

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
`

// Retry utility with exponential backoff
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on validation errors or 404s
      if (lastError.message.includes('not found') ||
          lastError.message.includes('404') ||
          lastError.message.includes('Invalid')) {
        throw lastError;
      }

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
};

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
        const otherResults = otherFiltered.map(profile => ({
          ...profile,
          platform_mismatch: true,
          original_platform: profile.platform,
        }))

        setSearchResults([...filtered, ...otherResults])
      } else {
        setSearchResults(filtered)
      }

      setShowResults(true)

      // If no results found on any platform, show import prompt instead of auto-importing
      if (filtered.length === 0) {
        setShowImportPrompt(true)
      } else {
        setShowImportPrompt(false)
      }
    } catch (error) {
      console.error('Error searching players:', error)
      setSearchResults([])
      setShowResults(true)
      // If there's an error, show import prompt
      setShowImportPrompt(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handlePlayerSelect = async (userId: string, platform: 'lichess' | 'chess.com', displayName?: string, rating?: number) => {
    try {
      // Use retry logic for ProfileService with exponential backoff
      const profile = await retryWithBackoff(
        () => ProfileService.getOrCreateProfile(userId, platform),
        3, // 3 retries
        1000 // 1 second initial delay
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

      alert(errorMessage);
    }
  }

  const handleManualImport = async () => {
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
        // Import successful, now select the player
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

  const getPlatformIcon = (platform: 'lichess' | 'chess.com') => {
    return platform === 'chess.com' ? '♞' : '♟'
  }

  const getPlatformColor = (platform: 'lichess' | 'chess.com') => {
    return platform === 'chess.com' ? 'text-green-600' : 'text-blue-600'
  }

  return (
    <>
      <style>{customPulseStyle}</style>
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-100 shadow-xl shadow-black/40">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-white">Search Player</h2>
          <p className="mt-2 text-sm text-slate-300">Find and analyze any chess player's games</p>
        </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
              placeholder="Enter player username..."
              required
            />
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <button
              type="button"
              onClick={() => setSelectedPlatform('lichess')}
              className={`flex-1 md:w-32 rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                selectedPlatform === 'lichess'
                  ? 'border border-yellow-400/40 bg-yellow-500/20 text-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.15),inset_0_2px_4px_rgba(161,98,7,0.15)] animate-custom-pulse'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10'
              }`}
              title="Lichess"
            >
              Lichess
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlatform('chess.com')}
              className={`flex-1 md:w-32 rounded-2xl px-6 py-3 text-sm font-semibold transition ${
                selectedPlatform === 'chess.com'
                  ? 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.15),inset_0_2px_4px_rgba(5,150,105,0.15)] animate-custom-pulse'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10'
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
            className="w-full md:w-44 rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSearching || isAutoImporting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-sky-200"></div>
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
            className="w-full md:w-44 rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/20"
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
                  <p className="text-lg font-medium text-slate-200">Please import games</p>
                  <p className="mb-4 text-sm text-slate-400">
                    Player "{searchQuery}" is not in our database yet.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-6">
                    <button
                      onClick={handleManualImport}
                      disabled={isAutoImporting}
                      className="w-full md:w-44 rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-2 text-sm font-semibold text-sky-100 shadow-[0_0_8px_rgba(56,189,248,0.15),inset_0_2px_4px_rgba(14,165,233,0.15)] animate-custom-pulse transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:animate-none"
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
                      className="w-full md:w-44 rounded-2xl border border-white/10 bg-white/10 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/20"
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
                  className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-100 transition hover:border-white/30 hover:bg-white/10"
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
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
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
              onClick={() => {
                if (confirm('Are you sure you want to clear all recent players?')) {
                  clearRecentPlayers()
                  setRecentPlayers([])
                  setShowRecentPlayers(false)
                }
              }}
              className="text-xs text-slate-400 hover:text-slate-200"
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
                className="font-medium text-sky-300 hover:text-sky-200 text-sm"
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
                    className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 transition hover:border-white/30 hover:bg-white/10"
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
    </>
  )
}
