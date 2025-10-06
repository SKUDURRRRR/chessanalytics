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
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Search Player</h2>
        <p className="text-gray-600">Find and analyze any chess player's games</p>
      </div>

      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex space-x-3">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter player username..."
              required
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setSelectedPlatform('lichess')}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedPlatform === 'lichess'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Lichess"
            >
              Lichess
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlatform('chess.com')}
              className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                selectedPlatform === 'chess.com'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Chess.com"
            >
              Chess.com
            </button>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isSearching || isAutoImporting || !searchQuery.trim()}
            className="flex-1 bg-blue-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching || isAutoImporting ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
            className="px-6 py-3 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
          >
            Clear
          </button>
        </div>
      </form>

      {/* Search Results */}
      {showResults && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Search Results ({searchResults.length})
          </h3>

          {searchResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {isAutoImporting ? (
                <div className="space-y-4">
                  <div className="text-4xl mb-2">Fast</div>
                  <p className="text-lg font-medium">Importing games for "{searchQuery}"...</p>
                  <p className="text-sm">This may take a few moments</p>
                </div>
              ) : showImportPrompt ? (
                <div className="space-y-4">
                  <div className="text-4xl mb-2">Search</div>
                  <p className="text-lg font-medium">No players found in database</p>
                  <p className="text-sm text-gray-600 mb-4">
                    Player "{searchQuery}" is not in our database yet.
                  </p>
                  <div className="space-x-3">
                    <button
                      onClick={handleManualImport}
                      disabled={isAutoImporting}
                      className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      className="bg-gray-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl mb-2">Search</div>
                  <p>No players found matching "{searchQuery}"</p>
                  <p className="text-sm">Try a different search term</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {searchResults.map(player => (
                <div
                  key={`${player.user_id}-${player.platform}`}
                  onClick={() => handlePlayerSelect(player.user_id, player.platform)}
                  className={`p-4 border rounded-lg cursor-pointer hover:shadow-md transition-all ${
                    player.platform_mismatch
                      ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`text-2xl ${getPlatformColor(player.platform)}`}>
                      {getPlatformIcon(player.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">
                        {player.display_name || player.user_id}
                      </div>
                      <div className="text-sm text-gray-500 truncate">
                        {player.user_id} - {player.platform}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player.total_games} games - {player.current_rating} rating
                      </div>
                      {player.platform_mismatch && (
                        <div className="text-xs text-yellow-600 font-medium mt-1">
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
        <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold text-gray-800">
              {importProgress.status === 'starting' && 'Starting Import...'}
              {importProgress.status === 'importing' && 'Importing Games...'}
              {importProgress.status === 'completed' && 'Import Complete!'}
              {importProgress.status === 'error' && 'Import Failed'}
            </h4>
            <div className="text-sm text-gray-500">
              {importProgress.importedGames} games imported
            </div>
          </div>

          <div className="mb-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  importProgress.status === 'error'
                    ? 'bg-red-500'
                    : importProgress.status === 'completed'
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                }`}
                style={{ width: `${importProgress.progress}%` }}
              ></div>
            </div>
          </div>

          <p
            className={`text-sm ${
              importProgress.status === 'error'
                ? 'text-red-600'
                : importProgress.status === 'completed'
                  ? 'text-green-600'
                  : 'text-gray-600'
            }`}
          >
            {importProgress.message}
          </p>

          {importProgress.status === 'completed' && (
            <div className="mt-3 text-center">
              <div className="text-2xl mb-2">Yes</div>
              <p className="text-green-600 font-medium">
                {importProgress.importedGames} games imported successfully! You can now view
                analytics.
              </p>
            </div>
          )}

          {importProgress.status === 'error' && (
            <div className="mt-3 text-center">
              <div className="text-2xl mb-2">No</div>
              <p className="text-red-600 font-medium">
                Import failed. Please try again or check if the username is correct.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Quick Access to Recent Players */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Quick Access</h3>
        <p className="text-sm text-gray-600 mb-3">
          Or search for a new player by typing their username above
        </p>
        <div className="text-center">
          <button
            onClick={() => setShowResults(!showResults)}
            className="text-blue-500 hover:text-blue-600 font-medium"
          >
            {showResults ? 'Hide' : 'Show'} Recent Players
          </button>
        </div>
      </div>
    </div>
  )
}
