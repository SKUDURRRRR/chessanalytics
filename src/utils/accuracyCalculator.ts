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
 * Calculate realistic accuracy using improved threshold-based scoring
 * This matches the backend calculation and provides more realistic accuracy scores
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

    // Chess.com-aligned move classification (CORRECTED 2025-10-08)
    // Best: 0-5cp, Great: 5-15cp, Excellent: 15-25cp, Good: 25-50cp
    // Inaccuracy: 50-100cp, Mistake: 100-200cp, Blunder: 200+cp
    if (centipawn_loss <= 5) {
      brilliant_moves++  // Best moves (Note: not all are brilliant, just using this counter)
    } else if (centipawn_loss <= 50) {
      good_moves++  // Includes Great, Excellent, and Good (5-50cp)
    } else if (centipawn_loss <= 100) {
      inaccuracies++  // Inaccuracies (50-100cp) - Chess.com standard
    } else if (centipawn_loss <= 200) {
      mistakes++  // Mistakes (100-200cp) - Chess.com standard
    } else {
      blunders++  // Blunders (200+cp) - Chess.com standard
    }
  }

  // Chess.com-style accuracy calculation with conservative thresholds
  // This matches the backend calculation for consistency
  let total_accuracy = 0
  for (const move of moves) {
    const centipawn_loss = move.centipawn_loss || 0
    
    if (centipawn_loss <= 5) {
      total_accuracy += 100.0  // Only truly perfect moves
    } else if (centipawn_loss <= 20) {
      // Linear interpolation from 100% to 85% for 5-20 CPL
      total_accuracy += 100.0 - (centipawn_loss - 5) * 1.0
    } else if (centipawn_loss <= 40) {
      // Linear interpolation from 85% to 70% for 20-40 CPL
      total_accuracy += 85.0 - (centipawn_loss - 20) * 0.75
    } else if (centipawn_loss <= 80) {
      // Linear interpolation from 70% to 50% for 40-80 CPL
      total_accuracy += 70.0 - (centipawn_loss - 40) * 0.5
    } else if (centipawn_loss <= 150) {
      // Linear interpolation from 50% to 30% for 80-150 CPL
      total_accuracy += 50.0 - (centipawn_loss - 80) * 0.286
    } else {
      // Linear interpolation from 30% to 15% for 150+ CPL
      total_accuracy += Math.max(15.0, 30.0 - (centipawn_loss - 150) * 0.1)
    }
  }
  
  const accuracy = total_accuracy / moves.length

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
 * Calculate opening accuracy using Chess.com's CAPS2 algorithm (same as overall accuracy).
 * Uses the standard accuracy formula consistently across all game phases.
 */
export function calculateOpeningAccuracyChessCom(moves: MoveAnalysis[]): number {
  if (!moves || moves.length === 0) return 0

  console.log('[Opening Accuracy] Calculating for', moves.length, 'moves')
  
  // Extract centipawn losses from moves (handle both naming conventions)
  const centipawnLosses = moves.map(move => (move as any).centipawnLoss ?? move.centipawn_loss ?? 0)
  
  // Use the same Chess.com CAPS2 formula as overall accuracy
  let totalAccuracy = 0
  for (let i = 0; i < centipawnLosses.length; i++) {
    const cpl = Math.min(centipawnLosses[i], 1000) // Cap at 1000 to avoid math errors
    
    // Chess.com CAPS2 algorithm thresholds:
    let moveAccuracy: number
    if (cpl <= 5) {
      moveAccuracy = 100.0  // Perfect moves (0-5 CPL)
    } else if (cpl <= 20) {
      // Linear interpolation from 100% to 85% for 5-20 CPL
      moveAccuracy = 100.0 - (cpl - 5) * 1.0  // 100% to 85%
    } else if (cpl <= 40) {
      // Linear interpolation from 85% to 70% for 20-40 CPL
      moveAccuracy = 85.0 - (cpl - 20) * 0.75  // 85% to 70%
    } else if (cpl <= 80) {
      // Linear interpolation from 70% to 50% for 40-80 CPL
      moveAccuracy = 70.0 - (cpl - 40) * 0.5  // 70% to 50%
    } else if (cpl <= 150) {
      // Linear interpolation from 50% to 30% for 80-150 CPL
      moveAccuracy = 50.0 - (cpl - 80) * 0.286  // 50% to 30%
    } else {
      // Linear interpolation from 30% to 15% for 150+ CPL
      moveAccuracy = Math.max(15.0, 30.0 - (cpl - 150) * 0.1)  // 30% to 15%
    }
    
    if (i < 3) {
      console.log(`[Opening Accuracy] Move ${i+1}: CPL=${cpl}, Accuracy=${moveAccuracy.toFixed(1)}%`)
    }
    
    totalAccuracy += moveAccuracy
  }
  
  const finalAccuracy = Math.round((totalAccuracy / centipawnLosses.length) * 10) / 10
  console.log('[Opening Accuracy] Final:', finalAccuracy, '% (avg of', centipawnLosses.length, 'moves)')
  
  return finalAccuracy
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
