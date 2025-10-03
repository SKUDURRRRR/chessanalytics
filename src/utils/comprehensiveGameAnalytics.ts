// Comprehensive Game Analytics - Single Query Analytics from Games Table
// Leverages the same principle: data is available immediately after import!

import { supabase } from '../lib/supabase'
import { getTimeControlCategory } from './timeControlUtils'
import { normalizeOpeningName } from './openingUtils'
import { OpeningIdentifierSets } from '../types'

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
  performanceTrends: {
    recentWinRate: number // Last 10 games
    recentAverageElo: number // Last 10 games
    eloTrend: 'improving' | 'declining' | 'stable'
  }
  
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
    console.log(`🔍 Getting comprehensive analytics for ${userId} on ${platform}`)
    
    // Canonicalize user ID to match backend logic
    const canonicalUserId = canonicalizeUserId(userId, platform)
    console.log(`🔍 Canonicalized user ID: "${canonicalUserId}"`)
    
    // Single query to get all games data
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', canonicalUserId)
      .eq('platform', platform)
      .not('my_rating', 'is', null)
      .order('played_at', { ascending: false })

    if (error) {
      console.error('Error fetching games for analytics:', error)
      return getEmptyAnalytics()
    }

    if (!games || games.length === 0) {
      return getEmptyAnalytics()
    }

    // Calculate all analytics from the single dataset
    return calculateAnalyticsFromGames(games)
    
  } catch (error) {
    console.error('Error getting comprehensive game analytics:', error)
    return getEmptyAnalytics()
  }
}

/**
 * Calculate analytics from games data
 */
function calculateAnalyticsFromGames(games: any[]): GameAnalytics {
  const totalGames = games.length
  
  // Basic Statistics
  const wins = games.filter(g => g.result === 'win').length
  const draws = games.filter(g => g.result === 'draw').length
  const losses = games.filter(g => g.result === 'loss').length
  
  const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0
  const drawRate = totalGames > 0 ? (draws / totalGames) * 100 : 0
  const lossRate = totalGames > 0 ? (losses / totalGames) * 100 : 0
  
  // ELO Statistics
  const elos = games.map(g => g.my_rating).filter(r => r !== null)
  const highestElo = elos.length > 0 ? Math.max(...elos) : null
  const lowestElo = elos.length > 0 ? Math.min(...elos) : null
  const currentElo = games[0]?.my_rating || null
  const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : null
  const eloRange = highestElo && lowestElo ? highestElo - lowestElo : null
  
  // Debug logging for ELO verification
  console.log('🔍 ELO Verification Debug:', {
    totalGames: games.length,
    validElos: elos.length,
    highestElo,
    lowestElo,
    currentElo,
    averageElo: averageElo?.toFixed(1),
    eloRange,
    top5Elos: elos.sort((a, b) => b - a).slice(0, 5)
  })
  
  // Find the time control where highest ELO was achieved
  const highestEloGame = games.find(g => g.my_rating === highestElo)
  const timeControlWithHighestElo = highestEloGame?.time_control || null
  
  // Time Control Analysis
  const timeControlStats = calculateTimeControlStats(games)
  
  // Opening Analysis
  const openingStats = calculateOpeningStats(games)
  
  // Opening Color Performance
  const openingColorStats = calculateOpeningColorStats(games)
  
  // Debug comparison between the two data sources
  console.log('🔍 Opening Data Comparison:', {
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
  
  return {
    totalGames,
    winRate,
    drawRate,
    lossRate,
    highestElo,
    lowestElo,
    currentElo,
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
    const opening = game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })
  
  console.log(`🏆 Opening Stats: ${validGames.length} games with valid openings out of ${games.length} total games`)
  
  const openingMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  
  validGames.forEach(game => {
    const rawOpening = game.opening_family || game.opening
    const opening = normalizeOpeningName(rawOpening)
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

  // Debug logging for winning openings calculation
  console.log('🏆 Winning Openings Debug:', {
    totalGames: games.length,
    validGames: validGames.length,
    totalOpenings: allOpenings.length,
    filteredOpenings: filteredOpenings.length,
    top10Openings: filteredOpenings.sort((a, b) => b.games - a.games).slice(0, 10).map(o => ({
      opening: o.opening,
      games: o.games,
      winRate: o.winRate.toFixed(1),
      wins: o.wins,
      losses: o.losses,
      draws: o.draws
    })),
    losingOpenings: filteredOpenings.filter(o => o.winRate < 50).length,
    losingOpeningsDetails: filteredOpenings.filter(o => o.winRate < 50).sort((a, b) => b.games - a.games).slice(0, 15).map(o => ({
      opening: o.opening,
      games: o.games,
      winRate: o.winRate.toFixed(1),
      wins: o.wins,
      losses: o.losses,
      draws: o.draws
    })),
    singleGameOpenings: allOpenings.filter(o => o.games === 1).length,
    filteredOutOpenings: allOpenings.length - filteredOpenings.length,
    gameCountDistribution: filteredOpenings.reduce((acc, o) => {
      acc[o.games] = (acc[o.games] || 0) + 1
      return acc
    }, {} as Record<number, number>)
  })

  return filteredOpenings
    .sort((a, b) => {
      // Primary sort: by win rate (descending - highest win rate first)
      // Secondary sort: by games (descending - more games first for tie-breaking)
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate
      }
      return b.games - a.games
    })
    .slice(0, 10) // Top 10 openings
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
    const opening = game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })
  
  console.log(`🎨 Opening Color Stats: ${validGames.length} games with valid openings out of ${games.length} total games`)
  
  // Separate games by color
  const whiteGames = validGames.filter(g => g.color === 'white')
  const blackGames = validGames.filter(g => g.color === 'black')
  
  // Group white games by opening (with normalized names)
  const whiteOpeningMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  whiteGames.forEach(game => {
    const rawOpening = game.opening_family || game.opening
    const normalizedOpening = normalizeOpeningName(rawOpening)
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
    const rawOpening = game.opening_family || game.opening
    const normalizedOpening = normalizeOpeningName(rawOpening)
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
    .sort((a, b) => b.winRate - a.winRate) // Sort by win rate descending

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
    .sort((a, b) => b.winRate - a.winRate) // Sort by win rate descending
  
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
} {
  const opponentRatings = games.map(g => g.opponent_rating).filter(r => r !== null)
  const playerRatings = games.map(g => g.my_rating).filter(r => r !== null)
  
  const averageOpponentRating = opponentRatings.length > 0 ? 
    opponentRatings.reduce((a, b) => a + b, 0) / opponentRatings.length : 0
  
  const highestOpponentRating = opponentRatings.length > 0 ? Math.max(...opponentRatings) : 0
  const lowestOpponentRating = opponentRatings.length > 0 ? Math.min(...opponentRatings) : 0
  
  const averagePlayerRating = playerRatings.length > 0 ? 
    playerRatings.reduce((a, b) => a + b, 0) / playerRatings.length : 0
  
  const ratingDifference = averagePlayerRating - averageOpponentRating
  
  return {
    averageOpponentRating,
    highestOpponentRating,
    lowestOpponentRating,
    ratingDifference
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
 * Calculate performance trends
 */
function calculatePerformanceTrends(games: any[]): {
  recentWinRate: number
  recentAverageElo: number
  eloTrend: 'improving' | 'declining' | 'stable'
} {
  const recentGames = games.slice(0, 10) // Last 10 games
  const recentWins = recentGames.filter(g => g.result === 'win').length
  const recentWinRate = recentGames.length > 0 ? (recentWins / recentGames.length) * 100 : 0
  
  const recentElos = recentGames.map(g => g.my_rating).filter(r => r !== null)
  const recentAverageElo = recentElos.length > 0 ? 
    recentElos.reduce((a, b) => a + b, 0) / recentElos.length : 0
  
  // Determine ELO trend
  let eloTrend: 'improving' | 'declining' | 'stable' = 'stable'
  if (games.length >= 20) {
    const firstHalf = games.slice(-20, -10).map(g => g.my_rating).filter(r => r !== null)
    const secondHalf = games.slice(-10).map(g => g.my_rating).filter(r => r !== null)
    
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
    eloTrend
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
      eloTrend: 'stable'
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
    .select('opening, opening_family, result, my_rating')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)

  if (error || !games) {
    return []
  }

  // Filter out games without proper opening names (same logic as color performance)
  const validGames = games.filter(game => {
    const opening = game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })

  const openingMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  validGames.forEach(game => {
    const rawOpening = game.opening_family || game.opening
    const normalizedOpening = normalizeOpeningName(rawOpening)
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
    .select('opening, opening_family, result, my_rating, color')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)

  if (error || !games) {
    return { white: [], black: [] }
  }

  // Filter out games without proper opening names
  const validGames = games.filter(game => {
    const opening = game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })
  
  // Separate games by color
  const whiteGames = validGames.filter(g => g.color === 'white')
  const blackGames = validGames.filter(g => g.color === 'black')
  
  // Group white games by opening (with normalized names)
  const whiteOpeningMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  whiteGames.forEach(game => {
    const rawOpening = game.opening_family || game.opening
    const normalizedOpening = normalizeOpeningName(rawOpening)
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
  const blackOpeningMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  blackGames.forEach(game => {
    const rawOpening = game.opening_family || game.opening
    const normalizedOpening = normalizeOpeningName(rawOpening)
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
    .sort((a, b) => b.winRate - a.winRate) // Sort by win rate descending
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
    .sort((a, b) => b.winRate - a.winRate) // Sort by win rate descending
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

  console.log(`🔍 getWorstOpeningPerformance: Fetched ${games.length} games for ${userId} on ${platform}`)
  
  // Add a simple data validation
  const sampleGames = games.slice(0, 5)
  console.log('🔍 Sample games data:', sampleGames.map(g => ({
    opening: g.opening,
    opening_family: g.opening_family,
    result: g.result,
    my_rating: g.my_rating
  })))

  // Filter out games without proper opening names (same logic as other functions)
  const validGames = games.filter(game => {
    const opening = game.opening_family || game.opening
    return opening && opening.trim() !== '' && opening !== 'Unknown' && opening !== 'null'
  })

  const openingMap = new Map<string, { games: any[]; openings: Set<string>; families: Set<string> }>()
  validGames.forEach(game => {
    const rawOpening = game.opening_family || game.opening
    const normalizedOpening = normalizeOpeningName(rawOpening)
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
  console.log('🔍 Opening Performance Debug (getWorstOpeningPerformance):', {
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

  // Get all losing openings (win rate < 50%) with at least 5 games and sort by worst win rate first
  let losingOpenings = allOpenings
    .filter(opening => opening.winRate < 50 && opening.games >= 5) // Apply both win rate and minimum games filter
    .sort((a, b) => {
      // Primary sort: by win rate (ascending) - lowest win rate first
      // Secondary sort: by games (descending) - more games first for tie-breaking
      if (a.winRate !== b.winRate) {
        return a.winRate - b.winRate
      }
      return b.games - a.games
    })

  console.log(`🔍 Found ${losingOpenings.length} losing openings, showing top ${Math.min(limit, losingOpenings.length)}`)

  // If we have very few losing openings, also include some worst performers by win rate
  if (losingOpenings.length < 3) {
    console.log('🔍 Very few losing openings, including worst performers by win rate...')
    
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

// Recent Performance
export async function getRecentPerformance(
  userId: string,
  platform: 'lichess' | 'chess.com',
  games: number = 10
): Promise<{ winRate: number; averageElo: number; trend: 'improving' | 'declining' | 'stable' }> {
  const { data: recentGames, error } = await supabase
    .from('games')
    .select('result, my_rating, played_at')
    .eq('user_id', userId.toLowerCase())
    .eq('platform', platform)
    .not('my_rating', 'is', null)
    .order('played_at', { ascending: false })
    .limit(games)

  if (error || !recentGames || recentGames.length === 0) {
    return { winRate: 0, averageElo: 0, trend: 'stable' }
  }

  const wins = recentGames.filter(g => g.result === 'win').length
  const winRate = (wins / recentGames.length) * 100

  const elos = recentGames.map(g => g.my_rating).filter(r => r !== null)
  const averageElo = elos.length > 0 ? elos.reduce((a, b) => a + b, 0) / elos.length : 0

  // Simple trend calculation
  let trend: 'improving' | 'declining' | 'stable' = 'stable'
  if (recentGames.length >= 6) {
    const firstHalf = recentGames.slice(-6, -3).map(g => g.my_rating).filter(r => r !== null)
    const secondHalf = recentGames.slice(-3).map(g => g.my_rating).filter(r => r !== null)

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

  return { winRate, averageElo, trend }
}
