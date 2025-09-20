// Auto Import Service - Automatically import games for new players
import { supabase } from '../lib/supabase'
import { normalizeUserId } from '../lib/security'
import { config } from '../lib/config'

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
  errorCount?: number
  errors?: string[]
}

const API_BASE_URL = config.getApi().baseUrl
const buildApiUrl = (path: string) => new URL(path, API_BASE_URL).toString()

export class AutoImportService {

  // Validate that a user exists on the specified platform
  static async validateUserOnPlatform(
    username: string,
    platform: 'lichess' | 'chess.com'
  ): Promise<{ exists: boolean; userInfo?: any }> {

    try {
      const normalizedUsername = normalizeUserId(username, platform)
      if (platform === 'lichess') {
        return await this.validateLichessUser(normalizedUsername)
      } else {
        return await this.validateChessComUser(normalizedUsername)
      }
    } catch (error) {
      console.error('Error validating user:', error)
      return { exists: false }
    }
  }

  // Validate Lichess user
  private static async validateLichessUser(
    username: string
  ): Promise<{ exists: boolean; userInfo?: any }> {
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
  private static async validateChessComUser(
    username: string
  ): Promise<{ exists: boolean; userInfo?: any }> {
    try {
      const normalizedUsername = username.trim().toLowerCase()
      const response = await fetch(buildApiUrl(`/proxy/chess-com/${normalizedUsername}`))

      if (response.ok) {
        const userInfo = await response.json()
        if (userInfo.error) {
          return { exists: false }
        }
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
      const normalizedUsername = normalizeUserId(username, platform)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', normalizedUsername)
        .eq('platform', platform)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
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
    const displayName = username.trim()
    const normalizedUsername = normalizeUserId(username, platform)
    let savedGames = 0
    let errorCount = 0
    const errorMessages: string[] = []

    try {
      console.log(`Starting import for ${displayName} on ${platform}`)

      onProgress?.({
        status: 'starting',
        message: 'Validating user and preparing import...',
        progress: 0,
        importedGames: 0,
      })

      // Validate user exists (keep original display name for API call)
      const validation = await this.validateUserOnPlatform(displayName, platform)
      console.log('User validation result:', validation)

      if (!validation.exists) {
        console.log(`User ${displayName} not found on ${platform}`)
        return {
          success: false,
          message: `User "${displayName}" not found on ${platform === 'chess.com' ? 'Chess.com' : 'Lichess'}`,
          importedGames: 0,
        }
      }

      onProgress?.({
        status: 'importing',
        message: 'Fetching games from platform...',
        progress: 10,
        importedGames: 0,
      })

      // Fetch games from platform using normalized username
      console.log(`Fetching games for ${normalizedUsername} from ${platform}`)
      const games = await this.fetchGamesFromPlatform(normalizedUsername, platform, 100)
      console.log(`Fetched ${games.length} games`)

      if (games.length === 0) {
        console.log(`No games found for ${normalizedUsername} on ${platform}`)
        return {
          success: false,
          message: `No games found for user "${displayName}" on ${platform}`,
          importedGames: 0,
        }
      }

      onProgress?.({
        status: 'importing',
        message: `Found ${games.length} games. Creating profile...`,
        progress: 30,
        importedGames: 0,
      })

      let { data: existingProfile, error: _checkError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', normalizedUsername)
        .eq('platform', platform)
        .single()

      let profileError

      if (existingProfile) {
        const { data: _updateData, error: updateError } = await supabase
          .from('user_profiles')
          .update({
            display_name: validation.userInfo?.username || displayName,
            current_rating:
              validation.userInfo?.perfs?.classical?.rating ||
              validation.userInfo?.perfs?.rapid?.rating ||
              validation.userInfo?.perfs?.blitz?.rating ||
              1200,
            total_games: games.length,
            win_rate: 0,
            last_accessed: new Date().toISOString(),
          })
          .eq('user_id', normalizedUsername)
          .eq('platform', platform)
          .select()
          .single()

        profileError = updateError
      } else {
        const { data: _insertData, error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: normalizedUsername,
            platform: platform,
            display_name: validation.userInfo?.username || displayName,
            current_rating:
              validation.userInfo?.perfs?.classical?.rating ||
              validation.userInfo?.perfs?.rapid?.rating ||
              validation.userInfo?.perfs?.blitz?.rating ||
              1200,
            total_games: games.length,
            win_rate: 0,
          })
          .select()
          .single()

        profileError = insertError
      }

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return {
          success: false,
          message: 'Failed to create user profile',
          importedGames: 0,
        }
      }

      onProgress?.({
        status: 'importing',
        message: 'Extracting and saving game data...',
        progress: 50,
        importedGames: 0,
      })

      for (const game of games) {
        try {
          const gameInfo = this.parsePGNForGameInfo(game.pgn, normalizedUsername)

          const { error: gameError } = await supabase.from('games').upsert({
            user_id: normalizedUsername,
            platform: platform,
            provider_game_id: game.id,
            result: gameInfo.result,
            color: gameInfo.color,
            time_control: gameInfo.timeControl,
            opening: gameInfo.opening,
            opening_family: gameInfo.openingFamily,
            opponent_rating: gameInfo.opponentRating,
            my_rating: gameInfo.myRating,
            played_at: gameInfo.playedAt,
            created_at: new Date().toISOString(),
          })

          if (gameError) {
            console.error(`Error saving structured data for game ${game.id}:`, gameError)
            errorCount++
            errorMessages.push(`games.upsert failed for ${game.id}: ${gameError.message ?? 'Unknown error'}`)
          } else {
            savedGames++
          }
        } catch (err) {
          console.error(`Error processing game ${game.id}:`, err)
          errorCount++
          errorMessages.push(`parse failed for ${game.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }

      if (savedGames > 0) {
        console.log(`Saving PGN data for ${savedGames} games...`)

        onProgress?.({
          status: 'importing',
          message: 'Saving PGN data to database...',
          progress: 70,
          importedGames: savedGames,
        })

        for (const game of games) {
          try {
            const { error: pgnError } = await supabase.from('games_pgn').upsert({
              user_id: normalizedUsername,
              platform: platform,
              provider_game_id: game.id,
              pgn: game.pgn,
              created_at: new Date().toISOString(),
            })

            if (pgnError) {
              console.error(`Error saving PGN for game ${game.id}:`, pgnError)
              errorMessages.push(`games_pgn.upsert failed for ${game.id}: ${pgnError.message ?? 'Unknown error'}`)
            }
          } catch (err) {
            console.error(`Error saving PGN for game ${game.id}:`, err)
            errorMessages.push(`games_pgn.upsert threw for ${game.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
          }
        }
      }

      onProgress?.({
        status: 'importing',
        message: 'Updating profile...',
        progress: 80,
        importedGames: savedGames,
      })

      const { count: totalGamesCount } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', normalizedUsername)
        .eq('platform', platform)

      const totalGames = typeof totalGamesCount === 'number' ? totalGamesCount : savedGames

      await supabase
        .from('user_profiles')
        .update({
          total_games: totalGames,
          last_accessed: new Date().toISOString(),
        })
        .eq('user_id', normalizedUsername)
        .eq('platform', platform)

      onProgress?.({
        status: 'importing',
        message: 'Starting basic analysis...',
        progress: 90,
        importedGames: savedGames,
      })

      try {
        const analysisResult = await this.triggerBasicAnalysis(normalizedUsername, platform, savedGames)
        console.log('Basic analysis result:', analysisResult)
      } catch (analysisError) {
        console.warn('Basic analysis failed, but import was successful:', analysisError)
      }

      onProgress?.({
        status: 'completed',
        message: `Successfully imported ${savedGames} games and started analysis`,
        progress: 100,
        importedGames: savedGames,
      })

      return {
        success: true,
        message: `Successfully imported ${savedGames} games and started analysis`,
        importedGames: savedGames,
        errorCount,
        errors: errorMessages,
      }
    } catch (error) {
      console.error('Error importing games:', error)
      const failureMessage = `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      errorMessages.push(failureMessage)
      onProgress?.({
        status: 'error',
        message: failureMessage,
        progress: 0,
        importedGames: 0,
      })

      return {
        success: false,
        message: failureMessage,
        importedGames: savedGames,
        errorCount,
        errors: errorMessages,
      }
    }
  }

  // Trigger basic analysis for imported games
  private static async triggerBasicAnalysis(
    username: string,
    platform: 'lichess' | 'chess.com',
    gameCount: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedUsername = normalizeUserId(username, platform)
      const response = await fetch(
        buildApiUrl('/api/v1/analyze'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: normalizedUsername,
            platform: platform,
            analysis_type: 'basic',
            limit: gameCount,
            skill_level: 8,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error triggering basic analysis:', error)
      throw error
    }
  }

  // Fetch games from platform
  private static async fetchGamesFromPlatform(
    username: string,
    platform: 'lichess' | 'chess.com',
    maxGames: number
  ): Promise<Array<{ id: string; pgn: string; date: string }>> {
    const normalizedUsername = normalizeUserId(username, platform)
    if (platform === 'lichess') {
      return await this.fetchLichessGames(normalizedUsername, maxGames)
    } else {
      return await this.fetchChessComGames(normalizedUsername, maxGames)
    }
  }

  // Fetch games from Lichess
  private static async fetchLichessGames(
    username: string,
    maxGames: number
  ): Promise<
    Array<{
      id: string
      pgn: string
      date: string
      white?: any
      black?: any
      winner?: string
      timeControl?: string
    }>
  > {
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
              date: game.createdAt || new Date().toISOString(),
              white: { username: game.players?.white?.user?.name },
              black: { username: game.players?.black?.user?.name },
              winner: game.winner,
              timeControl: game.perf || 'Unknown',
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
              const gameId = gameIdMatch
                ? gameIdMatch[1]
                : `${username}-${Date.now()}-${Math.random()}`

              // Extract date from PGN
              const dateMatch = gameBlock.match(/\[UTCDate "([^"]+)"/)
              const date = dateMatch ? dateMatch[1] : new Date().toISOString()

              console.log(`Found game ${gameId}, PGN length: ${gameBlock.length}`)
              console.log('Full PGN for this game:', gameBlock)

              games.push({
                id: gameId,
                pgn: gameBlock,
                date: date,
                white: { username: this.extractPlayerFromPGN(gameBlock, 'White') },
                black: { username: this.extractPlayerFromPGN(gameBlock, 'Black') },
                winner: this.extractResultFromPGN(gameBlock),
                timeControl: this.extractTimeControlFromPGN(gameBlock),
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
  ): Promise<
    Array<{
      id: string
      pgn: string
      date: string
      white?: any
      black?: any
      winner?: string
      timeControl?: string
    }>
  > {
    try {
      const canonicalUsername = username.trim().toLowerCase()
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
            buildApiUrl(`/proxy/chess-com/${canonicalUsername}/games/${year}/${month}`)
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
                    id: game.url?.split('/').pop() || `${canonicalUsername}-${Date.now()}-${Math.random()}`,
                    pgn: game.pgn,
                    date: game.end_time
                      ? new Date(game.end_time * 1000).toISOString()
                      : new Date().toISOString(),
                    white: { username: game.white?.username },
                    black: { username: game.black?.username },
                    winner: game.white?.result || game.black?.result,
                    timeControl: game.time_class || 'Unknown',
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
      const normalizedUsername = normalizeUserId(username, platform)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('total_games, updated_at')
        .eq('user_id', normalizedUsername)
        .eq('platform', platform)
        .single()

      if (error) {
        return { isImported: false, totalGames: 0 }
      }

      return {
        isImported: true,
        totalGames: data.total_games || 0,
        lastImportDate: data.updated_at,
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
    const normalizedUsername = normalizeUserId(username, platform)

    await supabase
      .from('game_features')
      .delete()
      .eq('user_id', normalizedUsername)
      .eq('platform', platform)

    return await this.importLast100Games(normalizedUsername, platform, onProgress)
  }

  // Parse PGN to extract game information for database storage
  private static parsePGNForGameInfo(
    pgn: string,
    username: string
  ): {
    result: string
    color: string
    timeControl: string
    opening: string
    openingFamily: string
    opponentRating: number | null
    myRating: number | null
    playedAt: string
  } {
    try {
      const canonicalUsername = username.trim().toLowerCase()

      // Extract headers from PGN
      const headers: { [key: string]: string } = {}
      const headerLines = pgn.split('\n').filter(line => line.startsWith('[') && line.endsWith(']'))

      for (const line of headerLines) {
        const match = line.match(/\[(\w+)\s+"([^"]+)"/)
        if (match) {
          headers[match[1]] = match[2]
        }
      }

      // Determine result
      let result = 'draw'
      if (headers.Result) {
        if (headers.Result === '1-0') {
          result = 'win'
        } else if (headers.Result === '0-1') {
          result = 'loss'
        }
      }

      // Determine player color
      let color = 'white'
      if ((headers.Black || '').toLowerCase() === canonicalUsername) {
        color = 'black'
        if (headers.Result === '0-1') {
          result = 'win'
        } else if (headers.Result === '1-0') {
          result = 'loss'
        }
      }

      // Extract time control
      const timeControl = headers.TimeControl || headers.Time || 'Unknown'

      // Extract opening information
      const opening = headers.Opening || 'Unknown'
      const openingFamily = this.categorizeOpening(opening)

      // Extract ratings
      const myRating =
        color === 'white'
          ? headers.WhiteElo
            ? parseInt(headers.WhiteElo)
            : null
          : headers.BlackElo
            ? parseInt(headers.BlackElo)
            : null

      const opponentRating =
        color === 'white'
          ? headers.BlackElo
            ? parseInt(headers.BlackElo)
            : null
          : headers.WhiteElo
            ? parseInt(headers.WhiteElo)
            : null

      // Extract date
      const playedAt = headers.UTCDate || headers.Date || new Date().toISOString()

      return {
        result,
        color,
        timeControl,
        opening,
        openingFamily,
        opponentRating,
        myRating,
        playedAt,
      }
    } catch (error) {
      console.error('Error parsing PGN:', error)
      // Return default values if parsing fails
      return {
        result: 'draw',
        color: 'white',
        timeControl: 'Unknown',
        opening: 'Unknown',
        openingFamily: 'Unknown',
        opponentRating: null,
        myRating: null,
        playedAt: new Date().toISOString(),
      }
    }
  }

  // Categorize opening into family
  private static categorizeOpening(opening: string): string {
    const openingLower = opening.toLowerCase()

    if (openingLower.includes('sicilian')) return 'Sicilian Defense'
    if (openingLower.includes('french')) return 'French Defense'
    if (openingLower.includes('catalan')) return 'Catalan Opening'
    if (openingLower.includes("queen's gambit") || openingLower.includes('queens gambit'))
      return "Queen's Gambit"
    if (openingLower.includes("king's indian") || openingLower.includes('kings indian'))
      return "King's Indian Defense"
    if (openingLower.includes('italian')) return 'Italian Game'
    if (openingLower.includes('english')) return 'English Opening'
    if (openingLower.includes('caro-kann')) return 'Caro-Kann Defense'
    if (openingLower.includes('pirc')) return 'Pirc Defense'
    if (openingLower.includes('dutch')) return 'Dutch Defense'
    if (openingLower.includes('nimzo-indian') || openingLower.includes('nimzo indian'))
      return 'Nimzo-Indian Defense'
    if (openingLower.includes('grünfeld') || openingLower.includes('gruenfeld'))
      return 'Grünfeld Defense'
    if (openingLower.includes('benoni')) return 'Benoni Defense'
    if (openingLower.includes('scandinavian')) return 'Scandinavian Defense'
    if (openingLower.includes('alekhine')) return 'Alekhine Defense'
    if (openingLower.includes('modern')) return 'Modern Defense'
    if (openingLower.includes('reti')) return 'Réti Opening'
    if (openingLower.includes('bird')) return 'Bird Opening'
    if (openingLower.includes('larsen')) return 'Larsen Opening'
    if (openingLower.includes('bogo-indian') || openingLower.includes('bogo indian'))
      return 'Bogo-Indian Defense'
    if (openingLower.includes("queen's indian") || openingLower.includes('queens indian'))
      return "Queen's Indian Defense"

    return 'Other'
  }

  // Helper method to extract player name from PGN
  private static extractPlayerFromPGN(pgn: string, color: 'White' | 'Black'): string | undefined {
    const match = pgn.match(new RegExp(`\\[${color}\\s+"([^"]+)"`))
    return match ? match[1] : undefined
  }

  // Helper method to extract result from PGN
  private static extractResultFromPGN(pgn: string): string | undefined {
    const match = pgn.match(/\[Result\s+"([^"]+)"/)
    return match ? match[1] : undefined
  }

  // Helper method to extract time control from PGN
  private static extractTimeControlFromPGN(pgn: string): string {
    const timeMatch = pgn.match(/\[TimeControl\s+"([^"]+)"/)
    return timeMatch ? timeMatch[1] : 'Unknown'
  }
}