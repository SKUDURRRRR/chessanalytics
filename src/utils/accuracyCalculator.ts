/**
 * Accuracy Calculator Utility
 * Calculates realistic accuracy using industry-standard thresholds
 */

export interface MoveAnalysis {
  centipawn_loss: number
  is_best?: boolean
  is_blunder?: boolean
  is_mistake?: boolean
  is_inaccuracy?: boolean
}

export interface AccuracyStats {
  accuracy: number
  brilliant_moves: number
  good_moves: number
  acceptable_moves: number
  inaccuracies: number
  mistakes: number
  blunders: number
  total_moves: number
}

/**
 * Calculate realistic accuracy using rating-adjusted thresholds
 * Higher-rated players have more lenient thresholds for "accurate" moves
 */
export function calculateRealisticAccuracy(moves: MoveAnalysis[], playerRating?: number): AccuracyStats {
  if (!moves || moves.length === 0) {
    return {
      accuracy: 0,
      brilliant_moves: 0,
      good_moves: 0,
      acceptable_moves: 0,
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
      total_moves: 0
    }
  }

  // Rating-adjusted thresholds for accuracy calculation
  let accuracyThreshold: number
  if (!playerRating || playerRating < 1000) {
    // Beginner (0-999): Only brilliant moves count as accurate
    accuracyThreshold = 5
  } else if (playerRating < 1400) {
    // Intermediate (1000-1399): Brilliant + good moves count as accurate
    accuracyThreshold = 30
  } else if (playerRating < 1800) {
    // Advanced (1400-1799): Include some acceptable moves
    accuracyThreshold = 80
  } else {
    // Expert+ (1800+): More lenient for high-rated players
    accuracyThreshold = 150
  }

  let brilliant_moves = 0
  let good_moves = 0
  let acceptable_moves = 0
  let inaccuracies = 0
  let mistakes = 0
  let blunders = 0

  for (const move of moves) {
    const centipawn_loss = move.centipawn_loss || 0

    // Industry-standard move classification (for display)
    if (centipawn_loss <= 5) {
      brilliant_moves++
    } else if (centipawn_loss <= 30) {
      good_moves++
    } else if (centipawn_loss <= 80) {
      acceptable_moves++
    } else if (centipawn_loss <= 150) {
      inaccuracies++
    } else if (centipawn_loss <= 250) {
      mistakes++
    } else {
      blunders++
    }
  }

  // Rating-adjusted accuracy calculation
  const accurate_moves = moves.filter(move => (move.centipawn_loss || 0) <= accuracyThreshold).length
  const accuracy = (accurate_moves / moves.length) * 100

  return {
    accuracy: Math.round(accuracy * 10) / 10, // Round to 1 decimal place
    brilliant_moves,
    good_moves,
    acceptable_moves,
    inaccuracies,
    mistakes,
    blunders,
    total_moves: moves.length
  }
}

/**
 * Calculate accuracy from moves_analysis array in game data
 */
export function calculateAccuracyFromGameData(gameData: any, playerRating?: number): number {
  if (!gameData || !gameData.moves_analysis || !Array.isArray(gameData.moves_analysis)) {
    return 0
  }

  const stats = calculateRealisticAccuracy(gameData.moves_analysis, playerRating)
  return stats.accuracy
}

/**
 * Calculate average accuracy from multiple games
 */
export function calculateAverageAccuracy(games: any[], playerRating?: number): number {
  if (!games || games.length === 0) {
    return 0
  }

  let totalAccuracy = 0
  let validGames = 0

  for (const game of games) {
    const accuracy = calculateAccuracyFromGameData(game, playerRating)
    if (accuracy > 0) {
      totalAccuracy += accuracy
      validGames++
    }
  }

  return validGames > 0 ? Math.round((totalAccuracy / validGames) * 10) / 10 : 0
}
