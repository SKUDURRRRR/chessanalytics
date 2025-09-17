// Auto Import Service - Automatically import games for new players
import { supabase } from '../lib/supabase'

export interface ImportProgress {
  status: 'starting' | 'importing' | 'completed' | 'error'
  message: string
  progress: number
  importedGames: number
}

export interface ImportResult {
  success: boolean
  message: string
  importedGames: number
  errors?: string[]
}

export class AutoImportService {
  // Validate that a user exists on the specified platform
  static async validateUserOnPlatform(
    username: string, 
    platform: 'lichess' | 'chess.com'
  ): Promise<{ exists: boolean; userInfo?: any }> {
    try {
      if (platform === 'lichess') {
        return await this.validateLichessUser(username)
      } else {
        return await this.validateChessComUser(username)
      }
    } catch (error) {
      console.error('Error validating user:', error)
      return { exists: false }
    }
  }

  // Validate Lichess user
  private static async validateLichessUser(username: string): Promise<{ exists: boolean; userInfo?: any }> {
    try {
      const response = await fetch(`https://lichess.org/api/user/${username}`)
      
      if (response.ok) {
        const userInfo = await response.json()
        return { exists: true, userInfo }
      } else if (response.status === 404) {
        return { exists: false }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Error validating Lichess user:', error)
      return { exists: false }
    }
  }

  // Validate Chess.com user
  private static async validateChessComUser(username: string): Promise<{ exists: boolean; userInfo?: any }> {
    try {
      const response = await fetch(`https://api.chess.com/pub/player/${username}`)
      
      if (response.ok) {
        const userInfo = await response.json()
        return { exists: true, userInfo }
      } else if (response.status === 404) {
        return { exists: false }
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error('Error validating Chess.com user:', error)
      return { exists: false }
    }
  }

  // Check if user already exists in our database
  static async checkUserExists(
    username: string, 
    platform: 'lichess' | 'chess.com'
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', username)
        .eq('platform', platform)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error checking user existence:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Error checking user existence:', error)
      return false
    }
  }

  // Import last 100 games for a user
  static async importLast100Games(
    username: string,
    platform: 'lichess' | 'chess.com',
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    try {
      console.log(`Starting import for ${username} on ${platform}`)
      
      onProgress?.({
        status: 'starting',
        message: 'Validating user and preparing import...',
        progress: 0,
        importedGames: 0
      })

      // Validate user exists
      const validation = await this.validateUserOnPlatform(username, platform)
      console.log('User validation result:', validation)
      
      if (!validation.exists) {
        console.log(`User ${username} not found on ${platform}`)
        return {
          success: false,
          message: `User "${username}" not found on ${platform === 'chess.com' ? 'Chess.com' : 'Lichess'}`,
          importedGames: 0
        }
      }

      onProgress?.({
        status: 'importing',
        message: 'Fetching games from platform...',
        progress: 10,
        importedGames: 0
      })

      // Fetch games from platform
      console.log(`Fetching games for ${username} from ${platform}`)
      const games = await this.fetchGamesFromPlatform(username, platform, 100)
      console.log(`Fetched ${games.length} games`)
      
      if (games.length === 0) {
        console.log(`No games found for ${username} on ${platform}`)
        return {
          success: false,
          message: `No games found for user "${username}" on ${platform}`,
          importedGames: 0
        }
      }

      onProgress?.({
        status: 'importing',
        message: `Found ${games.length} games. Creating profile...`,
        progress: 30,
        importedGames: 0
      })

      // Create or get profile
      // First check if profile exists, then either update or insert
      let { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', username)
        .eq('platform', platform)
        .single()

      let profile, profileError

      if (existingProfile) {
        // Update existing record
        const { data: updateData, error: updateError } = await supabase
          .from('user_profiles')
          .update({
            display_name: validation.userInfo?.username || username,
            current_rating: validation.userInfo?.perfs?.classical?.rating || 
                           validation.userInfo?.perfs?.rapid?.rating || 
                           validation.userInfo?.perfs?.blitz?.rating || 1200,
            total_games: games.length,
            win_rate: 0,
            last_accessed: new Date().toISOString()
          })
          .eq('user_id', username)
          .eq('platform', platform)
          .select()
          .single()
        
        profile = updateData
        profileError = updateError
      } else {
        // Insert new record
        const { data: insertData, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: username,
            platform: platform,
            display_name: validation.userInfo?.username || username,
            current_rating: validation.userInfo?.perfs?.classical?.rating || 
                           validation.userInfo?.perfs?.rapid?.rating || 
                           validation.userInfo?.perfs?.blitz?.rating || 1200,
            total_games: games.length,
            win_rate: 0
          })
          .select()
          .single()
        
        profile = insertData
        profileError = insertError
      }

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return {
          success: false,
          message: 'Failed to create user profile',
          importedGames: 0
        }
      }

      onProgress?.({
        status: 'importing',
        message: 'Saving games to database...',
        progress: 50,
        importedGames: 0
      })

      // Save games to database (simplified - just store basic game data)
      let savedGames = 0
      let errors = 0

      for (const game of games) {
        try {
          const { error } = await supabase
            .from('games')
            .upsert({
              game_id: game.id,
              user_id: username,
              platform: platform,
              pgn: game.pgn,
              white_player: game.white?.username || 'Unknown',
              black_player: game.black?.username || 'Unknown',
              result: game.winner || 'Unknown',
              time_control: game.timeControl || 'Unknown',
              created_at: new Date().toISOString()
            })

          if (error) {
            console.error(`Error saving game ${game.id}:`, error)
            errors++
          } else {
            savedGames++
          }
        } catch (err) {
          console.error(`Error processing game ${game.id}:`, err)
          errors++
        }
      }

      onProgress?.({
        status: 'importing',
        message: 'Updating profile...',
        progress: 80,
        importedGames: savedGames
      })

      // Update profile with final stats
      await supabase
        .from('user_profiles')
        .update({
          total_games: savedGames,
          last_accessed: new Date().toISOString()
        })
        .eq('user_id', username)
        .eq('platform', platform)

      onProgress?.({
        status: 'completed',
        message: `Successfully imported ${savedGames} games`,
        progress: 100,
        importedGames: savedGames
      })

      return {
        success: true,
        message: `Successfully imported ${savedGames} games`,
        importedGames: savedGames,
        errors: errors
      }

    } catch (error) {
      console.error('Error importing games:', error)
      onProgress?.({
        status: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        progress: 0,
        importedGames: 0
      })

      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        importedGames: 0
      }
    }
  }

  // Fetch games from platform
  private static async fetchGamesFromPlatform(
    username: string,
    platform: 'lichess' | 'chess.com',
    maxGames: number
  ): Promise<Array<{ id: string; pgn: string; date: string }>> {
    if (platform === 'lichess') {
      return await this.fetchLichessGames(username, maxGames)
    } else {
      return await this.fetchChessComGames(username, maxGames)
    }
  }

  // Fetch games from Lichess
  private static async fetchLichessGames(
    username: string, 
    maxGames: number
  ): Promise<Array<{ id: string; pgn: string; date: string }>> {
    try {
      const response = await fetch(
        `https://lichess.org/api/games/user/${username}?max=${maxGames}&perfType=classical,rapid,blitz&moves=true&pgnInJson=true`
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const text = await response.text()
      console.log('Raw Lichess API response (first 1000 chars):', text.substring(0, 1000))
      
      // Try to parse as JSON first (with pgnInJson=true)
      let games = []
      try {
        const jsonData = JSON.parse(text)
        console.log('Parsed as JSON, found games:', jsonData.length)
        
        for (const game of jsonData) {
          if (game.pgn) {
            console.log(`Found game ${game.id}, PGN length: ${game.pgn.length}`)
            console.log('Full PGN for this game:', game.pgn)
            
            games.push({
              id: game.id || `${username}-${Date.now()}-${Math.random()}`,
              pgn: game.pgn,
              date: game.createdAt || new Date().toISOString()
            })
          }
        }
      } catch (jsonError) {
        console.log('Not JSON format, trying PGN format')
        
        // Fallback to PGN format parsing
        const gameBlocks = text.trim().split('\n\n')
        console.log(`Split into ${gameBlocks.length} game blocks`)
        
        for (const gameBlock of gameBlocks) {
          if (gameBlock.trim()) {
            console.log('Processing game block:', gameBlock.substring(0, 200) + '...')
            
            // Check if this is a PGN game (contains PGN headers)
            if (gameBlock.includes('[Event') && gameBlock.includes('[Site')) {
              // Extract game ID from PGN
              const gameIdMatch = gameBlock.match(/\[Site "https:\/\/lichess\.org\/([^"]+)"/)
              const gameId = gameIdMatch ? gameIdMatch[1] : `${username}-${Date.now()}-${Math.random()}`
              
              // Extract date from PGN
              const dateMatch = gameBlock.match(/\[UTCDate "([^"]+)"/)
              const date = dateMatch ? dateMatch[1] : new Date().toISOString()
              
              console.log(`Found game ${gameId}, PGN length: ${gameBlock.length}`)
              console.log('Full PGN for this game:', gameBlock)
              
              games.push({
                id: gameId,
                pgn: gameBlock,
                date: date
              })
            } else {
              // Skip unrecognized blocks
              console.warn('Skipping unrecognized game block format')
            }
          }
        }
      }

      console.log(`Fetched ${games.length} games from Lichess`)
      return games
    } catch (error) {
      console.error('Error fetching Lichess games:', error)
      return []
    }
  }

  // Fetch games from Chess.com
  private static async fetchChessComGames(
    username: string, 
    maxGames: number
  ): Promise<Array<{ id: string; pgn: string; date: string }>> {
    try {
      // Chess.com API requires multiple calls for different time periods
      const games = []
      const currentDate = new Date()
      const months = 12 // Get games from last 12 months

      for (let i = 0; i < months; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')

        try {
          const response = await fetch(
            `https://api.chess.com/pub/player/${username}/games/${year}/${month}`
          )

          if (response.ok) {
            const data = await response.json()
            if (data.games) {
              for (const game of data.games) {
                if (games.length >= maxGames) break
                
                if (game.pgn) {
                  // Log the full PGN to debug the format
                  console.log('Chess.com PGN sample:', game.pgn.substring(0, 1000) + '...')
                  
                  games.push({
                    id: game.url?.split('/').pop() || `${username}-${Date.now()}-${Math.random()}`,
                    pgn: game.pgn,
                    date: game.end_time ? new Date(game.end_time * 1000).toISOString() : new Date().toISOString()
                  })
                }
              }
            }
          }

          if (games.length >= maxGames) break
        } catch (monthError) {
          console.warn(`Error fetching games for ${year}/${month}:`, monthError)
        }
      }

      return games.slice(0, maxGames)
    } catch (error) {
      console.error('Error fetching Chess.com games:', error)
      return []
    }
  }

  // Get import status for a user
  static async getImportStatus(
    username: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<{
    isImported: boolean
    totalGames: number
    lastImportDate?: string
  }> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('total_games, updated_at')
        .eq('user_id', username)
        .eq('platform', platform)
        .single()

      if (error) {
        return { isImported: false, totalGames: 0 }
      }

      return {
        isImported: true,
        totalGames: data.total_games || 0,
        lastImportDate: data.updated_at
      }
    } catch (error) {
      console.error('Error getting import status:', error)
      return { isImported: false, totalGames: 0 }
    }
  }

  // Re-import games for an existing user
  static async reimportGames(
    username: string,
    platform: 'lichess' | 'chess.com',
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    // First clear existing data
    await supabase
      .from('game_features')
      .delete()
      .eq('user_id', username)
      .eq('platform', platform)

    // Then import fresh
    return await this.importLast100Games(username, platform, onProgress)
  }
}
