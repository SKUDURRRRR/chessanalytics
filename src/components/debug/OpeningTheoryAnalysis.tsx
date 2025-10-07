import React, { useMemo } from 'react'
import { Chess } from 'chess.js'
import { identifyOpening } from '../../utils/openingIdentification'
import { EnhancedOpeningAnalysis } from './EnhancedOpeningAnalysis'

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

interface OpeningTheoryAnalysisProps {
  moves: ProcessedMove[]
  playerColor: 'white' | 'black'
  gameRecord: any
  openingStats?: Array<{
    opening: string
    openingFamily: string
    games: number
    winRate: number
    averageElo: number
  }>
  totalGames?: number
}


interface OpeningVariation {
  name: string
  moves: string[]
  description: string
  popularity: 'common' | 'uncommon' | 'rare'
  evaluation: 'equal' | 'slight-advantage' | 'advantage' | 'disadvantage'
}

export function OpeningTheoryAnalysis({ moves, playerColor, gameRecord, openingStats, totalGames }: OpeningTheoryAnalysisProps) {
  const userMoves = moves.filter(move => move.isUserMove)
  const openingMoves = userMoves.slice(0, 15) // First 15 moves typically cover opening



  const identifiedVariation = useMemo(() => {
    const firstMoves = openingMoves.map(m => m.san)
    const openingResult = identifyOpening(gameRecord, firstMoves, playerColor)
    
    // Convert the result to the expected format
    return {
      name: openingResult.name,
      moves: firstMoves,
      description: openingResult.description,
      popularity: openingResult.popularity,
      evaluation: openingResult.evaluation
    }
  }, [openingMoves, gameRecord, playerColor])

  const openingAccuracy = useMemo(() => {
    if (openingMoves.length === 0) return 0
    const bestMoves = openingMoves.filter(move => 
      move.classification === 'best' || move.classification === 'brilliant'
    ).length
    return Math.round((bestMoves / openingMoves.length) * 100)
  }, [openingMoves])

  const theoryKnowledge = useMemo(() => {
    const totalMoves = openingMoves.length
    const inaccuracyMoves = openingMoves.filter(move => 
      move.classification === 'inaccuracy' || move.classification === 'mistake'
    ).length
    
    if (inaccuracyMoves === 0) return 'excellent'
    if (inaccuracyMoves <= totalMoves * 0.1) return 'good'
    if (inaccuracyMoves <= totalMoves * 0.2) return 'fair'
    return 'needs-improvement'
  }, [openingMoves])

  const getTheoryScore = (knowledge: string) => {
    switch (knowledge) {
      case 'excellent': return { score: 9, color: 'text-green-600', bg: 'bg-green-100' }
      case 'good': return { score: 7, color: 'text-blue-600', bg: 'bg-blue-100' }
      case 'fair': return { score: 5, color: 'text-yellow-600', bg: 'bg-yellow-100' }
      default: return { score: 3, color: 'text-red-600', bg: 'bg-red-100' }
    }
  }

  const scoreInfo = getTheoryScore(theoryKnowledge)

  return (
    <EnhancedOpeningAnalysis 
      moves={moves}
      playerColor={playerColor}
      gameRecord={gameRecord}
      openingStats={openingStats}
      totalGames={totalGames}
    />
  )
}
