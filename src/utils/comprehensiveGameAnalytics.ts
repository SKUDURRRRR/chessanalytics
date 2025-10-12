// @ts-nocheck
// Comprehensive Game Analytics - Single Query Analytics from Games Table
// Leverages the same principle: data is available immediately after import!

import { supabase } from '../lib/supabase'
import { getTimeControlCategory } from './timeControlUtils'
import { getOpeningNameWithFallback } from './openingIdentification'
import { OpeningIdentifierSets } from '../types'
import { shouldCountOpeningForColor } from './openingColorClassification'

export interface GameAnalytics {
  // Basic Statistics
  totalGames: number
  winRate: number
  drawRate: number
  lossRate: number
  
  // ELO Statistics
  highestElo: number | null
  lowestElo: number | null
  currentElo: number | null
  currentEloPerTimeControl: Record<string, number>
  averageElo: number | null
  eloRange: number | null
  timeControlWithHighestElo: string | null
  
  // Time Control Analysis
  timeControlStats: Array<{
    timeControl: string
    games: number
    winRate: number
    averageElo: number
    highestElo: number
  }>
  
  // Opening Analysis
  openingStats: Array<{
    opening: string
    openingFamily: string
    games: number
    winRate: number
    averageElo: number
    identifiers: OpeningIdentifierSets
  }>
  
  // Opening Color Performance
  openingColorStats: {
    white: Array<{
      opening: string
      winRate: number
      games: number
      wins: number
      losses: number
      draws: number
      rawOpenings: string[]
    }>
    black: Array<{
      opening: string
      winRate: number
      games: number
      wins: number
      losses: number
      draws: number
      rawOpenings: string[]
    }>
  }
  
  // Color Performance
  colorStats: {
    white: { games: number; winRate: number; averageElo: number }
    black: { games: number; winRate: number; averageElo: number }
  }
  
  // Opponent Analysis
  opponentStats: {
    averageOpponentRating: number
    highestOpponentRating: number
    lowestOpponentRating: number
    ratingDifference: number // Average difference between player and opponent
    highestOpponentGame: {
      opponentRating: number
      opponentName?: string
      result: 'win' | 'loss' | 'draw'
      gameId: string
      playedAt: string
      opening?: string
      totalMoves?: number
      color?: 'white' | 'black'
      accuracy?: number
    } | null
    highestOpponentWin: {
      opponentRating: number
      opponentName?: string
      result: 'win'
      gameId: string
      playedAt: string
      opening?: string
      totalMoves?: number
      color?: 'white' | 'black'
      accuracy?: number
    } | null
    toughestOpponents: Array<{
      opponentRating: number
      opponentName?: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      recentGameId: string
      recentGameDate: string
    }>
    favoriteOpponents: Array<{
      opponentRating: number
      opponentName?: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      recentGameId: string
      recentGameDate: string
    }>
    ratingRangeStats: Array<{
      range: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      averageOpponentRating: number
    }>
  }
  
  // Temporal Analysis
  temporalStats: {
    firstGame: string | null
    lastGame: string | null
    gamesThisMonth: number
    gamesThisWeek: number
    averageGamesPerDay: number
  }
  
  // Performance Trends
  performanceTrends: PerformanceTrendsOverview
  
  // Game Length Analysis
  gameLengthStats: {
    averageGameLength: number
    shortestGame: number
    longestGame: number
    quickVictories: number // Games with < 20 moves
    longGames: number // Games with > 60 moves
  }
}

/**
 * Get the most played opening for a specific time control
 */
export async function getMostPlayedOpeningForTimeControl(
  userId: string,
  platform: 'lichess' | 'chess.com',
  timeControl: string
): Promise<{ opening: string; games: number } | null> {
  try {
    const canonicalUserId = canonicalizeUserId(userId, platform)
    
    // Import time control utility to filter by category
    const { getTimeControlCategory } = await import('./timeControlUtils')
    
    // Fetch all games with time_control and opening data
    const { data: games, error } = await supabase
      .from('games')
      .select('opening, opening_family, opening_normalized, time_control')
      .eq('user_id', canonicalUserId)
      .eq('platform', platform)
      .not('time_control', 'is', null)
    
    if (error || !games || games.length === 0) {
      return null
    }
    
    // Filter games by time control category (e.g., "Blitz" matches "3+0", "5+0", etc.)
    const filteredGames = games.filter(game => 
      getTimeControlCategory(game.time_control) === timeControl
    )
    
    if (filteredGames.length === 0) {
      return null
    }
    
    // Count openings
    const openingCounts = new Map<string, number>()
    
    for (const game of filteredGames) {
      const openingName = getOpeningNameWithFallback(
        game.opening_normalized || game.opening || game.opening_family,
        game  // Pass the full game object
      )
      
      // IMPORTANT: Only count openings that the player actually plays
      // Skip if this is an opponent's opening (e.g., skip Caro-Kann when player played white)
      if (!shouldCountOpeningForColor(openingName, game.color)) {
        continue // Skip this game - it's the opponent's opening choice
      }
      
      const count = openingCounts.get(openingName) || 0
      openingCounts.set(openingName, count + 1)
    }
    
    // Find the most played opening
    let mostPlayed: { opening: string; games: number } | null = null
    
    for (const [opening, games] of openingCounts.entries()) {
      if (!mostPlayed || games > mostPlayed.games) {
        mostPlayed = { opening, games }
      }
    }
    
    return mostPlayed
  } catch (error) {
    console.error('Error getting most played opening for time control:', error)
    return null
  }
}

/**
 * Get comprehensive game analytics with single queries
 * All data comes from the games table - no analysis required!
 */
// Canonicalize user ID to match backend logic
function canonicalizeUserId(userId: string, platform: string): string {
  if (platform === 'chess.com') {
    return userId.trim().toLowerCase()
  } else { // lichess
    return userId.trim()
  }
}

export async function getComprehensiveGameAnalytics(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<GameAnalytics> {
  try {
    console.log(`Getting comprehensive analytics for ${userId} on ${platform}`)
    
    // Canonicalize user ID to match backend logic
    const canonicalUserId = canonicalizeUserId(userId, platform)
    console.log(`Canonicalized user ID: "${canonicalUserId}"`)
    
    // First, get the total count of games
    const { count: totalGamesCount, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', canonicalUserId)
      .eq('platform', platform)
      .not('my_rating', 'is', null)

    if (countError) {
      console.error('Error getting games count:', countError)
      return getEmptyAnalytics()
    }

    console.log(`Total games in database: ${totalGamesCount}`)

    // Try to fetch all games by using a very high limit and range queries
    let allGames: any[] = []
    let offset = 0
    const batchSize = 1000
    let hasMore = true
    
    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', canonicalUserId)
        .eq('platform', platform)
        .not('my_rating', 'is', null)
        .order('played_at', { ascending: false })
        .range(offset, offset + batchSize - 1)
      
      if (error) {
        console.error('Error fetching games batch:', error)
        break
      }
      
      if (!batch || batch.length === 0) {
        hasMore = false
      } else {
        allGames = allGames.concat(batch)
        offset += batchSize
        
        // If we got fewer games than the batch size, we've reached the end
        if (batch.length < batchSize) {
          hasMore = false
        }
        
        console.log(`Fetched batch: ${batch.length} games (total so far: ${allGames.length})`)
      }
    }
    
    const games = allGames

    if (!games || games.length === 0) {
      return getEmptyAnalytics()
    }

    console.log(`Fetched ${games.length} games for analytics (total in DB: ${totalGamesCount})`)

    // Calculate all analytics from the single dataset
    return calculateAnalyticsFromGames(games, totalGamesCount)
    
  } catch (error) {
    console.error('Error getting comprehensive game analytics:', error)
    return getEmptyAnalytics()
  }
}

/**
 * Calculate analytics from games data
 */
function calculateAnalyticsFromGames(games: any[], actualTotalCount?: number): GameAnalytics {
  const totalGames = actualTotalCount || games.length
  
  // Debug logging for total games calculation
  console.log('Total Games Calculation Debug:', {
    actualTotalCount,
    gamesLength: games.length,
    finalTotalGames: totalGames,
    usingActualCount: actualTotalCount !== undefined
  })
  
  // Basic Statistics
  const wins = games.filter(g => g.result === 'win').length
  const draws = games.filter(g => g.result === 'draw').length
  const losses = games.filter(g => g.result === 'loss').length
  
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0
  const drawRate = totalGames > 0 ? (draws / totalGames) * 100 : 0
  const lossRate = totalGames > 0 ? (losses / totalGames) * 100 : 0
  
  // ELO Statistics
  // Only filter out games with 'null' string literal (actual corruption)
  // Keep everything else including "-" which may be correspondence games
  const validGamesForElo = games.filter(g => 
    g.time_control !== 'null' &&
    g.my_rating !== null &&
    g.my_rating > 0 &&
    g.my_rating < 4000  // Sanity check for valid ratings
  )
  
  const elos = validGamesForElo.map(g => g.my_rating)
  const highestElo = elos.length > 0 ? Math.max(...elos) : null
  const lowestElo = elos.length > 0 ? Math.min(...elos) : null
  const currentElo = games[0]?.my_rating || null
  const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : null
  const eloRange = highestElo && lowestElo ? highestElo - lowestElo : null
  
  // Calculate current ELO per time control category
  const currentEloPerTimeControl: Record<string, number> = {}
  const timeControlGames = validGamesForElo.reduce((acc, game) => {
    const tc = getTimeControlCategory(game.time_control || 'Unknown')
    if (!acc[tc]) acc[tc] = []
    acc[tc].push(game)
    return acc
  }, {} as Record<string, any[]>)

  for (const [tc, tcGames] of Object.entries(timeControlGames)) {
    const validRatings = tcGames
      .filter(g => g.my_rating && g.my_rating > 0)
      .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
    if (validRatings.length > 0) {
      currentEloPerTimeControl[tc] = validRatings[0].my_rating
    }
  }
  
  // Debug: Log highest ELO calculation and check for correspondence games
  const correspondenceGames = validGamesForElo.filter(g => {
    const tc = g.time_control?.toLowerCase() || ''
    return tc.includes('/') || tc === '' || tc === '-' || tc.includes('correspondence') || tc.includes('days')
  })
  
  const highRatingGames = validGamesForElo
    .filter(g => g.my_rating >= 1600)
    .sort((a, b) => b.my_rating - a.my_rating)
    .slice(0, 10)  // Show top 10 instead of 5
    .map(g => ({
      rating: g.my_rating,
      timeControl: g.time_control,
      playedAt: g.played_at?.substring(0, 10),  // Just date
      gameId: g.provider_game_id,
      opponentRating: g.opponent_rating
    }))
  
  console.log('ELO Statistics Debug:', {
    totalGames: games.length,
    validGamesForElo: validGamesForElo.length,
    filteredOut: games.length - validGamesForElo.length,
    totalElos: elos.length,
    highestElo,
    lowestElo,
    currentElo,
    averageElo,
    correspondenceGamesFound: correspondenceGames.length,
    dashTimeControlGames: games.filter(g => g.time_control === '-').length,
    top10HighRatingGames: highRatingGames,
    sampleElos: elos.slice(0, 10)
  })
  
  // Find the time control where highest ELO was achieved (from valid games only)
  const highestEloGame = validGamesForElo.find(g => g.my_rating === highestElo)
  const timeControlWithHighestElo = highestEloGame?.time_control || null
  
  // Debug: Log highest ELO game details
  if (highestEloGame) {
    console.log('Highest ELO Game Found:', {
      rating: highestEloGame.my_rating,
      timeControl: highestEloGame.time_control,
      playedAt: highestEloGame.played_at,
      gameId: highestEloGame.provider_game_id,
      opponentRating: highestEloGame.opponent_rating
    })
  }
  
  // Time Control Analysis
  const timeControlStats = calculateTimeControlStats(games)
  
  // Opening Analysis
  const openingStats = calculateOpeningStats(games)
  
  // Opening Color Performance
  const openingColorStats = calculateOpeningColorStats(games)
  
  // Debug comparison between the two data sources
  console.log('Opening Data Comparison:', {
    mainOpeningStats: {
      totalOpenings: openingStats.length,
      top3: openingStats.slice(0, 3).map(o => ({ opening: o.opening, games: o.games, winRate: o.winRate }))
    },
    colorStats: {
      whiteOpenings: openingColorStats.white.length,
      blackOpenings: openingColorStats.black.length,
      totalColorOpenings: openingColorStats.white.length + openingColorStats.black.length,
      topWhite: openingColorStats.white.slice(0, 3).map(o => ({ opening: o.opening, games: o.games, winRate: o.winRate })),
      topBlack: openingColorStats.black.slice(0, 3).map(o => ({ opening: o.opening, games: o.games, winRate: o.winRate }))
    }
  })
  
  // Color Performance
  const colorStats = calculateColorStats(games)
  
  // Opponent Analysis
  const opponentStats = calculateOpponentStats(games)
  
  // Temporal Analysis
  const temporalStats = calculateTemporalStats(games)
  
  // Performance Trends
  const performanceTrends = calculatePerformanceTrends(games)
  
  // Game Length Analysis
  const gameLengthStats = calculateGameLengthStats(games)
  
  const result = {
    totalGames,
    winRate,
    drawRate,
    lossRate,
    highestElo,
    lowestElo,
    currentElo,
    currentEloPerTimeControl,
    averageElo,
    eloRange,
    timeControlWithHighestElo,
    timeControlStats,
    openingStats,
    openingColorStats,
    colorStats,
    opponentStats,
    temporalStats,
    performanceTrends,
    gameLengthStats
  }
  
  console.log('Comprehensive analytics result:', {
    totalGames: result.totalGames,
    winRate: result.winRate,
    drawRate: result.drawRate,
    lossRate: result.lossRate,
    highestElo: result.highestElo,
    lowestElo: result.lowestElo,
    currentElo: result.currentElo,
    averageElo: result.averageElo,
    eloRange: result.eloRange
  })
  
  return result
}

/**
 * Calculate time control statistics
 */
function calculateTimeControlStats(games: any[]): Array<{
  timeControl: string
  games: number
  winRate: number
  averageElo: number
  highestElo: number
}> {
  const timeControlMap = new Map<string, any[]>()
  
  games.forEach(game => {
    const tc = game.time_control || 'Unknown'
    const tcCategory = getTimeControlCategory(tc)
    if (!timeControlMap.has(tcCategory)) {
      timeControlMap.set(tcCategory, [])
    }
    timeControlMap.get(tcCategory)!.push(game)
  })
  
  return Array.from(timeControlMap.entries()).map(([timeControl, tcGames]) => {
    const wins = tcGames.filter(g => g.result === 'win').length
    const winRate = tcGames.length > 0 ? (wins / tcGames.length) * 100 : 0
    const elos = tcGames.map(g => g.my_rating).filter(r => r !== null)
    const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0
    const highestElo = elos.length > 0 ? Math.max(...elos) : 0
    
    return {
      timeControl,
      games: tcGames.length,
      winRate,
      averageElo,
      highestElo
    }
  }).sort((a, b) => b.games - a.games)
}

/**
 * Calculate opening statistics
 * Now uses the same filtering logic as color performance for consistency
 */
function calculateOpeningStats(games: any[]): Array<{
  opening: string
  openingFamily: string
  games: number
  winRate: number
  averageElo: number
  identifiers: OpeningIdentifierSets
}> {
  // Filter out games without proper opening names (same logic as color performance)
  const validGames = games.filter(game => {
    const opening = game.opening_normalized || game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })
  
  console.log(`Opening Stats: ${validGames.length} games with valid openings out of ${games.length} total games`)
  
  const openingMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  
  validGames.forEach(game => {
    // Use opening_normalized first (which has consolidated opening names)
    const rawOpening = game.opening_normalized || game.opening_family || game.opening
    const opening = getOpeningNameWithFallback(rawOpening, game)
    
    // IMPORTANT: Only count openings that the player actually plays
    // Skip if this is an opponent's opening (e.g., skip Caro-Kann when player played white)
    if (!shouldCountOpeningForColor(opening, game.color)) {
      return // Skip this game - it's the opponent's opening choice
    }
    
    if (!openingMap.has(opening)) {
      openingMap.set(opening, { games: [], openings: new Set(), families: new Set() })
    }
    const entry = openingMap.get(opening)!
    entry.games.push(game)
    if (game.opening) {
      entry.openings.add(game.opening)
    }
    if (game.opening_family) {
      entry.families.add(game.opening_family)
    }
  })
  
  const allOpenings = Array.from(openingMap.entries()).map(([opening, details]) => {
    const openingGames = details.games
    const wins = openingGames.filter(g => g.result === 'win').length
    const losses = openingGames.filter(g => g.result === 'loss').length
    const draws = openingGames.filter(g => g.result === 'draw').length
    const winRate = openingGames.length > 0 ? (wins / openingGames.length) * 100 : 0
    const elos = openingGames.map(g => g.my_rating).filter(r => r !== null)
    const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0
    
    return {
      opening,
      openingFamily: openingGames[0]?.opening_family || 'Unknown',
      games: openingGames.length,
      winRate,
      averageElo,
      wins,
      losses,
      draws,
      identifiers: {
        openingFamilies: Array.from(details.families).filter(Boolean) as string[],
        openings: Array.from(details.openings).filter(Boolean) as string[]
      }
    }
  })

  // Apply minimum game filter for statistical validity (5+ games)
  const filteredOpenings = allOpenings.filter(opening => opening.games >= 5)

  // Filter for winning openings (win rate >= 50%)
  const winningOpenings = filteredOpenings.filter(opening => opening.winRate >= 50)

  // Debug logging for winning openings calculation
  console.log('Winning Openings Debug:', {
    totalGames: games.length,
    validGames: validGames.length,
    totalOpenings: allOpenings.length,
    filteredOpenings: filteredOpenings.length,
    winningOpenings: winningOpenings.length,
    top10WinningOpenings: winningOpenings.sort((a, b) => b.games - a.games).slice(0, 10).map(o => ({
      opening: o.opening,
      games: o.games,
      winRate: o.winRate.toFixed(1),
      wins: o.wins,
      losses: o.losses,
      draws: o.draws
    })),
    losingOpenings: filteredOpenings.filter(o => o.winRate < 50).length,
    losingOpeningsDetails: filteredOpenings.filter(o => o.winRate < 50).sort((a, b) => b.games - a.games).slice(0, 10).map(o => ({
      opening: o.opening,
      games: o.games,
      winRate: o.winRate.toFixed(1),
      wins: o.wins,
      losses: o.losses,
      draws: o.draws
    }))
  })

  // Return winning openings (>= 50% win rate) sorted by most-played
  return winningOpenings
    .sort((a, b) => {
      // Sort by games descending - most played winning openings first
      return b.games - a.games
    })
    .slice(0, 10) // Top 10 most-played winning openings
}

/**
 * Calculate opening performance by color (white vs black)
 */
function calculateOpeningColorStats(games: any[]): {
    white: Array<{
      opening: string
      winRate: number
      games: number
      wins: number
      losses: number
      draws: number
      identifiers: OpeningIdentifierSets
    }>
    black: Array<{
      opening: string
      winRate: number
      games: number
      wins: number
      losses: number
      draws: number
      identifiers: OpeningIdentifierSets
    }>
} {
  // Filter out games without proper opening names and normalize them
  const validGames = games.filter(game => {
    const opening = game.opening_normalized || game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })
  
  console.log(`Opening Color Stats: ${validGames.length} games with valid openings out of ${games.length} total games`)
  
  // Separate games by color
  const whiteGames = validGames.filter(g => g.color === 'white')
  const blackGames = validGames.filter(g => g.color === 'black')
  
  // Group white games by opening (with normalized names)
  // IMPORTANT: Only count openings that belong to white (not black defenses)
  const whiteOpeningMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  whiteGames.forEach(game => {
    // Use opening_normalized first (which has consolidated opening names)
    const rawOpening = game.opening_normalized || game.opening_family || game.opening
    const normalizedOpening = getOpeningNameWithFallback(rawOpening, game)
    
    // Filter: Only include if this opening belongs to white
    // (e.g., exclude "Caro-Kann" when player played white against it)
    if (!shouldCountOpeningForColor(normalizedOpening, 'white')) {
      return // Skip this game for white opening stats
    }
    
    if (!whiteOpeningMap.has(normalizedOpening)) {
      whiteOpeningMap.set(normalizedOpening, { games: [], openings: new Set(), families: new Set() })
    }
    const entry = whiteOpeningMap.get(normalizedOpening)!
    entry.games.push(game)
    if (game.opening) {
      entry.openings.add(game.opening)
    }
    if (game.opening_family) {
      entry.families.add(game.opening_family)
    }
  })

  const blackOpeningMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  blackGames.forEach(game => {
    // Use opening_normalized first (which has consolidated opening names)
    const rawOpening = game.opening_normalized || game.opening_family || game.opening
    const normalizedOpening = getOpeningNameWithFallback(rawOpening, game)
    
    // Filter: Only include if this opening belongs to black
    // (e.g., exclude "Italian Game" when player played black against it)
    if (!shouldCountOpeningForColor(normalizedOpening, 'black')) {
      return // Skip this game for black opening stats
    }
    
    if (!blackOpeningMap.has(normalizedOpening)) {
      blackOpeningMap.set(normalizedOpening, { games: [], openings: new Set(), families: new Set() })
    }
    const entry = blackOpeningMap.get(normalizedOpening)!
    entry.games.push(game)
    if (game.opening) {
      entry.openings.add(game.opening)
    }
    if (game.opening_family) {
      entry.families.add(game.opening_family)
    }
  })

  const whiteStats = Array.from(whiteOpeningMap.entries()).map(([opening, details]) => {
    const openingGames = details.games
    const wins = openingGames.filter(g => g.result === 'win').length
    const losses = openingGames.filter(g => g.result === 'loss').length
    const draws = openingGames.filter(g => g.result === 'draw').length
    const winRate = openingGames.length > 0 ? (wins / openingGames.length) * 100 : 0

    return {
      opening,
      winRate,
      games: openingGames.length,
      wins,
      losses,
      draws,
      identifiers: {
        openingFamilies: Array.from(details.families).filter(Boolean) as string[],
        openings: Array.from(details.openings).filter(Boolean) as string[]
      }
    }
  }).filter(stat => stat.games >= 5) // Only include openings with at least 5 games for statistical validity
    .sort((a, b) => b.games - a.games) // Sort by games descending - most played first

  const blackStats = Array.from(blackOpeningMap.entries()).map(([opening, details]) => {
    const openingGames = details.games
    const wins = openingGames.filter(g => g.result === 'win').length
    const losses = openingGames.filter(g => g.result === 'loss').length
    const draws = openingGames.filter(g => g.result === 'draw').length
    const winRate = openingGames.length > 0 ? (wins / openingGames.length) * 100 : 0

    return {
      opening,
      winRate,
      games: openingGames.length,
      wins,
      losses,
      draws,
      identifiers: {
        openingFamilies: Array.from(details.families).filter(Boolean) as string[],
        openings: Array.from(details.openings).filter(Boolean) as string[]
      }
    }
  }).filter(stat => stat.games >= 5) // Only include openings with at least 5 games for statistical validity
    .sort((a, b) => b.games - a.games) // Sort by games descending - most played first
  
  return {
    white: whiteStats,
    black: blackStats
  }
}

/**
 * Calculate color performance statistics
 */
function calculateColorStats(games: any[]): {
  white: { games: number; winRate: number; averageElo: number }
  black: { games: number; winRate: number; averageElo: number }
} {
  const whiteGames = games.filter(g => g.color === 'white')
  const blackGames = games.filter(g => g.color === 'black')
  
  const whiteWins = whiteGames.filter(g => g.result === 'win').length
  const blackWins = blackGames.filter(g => g.result === 'win').length
  
  const whiteWinRate = whiteGames.length > 0 ? (whiteWins / whiteGames.length) * 100 : 0
  const blackWinRate = blackGames.length > 0 ? (blackWins / blackGames.length) * 100 : 0
  
  const whiteElos = whiteGames.map(g => g.my_rating).filter(r => r !== null)
  const blackElos = blackGames.map(g => g.my_rating).filter(r => r !== null)
  
  const whiteAverageElo = whiteElos.length > 0 ? whiteElos.reduce((a, b) => a + b, 0) / whiteElos.length : 0
  const blackAverageElo = blackElos.length > 0 ? blackElos.reduce((a, b) => a + b, 0) / blackElos.length : 0
  
  return {
    white: {
      games: whiteGames.length,
      winRate: whiteWinRate,
      averageElo: whiteAverageElo
    },
    black: {
      games: blackGames.length,
      winRate: blackWinRate,
      averageElo: blackAverageElo
    }
  }
}

/**
 * Calculate opponent statistics
 */
function calculateOpponentStats(games: any[]): {
  averageOpponentRating: number
  highestOpponentRating: number
  lowestOpponentRating: number
  ratingDifference: number
  highestOpponentGame: {
    opponentRating: number
    opponentName?: string
    result: 'win' | 'loss' | 'draw'
    gameId: string
    playedAt: string
    opening?: string
    totalMoves?: number
    color?: 'white' | 'black'
    accuracy?: number
  } | null
  highestOpponentWin: {
    opponentRating: number
    opponentName?: string
    result: 'win'
    gameId: string
    playedAt: string
    opening?: string
    totalMoves?: number
    color?: 'white' | 'black'
    accuracy?: number
  } | null
  toughestOpponents: Array<{
    opponentRating: number
    opponentName?: string
    games: number
    wins: number
    losses: number
    draws: number
    winRate: number
    recentGameId: string
    recentGameDate: string
  }>
  favoriteOpponents: Array<{
    opponentRating: number
    opponentName?: string
    games: number
    wins: number
    losses: number
    draws: number
    winRate: number
    recentGameId: string
    recentGameDate: string
  }>
  ratingRangeStats: Array<{
    range: string
    games: number
    wins: number
    losses: number
    draws: number
    winRate: number
    averageOpponentRating: number
  }>
} {
  const validGames = games.filter(g => g.opponent_rating !== null && g.my_rating !== null)
  
  if (validGames.length === 0) {
    return {
      averageOpponentRating: 0,
      highestOpponentRating: 0,
      lowestOpponentRating: 0,
      ratingDifference: 0,
      highestOpponentGame: null,
      highestOpponentWin: null,
      toughestOpponents: [],
      favoriteOpponents: [],
      ratingRangeStats: []
    }
  }

  const opponentRatings = validGames.map(g => g.opponent_rating)
  const playerRatings = validGames.map(g => g.my_rating)
  
  const averageOpponentRating = opponentRatings.reduce((a, b) => a + b, 0) / opponentRatings.length
  const highestOpponentRating = Math.max(...opponentRatings)
  const lowestOpponentRating = Math.min(...opponentRatings)
  const averagePlayerRating = playerRatings.reduce((a, b) => a + b, 0) / playerRatings.length
  const ratingDifference = averagePlayerRating - averageOpponentRating

  // Find the game against the highest rated opponent
  const highestOpponentGame = validGames
    .filter(g => g.opponent_rating === highestOpponentRating)
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())[0] || null

  const highestOpponentGameData = highestOpponentGame ? {
    opponentRating: highestOpponentGame.opponent_rating,
    opponentName: highestOpponentGame.opponent_name,
    result: highestOpponentGame.result,
    gameId: highestOpponentGame.provider_game_id,
    playedAt: highestOpponentGame.played_at,
    opening: getOpeningNameWithFallback(highestOpponentGame.opening_normalized || highestOpponentGame.opening_family || highestOpponentGame.opening || 'Unknown'),
    totalMoves: highestOpponentGame.total_moves,
    color: highestOpponentGame.color,
    accuracy: highestOpponentGame.accuracy
  } : null

  // Find the highest rated opponent that the player won against
  const highestOpponentWin = validGames
    .filter(g => g.result === 'win')
    .sort((a, b) => b.opponent_rating - a.opponent_rating)[0] || null

  const highestOpponentWinData = highestOpponentWin ? {
    opponentRating: highestOpponentWin.opponent_rating,
    opponentName: highestOpponentWin.opponent_name,
    result: 'win' as const,
    gameId: highestOpponentWin.provider_game_id,
    playedAt: highestOpponentWin.played_at,
    opening: getOpeningNameWithFallback(highestOpponentWin.opening_normalized || highestOpponentWin.opening_family || highestOpponentWin.opening || 'Unknown'),
    totalMoves: highestOpponentWin.total_moves,
    color: highestOpponentWin.color,
    accuracy: highestOpponentWin.accuracy
  } : null

  // Group games by opponent rating (rounded to nearest 50 for grouping)
  const opponentGroups = new Map<string, any[]>()
  validGames.forEach(game => {
    // Group by opponent name if available, otherwise by rating
    const groupKey = game.opponent_name || `rating_${Math.round(game.opponent_rating / 50) * 50}`
    if (!opponentGroups.has(groupKey)) {
      opponentGroups.set(groupKey, [])
    }
    opponentGroups.get(groupKey)!.push(game)
  })

  // Calculate stats for each opponent group
  const opponentStats = Array.from(opponentGroups.entries()).map(([groupKey, games]) => {
    const wins = games.filter(g => g.result === 'win').length
    const losses = games.filter(g => g.result === 'loss').length
    const draws = games.filter(g => g.result === 'draw').length
    const winRate = (wins / games.length) * 100
    
    // Get most recent game for this opponent group
    const recentGame = games.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())[0]
    
    // Determine if this is grouped by name or rating
    const isGroupedByName = groupKey.startsWith('rating_') === false
    const opponentName = isGroupedByName ? groupKey : undefined
    const opponentRating = isGroupedByName ? recentGame.opponent_rating : parseInt(groupKey.replace('rating_', ''))
    
    return {
      opponentRating,
      opponentName,
      games: games.length,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 10) / 10,
      recentGameId: recentGame.provider_game_id,
      recentGameDate: recentGame.played_at
    }
  })

  // Sort by win rate to find toughest and favorite opponents
  // For toughest opponents, we want negative win rates (struggling against them)
  let toughestOpponents = []
  let gameThreshold = 10
  
  // Try to find opponents with negative win rates, starting with 10+ games
  while (toughestOpponents.length < 3 && gameThreshold >= 1) {
    toughestOpponents = opponentStats
      .filter(stat => stat.games >= gameThreshold && stat.winRate <= 49) // Negative win rate (49% or lower)
      .sort((a, b) => b.games - a.games) // Sort by most games first, then by worst win rate
      .slice(0, 3)
    
    if (toughestOpponents.length < 3) {
      gameThreshold-- // Lower the threshold if we don't have enough opponents
    }
  }

  // For favorite opponents, we want positive win rates (doing well against them)
  let favoriteOpponents = []
  gameThreshold = 10
  
  // Try to find opponents with positive win rates, starting with 10+ games
  while (favoriteOpponents.length < 3 && gameThreshold >= 1) {
    favoriteOpponents = opponentStats
      .filter(stat => stat.games >= gameThreshold && stat.winRate >= 51) // Positive win rate (51% or higher)
      .sort((a, b) => b.games - a.games) // Sort by most games first, then by best win rate
      .slice(0, 3)
    
    if (favoriteOpponents.length < 3) {
      gameThreshold-- // Lower the threshold if we don't have enough opponents
    }
  }

  // Rating range statistics
  const ratingRanges = [
    { min: 0, max: 800, label: 'Beginner (0-800)' },
    { min: 801, max: 1200, label: 'Novice (801-1200)' },
    { min: 1201, max: 1600, label: 'Intermediate (1201-1600)' },
    { min: 1601, max: 2000, label: 'Advanced (1601-2000)' },
    { min: 2001, max: 2400, label: 'Expert (2001-2400)' },
    { min: 2401, max: 3000, label: 'Master+ (2401+)' }
  ]

  const ratingRangeStats = ratingRanges.map(range => {
    const rangeGames = validGames.filter(g => 
      g.opponent_rating >= range.min && g.opponent_rating <= range.max
    )
    
    if (rangeGames.length === 0) return null
    
    const wins = rangeGames.filter(g => g.result === 'win').length
    const losses = rangeGames.filter(g => g.result === 'loss').length
    const draws = rangeGames.filter(g => g.result === 'draw').length
    const winRate = (wins / rangeGames.length) * 100
    const averageOpponentRating = rangeGames.reduce((sum, g) => sum + g.opponent_rating, 0) / rangeGames.length
    
    return {
      range: range.label,
      games: rangeGames.length,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 10) / 10,
      averageOpponentRating: Math.round(averageOpponentRating)
    }
  }).filter(Boolean) as Array<{
    range: string
    games: number
    wins: number
    losses: number
    draws: number
    winRate: number
    averageOpponentRating: number
  }>

  return {
    averageOpponentRating: Math.round(averageOpponentRating),
    highestOpponentRating,
    lowestOpponentRating,
    ratingDifference: Math.round(ratingDifference),
    highestOpponentGame: highestOpponentGameData,
    highestOpponentWin: highestOpponentWinData,
    toughestOpponents,
    favoriteOpponents,
    ratingRangeStats
  }
}

/**
 * Calculate temporal statistics
 */
function calculateTemporalStats(games: any[]): {
  firstGame: string | null
  lastGame: string | null
  gamesThisMonth: number
  gamesThisWeek: number
  averageGamesPerDay: number
} {
  const sortedGames = games.sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime())
  
  const firstGame = sortedGames[0]?.played_at || null
  const lastGame = sortedGames[sortedGames.length - 1]?.played_at || null
  
  const now = new Date()
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  
  const gamesThisMonth = games.filter(g => new Date(g.played_at) >= oneMonthAgo).length
  const gamesThisWeek = games.filter(g => new Date(g.played_at) >= oneWeekAgo).length
  
  // Calculate average games per day
  let averageGamesPerDay = 0
  if (firstGame && lastGame) {
    const daysDiff = (new Date(lastGame).getTime() - new Date(firstGame).getTime()) / (1000 * 60 * 60 * 24)
    averageGamesPerDay = daysDiff > 0 ? games.length / daysDiff : 0
  }
  
  return {
    firstGame,
    lastGame,
    gamesThisMonth,
    gamesThisWeek,
    averageGamesPerDay
  }
}

/**
 * Calculate performance trends - time control specific like ELO graph
 */
export interface PerformanceTrendSummary {
  recentWinRate: number
  recentAverageElo: number
  eloTrend: 'improving' | 'declining' | 'stable'
  sampleSize: number
}

export interface PerformanceTrendsOverview extends PerformanceTrendSummary {
  timeControlUsed: string
  totalGamesConsidered: number
  perTimeControl: Record<string, PerformanceTrendSummary>
}

function calculatePerformanceTrends(games: any[]): PerformanceTrendsOverview {
  // Find the most played time control (same logic as ELO graph)
  const timeControlCounts = games.reduce((acc, game) => {
    const tc = getTimeControlCategory(game.time_control || 'Unknown')
    acc[tc] = (acc[tc] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const mostPlayedTimeControl = Object.entries(timeControlCounts).reduce((a, b) => 
    timeControlCounts[a[0]] > timeControlCounts[b[0]] ? a : b, ['Unknown', 0])[0]

  // Filter games by the most played time control (same as ELO graph)
  const byTimeControl = games.reduce((acc, game) => {
    const category = getTimeControlCategory(game.time_control || 'Unknown')
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(game)
    return acc
  }, {} as Record<string, any[]>)

  const perTimeControl: Record<string, PerformanceTrendSummary> = {}

  Object.entries(byTimeControl).forEach(([category, categoryGames]) => {
    const sortedGames = categoryGames
      .slice()
      .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())

    // Use same sample size as ELO trend graph (50 games, then processed)
    const recentGamesForCategory = sortedGames.slice(0, 50)
    const winsForCategory = recentGamesForCategory.filter(g => g.result === 'win').length
    const recentWinRateForCategory = recentGamesForCategory.length > 0
      ? (winsForCategory / recentGamesForCategory.length) * 100
      : 0

    const recentElosForCategory = recentGamesForCategory
      .map(g => g.my_rating)
      .filter(r => r !== null)
    const recentAverageEloForCategory = recentElosForCategory.length > 0
      ? recentElosForCategory.reduce((a, b) => a + b, 0) / recentElosForCategory.length
      : 0

    let eloTrendForCategory: 'improving' | 'declining' | 'stable' = 'stable'
    if (sortedGames.length >= 40) {
      const firstHalf = sortedGames.slice(-40, -20).map(g => g.my_rating).filter(r => r !== null)
      const secondHalf = sortedGames.slice(-20).map(g => g.my_rating).filter(r => r !== null)

      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

        if (secondHalfAvg > firstHalfAvg + 10) {
          eloTrendForCategory = 'improving'
        } else if (secondHalfAvg < firstHalfAvg - 10) {
          eloTrendForCategory = 'declining'
        }
      }
    }

    perTimeControl[category] = {
      recentWinRate: recentWinRateForCategory,
      recentAverageElo: recentAverageEloForCategory,
      eloTrend: eloTrendForCategory,
      sampleSize: recentGamesForCategory.length
    }
  })

  const filteredGames = byTimeControl[mostPlayedTimeControl]?.slice().sort(
    (a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()
  ) || []

  // Use same sample size as ELO trend graph (50 games)
  const recentGames = filteredGames.slice(0, 50)
  const recentWins = recentGames.filter(g => g.result === 'win').length
  const recentWinRate = recentGames.length > 0 ? (recentWins / recentGames.length) * 100 : 0
  
  const recentElos = recentGames.map(g => g.my_rating).filter(r => r !== null)
  const recentAverageElo = recentElos.length > 0 ? 
    recentElos.reduce((a, b) => a + b, 0) / recentElos.length : 0
  
  // Determine ELO trend using the filtered games
  let eloTrend: 'improving' | 'declining' | 'stable' = 'stable'
  if (filteredGames.length >= 40) {
    const firstHalf = filteredGames.slice(-40, -20).map(g => g.my_rating).filter(r => r !== null)
    const secondHalf = filteredGames.slice(-20).map(g => g.my_rating).filter(r => r !== null)
    
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      
      if (secondHalfAvg > firstHalfAvg + 10) {
        eloTrend = 'improving'
      } else if (secondHalfAvg < firstHalfAvg - 10) {
        eloTrend = 'declining'
      }
    }
  }
  
  return {
    recentWinRate,
    recentAverageElo,
    eloTrend,
    timeControlUsed: mostPlayedTimeControl,
    sampleSize: recentGames.length,
    totalGamesConsidered: filteredGames.length,
    perTimeControl
  }
}

/**
 * Calculate game length statistics
 */
function calculateGameLengthStats(games: any[]): {
  averageGameLength: number
  shortestGame: number
  longestGame: number
  quickVictories: number
  longGames: number
} {
  const gameLengths = games.map(g => g.total_moves).filter(m => m !== null && m > 0)
  
  const averageGameLength = gameLengths.length > 0 ? 
    gameLengths.reduce((a, b) => a + b, 0) / gameLengths.length : 0
  
  const shortestGame = gameLengths.length > 0 ? Math.min(...gameLengths) : 0
  const longestGame = gameLengths.length > 0 ? Math.max(...gameLengths) : 0
  
  const quickVictories = games.filter(g => g.total_moves && g.total_moves < 20 && g.result === 'win').length
  const longGames = games.filter(g => g.total_moves && g.total_moves > 60).length
  
  return {
    averageGameLength,
    shortestGame,
    longestGame,
    quickVictories,
    longGames
  }
}

/**
 * Get empty analytics for error cases
 */
function getEmptyAnalytics(): GameAnalytics {
  return {
    totalGames: 0,
    winRate: 0,
    drawRate: 0,
    lossRate: 0,
    highestElo: null,
    lowestElo: null,
    currentElo: null,
    currentEloPerTimeControl: {},
    averageElo: null,
    eloRange: null,
    timeControlWithHighestElo: null,
    timeControlStats: [],
    openingStats: [],
    openingColorStats: {
      white: [],
      black: []
    },
    colorStats: {
      white: { games: 0, winRate: 0, averageElo: 0 },
      black: { games: 0, winRate: 0, averageElo: 0 }
    },
    opponentStats: {
      averageOpponentRating: 0,
      highestOpponentRating: 0,
      lowestOpponentRating: 0,
      ratingDifference: 0
    },
    temporalStats: {
      firstGame: null,
      lastGame: null,
      gamesThisMonth: 0,
      gamesThisWeek: 0,
      averageGamesPerDay: 0
    },
    performanceTrends: {
      recentWinRate: 0,
      recentAverageElo: 0,
      eloTrend: 'stable',
      timeControlUsed: 'Unknown',
      sampleSize: 0,
      totalGamesConsidered: 0,
      perTimeControl: {}
    },
    gameLengthStats: {
      averageGameLength: 0,
      shortestGame: 0,
      longestGame: 0,
      quickVictories: 0,
      longGames: 0
    }
  }
}

/**
 * Get specific analytics with single queries
 */

// Win Rate Analysis
export async function getWinRateAnalysis(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<{ winRate: number; totalGames: number; wins: number; draws: number; losses: number }> {
  const { data: games, error } = await supabase
    .from('games')
    .select('result')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)

  if (error || !games) {
    return { winRate: 0, totalGames: 0, wins: 0, draws: 0, losses: 0 }
  }

  const wins = games.filter(g => g.result === 'win').length
  const draws = games.filter(g => g.result === 'draw').length
  const losses = games.filter(g => g.result === 'loss').length
  const totalGames = games.length
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0

  return { winRate, totalGames, wins, draws, losses }
}

// Opening Performance
export async function getOpeningPerformance(
  userId: string,
  platform: 'lichess' | 'chess.com',
  limit: number = 10
): Promise<
  Array<{
    opening: string
    games: number
    winRate: number
    averageElo: number
    identifiers: OpeningIdentifierSets
  }>
> {
  const { data: games, error } = await supabase
    .from('games')
    .select('opening, opening_family, opening_normalized, result, my_rating')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)

  if (error || !games) {
    return []
  }

  // Filter out games without proper opening names (same logic as color performance)
  const validGames = games.filter(game => {
    const opening = game.opening_normalized || game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })

  const openingMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  validGames.forEach(game => {
    const rawOpening = game.opening_normalized || game.opening_family || game.opening
    const normalizedOpening = getOpeningNameWithFallback(rawOpening, game)
    if (!openingMap.has(normalizedOpening)) {
      openingMap.set(normalizedOpening, { games: [], openings: new Set(), families: new Set() })
    }
    const entry = openingMap.get(normalizedOpening)!
    entry.games.push(game)
    if (game.opening) {
      entry.openings.add(game.opening)
    }
    if (game.opening_family) {
      entry.families.add(game.opening_family)
    }
  })

  return Array.from(openingMap.entries())
    .map(([opening, details]) => {
      const openingGames = details.games
      const wins = openingGames.filter(g => g.result === 'win').length
      const winRate = openingGames.length > 0 ? (wins / openingGames.length) * 100 : 0
      const elos = openingGames.map(g => g.my_rating).filter(r => r !== null)
      const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0

      return {
        opening,
        games: openingGames.length,
        winRate,
        averageElo,
        identifiers: {
          openingFamilies: Array.from(details.families).filter(Boolean) as string[],
          openings: Array.from(details.openings).filter(Boolean) as string[]
        }
      }
    })
    .filter(opening => opening.games >= 5) // Apply minimum game filter for statistical validity
    .sort((a, b) => {
      // Primary sort: by win rate (descending - highest win rate first)
      // Secondary sort: by games (descending - more games first for tie-breaking)
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate
      }
      return b.games - a.games
    })
    .slice(0, limit)
}

// Opening Color Performance
export async function getOpeningColorPerformance(
  userId: string,
  platform: 'lichess' | 'chess.com',
  limit: number = 5
): Promise<{
  white: Array<{
    opening: string
    winRate: number
    games: number
    wins: number
    losses: number
    draws: number
    identifiers: OpeningIdentifierSets
  }>
  black: Array<{
    opening: string
    winRate: number
    games: number
    wins: number
    losses: number
    draws: number
    identifiers: OpeningIdentifierSets
  }>
}> {
  const { data: games, error } = await supabase
    .from('games')
    .select('opening, opening_family, opening_normalized, result, my_rating, color')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)

  if (error || !games) {
    return { white: [], black: [] }
  }

  // Filter out games without proper opening names
  const validGames = games.filter(game => {
    const opening = game.opening_normalized || game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })
  
  // Separate games by color
  const whiteGames = validGames.filter(g => g.color === 'white')
  const blackGames = validGames.filter(g => g.color === 'black')
  
  // Group white games by opening (with normalized names)
  // IMPORTANT: Only count openings that belong to white (not black defenses)
  const whiteOpeningMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  whiteGames.forEach(game => {
    const rawOpening = game.opening_normalized || game.opening_family || game.opening
    const normalizedOpening = getOpeningNameWithFallback(rawOpening, game)
    
    // Filter: Only include if this opening belongs to white
    // (e.g., exclude "Caro-Kann" when player played white against it)
    if (!shouldCountOpeningForColor(normalizedOpening, 'white')) {
      return // Skip this game for white opening stats
    }
    
    if (!whiteOpeningMap.has(normalizedOpening)) {
      whiteOpeningMap.set(normalizedOpening, { games: [], openings: new Set(), families: new Set() })
    }
    const entry = whiteOpeningMap.get(normalizedOpening)!
    entry.games.push(game)
    if (game.opening) {
      entry.openings.add(game.opening)
    }
    if (game.opening_family) {
      entry.families.add(game.opening_family)
    }
  })
  
  // Group black games by opening (with normalized names)
  // IMPORTANT: Only count openings that belong to black (not white attacks)
  const blackOpeningMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  blackGames.forEach(game => {
    const rawOpening = game.opening_normalized || game.opening_family || game.opening
    const normalizedOpening = getOpeningNameWithFallback(rawOpening, game)
    
    // Filter: Only include if this opening belongs to black
    // (e.g., exclude "Italian Game" when player played black against it)
    if (!shouldCountOpeningForColor(normalizedOpening, 'black')) {
      return // Skip this game for black opening stats
    }
    
    if (!blackOpeningMap.has(normalizedOpening)) {
      blackOpeningMap.set(normalizedOpening, { games: [], openings: new Set(), families: new Set() })
    }
    const entry = blackOpeningMap.get(normalizedOpening)!
    entry.games.push(game)
    if (game.opening) {
      entry.openings.add(game.opening)
    }
    if (game.opening_family) {
      entry.families.add(game.opening_family)
    }
  })
  
  // Calculate white opening stats
  const whiteStats = Array.from(whiteOpeningMap.entries()).map(([opening, details]) => {
    const openingGames = details.games
    const wins = openingGames.filter(g => g.result === 'win').length
    const losses = openingGames.filter(g => g.result === 'loss').length
    const draws = openingGames.filter(g => g.result === 'draw').length
    const winRate = openingGames.length > 0 ? (wins / openingGames.length) * 100 : 0
    
    return {
      opening,
      winRate,
      games: openingGames.length,
      wins,
      losses,
      draws,
      identifiers: {
        openingFamilies: Array.from(details.families).filter(Boolean) as string[],
        openings: Array.from(details.openings).filter(Boolean) as string[]
      }
    }
  }).filter(stat => stat.games >= 5) // Only include openings with at least 5 games for statistical validity
    .sort((a, b) => b.games - a.games) // Sort by games descending - most played first
    .slice(0, limit)
  
  // Calculate black opening stats
  const blackStats = Array.from(blackOpeningMap.entries()).map(([opening, details]) => {
    const openingGames = details.games
    const wins = openingGames.filter(g => g.result === 'win').length
    const losses = openingGames.filter(g => g.result === 'loss').length
    const draws = openingGames.filter(g => g.result === 'draw').length
    const winRate = openingGames.length > 0 ? (wins / openingGames.length) * 100 : 0
    
    return {
      opening,
      winRate,
      games: openingGames.length,
      wins,
      losses,
      draws,
      identifiers: {
        openingFamilies: Array.from(details.families).filter(Boolean) as string[],
        openings: Array.from(details.openings).filter(Boolean) as string[]
      }
    }
  }).filter(stat => stat.games >= 5) // Only include openings with at least 5 games for statistical validity
    .sort((a, b) => b.games - a.games) // Sort by games descending - most played first
    .slice(0, limit)
  
  return {
    white: whiteStats,
    black: blackStats
  }
}

// Worst Opening Performance (Losing Openings)
export async function getWorstOpeningPerformance(
  userId: string,
  platform: 'lichess' | 'chess.com',
  limit: number = 10
): Promise<Array<{ opening: string; games: number; winRate: number; averageElo: number }>> {
  // Use the same data fetching approach as getComprehensiveGameAnalytics
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)
    .not('my_rating', 'is', null)
    .order('played_at', { ascending: false })

  if (error || !games) {
    console.error('Error fetching games for worst opening performance:', error)
    return []
  }

  console.log(`getWorstOpeningPerformance: Fetched ${games.length} games for ${userId} on ${platform}`)
  
  // Add a simple data validation
  const sampleGames = games.slice(0, 5)
  console.log('Sample games data:', sampleGames.map(g => ({
    opening: g.opening,
    opening_family: g.opening_family,
    result: g.result,
    my_rating: g.my_rating
  })))

  // Filter out games without proper opening names (same logic as other functions)
  const validGames = games.filter(game => {
    const opening = game.opening_normalized || game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })

  const openingMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  validGames.forEach(game => {
    const rawOpening = game.opening_normalized || game.opening_family || game.opening
    const normalizedOpening = getOpeningNameWithFallback(rawOpening, game)
    
    // IMPORTANT: Only count openings that the player actually plays
    // Skip if this is an opponent's opening (e.g., skip Caro-Kann when player played white)
    if (!shouldCountOpeningForColor(normalizedOpening, game.color)) {
      return // Skip this game - it's the opponent's opening choice
    }
    
    if (!openingMap.has(normalizedOpening)) {
      openingMap.set(normalizedOpening, { games: [], openings: new Set(), families: new Set() })
    }
    const entry = openingMap.get(normalizedOpening)!
    entry.games.push(game)
    if (game.opening) {
      entry.openings.add(game.opening)
    }
    if (game.opening_family) {
      entry.families.add(game.opening_family)
    }
  })

  const allOpenings = Array.from(openingMap.entries()).map(([opening, openingData]) => {
    const openingGames = openingData.games
    const wins = openingGames.filter(g => g.result === 'win').length
    const losses = openingGames.filter(g => g.result === 'loss').length
    const draws = openingGames.filter(g => g.result === 'draw').length
    const winRate = openingGames.length > 0 ? (wins / openingGames.length) * 100 : 0
    const elos = openingGames.map(g => g.my_rating).filter(r => r !== null)
    const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0

    return {
      opening,
      games: openingGames.length,
      winRate,
      averageElo,
      wins,
      losses,
      draws,
      identifiers: {
        openingFamilies: Array.from(openingGames[0]?.opening_family ? [openingGames[0].opening_family] : []).filter(Boolean) as string[],
        openings: Array.from(openingGames.map(g => g.opening).filter(Boolean)).filter(Boolean) as string[]
      }
    }
  })

  // Debug logging to understand the distribution
  console.log('Opening Performance Debug (getWorstOpeningPerformance):', {
    totalGames: games.length,
    validGames: validGames.length,
    totalOpenings: allOpenings.length,
    allOpeningsSorted: allOpenings.sort((a, b) => b.games - a.games).slice(0, 15).map(o => ({
      opening: o.opening,
      games: o.games,
      winRate: o.winRate.toFixed(1),
      wins: o.wins || 'N/A',
      losses: o.losses || 'N/A',
      draws: o.draws || 'N/A'
    })),
    openingsByGameCount: allOpenings.reduce((acc, o) => {
      acc[o.games] = (acc[o.games] || 0) + 1
      return acc
    }, {} as Record<number, number>),
    losingOpenings: allOpenings.filter(o => o.winRate < 50).length,
    losingOpeningsWith5PlusGames: allOpenings.filter(o => o.winRate < 50 && o.games >= 5).length,
    losingOpeningsByGameCount: allOpenings.filter(o => o.winRate < 50).reduce((acc, o) => {
      acc[o.games] = (acc[o.games] || 0) + 1
      return acc
    }, {} as Record<number, number>),
    topLosingOpenings: allOpenings.filter(o => o.winRate < 50 && o.games >= 5).sort((a, b) => b.games - a.games).slice(0, 15).map(o => ({
      opening: o.opening,
      games: o.games,
      winRate: o.winRate.toFixed(1),
      wins: o.wins || 'N/A',
      losses: o.losses || 'N/A',
      draws: o.draws || 'N/A'
    }))
  })

  // Get all losing openings (win rate < 50%) with at least 5 games and sort by most-played
  let losingOpenings = allOpenings
    .filter(opening => opening.winRate < 50 && opening.games >= 5) // Apply both win rate and minimum games filter
    .sort((a, b) => {
      // Sort by games descending - most played losing openings first
      // This ensures frequently-played losing openings appear instead of rare low-win-rate openings
      return b.games - a.games
    })

  console.log(`Found ${losingOpenings.length} losing openings, showing top ${Math.min(limit, losingOpenings.length)} most-played`)

  // If we have very few losing openings, also include some worst performers by win rate
  if (losingOpenings.length < 3) {
    console.log('Very few losing openings, including worst performers by win rate...')
    
    const worstPerformers = allOpenings
      .filter(opening => opening.games >= 5) // At least 5 games for statistical significance
      .sort((a, b) => {
        // Sort by win rate first (ascending - worst first), then by games
        if (a.winRate !== b.winRate) {
          return a.winRate - b.winRate
        }
        return b.games - a.games
      })
      .slice(0, 3) // Get top 3 worst performers
    
    // Combine losing openings with worst performers, removing duplicates
    const combined = [...losingOpenings]
    worstPerformers.forEach(worst => {
      if (!combined.find(losing => losing.opening === worst.opening)) {
        combined.push(worst)
      }
    })
    
    losingOpenings = combined.slice(0, limit)
  }

  return losingOpenings.slice(0, limit)
    .map(opening => ({
      opening: opening.opening,
      games: opening.games,
      winRate: opening.winRate,
      averageElo: opening.averageElo,
      identifiers: opening.identifiers,
    }))
}

// Time Control Performance
export async function getTimeControlPerformance(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<Array<{ timeControl: string; games: number; winRate: number; averageElo: number }>> {
  const { data: games, error } = await supabase
    .from('games')
    .select('time_control, result, my_rating')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)
    .not('time_control', 'is', null)

  if (error || !games) {
    return []
  }

  const timeControlMap = new Map<string, any[]>()
  games.forEach(game => {
    const tc = game.time_control || 'Unknown'
    if (!timeControlMap.has(tc)) {
      timeControlMap.set(tc, [])
    }
    timeControlMap.get(tc)!.push(game)
  })

  return Array.from(timeControlMap.entries()).map(([timeControl, tcGames]) => {
    const wins = tcGames.filter(g => g.result === 'win').length
    const winRate = tcGames.length > 0 ? (wins / tcGames.length) * 100 : 0
    const elos = tcGames.map(g => g.my_rating).filter(r => r !== null)
    const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0

    return { timeControl, games: tcGames.length, winRate, averageElo }
  }).sort((a, b) => b.games - a.games)
}

// Color Performance
export async function getColorPerformance(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<{ white: { games: number; winRate: number }; black: { games: number; winRate: number } }> {
  const { data: games, error } = await supabase
    .from('games')
    .select('color, result')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)
    .not('color', 'is', null)

  if (error || !games) {
    return { white: { games: 0, winRate: 0 }, black: { games: 0, winRate: 0 } }
  }

  const whiteGames = games.filter(g => g.color === 'white')
  const blackGames = games.filter(g => g.color === 'black')

  const whiteWins = whiteGames.filter(g => g.result === 'win').length
  const blackWins = blackGames.filter(g => g.result === 'win').length

  const whiteWinRate = whiteGames.length > 0 ? (whiteWins / whiteGames.length) * 100 : 0
  const blackWinRate = blackGames.length > 0 ? (blackWins / blackGames.length) * 100 : 0

  return {
    white: { games: whiteGames.length, winRate: whiteWinRate },
    black: { games: blackGames.length, winRate: blackWinRate }
  }
}

// Recent Performance - time control specific
export async function getRecentPerformance(
  userId: string,
  platform: 'lichess' | 'chess.com',
  games: number = 10
): Promise<{ winRate: number; averageElo: number; trend: 'improving' | 'declining' | 'stable'; timeControlUsed: string }> {
  // First get all games to find most played time control
  const { data: allGames, error: allGamesError } = await supabase
    .from('games')
    .select('time_control, my_rating, played_at, result')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)
    .not('my_rating', 'is', null)
    .not('time_control', 'is', null)
    .order('played_at', { ascending: true })

  if (allGamesError || !allGames || allGames.length === 0) {
    return { winRate: 0, averageElo: 0, trend: 'stable', timeControlUsed: 'Unknown' }
  }

  // Find the most played time control
  const timeControlCounts = allGames.reduce((acc, game) => {
    const tc = getTimeControlCategory(game.time_control || 'Unknown')
    acc[tc] = (acc[tc] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const mostPlayedTimeControl = Object.entries(timeControlCounts).reduce((a, b) => 
    timeControlCounts[a[0]] > timeControlCounts[b[0]] ? a : b, ['Unknown', 0])[0]

  // Filter games by the most played time control and get recent games
  const filteredGames = allGames
    .filter(game => {
      const gameTimeControl = getTimeControlCategory(game.time_control || 'Unknown')
      return gameTimeControl === mostPlayedTimeControl
    })
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
    .slice(0, games)

  if (filteredGames.length === 0) {
    return { winRate: 0, averageElo: 0, trend: 'stable', timeControlUsed: mostPlayedTimeControl }
  }

  const wins = filteredGames.filter(g => g.result === 'win').length
  const winRate = (wins / filteredGames.length) * 100

  const elos = filteredGames.map(g => g.my_rating).filter(r => r !== null)
  const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0

  // Simple trend calculation
  let trend: 'improving' | 'declining' | 'stable' = 'stable'
  if (filteredGames.length >= 6) {
    const firstHalf = filteredGames.slice(-6, -3).map(g => g.my_rating).filter(r => r !== null)
    const secondHalf = filteredGames.slice(-3).map(g => g.my_rating).filter(r => r !== null)

    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length

      if (secondHalfAvg > firstHalfAvg + 10) {
        trend = 'improving'
      } else if (secondHalfAvg < firstHalfAvg - 10) {
        trend = 'declining'
      }
    }
  }

  return { winRate, averageElo, trend, timeControlUsed: mostPlayedTimeControl }
}
