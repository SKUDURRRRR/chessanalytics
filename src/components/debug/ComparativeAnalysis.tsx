import React, { useMemo } from 'react'

interface ProcessedMove {
  index: number
  ply: number
  moveNumber: number
  player: 'white' | 'black'
  isUserMove: boolean
  san: string
  bestMoveSan: string | null
  evaluation: { type: 'cp' | 'mate'; value: number } | null
  scoreForPlayer: number
  displayEvaluation: string
  centipawnLoss: number | null
  classification: 'brilliant' | 'best' | 'good' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder' | 'uncategorized'
  explanation: string
  fenBefore: string
  fenAfter: string
}

interface ComparativeAnalysisProps {
  moves: ProcessedMove[]
  playerColor: 'white' | 'black'
  gameRecord: any
}

interface GameComparison {
  metric: string
  thisGame: number
  average: number
  percentile: number
  description: string
  improvement: string
}

interface PlayerComparison {
  name: string
  rating: number
  similarity: number
  strengths: string[]
  weaknesses: string[]
  advice: string
}

export function ComparativeAnalysis({ moves, playerColor, gameRecord }: ComparativeAnalysisProps) {
  // Filter user moves, with fallback logic if isUserMove is not set correctly
  let userMoves = moves.filter(move => move.isUserMove)
  
  // Fallback: if no moves are marked as user moves, determine based on player color
  if (userMoves.length === 0) {
    console.warn('No moves marked as user moves, using fallback logic based on player color')
    userMoves = moves.filter(move => move.player === playerColor)
  }
  
  // Final fallback: if still no moves, use every other move (assuming user plays one color)
  if (userMoves.length === 0 && moves.length > 0) {
    console.warn('Still no user moves found, using every other move as fallback')
    userMoves = moves.filter((_, index) => index % 2 === (playerColor === 'white' ? 0 : 1))
  }

  const gameComparisons = useMemo(() => {
    const comparisons: GameComparison[] = []
    
    // Calculate accuracy
    const accuracy = userMoves.length > 0 
      ? (userMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length / userMoves.length) * 100
      : 0
    
    comparisons.push({
      metric: 'Accuracy',
      thisGame: accuracy,
      average: 65, // Typical accuracy for rated players
      percentile: Math.min(95, Math.max(5, (accuracy / 80) * 100)),
      description: 'Percentage of best moves played',
      improvement: accuracy < 60 ? 'Focus on calculation and pattern recognition' : 'Maintain current level'
    })

    // Calculate blunder rate
    const blunderRate = userMoves.length > 0 
      ? (userMoves.filter(m => m.classification === 'blunder').length / userMoves.length) * 100
      : 0
    
    comparisons.push({
      metric: 'Blunder Rate',
      thisGame: blunderRate,
      average: 8, // Typical blunder rate
      percentile: blunderRate < 5 ? 90 : blunderRate < 10 ? 60 : 30,
      description: 'Percentage of moves that lose significant advantage',
      improvement: blunderRate > 10 ? 'Take more time to double-check moves' : 'Good blunder prevention'
    })

    // Calculate tactical awareness
    const tacticalMoves = userMoves.filter(m => m.classification === 'brilliant').length
    const tacticalRate = userMoves.length > 0 ? (tacticalMoves / userMoves.length) * 100 : 0
    
    comparisons.push({
      metric: 'Tactical Awareness',
      thisGame: tacticalRate,
      average: 2, // Typical brilliant move rate
      percentile: tacticalRate > 5 ? 95 : tacticalRate > 2 ? 70 : 40,
      description: 'Ability to find brilliant tactical moves',
      improvement: tacticalRate < 1 ? 'Solve more tactical puzzles' : 'Excellent tactical vision'
    })

    // Calculate consistency
    const consistency = userMoves.length > 0 
      ? 100 - (userMoves.filter(m => m.classification === 'inaccuracy' || m.classification === 'mistake' || m.classification === 'blunder').length / userMoves.length) * 100
      : 0
    
    comparisons.push({
      metric: 'Consistency',
      thisGame: consistency,
      average: 75, // Typical consistency
      percentile: consistency > 85 ? 90 : consistency > 75 ? 60 : 30,
      description: 'Ability to maintain quality throughout the game',
      improvement: consistency < 70 ? 'Focus on maintaining concentration' : 'Very consistent play'
    })

    return comparisons
  }, [userMoves])

  const playerComparisons = useMemo(() => {
    const comparisons: PlayerComparison[] = []
    
    // Analyze playing style to suggest similar players
    const blunderCount = userMoves.filter(m => m.classification === 'blunder').length
    const brilliantCount = userMoves.filter(m => m.classification === 'brilliant').length
    const mistakeCount = userMoves.filter(m => m.classification === 'mistake').length
    const inaccuracyCount = userMoves.filter(m => m.classification === 'inaccuracy').length
    const goodMovesCount = userMoves.filter(m => m.classification === 'good').length
    const bestMovesCount = userMoves.filter(m => m.classification === 'best').length
    
    const accuracy = userMoves.length > 0 
      ? (userMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length / userMoves.length) * 100
      : 0
    
    const totalErrors = blunderCount + mistakeCount + inaccuracyCount
    const errorRate = userMoves.length > 0 ? (totalErrors / userMoves.length) * 100 : 0
    const tacticalRate = userMoves.length > 0 ? (brilliantCount / userMoves.length) * 100 : 0

    // 1. Aggressive tactical player (expanded criteria)
    if ((brilliantCount > 0 && blunderCount > 1) || (tacticalRate > 3 && errorRate > 15)) {
      comparisons.push({
        name: 'Mikhail Tal',
        rating: 2700,
        similarity: Math.min(85, 60 + (brilliantCount * 5) + (tacticalRate * 2)),
        strengths: ['Tactical vision', 'Combinational play', 'Initiative'],
        weaknesses: ['Positional play', 'Endgame technique'],
        advice: 'Study Tal\'s games to improve your tactical combinations while working on positional understanding'
      })
    }

    // 2. Solid positional player (expanded criteria)
    if ((accuracy > 65 && blunderCount <= 2) || (errorRate < 20 && bestMovesCount > goodMovesCount)) {
      comparisons.push({
        name: 'Anatoly Karpov',
        rating: 2780,
        similarity: Math.min(90, 50 + (accuracy * 0.3) + (blunderCount === 0 ? 20 : 0)),
        strengths: ['Positional understanding', 'Consistency', 'Endgame technique'],
        weaknesses: ['Tactical complications', 'Initiative'],
        advice: 'Study Karpov\'s games to enhance your positional play and consider being more active'
      })
    }

    // 3. Universal player (expanded criteria)
    if ((accuracy > 60 && brilliantCount > 0 && blunderCount <= 3) || (accuracy > 70 && errorRate < 25)) {
      comparisons.push({
        name: 'Magnus Carlsen',
        rating: 2850,
        similarity: Math.min(85, 45 + (accuracy * 0.4) + (brilliantCount * 3)),
        strengths: ['Universal style', 'Endgame mastery', 'Practical play'],
        weaknesses: ['Opening preparation', 'Time management'],
        advice: 'Study Carlsen\'s games to develop a more universal playing style'
      })
    }

    // 4. Defensive player (expanded criteria)
    if ((blunderCount <= 2 && brilliantCount === 0) || (errorRate < 15 && tacticalRate < 2)) {
      comparisons.push({
        name: 'Tigran Petrosian',
        rating: 2600,
        similarity: Math.min(80, 40 + (blunderCount === 0 ? 25 : 15) + (errorRate < 10 ? 15 : 0)),
        strengths: ['Defensive skills', 'Prophylaxis', 'Safety'],
        weaknesses: ['Initiative', 'Tactical play'],
        advice: 'Study Petrosian\'s games to improve your defensive skills while working on tactical awareness'
      })
    }

    // 5. NEW: Aggressive attacking player
    if (brilliantCount > 0 && (mistakeCount > blunderCount) && accuracy > 55) {
      comparisons.push({
        name: 'Alexander Alekhine',
        rating: 2650,
        similarity: Math.min(80, 50 + (brilliantCount * 4) + (mistakeCount * 2)),
        strengths: ['Attacking play', 'Initiative', 'Dynamic positions'],
        weaknesses: ['Defensive play', 'Endgame technique'],
        advice: 'Study Alekhine\'s games to improve your attacking skills while working on defensive fundamentals'
      })
    }

    // 6. NEW: Precise technical player
    if (accuracy > 75 && blunderCount === 0 && mistakeCount <= 2) {
      comparisons.push({
        name: 'José Raúl Capablanca',
        rating: 2750,
        similarity: Math.min(90, 60 + (accuracy * 0.3) + (blunderCount === 0 ? 20 : 0)),
        strengths: ['Technical precision', 'Endgame mastery', 'Natural talent'],
        weaknesses: ['Complex tactics', 'Opening theory'],
        advice: 'Study Capablanca\'s games to improve your technical precision and endgame skills'
      })
    }

    // 7. NEW: Fighting spirit player
    if (errorRate > 20 && brilliantCount > 0 && accuracy > 50) {
      comparisons.push({
        name: 'Bobby Fischer',
        rating: 2785,
        similarity: Math.min(85, 45 + (brilliantCount * 5) + (accuracy * 0.2)),
        strengths: ['Competitive spirit', 'Sharp tactics', 'Deep preparation'],
        weaknesses: ['Positional play', 'Time management'],
        advice: 'Study Fischer\'s games to improve your competitive edge and tactical sharpness'
      })
    }

    // 8. NEW: Creative player
    if (brilliantCount > 1 && goodMovesCount > bestMovesCount && errorRate < 30) {
      comparisons.push({
        name: 'Vladimir Kramnik',
        rating: 2800,
        similarity: Math.min(80, 50 + (brilliantCount * 3) + (goodMovesCount * 0.5)),
        strengths: ['Creative play', 'Positional understanding', 'Endgame technique'],
        weaknesses: ['Tactical complications', 'Time pressure'],
        advice: 'Study Kramnik\'s games to develop your creative and positional understanding'
      })
    }

    // 9. NEW: Endgame specialist
    if (accuracy > 70 && blunderCount <= 1 && bestMovesCount > brilliantCount) {
      comparisons.push({
        name: 'Vasily Smyslov',
        rating: 2620,
        similarity: Math.min(85, 55 + (accuracy * 0.3) + (bestMovesCount * 2)),
        strengths: ['Endgame mastery', 'Technical precision', 'Harmonious play'],
        weaknesses: ['Aggressive play', 'Complex tactics'],
        advice: 'Study Smyslov\'s games to improve your endgame technique and positional harmony'
      })
    }

    // 10. NEW: Dynamic attacking player
    if (brilliantCount > 0 && (mistakeCount > 0 || blunderCount > 0) && accuracy > 45 && errorRate > 20) {
      comparisons.push({
        name: 'Garry Kasparov',
        rating: 2851,
        similarity: Math.min(90, 60 + (brilliantCount * 4) + (accuracy * 0.2)),
        strengths: ['Dynamic play', 'Initiative', 'Pressure tactics'],
        weaknesses: ['Defensive play', 'Time management'],
        advice: 'Study Kasparov\'s games to improve your dynamic play and initiative'
      })
    }

    // 11. NEW: Solid technical player
    if (accuracy > 65 && blunderCount <= 1 && mistakeCount <= 2 && brilliantCount === 0) {
      comparisons.push({
        name: 'Vladimir Kramnik',
        rating: 2800,
        similarity: Math.min(85, 60 + (accuracy * 0.3) + (blunderCount === 0 ? 15 : 0)),
        strengths: ['Technical precision', 'Positional understanding', 'Endgame technique'],
        weaknesses: ['Tactical complications', 'Aggressive play'],
        advice: 'Study Kramnik\'s games to improve your technical precision and positional understanding'
      })
    }

    // 12. NEW: Romantic attacking player
    if (brilliantCount > 1 && (blunderCount > 2 || mistakeCount > 2) && accuracy > 40) {
      comparisons.push({
        name: 'Adolf Anderssen',
        rating: 2600,
        similarity: Math.min(80, 50 + (brilliantCount * 4) + (blunderCount * 2)),
        strengths: ['Romantic attacks', 'Sacrificial play', 'Initiative'],
        weaknesses: ['Defensive play', 'Positional understanding'],
        advice: 'Study Anderssen\'s games to improve your attacking instincts and sacrificial play'
      })
    }

    // 13. NEW: Modern universal player
    if (accuracy > 70 && brilliantCount > 0 && blunderCount <= 2 && errorRate < 20) {
      comparisons.push({
        name: 'Fabiano Caruana',
        rating: 2844,
        similarity: Math.min(85, 55 + (accuracy * 0.3) + (brilliantCount * 3)),
        strengths: ['Universal style', 'Opening preparation', 'Technical precision'],
        weaknesses: ['Time pressure', 'Endgame technique'],
        advice: 'Study Caruana\'s games to develop a modern universal playing style'
      })
    }

    // 14. NEW: Positional master
    if (accuracy > 75 && blunderCount === 0 && mistakeCount <= 1 && brilliantCount <= 1) {
      comparisons.push({
        name: 'Wilhelm Steinitz',
        rating: 2500,
        similarity: Math.min(90, 65 + (accuracy * 0.3) + (blunderCount === 0 ? 20 : 0)),
        strengths: ['Positional theory', 'Strategic understanding', 'Pioneering play'],
        weaknesses: ['Modern tactics', 'Time management'],
        advice: 'Study Steinitz\'s games to understand fundamental positional principles'
      })
    }

    // 15. NEW: Tactical genius
    if (brilliantCount > 2 && (blunderCount + mistakeCount) > 3 && accuracy > 40) {
      comparisons.push({
        name: 'Paul Morphy',
        rating: 2600,
        similarity: Math.min(85, 55 + (brilliantCount * 5) + (accuracy * 0.1)),
        strengths: ['Tactical genius', 'Natural talent', 'Attacking play'],
        weaknesses: ['Positional play', 'Endgame technique'],
        advice: 'Study Morphy\'s games to improve your tactical vision and natural attacking instincts'
      })
    }

    // 16. NEW: Defensive master
    if (blunderCount <= 1 && brilliantCount === 0 && mistakeCount <= 2 && accuracy > 60) {
      comparisons.push({
        name: 'Aron Nimzowitsch',
        rating: 2580,
        similarity: Math.min(80, 50 + (blunderCount === 0 ? 20 : 10) + (accuracy * 0.3)),
        strengths: ['Defensive mastery', 'Prophylaxis', 'Positional understanding'],
        weaknesses: ['Aggressive play', 'Tactical complications'],
        advice: 'Study Nimzowitsch\'s games to improve your defensive skills and prophylactic thinking'
      })
    }

    // 17. NEW: Modern attacking player
    if (brilliantCount > 0 && accuracy > 55 && errorRate > 15 && errorRate < 50) {
      comparisons.push({
        name: 'Hikaru Nakamura',
        rating: 2790,
        similarity: Math.min(85, 55 + (brilliantCount * 4) + (accuracy * 0.2)),
        strengths: ['Modern attacks', 'Initiative', 'Practical play'],
        weaknesses: ['Positional play', 'Endgame technique'],
        advice: 'Study Nakamura\'s games to improve your modern attacking play and initiative'
      })
    }

    // 18. NEW: Classical positional player
    if (accuracy > 70 && blunderCount <= 1 && brilliantCount <= 1 && goodMovesCount > bestMovesCount) {
      comparisons.push({
        name: 'Emanuel Lasker',
        rating: 2720,
        similarity: Math.min(85, 60 + (accuracy * 0.3) + (goodMovesCount * 0.3)),
        strengths: ['Classical play', 'Practical understanding', 'Endgame technique'],
        weaknesses: ['Modern tactics', 'Opening theory'],
        advice: 'Study Lasker\'s games to improve your classical positional understanding and practical play'
      })
    }

    // More lenient matching criteria - try to match everyone to a famous player
    
    // Match any tactical tendency
    if (comparisons.length === 0 && (brilliantCount > 0 || tacticalRate > 1)) {
      comparisons.push({
        name: 'Mikhail Tal',
        rating: 2700,
        similarity: Math.min(75, 50 + (brilliantCount * 5) + (tacticalRate * 2)),
        strengths: ['Tactical vision', 'Combinational play', 'Initiative'],
        weaknesses: ['Positional play', 'Endgame technique'],
        advice: 'Study Tal\'s games to improve your tactical combinations while working on positional understanding'
      })
    }
    
    // Match solid play
    if (comparisons.length === 0 && (accuracy > 55 || blunderCount <= 2)) {
      comparisons.push({
        name: 'Anatoly Karpov',
        rating: 2780,
        similarity: Math.min(80, 45 + (accuracy * 0.4) + (blunderCount === 0 ? 15 : 0)),
        strengths: ['Positional understanding', 'Consistency', 'Endgame technique'],
        weaknesses: ['Tactical complications', 'Initiative'],
        advice: 'Study Karpov\'s games to enhance your positional play and consider being more active'
      })
    }
    
    // Match universal style
    if (comparisons.length === 0 && accuracy > 50) {
      comparisons.push({
        name: 'Magnus Carlsen',
        rating: 2850,
        similarity: Math.min(75, 40 + (accuracy * 0.5)),
        strengths: ['Universal style', 'Endgame mastery', 'Practical play'],
        weaknesses: ['Opening preparation', 'Time management'],
        advice: 'Study Carlsen\'s games to develop a more universal playing style'
      })
    }
    
    // ULTIMATE FALLBACK - if still no matches, use a thoughtful comparison
    if (comparisons.length === 0) {
      // Analyze overall tendency
      if (blunderCount > 3 && errorRate > 30) {
        comparisons.push({
          name: 'Paul Morphy',
          rating: 2600,
          similarity: 60,
          strengths: ['Attacking instinct', 'Natural talent', 'Creative play'],
          weaknesses: ['Calculation depth', 'Defensive skills'],
          advice: 'Like Morphy, focus on developing tactical vision while working on reducing errors through careful calculation'
        })
      } else if (accuracy < 40 && blunderCount > 2) {
        comparisons.push({
          name: 'Adolf Anderssen',
          rating: 2600,
          similarity: 55,
          strengths: ['Romantic style', 'Fighting spirit', 'Creative ideas'],
          weaknesses: ['Accuracy', 'Defensive technique'],
          advice: 'Channel your creative energy like Anderssen while focusing on improving calculation accuracy'
        })
      } else {
        comparisons.push({
          name: 'Vasily Smyslov',
          rating: 2620,
          similarity: 65,
          strengths: ['Harmonious play', 'Solid fundamentals', 'Balanced approach'],
          weaknesses: ['Aggressive play', 'Complex tactics'],
          advice: 'Study Smyslov\'s balanced style to develop a well-rounded game'
        })
      }
    }

    return comparisons
  }, [userMoves])


  const getRatingEstimate = () => {
    // First, try chess.com-style performance rating using opponent rating and game result
    if (gameRecord?.opponent_rating && gameRecord?.result) {
      const opponentRating = parseInt(gameRecord.opponent_rating)
      const gameResult = gameRecord.result.toLowerCase()
      const myRating = gameRecord.my_rating ? parseInt(gameRecord.my_rating) : 1200
      
      // Base chess.com performance rating formula
      let basePerformanceRating: number
      if (gameResult === 'win') {
        basePerformanceRating = opponentRating + 400
      } else if (gameResult === 'loss') {
        basePerformanceRating = opponentRating - 400
      } else if (gameResult === 'draw') {
        basePerformanceRating = opponentRating
      } else {
        // Fallback to move-based calculation
        return calculateMoveBasedRating()
      }
      
      // Calculate move-based adjustment to fine-tune the rating
      const moveBasedRating = calculateMoveBasedRating()
      const moveQualityAdjustment = calculateMoveQualityAdjustment()
      
      // Hybrid approach: combine base performance rating with move quality adjustment
      // This accounts for chess.com's more sophisticated calculation that considers move quality
      const finalPerformanceRating = basePerformanceRating + moveQualityAdjustment
      
      console.log('Hybrid Performance Rating Calculation:', {
        opponentRating,
        myRating,
        gameResult,
        basePerformanceRating,
        moveBasedRating,
        moveQualityAdjustment,
        finalPerformanceRating,
        calculation: `${opponentRating} ${gameResult === 'win' ? '+' : gameResult === 'loss' ? '-' : ''} ${gameResult === 'win' ? '400' : gameResult === 'loss' ? '400' : '0'} + ${moveQualityAdjustment.toFixed(1)} = ${finalPerformanceRating.toFixed(1)}`,
        gameRecord: {
          opponent_rating: gameRecord.opponent_rating,
          my_rating: gameRecord.my_rating,
          result: gameRecord.result
        }
      })
      
      return Math.max(800, Math.min(2400, Math.round(finalPerformanceRating)))
    }
    
    // Fallback to move-based calculation if no opponent rating data
    console.log('No opponent rating data available, using move-based calculation')
    return calculateMoveBasedRating()
  }

  const calculateMoveQualityAdjustment = () => {
    if (userMoves.length === 0) return 0

    const totalMoves = userMoves.length
    const bestMoves = userMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length
    const goodMoves = userMoves.filter(m => m.classification === 'good').length
    const blunders = userMoves.filter(m => m.classification === 'blunder').length
    const mistakes = userMoves.filter(m => m.classification === 'mistake').length
    const inaccuracies = userMoves.filter(m => m.classification === 'inaccuracy').length

    // Calculate move quality metrics
    const accuracy = (bestMoves / totalMoves) * 100
    const blunderRate = (blunders / totalMoves) * 100
    const mistakeRate = (mistakes / totalMoves) * 100
    const inaccuracyRate = (inaccuracies / totalMoves) * 100
    const avgCentipawnLoss = userMoves.reduce((sum, move) => sum + (move.centipawnLoss || 0), 0) / totalMoves

    // Calculate adjustment based on move quality relative to expected performance
    // This simulates chess.com's move quality analysis
    let adjustment = 0

    // Accuracy bonus/penalty (more weight than other factors)
    if (accuracy > 80) {
      adjustment += (accuracy - 80) * 2 // Strong bonus for high accuracy
    } else if (accuracy < 60) {
      adjustment -= (60 - accuracy) * 1.5 // Penalty for low accuracy
    }

    // Blunder penalty (harsh)
    adjustment -= blunderRate * 3

    // Mistake penalty (moderate)
    adjustment -= mistakeRate * 1.5

    // Inaccuracy penalty (light)
    adjustment -= inaccuracyRate * 0.5

    // Centipawn loss adjustment
    if (avgCentipawnLoss > 50) {
      adjustment -= Math.min(50, (avgCentipawnLoss - 50) * 0.3)
    } else if (avgCentipawnLoss < 20) {
      adjustment += Math.min(30, (20 - avgCentipawnLoss) * 0.5)
    }

    // Cap the adjustment to reasonable bounds
    return Math.max(-100, Math.min(100, adjustment))
  }

  const calculateMoveBasedRating = () => {
    if (userMoves.length === 0) {
      console.warn('No user moves available for rating estimation')
      return 1200 // Default rating when no data available
    }

    // Calculate move quality metrics
    const totalMoves = userMoves.length
    const bestMoves = userMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length
    const goodMoves = userMoves.filter(m => m.classification === 'good').length
    const acceptableMoves = userMoves.filter(m => m.classification === 'acceptable').length
    const inaccuracies = userMoves.filter(m => m.classification === 'inaccuracy').length
    const mistakes = userMoves.filter(m => m.classification === 'mistake').length
    const blunders = userMoves.filter(m => m.classification === 'blunder').length

    // Calculate accuracy percentage (best + brilliant moves)
    const accuracy = (bestMoves / totalMoves) * 100
    
    // Calculate blunder rate
    const blunderRate = (blunders / totalMoves) * 100
    
    // Calculate average centipawn loss for more precise rating
    const avgCentipawnLoss = userMoves.reduce((sum, move) => sum + (move.centipawnLoss || 0), 0) / totalMoves

    // Debug logging to understand the calculation
    console.log('Move-based Performance Rating Debug:', {
      totalMoves,
      bestMoves,
      goodMoves,
      acceptableMoves,
      inaccuracies,
      mistakes,
      blunders,
      accuracy: accuracy.toFixed(1),
      blunderRate: blunderRate.toFixed(1),
      avgCentipawnLoss: avgCentipawnLoss.toFixed(1),
      moveClassifications: userMoves.map(m => ({ san: m.san, classification: m.classification, centipawnLoss: m.centipawnLoss }))
    })

    // Improved rating estimation formula
    let estimatedRating = 1200 // Base rating
    
    // Accuracy factor (more realistic scaling)
    estimatedRating += (accuracy - 60) * 15 // 60% accuracy = 1200 rating baseline
    
    // Blunder penalty (harsh penalty for blunders)
    estimatedRating -= blunderRate * 40
    
    // Centipawn loss factor (additional precision)
    if (avgCentipawnLoss > 0) {
      estimatedRating -= Math.min(200, avgCentipawnLoss * 0.5) // Cap penalty at 200 points
    }
    
    // Bonus for good moves
    const goodMoveRate = (goodMoves / totalMoves) * 100
    estimatedRating += Math.min(100, goodMoveRate * 0.5)
    
    // Penalty for too many inaccuracies
    const inaccuracyRate = (inaccuracies / totalMoves) * 100
    estimatedRating -= Math.min(100, inaccuracyRate * 0.3)
    
    const finalRating = Math.max(800, Math.min(2400, Math.round(estimatedRating)))
    
    console.log('Move-based rating calculation steps:', {
      baseRating: 1200,
      accuracyAdjustment: (accuracy - 60) * 15,
      blunderPenalty: blunderRate * 40,
      centipawnPenalty: avgCentipawnLoss > 0 ? Math.min(200, avgCentipawnLoss * 0.5) : 0,
      goodMoveBonus: Math.min(100, goodMoveRate * 0.5),
      inaccuracyPenalty: Math.min(100, inaccuracyRate * 0.3),
      beforeClamp: estimatedRating,
      finalRating
    })
    
    return finalRating
  }

  return (
    <div className="space-y-6">
      {/* Performance Metrics */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Performance Metrics</h3>
        <div className="space-y-4">
          {gameComparisons.map((comparison, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-medium text-white">{comparison.metric}</h4>
                <span className="text-lg font-semibold text-white">
                  {comparison.thisGame.toFixed(1)}{comparison.metric === 'Accuracy' || comparison.metric === 'Consistency' ? '%' : ''}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-400">This Game:</span>
                  <span className="ml-2 font-medium text-white">{comparison.thisGame.toFixed(1)}{comparison.metric === 'Accuracy' || comparison.metric === 'Consistency' ? '%' : ''}</span>
                </div>
                <div>
                  <span className="text-slate-400">Average:</span>
                  <span className="ml-2 font-medium text-white">{comparison.average.toFixed(1)}{comparison.metric === 'Accuracy' || comparison.metric === 'Consistency' ? '%' : ''}</span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-300">{comparison.description}</p>
              <p className="mt-1 text-sm font-medium text-sky-300">{comparison.improvement}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Estimate */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Performance Rating</h3>
        <div className="text-center">
          <div className="mb-2 text-4xl font-bold text-sky-300">
            {getRatingEstimate()}
          </div>
          <p className="text-sm text-slate-300">
            Estimated performance rating based on move quality
          </p>
          <div className="mt-4 text-xs text-slate-400">
            <p>This is an estimate based on accuracy, blunder rate, and tactical awareness.</p>
            <p>Actual rating depends on many factors including opponent strength and time control.</p>
          </div>
        </div>
      </div>

      {/* Player Comparisons */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Playing Style Comparison</h3>
        {playerComparisons.length > 0 ? (
          <div className="space-y-4">
            {playerComparisons.map((player, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-white">{player.name}</h4>
                    <p className="text-sm text-slate-300">Peak Rating: {player.rating}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-sky-300">
                      {player.similarity}% similar
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <h5 className="mb-1 text-sm font-medium text-emerald-200">Strengths</h5>
                    <ul className="space-y-1 text-sm text-slate-200">
                      {player.strengths.map((strength, i) => (
                        <li key={i} className="flex items-center">
                          <span className="mr-2 text-emerald-300">✓</span>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="mb-1 text-sm font-medium text-rose-200">Areas to Improve</h5>
                    <ul className="space-y-1 text-sm text-slate-200">
                      {player.weaknesses.map((weakness, i) => (
                        <li key={i} className="flex items-center">
                          <span className="mr-2 text-rose-300">⚠</span>
                          {weakness}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
                  <p className="text-sm font-medium text-sky-200">Study Recommendation:</p>
                  <p className="mt-1 text-sm text-slate-200">{player.advice}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-slate-300">
            Loading playing style analysis...
          </div>
        )}
      </div>

      {/* Improvement Suggestions */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Personalized Improvement Plan</h3>
        <div className="space-y-3">
          {gameComparisons.some(c => c.percentile < 50) && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3">
              <span className="text-lg">📈</span>
              <div>
                <p className="text-sm font-semibold text-white">Focus Areas</p>
                <p className="text-xs text-amber-100">
                  {gameComparisons.filter(c => c.percentile < 50).map(c => c.metric).join(', ')} need improvement
                </p>
              </div>
            </div>
          )}

          {gameComparisons.some(c => c.percentile >= 80) && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-sm font-semibold text-white">Strengths</p>
                <p className="text-xs text-emerald-100">
                  Excellent performance in: {gameComparisons.filter(c => c.percentile >= 80).map(c => c.metric).join(', ')}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
            <span className="text-lg">🎯</span>
            <div>
              <p className="text-sm font-semibold text-white">Next Steps</p>
              <p className="text-xs text-slate-200">
                Focus on the areas with lowest scores and study games of similar players to improve your overall game
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
