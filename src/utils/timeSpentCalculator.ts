/**
 * Time Spent Calculator
 * Calculates total time a player has spent playing chess based on game data
 */

import { parseTimeControl } from './timeControlUtils'
import type { Game } from '../types'

export interface TimeSpentStats {
  totalTimeSeconds: number
  totalTimeFormatted: string
  breakdown: {
    hours: number
    minutes: number
    seconds: number
  }
  byTimeControl: Array<{
    category: string
    totalTimeSeconds: number
    totalTimeFormatted: string
    gameCount: number
    averageGameDuration: number
  }>
  estimatedActualTime: {
    totalTimeSeconds: number
    totalTimeFormatted: string
    description: string
  }
  longestGame: {
    estimatedDurationSeconds: number
    estimatedDurationFormatted: string
    gameId: string
    timeControl: string
    totalMoves: number
  } | null
  shortestGame: {
    estimatedDurationSeconds: number
    estimatedDurationFormatted: string
    gameId: string
    timeControl: string
    totalMoves: number
  } | null
}

/**
 * Format seconds into a human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds === 0) return '0 seconds'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`)
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`)
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`)
  if (secs > 0 && parts.length < 2) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`)

  return parts.join(', ')
}

/**
 * Estimate actual game duration based on time control and moves
 * This accounts for the fact that not all the allocated time is used
 */
function estimateActualGameDuration(
  timeControl: string,
  totalMoves: number | undefined
): number {
  const tcInfo = parseTimeControl(timeControl)

  // For correspondence games, estimate based on moves (assume ~1 hour per game on average)
  if (tcInfo.category === 'correspondence') {
    return 3600 // 1 hour estimated
  }

  // For unknown/invalid time controls, estimate based on typical game
  if (tcInfo.category === 'unknown' || !timeControl || timeControl === 'unknown') {
    // Estimate 10 minutes per game if we can't determine time control
    return 600
  }

  // Parse time control to get base time and increment
  let baseTime = 0
  let increment = 0

  if (timeControl.includes('+')) {
    const [base, inc] = timeControl.split('+').map(Number)
    if (!isNaN(base) && !isNaN(inc)) {
      // Determine if base is in seconds or minutes
      if (base >= 60 && base % 60 === 0 && base <= 1800) {
        baseTime = base // already in seconds
        increment = inc
      } else if (base <= 30) {
        baseTime = base * 60 // convert minutes to seconds
        increment = inc
      } else {
        baseTime = base
        increment = inc
      }
    }
  } else {
    // Just a number
    const base = Number(timeControl)
    if (!isNaN(base)) {
      if (base >= 60 && base % 60 === 0 && base <= 1800) {
        baseTime = base
      } else if (base <= 30) {
        baseTime = base * 60
      } else {
        baseTime = base
      }
    }
  }

  // If we couldn't parse but have category info, use that
  if (baseTime === 0 && tcInfo.totalTime > 0) {
    baseTime = tcInfo.totalTime
  }

  // If still no base time, estimate based on category
  if (baseTime === 0) {
    // Fallback estimates by category
    switch (tcInfo.category) {
      case 'bullet': baseTime = 120; break  // 2 min
      case 'blitz': baseTime = 300; break   // 5 min
      case 'rapid': baseTime = 600; break   // 10 min
      case 'classical': baseTime = 1800; break // 30 min
      default: baseTime = 600; break        // 10 min default
    }
  }

  // If we don't have move count, estimate based on typical game length
  if (!totalMoves || totalMoves === 0) {
    // Estimate typical number of moves by category
    const estimatedMoves = tcInfo.category === 'bullet' ? 30 :
                          tcInfo.category === 'blitz' ? 40 :
                          tcInfo.category === 'rapid' ? 40 : 50
    totalMoves = estimatedMoves
  }

  // Each player makes roughly half the moves
  const playerMoves = Math.ceil(totalMoves / 2)

  // Lichess calculates time as: base time + (increment × moves made)
  // This represents the actual time available/used in the game
  // No usage factor - we count the full allocated time as Lichess does
  const estimatedTime = baseTime + increment * playerMoves

  return estimatedTime
}

/**
 * Calculate maximum possible time for a game (theoretical maximum)
 */
function calculateMaxGameTime(
  timeControl: string,
  totalMoves: number | undefined
): number {
  const tcInfo = parseTimeControl(timeControl)

  if (tcInfo.category === 'correspondence') {
    // For correspondence, estimate based on typical game length
    return 86400 // 1 day
  }

  if (!totalMoves || totalMoves === 0) {
    return tcInfo.totalTime
  }

  // Parse increment
  let baseTime = tcInfo.totalTime
  let increment = 0

  if (timeControl.includes('+')) {
    const parts = timeControl.split('+')
    if (parts.length === 2) {
      increment = Number(parts[1]) || 0
    }
  }

  // Maximum time = base + (increment × player's half of moves)
  const playerMoves = Math.ceil(totalMoves / 2)
  return baseTime + increment * playerMoves
}

/**
 * Calculate total time spent playing chess
 */
export function calculateTimeSpent(games: Game[]): TimeSpentStats {
  if (!games || games.length === 0) {
    return {
      totalTimeSeconds: 0,
      totalTimeFormatted: '0 seconds',
      breakdown: { hours: 0, minutes: 0, seconds: 0 },
      byTimeControl: [],
      estimatedActualTime: {
        totalTimeSeconds: 0,
        totalTimeFormatted: '0 seconds',
        description: 'No games found'
      },
      longestGame: null,
      shortestGame: null
    }
  }

  let totalMaxTimeSeconds = 0
  let totalEstimatedActualTimeSeconds = 0
  const timeControlMap = new Map<string, {
    maxTime: number
    estimatedTime: number
    games: number
  }>()

  let longestGame: { duration: number; game: Game } | null = null
  let shortestGame: { duration: number; game: Game } | null = null

  // Debug: Track games with missing data
  let gamesWithoutTimeControl = 0
  let gamesWithoutMoves = 0

  // Process each game
  games.forEach(game => {
    if (!game.time_control || game.time_control === 'unknown') {
      gamesWithoutTimeControl++
    }
    if (!game.total_moves || game.total_moves === 0) {
      gamesWithoutMoves++
    }
    const timeControl = game.time_control || 'unknown'
    const maxTime = calculateMaxGameTime(timeControl, game.total_moves)
    const estimatedTime = estimateActualGameDuration(timeControl, game.total_moves)

    totalMaxTimeSeconds += maxTime
    totalEstimatedActualTimeSeconds += estimatedTime

    // Track by time control category
    const tcInfo = parseTimeControl(timeControl)
    const category = tcInfo.displayName

    if (!timeControlMap.has(category)) {
      timeControlMap.set(category, {
        maxTime: 0,
        estimatedTime: 0,
        games: 0
      })
    }

    const tcStats = timeControlMap.get(category)!
    tcStats.maxTime += maxTime
    tcStats.estimatedTime += estimatedTime
    tcStats.games += 1

    // Track longest/shortest games (by estimated time)
    if (game.total_moves && game.total_moves > 0) {
      if (!longestGame || estimatedTime > longestGame.duration) {
        longestGame = { duration: estimatedTime, game }
      }
      if (!shortestGame || estimatedTime < shortestGame.duration) {
        shortestGame = { duration: estimatedTime, game }
      }
    }
  })

  // Create breakdown by time control
  const byTimeControl = Array.from(timeControlMap.entries())
    .map(([category, stats]) => ({
      category,
      totalTimeSeconds: stats.estimatedTime,
      totalTimeFormatted: formatDuration(stats.estimatedTime),
      gameCount: stats.games,
      averageGameDuration: stats.games > 0 ? stats.estimatedTime / stats.games : 0
    }))
    .sort((a, b) => b.totalTimeSeconds - a.totalTimeSeconds)

  // Calculate breakdown
  const hours = Math.floor(totalEstimatedActualTimeSeconds / 3600)
  const minutes = Math.floor((totalEstimatedActualTimeSeconds % 3600) / 60)
  const seconds = Math.floor(totalEstimatedActualTimeSeconds % 60)

  // Debug logging
  if (games.length > 100) {
    console.log('⏱️ Time Calculation Summary:', {
      totalGames: games.length,
      gamesWithoutTimeControl,
      gamesWithoutMoves,
      totalEstimatedHours: Math.floor(totalEstimatedActualTimeSeconds / 3600),
      totalMaxHours: Math.floor(totalMaxTimeSeconds / 3600),
      topCategories: Array.from(timeControlMap.entries())
        .sort((a, b) => b[1].games - a[1].games)
        .slice(0, 5)
        .map(([cat, stats]) => ({
          category: cat,
          games: stats.games,
          estimatedHours: Math.floor(stats.estimatedTime / 3600)
        }))
    })
  }

  return {
    totalTimeSeconds: totalMaxTimeSeconds,
    totalTimeFormatted: formatDuration(totalMaxTimeSeconds),
    breakdown: { hours, minutes, seconds },
    byTimeControl,
    estimatedActualTime: {
      totalTimeSeconds: totalEstimatedActualTimeSeconds,
      totalTimeFormatted: formatDuration(totalEstimatedActualTimeSeconds),
      description: 'Calculated using base time + increment per move (matches Lichess methodology)'
    },
    longestGame: longestGame ? {
      estimatedDurationSeconds: longestGame.duration,
      estimatedDurationFormatted: formatDuration(longestGame.duration),
      gameId: longestGame.game.provider_game_id || longestGame.game.id,
      timeControl: longestGame.game.time_control || 'unknown',
      totalMoves: longestGame.game.total_moves || 0
    } : null,
    shortestGame: shortestGame ? {
      estimatedDurationSeconds: shortestGame.duration,
      estimatedDurationFormatted: formatDuration(shortestGame.duration),
      gameId: shortestGame.game.provider_game_id || shortestGame.game.id,
      timeControl: shortestGame.game.time_control || 'unknown',
      totalMoves: shortestGame.game.total_moves || 0
    } : null
  }
}

/**
 * Calculate time spent over a specific period
 */
export function calculateTimeSpentInPeriod(
  games: Game[],
  startDate: Date,
  endDate: Date
): TimeSpentStats {
  const filteredGames = games.filter(game => {
    const playedAt = new Date(game.played_at)
    return playedAt >= startDate && playedAt <= endDate
  })

  return calculateTimeSpent(filteredGames)
}

/**
 * Get time spent trend over time (monthly breakdown)
 */
export interface TimeSpentTrend {
  month: string
  year: number
  totalTimeSeconds: number
  totalTimeFormatted: string
  gameCount: number
  averageTimePerGame: number
}

export function getTimeSpentTrend(games: Game[]): TimeSpentTrend[] {
  const monthlyMap = new Map<string, { totalTime: number; gameCount: number }>()

  games.forEach(game => {
    const date = new Date(game.played_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const estimatedTime = estimateActualGameDuration(
      game.time_control || 'unknown',
      game.total_moves
    )

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { totalTime: 0, gameCount: 0 })
    }

    const monthData = monthlyMap.get(key)!
    monthData.totalTime += estimatedTime
    monthData.gameCount += 1
  })

  return Array.from(monthlyMap.entries())
    .map(([key, data]) => {
      const [year, month] = key.split('-')
      const monthName = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'short' })

      return {
        month: monthName,
        year: parseInt(year),
        totalTimeSeconds: data.totalTime,
        totalTimeFormatted: formatDuration(data.totalTime),
        gameCount: data.gameCount,
        averageTimePerGame: data.gameCount > 0 ? data.totalTime / data.gameCount : 0
      }
    })
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return new Date(`${a.month} 1, ${a.year}`).getMonth() - new Date(`${b.month} 1, ${b.year}`).getMonth()
    })
}
