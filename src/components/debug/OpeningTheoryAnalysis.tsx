import React, { useMemo } from 'react'
import { Chess } from 'chess.js'

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
}

interface OpeningDeviation {
  moveNumber: number
  move: string
  theoryMove: string | null
  evaluation: number
  explanation: string
  severity: 'minor' | 'moderate' | 'major'
}

interface OpeningVariation {
  name: string
  moves: string[]
  description: string
  popularity: 'common' | 'uncommon' | 'rare'
  evaluation: 'equal' | 'slight-advantage' | 'advantage' | 'disadvantage'
}

export function OpeningTheoryAnalysis({ moves, playerColor, gameRecord }: OpeningTheoryAnalysisProps) {
  const userMoves = moves.filter(move => move.isUserMove)
  const openingMoves = userMoves.slice(0, 15) // First 15 moves typically cover opening

  // Common opening variations database (simplified)
  const openingVariations: Record<string, OpeningVariation[]> = {
    'e4': [
      {
        name: 'Sicilian Defense',
        moves: ['e4', 'c5'],
        description: 'Most popular response to 1.e4',
        popularity: 'common',
        evaluation: 'equal'
      },
      {
        name: 'French Defense',
        moves: ['e4', 'e6'],
        description: 'Solid defensive setup',
        popularity: 'common',
        evaluation: 'equal'
      },
      {
        name: 'Caro-Kann Defense',
        moves: ['e4', 'c6'],
        description: 'Solid and reliable',
        popularity: 'common',
        evaluation: 'equal'
      }
    ],
    'd4': [
      {
        name: 'Queen\'s Gambit',
        moves: ['d4', 'd5', 'c4'],
        description: 'Classical opening with central control',
        popularity: 'common',
        evaluation: 'slight-advantage'
      },
      {
        name: 'King\'s Indian Defense',
        moves: ['d4', 'Nf6', 'c4', 'g6'],
        description: 'Dynamic counter-attacking setup',
        popularity: 'common',
        evaluation: 'equal'
      }
    ]
  }

  const openingDeviations = useMemo(() => {
    const deviations: OpeningDeviation[] = []
    
    // Check for theory deviations in opening moves
    openingMoves.forEach((move, index) => {
      if (move.classification === 'inaccuracy' || move.classification === 'mistake') {
        const severity = move.centipawnLoss && move.centipawnLoss > 100 ? 'major' :
                        move.centipawnLoss && move.centipawnLoss > 50 ? 'moderate' : 'minor'
        
        deviations.push({
          moveNumber: move.moveNumber,
          move: move.san,
          theoryMove: move.bestMoveSan,
          evaluation: move.centipawnLoss || 0,
          explanation: move.explanation,
          severity
        })
      }
    })

    return deviations
  }, [openingMoves])

  const identifiedVariation = useMemo(() => {
    const firstMoves = openingMoves.slice(0, 4).map(m => m.san)
    
    // Try to identify the opening variation
    for (const [firstMove, variations] of Object.entries(openingVariations)) {
      for (const variation of variations) {
        if (variation.moves.every((move, index) => 
          index < firstMoves.length && firstMoves[index] === move
        )) {
          return variation
        }
      }
    }

    // Fallback to basic identification
    if (firstMoves[0] === 'e4') {
      return {
        name: 'King\'s Pawn Opening',
        moves: ['e4'],
        description: 'Classical opening move',
        popularity: 'common' as const,
        evaluation: 'equal' as const
      }
    } else if (firstMoves[0] === 'd4') {
      return {
        name: 'Queen\'s Pawn Opening',
        moves: ['d4'],
        description: 'Classical opening move',
        popularity: 'common' as const,
        evaluation: 'equal' as const
      }
    }

    return null
  }, [openingMoves])

  const openingAccuracy = useMemo(() => {
    if (openingMoves.length === 0) return 0
    const bestMoves = openingMoves.filter(move => 
      move.classification === 'best' || move.classification === 'brilliant'
    ).length
    return Math.round((bestMoves / openingMoves.length) * 100)
  }, [openingMoves])

  const theoryKnowledge = useMemo(() => {
    const deviationCount = openingDeviations.length
    const totalMoves = openingMoves.length
    
    if (deviationCount === 0) return 'excellent'
    if (deviationCount <= totalMoves * 0.1) return 'good'
    if (deviationCount <= totalMoves * 0.2) return 'fair'
    return 'needs-improvement'
  }, [openingDeviations, openingMoves])

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
    <div className="space-y-6">
      {/* Opening Overview */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Opening Analysis</h3>
        
        {identifiedVariation ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-medium text-gray-900">{identifiedVariation.name}</h4>
                <p className="text-sm text-gray-600">{identifiedVariation.description}</p>
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  identifiedVariation.popularity === 'common' ? 'bg-green-100 text-green-700' :
                  identifiedVariation.popularity === 'uncommon' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {identifiedVariation.popularity}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-gray-700">Theory Knowledge</h5>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${scoreInfo.bg}`}>
                    <span className={`text-sm font-bold ${scoreInfo.color}`}>{scoreInfo.score}</span>
                  </div>
                  <span className="text-sm text-gray-600 capitalize">{theoryKnowledge}</span>
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium text-gray-700">Opening Accuracy</h5>
                <div className="mt-1">
                  <span className={`text-lg font-semibold ${
                    openingAccuracy >= 80 ? 'text-green-600' :
                    openingAccuracy >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {openingAccuracy}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-600">Unable to identify specific opening variation</p>
          </div>
        )}
      </div>

      {/* Theory Deviations */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Theory Deviations</h3>
        {openingDeviations.length > 0 ? (
          <div className="space-y-3">
            {openingDeviations.map((deviation, index) => (
              <div key={index} className={`border-l-4 p-3 rounded ${
                deviation.severity === 'major' ? 'border-red-500 bg-red-50' :
                deviation.severity === 'moderate' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Move {deviation.moveNumber}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      deviation.severity === 'major' ? 'bg-red-100 text-red-700' :
                      deviation.severity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {deviation.severity}
                    </span>
                    <span className="text-sm text-gray-600">
                      {deviation.evaluation > 0 ? '+' : ''}{Math.round(deviation.evaluation)} cp
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Played:</span> {deviation.move}
                  {deviation.theoryMove && (
                    <>
                      <br />
                      <span className="font-medium">Theory:</span> {deviation.theoryMove}
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-600">{deviation.explanation}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-green-500 text-2xl mb-2">✅</div>
            <p className="text-gray-600">No significant theory deviations found</p>
            <p className="text-sm text-gray-500 mt-1">Good opening knowledge!</p>
          </div>
        )}
      </div>

      {/* Opening Recommendations */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Study Recommendations</h3>
        <div className="space-y-3">
          {theoryKnowledge === 'needs-improvement' && (
            <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
              <span className="text-red-500 text-lg">📚</span>
              <div>
                <p className="text-sm font-medium text-red-800">Study Opening Theory</p>
                <p className="text-sm text-red-700">
                  Consider studying the {identifiedVariation?.name || 'opening'} more deeply to improve your early game play
                </p>
              </div>
            </div>
          )}

          {openingDeviations.some(d => d.severity === 'major') && (
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
              <span className="text-yellow-500 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-yellow-800">Avoid Major Deviations</p>
                <p className="text-sm text-yellow-700">
                  Major theory deviations can lead to difficult positions. Focus on learning the main lines
                </p>
              </div>
            </div>
          )}

          {openingAccuracy >= 80 && (
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <span className="text-green-500 text-lg">🏆</span>
              <div>
                <p className="text-sm font-medium text-green-800">Excellent Opening Play</p>
                <p className="text-sm text-green-700">
                  Your opening knowledge is strong. Consider expanding your repertoire with new variations
                </p>
              </div>
            </div>
          )}

          {identifiedVariation && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-500 text-lg">💡</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Expand Your Repertoire</p>
                <p className="text-sm text-blue-700">
                  Learn alternative lines in the {identifiedVariation.name} to handle different responses
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
