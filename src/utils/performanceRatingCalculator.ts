export interface MoveForRating {
  classification: string
  centipawn_loss: number
  san: string
  move: string
}

export interface PerformanceRatingInput {
  opponentRating?: number
  myRating?: number
  result?: string
  moves: MoveForRating[]
}

export interface PerformanceRatingResult {
  rating: number
  calculation: string
  method: 'hybrid' | 'move-based'
}

/**
 * Calculate performance rating using chess.com-style formula
 * Chess.com uses opponent rating + result as primary factor, with move quality as secondary
 */
export function calculatePerformanceRating(input: PerformanceRatingInput): PerformanceRatingResult {
  const { opponentRating, myRating, result, moves } = input

  // Chess.com's approach: opponent rating + result is the primary factor
  if (opponentRating && result && moves.length > 0) {
    const gameResult = result.toLowerCase()
    
    // Chess.com's standard performance rating formula
    let baseRating: number
    if (gameResult === 'win') {
      baseRating = opponentRating + 400  // Chess.com standard: win = opponent + 400
    } else if (gameResult === 'loss') {
      baseRating = opponentRating - 400  // Chess.com standard: loss = opponent - 400
    } else {
      baseRating = opponentRating  // Draw = opponent rating
    }
    
    // Move quality provides a smaller adjustment (secondary factor)
    const moveQualityAdjustment = calculateMoveQualityAdjustment(moves, myRating)
    
    // Final rating: primary (opponent + result) + secondary (move quality)
    const finalPerformanceRating = baseRating + moveQualityAdjustment
    
    const calculation = `${opponentRating} ${gameResult === 'win' ? '+' : gameResult === 'loss' ? '-' : ''} ${gameResult === 'win' ? '400' : gameResult === 'loss' ? '400' : '0'} + ${moveQualityAdjustment.toFixed(1)} = ${finalPerformanceRating.toFixed(1)}`
    
    return {
      rating: Math.max(800, Math.min(2400, Math.round(finalPerformanceRating))),
      calculation,
      method: 'hybrid'
    }
  }
  
  // Fallback to move-based calculation if no opponent rating data
  return calculateMoveBasedRating(moves)
}

function calculateMoveQualityAdjustment(moves: MoveForRating[], playerRating?: number): number {
  if (moves.length === 0) return 0

  const totalMoves = moves.length
  const bestMoves = moves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length
  const greatMoves = moves.filter(m => m.classification === 'great').length
  const excellentMoves = moves.filter(m => m.classification === 'excellent').length
  const goodMoves = moves.filter(m => m.classification === 'good').length
  const acceptableMoves = moves.filter(m => m.classification === 'acceptable').length
  const blunders = moves.filter(m => m.classification === 'blunder').length
  const mistakes = moves.filter(m => m.classification === 'mistake').length
  const inaccuracies = moves.filter(m => m.classification === 'inaccuracy').length

  // Calculate move quality metrics
  const accuracy = (bestMoves / totalMoves) * 100
  const strongMoves = (bestMoves + greatMoves + excellentMoves) / totalMoves * 100
  const solidMoves = (goodMoves + acceptableMoves) / totalMoves * 100
  const blunderRate = (blunders / totalMoves) * 100
  const mistakeRate = (mistakes / totalMoves) * 100
  const inaccuracyRate = (inaccuracies / totalMoves) * 100
  const avgCentipawnLoss = moves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0) / totalMoves

  // Determine rating-based adjustment factors
  // Higher-rated players get more conservative adjustments
  let ratingFactor = 1.0
  let penaltyFactor = 1.0
  let bonusFactor = 1.0
  
  if (playerRating) {
    if (playerRating >= 2000) {
      // Master+ level: very conservative
      ratingFactor = 0.5
      penaltyFactor = 1.8
      bonusFactor = 0.6
    } else if (playerRating >= 1800) {
      // Expert level: conservative
      ratingFactor = 0.65
      penaltyFactor = 1.5
      bonusFactor = 0.7
    } else if (playerRating >= 1600) {
      // Advanced level: moderate
      ratingFactor = 0.8
      penaltyFactor = 1.2
      bonusFactor = 0.8
    } else if (playerRating >= 1400) {
      // Intermediate level: slightly generous
      ratingFactor = 1.0
      penaltyFactor = 1.0
      bonusFactor = 1.0
    } else {
      // Beginner level: generous
      ratingFactor = 1.2
      penaltyFactor = 0.8
      bonusFactor = 1.2
    }
  }

  // Calculate adjustment based on move quality - very conservative, penalty-focused
  let adjustment = 0

  // Only penalize for poor play, don't reward good play
  // Blunder penalty - rating-adjusted (higher rated players penalized more)
  adjustment -= blunderRate * 3 * penaltyFactor * ratingFactor

  // Mistake penalty - rating-adjusted
  adjustment -= mistakeRate * 1.5 * penaltyFactor * ratingFactor

  // Inaccuracy penalty - rating-adjusted
  adjustment -= inaccuracyRate * 0.5 * penaltyFactor * ratingFactor

  // Centipawn loss penalty - only penalize for high centipawn loss
  if (avgCentipawnLoss > 30) {
    adjustment -= Math.min(40, (avgCentipawnLoss - 30) * 0.8) * penaltyFactor * ratingFactor
  }

  // Very conservative caps - mostly penalties, minimal bonuses
  const maxAdjustment = playerRating && playerRating >= 2000 ? 20 : 30
  const minAdjustment = playerRating && playerRating >= 2000 ? -40 : -60
  
  return Math.max(minAdjustment, Math.min(maxAdjustment, adjustment))
}

function calculateMoveBasedRating(moves: MoveForRating[]): PerformanceRatingResult {
  if (moves.length === 0) {
    return {
      rating: 1200, // Default rating when no data available
      calculation: 'No moves available',
      method: 'move-based'
    }
  }

  // Calculate move quality metrics
  const totalMoves = moves.length
  const bestMoves = moves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length
  const goodMoves = moves.filter(m => m.classification === 'good').length
  const acceptableMoves = moves.filter(m => m.classification === 'acceptable').length
  const inaccuracies = moves.filter(m => m.classification === 'inaccuracy').length
  const mistakes = moves.filter(m => m.classification === 'mistake').length
  const blunders = moves.filter(m => m.classification === 'blunder').length

  // Calculate accuracy percentage (best + brilliant moves)
  const accuracy = (bestMoves / totalMoves) * 100
  
  // Calculate blunder rate
  const blunderRate = (blunders / totalMoves) * 100
  
  // Calculate average centipawn loss for more precise rating
  const avgCentipawnLoss = moves.reduce((sum, move) => sum + (move.centipawn_loss || 0), 0) / totalMoves

  // Improved rating estimation formula
  let estimatedRating = 1200 // Base rating
  
  // Accuracy factor (more realistic scaling)
  estimatedRating += (accuracy - 60) * 15 // 60% accuracy = 1200 rating baseline
  
  // Blunder penalty (harsh penalty for blunders)
  estimatedRating -= blunderRate * 40
  
  // Mistake penalty (moderate penalty)
  estimatedRating -= (mistakes / totalMoves) * 100 * 20
  
  // Inaccuracy penalty (light penalty)
  estimatedRating -= (inaccuracies / totalMoves) * 100 * 8
  
  // Centipawn loss factor (additional precision)
  if (avgCentipawnLoss > 50) {
    estimatedRating -= Math.min(200, (avgCentipawnLoss - 50) * 2)
  } else if (avgCentipawnLoss < 20) {
    estimatedRating += Math.min(100, (20 - avgCentipawnLoss) * 3)
  }
  
  // Cap the rating to reasonable bounds
  const finalRating = Math.max(800, Math.min(2400, Math.round(estimatedRating)))
  
  const calculation = `Base: 1200 + Accuracy: ${accuracy.toFixed(1)}% (${((accuracy - 60) * 15).toFixed(0)}) - Blunders: ${blunderRate.toFixed(1)}% (${(blunderRate * 40).toFixed(0)}) - CPL: ${avgCentipawnLoss.toFixed(1)} = ${finalRating}`
  
  return {
    rating: finalRating,
    calculation,
    method: 'move-based'
  }
}
