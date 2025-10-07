// Player Search Component - Search for players and open their profiles
import React, { useState } from 'react'
import { ProfileService } from '../../services/profileService'
import { AutoImportService, ImportProgress } from '../../services/autoImportService'

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

  const handlePlayerSelect = async (userId: string, platform: 'lichess' | 'chess.com') => {
    try {
      // Create or get profile
      await ProfileService.getOrCreateProfile(userId, platform)

      // Select the player
      onPlayerSelect(userId, platform)

      // Reset search
      setSearchQuery('')
      setSearchResults([])
      setShowResults(false)
      setImportProgress(null)
    } catch (error) {
      console.error('Error selecting player:', error)
      alert('Failed to select player. Please try again.')
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
      const validation = await AutoImportService.validateUserOnPlatform(
        searchQuery,
        selectedPlatform
      )

      if (!validation.exists) {
        setImportProgress({
          status: 'error',
          message: `User "${searchQuery}" not found on ${selectedPlatform === 'chess.com' ? 'Chess.com' : 'Lichess'}. Please check the username and try again.`,
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
    return platform === 'chess.com' ? '♟' : '♞'
  }

  const getPlatformColor = (platform: 'lichess' | 'chess.com') => {
    return platform === 'chess.com' ? 'text-blue-600' : 'text-green-600'
  }

  return (
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedPlatform('lichess')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedPlatform === 'lichess'
                  ? 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200 shadow-inner shadow-emerald-900/40'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10'
              }`}
              title="Lichess"
            >
              Lichess
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlatform('chess.com')}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                selectedPlatform === 'chess.com'
                  ? 'border border-sky-400/40 bg-sky-500/20 text-sky-200 shadow-inner shadow-sky-900/40'
                  : 'border border-white/10 bg-white/5 text-slate-200 hover:border-white/30 hover:bg-white/10'
              }`}
              title="Chess.com"
            >
              Chess.com
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <button
            type="submit"
            disabled={isSearching || isAutoImporting || !searchQuery.trim()}
            className="flex-1 rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/20"
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
                  <div className="text-4xl text-slate-600">Search</div>
                  <p className="text-lg font-medium text-slate-200">No players found in database</p>
                  <p className="mb-4 text-sm text-slate-400">
                    Player "{searchQuery}" is not in our database yet.
                  </p>
                  <div className="space-x-3">
                    <button
                      onClick={handleManualImport}
                      disabled={isAutoImporting}
                      className="rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="rounded-2xl border border-white/10 bg-white/10 px-6 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl text-slate-600">Search</div>
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
                  onClick={() => handlePlayerSelect(player.user_id, player.platform)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    player.platform_mismatch
                      ? 'border-amber-300/40 bg-amber-500/10 text-amber-100 hover:border-amber-300/60'
                      : 'border-white/10 bg-white/5 text-slate-100 hover:border-white/30 hover:bg-white/10'
                  }`}
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
                      {player.platform_mismatch && (
                        <div className="mt-1 text-xs font-medium text-amber-200">
                          Warning: Found on {player.original_platform}, but you selected{' '}
                          {selectedPlatform}
                        </div>
                      )}
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
        <h3 className="mb-3 text-lg font-semibold text-white">Quick Access</h3>
        <p className="mb-3 text-sm text-slate-300">
          Or search for a new player by typing their username above
        </p>
        <div className="text-center">
          <button
            onClick={() => setShowResults(!showResults)}
            className="font-medium text-sky-300 hover:text-sky-200"
          >
            {showResults ? 'Hide' : 'Show'} Recent Players
          </button>
        </div>
      </div>
    </div>
  )
}
