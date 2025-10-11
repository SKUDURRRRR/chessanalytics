// Auto Import Service - Handles importing games from external platforms
import { config } from '../lib/config'

const API_URL = config.getApi().baseUrl

export interface ImportProgress {
  status: 'starting' | 'importing' | 'complete' | 'error'
  message: string
  progress: number
  importedGames: number
}

export interface ImportResult {
  success: boolean
  message: string
  importedGames?: number
}

export interface UserValidation {
  exists: boolean
  message?: string
}

export interface LargeImportProgress {
  status: 'idle' | 'discovering' | 'importing' | 'completed' | 'cancelled' | 'error'
  importedGames: number
  totalToImport: number
  progress: number
  message: string
  triggerRefresh?: boolean
}

export interface GameDiscovery {
  totalAvailable: number
  alreadyImported: number
  canImport: number
  cappedAt5000: boolean
}

export interface DateRange {
  fromDate?: string
  toDate?: string
}

export class AutoImportService {
  /**
   * Validate that a user exists on the specified platform
   */
  static async validateUserOnPlatform(
    userId: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<UserValidation> {
    try {
      const response = await fetch(`${API_URL}/api/v1/validate-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error validating user:', error)
      return {
        exists: false,
        message: 'Failed to validate user. Please check your connection and try again.',
      }
    }
  }

  /**
   * Check if user already exists in our database
   */
  static async checkUserExists(
    userId: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/api/v1/check-user-exists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
        }),
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      return data.exists || false
    } catch (error) {
      console.error('Error checking user existence:', error)
      return false
    }
  }

  /**
   * Import the last 100 games for a user
   */
  static async importLast100Games(
    userId: string,
    platform: 'lichess' | 'chess.com',
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    try {
      const response = await fetch(`${API_URL}/api/v1/import-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
          limit: 100,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (onProgress) {
        onProgress({
          status: 'complete',
          message: `Successfully imported ${data.imported_games || 0} games`,
          progress: 100,
          importedGames: data.imported_games || 0,
        })
      }

      return {
        success: true,
        message: `Successfully imported ${data.imported_games || 0} games`,
        importedGames: data.imported_games || 0,
      }
    } catch (error) {
      console.error('Error importing games:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (onProgress) {
        onProgress({
          status: 'error',
          message: `Import failed: ${errorMessage}`,
          progress: 0,
          importedGames: 0,
        })
      }

      return {
        success: false,
        message: `Import failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Smart import - imports newest 10 games or next batch if no new games
   */
  static async importSmartGames(
    userId: string,
    platform: 'lichess' | 'chess.com',
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    try {
      const response = await fetch(`${API_URL}/api/v1/import-games-smart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (onProgress) {
        // Use the detailed message from the backend if available
        let message
        if (data.message) {
          message = data.message
        } else if (data.imported_games > 0) {
          message = data.new_games_count > 0 
            ? `Imported ${data.imported_games} new games`
            : `Imported ${data.imported_games} additional games (no new games found)`
        } else {
          message = data.had_existing_games 
            ? "No new games found. You already have all recent games imported."
            : "No games found to import."
        }
        
        onProgress({
          status: 'complete',
          message: message,
          progress: 100,
          importedGames: data.imported_games || 0,
        })
      }

      let returnMessage
      if (data.message) {
        returnMessage = data.message
      } else if (data.imported_games > 0) {
        returnMessage = data.new_games_count > 0 
          ? `Imported ${data.imported_games} new games`
          : `Imported ${data.imported_games} additional games (no new games found)`
      } else {
        returnMessage = data.had_existing_games 
          ? "No new games found. You already have all recent games imported."
          : "No games found to import."
      }

      return {
        success: true,
        message: returnMessage,
        importedGames: data.imported_games || 0,
      }
    } catch (error) {
      console.error('Error importing games:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (onProgress) {
        onProgress({
          status: 'error',
          message: `Import failed: ${errorMessage}`,
          progress: 0,
          importedGames: 0,
        })
      }

      return {
        success: false,
        message: `Import failed: ${errorMessage}`,
      }
    }
  }

  /**
   * Discover available games for import
   */
  static async discoverAvailableGames(
    userId: string,
    platform: 'lichess' | 'chess.com',
    dateRange?: DateRange
  ): Promise<GameDiscovery> {
    try {
      const response = await fetch(`${API_URL}/api/v1/discover-games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
          from_date: dateRange?.fromDate,
          to_date: dateRange?.toDate
        })
      })
      
      if (!response.ok) {
        throw new Error(`Discovery failed: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error discovering games:', error)
      throw error
    }
  }

  /**
   * Import more games (up to 5000)
   */
  static async importMoreGames(
    userId: string,
    platform: 'lichess' | 'chess.com',
    limit: number,
    dateRange?: DateRange
  ): Promise<{ success: boolean; importKey: string }> {
    try {
      const response = await fetch(`${API_URL}/api/v1/import-more-games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          platform: platform,
          limit: limit,
          from_date: dateRange?.fromDate,
          to_date: dateRange?.toDate
        })
      })
      
      if (!response.ok) {
        throw new Error(`Import failed: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error importing more games:', error)
      throw error
    }
  }

  /**
   * Get progress of large import
   */
  static async getImportProgress(
    userId: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<LargeImportProgress> {
    try {
      const response = await fetch(`${API_URL}/api/v1/import-progress/${userId}/${platform}`)
      
      if (!response.ok) {
        throw new Error(`Failed to get progress: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error getting import progress:', error)
      throw error
    }
  }

  /**
   * Cancel ongoing import
   */
  static async cancelImport(
    userId: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_URL}/api/v1/cancel-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, platform: platform })
      })
      
      if (!response.ok) {
        throw new Error(`Failed to cancel import: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Error cancelling import:', error)
      throw error
    }
  }
}
