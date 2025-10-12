// @ts-nocheck
// Player statistics utilities
import { supabase } from '../lib/supabase'
import { Game } from '../types'
import { getTimeControlCategory } from './timeControlUtils'
// Removed PgnReprocessingService import - functionality moved to unified service

/**
 * Get the highest ELO rating and the time control where it was achieved
 * This function ensures we get the player's actual highest ELO, not opponent ELO
 * Optimized for performance with large datasets
 */
export async function getHighestEloAndTimeControl(
  userId: string, 
  platform: 'lichess' | 'chess.com'
): Promise<{
  highestElo: number | null
  timeControlWithHighestElo: string | null
  validationIssues?: string[]
}> {
  try {
    console.log(`DEBUG: Querying games for userId="${userId.toLowerCase()}" on platform="${platform}"`)
    
    // For large datasets, use a more efficient approach
    // First, get just the highest ELO game with minimal data
    const { data: topGames, error: topError } = await supabase
      .from('games')
      .select('my_rating, time_control, provider_game_id')
      .eq('user_id', userId.toLowerCase())
      .eq('platform', platform)
      .not('my_rating', 'is', null)
      .order('my_rating', { ascending: false })
      .limit(1)

    if (topError || !topGames || topGames.length === 0) {
      console.error('Error fetching highest ELO game:', topError)
      return { highestElo: null, timeControlWithHighestElo: null }
    }
    
    const topGame = topGames[0]

    // Quick validation
    const validationIssues: string[] = []
    
    if (topGame.my_rating < 100 || topGame.my_rating > 4000) {
      validationIssues.push(`Invalid player rating ${topGame.my_rating} in game ${topGame.provider_game_id}`)
    }

    // If validation passes, return the result
    if (validationIssues.length === 0) {
      return {
        highestElo: topGame.my_rating,
        timeControlWithHighestElo: normalizeTimeControl(topGame.time_control),
        validationIssues: undefined
      }
    }

    // If there are validation issues, fall back to the old method for detailed validation
    console.warn(`Validation issues found, falling back to detailed validation for user ${userId}`)
    return await getHighestEloAndTimeControlDetailed(userId, platform)

  } catch (error) {
    console.error('Error getting highest ELO and time control:', error)
    return { highestElo: null, timeControlWithHighestElo: null }
  }
}

/**
 * Detailed validation method for ELO data (fallback for validation issues)
 * This method is more thorough but slower for large datasets
 */
async function getHighestEloAndTimeControlDetailed(
  userId: string, 
  platform: 'lichess' | 'chess.com'
): Promise<{
  highestElo: number | null
  timeControlWithHighestElo: string | null
  validationIssues?: string[]
}> {
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('my_rating, opponent_rating, time_control, played_at, color, provider_game_id')
      .eq('user_id', userId.toLowerCase())
      .eq('platform', platform)
      .not('my_rating', 'is', null)
      .not('time_control', 'is', null)
      .order('my_rating', { ascending: false })
      .limit(1000) // Limit for performance

    if (error) {
      console.error('Error fetching games for detailed ELO validation:', error)
      return { highestElo: null, timeControlWithHighestElo: null }
    }

    if (!games || games.length === 0) {
      return { highestElo: null, timeControlWithHighestElo: null }
    }

    // Validate data quality and find highest rating
    let highestElo = 0
    let timeControlWithHighestElo = ''
    const validationIssues: string[] = []
    
    games.forEach((game, index) => {
      // Skip invalid data
      if (!game.my_rating || !game.time_control) {
        validationIssues.push(`Game ${game.provider_game_id}: Missing rating or time control`)
        return
      }
      
      // Validate ELO range
      if (game.my_rating < 100 || game.my_rating > 4000) {
        validationIssues.push(`Game ${game.provider_game_id}: Invalid player rating ${game.my_rating}`)
        return
      }
      
      // Validate opponent ELO range
      if (game.opponent_rating && (game.opponent_rating < 100 || game.opponent_rating > 4000)) {
        validationIssues.push(`Game ${game.provider_game_id}: Invalid opponent rating ${game.opponent_rating}`)
      }
      
      // Check for potential data corruption (player rating much higher than opponent)
      if (game.opponent_rating && game.my_rating > game.opponent_rating + 1000) {
        validationIssues.push(`Game ${game.provider_game_id}: Suspicious rating difference (player: ${game.my_rating}, opponent: ${game.opponent_rating})`)
      }
      
      if (game.my_rating > highestElo) {
        highestElo = game.my_rating
        timeControlWithHighestElo = normalizeTimeControl(game.time_control)
      }
    })

    // If we have validation issues, log them but still return the result
    if (validationIssues.length > 0) {
      console.warn(`ELO validation issues found for user ${userId}:`, validationIssues)
    }

    return {
      highestElo: highestElo > 0 ? highestElo : null,
      timeControlWithHighestElo: timeControlWithHighestElo || null,
      validationIssues: validationIssues.length > 0 ? validationIssues : undefined
    }
  } catch (error) {
    console.error('Error in detailed ELO validation:', error)
    return { highestElo: null, timeControlWithHighestElo: null }
  }
}

/**
 * Normalize time control strings to consistent format
 * Now returns the categorized time control (Bullet, Blitz, Rapid, Classical)
 */
function normalizeTimeControl(timeControl: string): string {
  if (!timeControl || timeControl === 'Unknown') {
    return 'Unknown'
  }
  
  // Use the time control categorization logic to get consistent display names
  return getTimeControlCategory(timeControl)
}

/**
 * Get most played time control for a user
 */
async function getMostPlayedTimeControl(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<string | null> {
  try {
    const { data: games, error } = await supabase
      .from('games')
      .select('time_control')
      .eq('user_id', userId.toLowerCase())
      .eq('platform', platform)
      .not('time_control', 'is', null)

    if (error || !games || games.length === 0) {
      return null
    }

    // Count time control occurrences
    const timeControlCounts = games.reduce((acc, game) => {
      const tc = game.time_control || 'Unknown'
      acc[tc] = (acc[tc] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Find the most played time control
    const mostPlayed = Object.entries(timeControlCounts).reduce((a, b) => 
      timeControlCounts[a[0]] > timeControlCounts[b[0]] ? a : b, ['Unknown', 0])

    return normalizeTimeControl(mostPlayed[0])
  } catch (error) {
    console.error('Error getting most played time control:', error)
    return null
  }
}

/**
 * Get highest ELO rating and the time control where it was achieved
 * Now uses the optimized approach by default for all players
 */
export async function getPlayerStats(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<{
  currentRating: number | null
  mostPlayedTimeControl: string | null
  validationIssues?: string[]
}> {
  // Use the optimized approach by default - get time control where highest ELO was achieved
  const { highestElo, timeControlWithHighestElo, validationIssues } = await getHighestEloAndTimeControl(userId, platform)

  return {
    currentRating: highestElo,
    mostPlayedTimeControl: timeControlWithHighestElo, // This is actually the time control with highest ELO
    validationIssues
  }
}

/**
 * Validate and fix ELO data for a user
 * This function can be called to ensure data integrity
 */
export async function validateAndFixEloData(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<{
  validationResult: any
  reprocessingResult?: any
  needsReprocessing: boolean
}> {
  try {
    // First, validate existing data
    const validationResult = await PgnReprocessingService.validateUserEloData(userId, platform)
    
    // If we have issues, offer to reprocess
    const needsReprocessing = validationResult.invalidGames > 0
    
    let reprocessingResult = null
    if (needsReprocessing) {
      console.log(`Found ${validationResult.invalidGames} invalid games for user ${userId}. Reprocessing recommended.`)
      // Note: We don't automatically reprocess here to avoid side effects
      // The caller can decide whether to call reprocessUserPgnData
    }
    
    return {
      validationResult,
      reprocessingResult,
      needsReprocessing
    }
  } catch (error) {
    console.error('Error validating ELO data:', error)
    throw error
  }
}
