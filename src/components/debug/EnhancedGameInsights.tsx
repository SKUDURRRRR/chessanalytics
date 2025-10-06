import React, { useMemo } from 'react'
import { Chess } from 'chess.js'
import { PositionalAnalysis } from './PositionalAnalysis'
import { OpeningTheoryAnalysis } from './OpeningTheoryAnalysis'
import { ComparativeAnalysis } from './ComparativeAnalysis'

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

interface EnhancedGameInsightsProps {
  moves: ProcessedMove[]
  playerColor: 'white' | 'black'
  currentMove: ProcessedMove | null
  gameRecord: any
}

interface TacticalPattern {
  name: string
  description: string
  moves: number[]
  severity: 'high' | 'medium' | 'low'
  type: 'tactical' | 'positional' | 'time-pressure' | 'opening' | 'endgame'
}

interface PhaseAnalysis {
  phase: 'opening' | 'middlegame' | 'endgame'
  startMove: number
  endMove: number
  accuracy: number
  keyMoments: ProcessedMove[]
  patterns: TacticalPattern[]
  summary: string
}

export function EnhancedGameInsights({ moves, playerColor, currentMove, gameRecord }: EnhancedGameInsightsProps) {
  const userMoves = moves.filter(move => move.isUserMove)
  const opponentMoves = moves.filter(move => !move.isUserMove)

  const tacticalPatterns = useMemo(() => {
    const patterns: TacticalPattern[] = []
    
    // Detect blunder sequences
    const blunderSequence = userMoves.filter(move => move.classification === 'blunder')
    if (blunderSequence.length >= 2) {
      patterns.push({
        name: 'Blunder Sequence',
        description: 'Multiple blunders in a short period indicate time pressure or tactical oversight',
        moves: blunderSequence.map(m => m.index),
        severity: 'high',
        type: 'tactical'
      })
    }

    // Detect tactical motifs
    const brilliantMoves = userMoves.filter(move => move.classification === 'brilliant')
    if (brilliantMoves.length > 0) {
      patterns.push({
        name: 'Tactical Brilliance',
        description: 'Exceptional tactical moves that demonstrate advanced calculation',
        moves: brilliantMoves.map(m => m.index),
        severity: 'high',
        type: 'tactical'
      })
    }

    // Detect opening deviations
    const openingMoves = userMoves.slice(0, 10)
    const openingInaccuracies = openingMoves.filter(move => 
      move.classification === 'inaccuracy' || move.classification === 'mistake'
    )
    if (openingInaccuracies.length > 0) {
      patterns.push({
        name: 'Opening Theory Deviation',
        description: 'Early deviations from established opening theory',
        moves: openingInaccuracies.map(m => m.index),
        severity: 'medium',
        type: 'opening'
      })
    }

    // Detect time pressure patterns (moves with high centipawn loss in later game)
    const lateGameMoves = userMoves.slice(-10)
    const timePressureMoves = lateGameMoves.filter(move => 
      move.centipawnLoss && move.centipawnLoss > 200
    )
    if (timePressureMoves.length >= 2) {
      patterns.push({
        name: 'Time Pressure',
        description: 'Quality deterioration in late game suggests time management issues',
        moves: timePressureMoves.map(m => m.index),
        severity: 'medium',
        type: 'time-pressure'
      })
    }

    return patterns
  }, [userMoves])

  const phaseAnalysis = useMemo(() => {
    const totalMoves = userMoves.length
    const openingEnd = Math.min(12, Math.floor(totalMoves * 0.2))
    const middlegameEnd = Math.floor(totalMoves * 0.8)
    
    const phases: PhaseAnalysis[] = []

    // Opening phase
    const openingMoves = userMoves.slice(0, openingEnd)
    const openingAccuracy = openingMoves.length > 0 
      ? (openingMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length / openingMoves.length) * 100
      : 0
    
    phases.push({
      phase: 'opening',
      startMove: 1,
      endMove: openingEnd,
      accuracy: openingAccuracy,
      keyMoments: openingMoves.filter(m => m.classification !== 'best' && m.classification !== 'acceptable'),
      patterns: tacticalPatterns.filter(p => p.type === 'opening'),
      summary: openingAccuracy > 80 
        ? 'Solid opening play with good theoretical knowledge'
        : openingAccuracy > 60
        ? 'Decent opening play with some inaccuracies'
        : 'Opening play needs improvement - consider studying theory'
    })

    // Middlegame phase
    const middlegameMoves = userMoves.slice(openingEnd, middlegameEnd)
    const middlegameAccuracy = middlegameMoves.length > 0
      ? (middlegameMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length / middlegameMoves.length) * 100
      : 0
    
    phases.push({
      phase: 'middlegame',
      startMove: openingEnd + 1,
      endMove: middlegameEnd,
      accuracy: middlegameAccuracy,
      keyMoments: middlegameMoves.filter(m => m.classification !== 'best' && m.classification !== 'acceptable'),
      patterns: tacticalPatterns.filter(p => p.type === 'tactical' || p.type === 'positional'),
      summary: middlegameAccuracy > 75
        ? 'Strong middlegame play with good tactical awareness'
        : middlegameAccuracy > 50
        ? 'Mixed middlegame performance - focus on calculation'
        : 'Middlegame needs work - study tactical patterns'
    })

    // Endgame phase
    const endgameMoves = userMoves.slice(middlegameEnd)
    const endgameAccuracy = endgameMoves.length > 0
      ? (endgameMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length / endgameMoves.length) * 100
      : 0
    
    phases.push({
      phase: 'endgame',
      startMove: middlegameEnd + 1,
      endMove: totalMoves,
      accuracy: endgameAccuracy,
      keyMoments: endgameMoves.filter(m => m.classification !== 'best' && m.classification !== 'acceptable'),
      patterns: tacticalPatterns.filter(p => p.type === 'endgame'),
      summary: endgameAccuracy > 85
        ? 'Excellent endgame technique'
        : endgameAccuracy > 65
        ? 'Good endgame play with room for improvement'
        : 'Endgame technique needs significant work'
    })

    return phases
  }, [userMoves, tacticalPatterns])

  const criticalMoments = useMemo(() => {
    return userMoves.filter(move => 
      move.classification === 'blunder' || 
      move.classification === 'brilliant' ||
      (move.centipawnLoss && move.centipawnLoss > 300)
    ).sort((a, b) => Math.abs(b.centipawnLoss || 0) - Math.abs(a.centipawnLoss || 0))
  }, [userMoves])

  const learningRecommendations = useMemo(() => {
    const recommendations: string[] = []
    
    // Analyze patterns to generate recommendations
    const blunderCount = userMoves.filter(m => m.classification === 'blunder').length
    const tacticalCount = userMoves.filter(m => m.classification === 'brilliant').length
    const openingIssues = tacticalPatterns.filter(p => p.type === 'opening').length
    const timePressureIssues = tacticalPatterns.filter(p => p.type === 'time-pressure').length

    if (blunderCount > 2) {
      recommendations.push('Focus on blunder prevention - take time to double-check moves')
    }
    
    if (tacticalCount === 0 && userMoves.length > 20) {
      recommendations.push('Work on tactical vision - solve puzzles to improve pattern recognition')
    }
    
    if (openingIssues > 0) {
      recommendations.push('Study opening theory for the openings you play most frequently')
    }
    
    if (timePressureIssues > 0) {
      recommendations.push('Improve time management - allocate more time for critical positions')
    }

    // Phase-specific recommendations
    const weakestPhase = phaseAnalysis.reduce((weakest, phase) => 
      phase.accuracy < weakest.accuracy ? phase : weakest
    )
    
    if (weakestPhase.accuracy < 60) {
      recommendations.push(`Focus on ${weakestPhase.phase} play - this is your weakest phase`)
    }

    return recommendations
  }, [userMoves, tacticalPatterns, phaseAnalysis])

  return (
    <div className="space-y-6">
      {/* Opening Theory Analysis */}
      <OpeningTheoryAnalysis 
        moves={moves}
        playerColor={playerColor}
        gameRecord={gameRecord}
      />

      {/* Positional Analysis */}
      <PositionalAnalysis 
        moves={moves}
        playerColor={playerColor}
        currentMove={currentMove}
      />

      {/* Tactical Patterns */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Tactical Patterns</h3>
        {tacticalPatterns.length > 0 ? (
          <div className="space-y-3">
            {tacticalPatterns.map((pattern, index) => (
              <div key={index} className={`p-3 rounded-lg border-l-4 ${
                pattern.severity === 'high' ? 'border-red-500 bg-red-50' :
                pattern.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">{pattern.name}</h4>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    pattern.severity === 'high' ? 'bg-red-100 text-red-700' :
                    pattern.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {pattern.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{pattern.description}</p>
                <div className="text-xs text-gray-500 mt-2">
                  Moves: {pattern.moves.map(m => `#${m + 1}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No significant tactical patterns detected in this game.</p>
        )}
      </div>

      {/* Phase Analysis */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Phase-by-Phase Analysis</h3>
        <div className="space-y-4">
          {phaseAnalysis.map((phase, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 capitalize">{phase.phase}</h4>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Moves {phase.startMove}-{phase.endMove}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    phase.accuracy > 80 ? 'bg-green-100 text-green-700' :
                    phase.accuracy > 60 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {phase.accuracy.toFixed(1)}% accuracy
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">{phase.summary}</p>
              
              {phase.keyMoments.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Key Moments:</h5>
                  <div className="space-y-1">
                    {phase.keyMoments.slice(0, 3).map((move, moveIndex) => (
                      <div key={moveIndex} className="flex items-center justify-between text-xs">
                        <span>Move {move.moveNumber}: {move.san}</span>
                        <span className={`px-2 py-1 rounded ${
                          move.classification === 'blunder' ? 'bg-red-100 text-red-700' :
                          move.classification === 'mistake' ? 'bg-orange-100 text-orange-700' :
                          move.classification === 'brilliant' ? 'bg-purple-100 text-purple-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {move.classification}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Critical Moments */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Critical Moments</h3>
        {criticalMoments.length > 0 ? (
          <div className="space-y-3">
            {criticalMoments.slice(0, 5).map((move, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">Move {move.moveNumber}: {move.san}</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {move.centipawnLoss ? `(${Math.round(move.centipawnLoss)} cp loss)` : ''}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  move.classification === 'blunder' ? 'bg-red-100 text-red-700' :
                  move.classification === 'brilliant' ? 'bg-purple-100 text-purple-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {move.classification}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No critical moments identified in this game.</p>
        )}
      </div>

      {/* Learning Recommendations */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Learning Recommendations</h3>
        {learningRecommendations.length > 0 ? (
          <div className="space-y-2">
            {learningRecommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <span className="text-blue-500 text-lg">💡</span>
                <p className="text-sm text-gray-700">{recommendation}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">Great game! Continue practicing to maintain your current level.</p>
        )}
      </div>

      {/* Comparative Analysis */}
      <ComparativeAnalysis 
        moves={moves}
        playerColor={playerColor}
        gameRecord={gameRecord}
      />
    </div>
  )
}
