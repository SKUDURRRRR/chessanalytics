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

interface PositionalAnalysisProps {
  moves: ProcessedMove[]
  playerColor: 'white' | 'black'
  currentMove: ProcessedMove | null
}

interface PositionalElement {
  name: string
  description: string
  strength: 'strong' | 'moderate' | 'weak'
  moves: number[]
  impact: number // -100 to 100
}

interface StrategicTheme {
  name: string
  description: string
  moves: number[]
  importance: 'critical' | 'important' | 'minor'
  playerAdvantage: boolean
}

export function PositionalAnalysis({ moves, playerColor, currentMove }: PositionalAnalysisProps) {
  const userMoves = moves.filter(move => move.isUserMove)
  const opponentMoves = moves.filter(move => !move.isUserMove)

  const positionalElements = useMemo(() => {
    const elements: PositionalElement[] = []
    
    // Analyze piece activity
    const activeMoves = userMoves.filter(move => 
      move.san.includes('+') || move.san.includes('x') || move.san.includes('=')
    )
    if (activeMoves.length > userMoves.length * 0.3) {
      elements.push({
        name: 'Piece Activity',
        description: 'High piece activity with many captures, checks, and promotions',
        strength: 'strong',
        moves: activeMoves.map(m => m.index),
        impact: 15
      })
    } else if (activeMoves.length < userMoves.length * 0.1) {
      elements.push({
        name: 'Piece Activity',
        description: 'Low piece activity - consider more active piece play',
        strength: 'weak',
        moves: userMoves.filter(m => !activeMoves.includes(m)).map(m => m.index),
        impact: -10
      })
    }

    // Analyze pawn structure
    const pawnMoves = userMoves.filter(move => 
      move.san.toLowerCase().includes('p') || 
      (move.san.length === 2 && !move.san.includes('N') && !move.san.includes('B') && !move.san.includes('R') && !move.san.includes('Q'))
    )
    if (pawnMoves.length > userMoves.length * 0.4) {
      elements.push({
        name: 'Pawn Structure',
        description: 'Active pawn play - good for controlling space and creating weaknesses',
        strength: 'moderate',
        moves: pawnMoves.map(m => m.index),
        impact: 8
      })
    }

    // Analyze king safety
    const kingMoves = userMoves.filter(move => 
      move.san.includes('O-O') || move.san.includes('K')
    )
    if (kingMoves.length > 0) {
      elements.push({
        name: 'King Safety',
        description: kingMoves.some(m => m.san.includes('O-O')) 
          ? 'Good king safety with castling'
          : 'King movement indicates potential safety concerns',
        strength: kingMoves.some(m => m.san.includes('O-O')) ? 'strong' : 'weak',
        moves: kingMoves.map(m => m.index),
        impact: kingMoves.some(m => m.san.includes('O-O')) ? 12 : -15
      })
    }

    // Analyze piece coordination
    const coordinationMoves = userMoves.filter(move => 
      move.classification === 'best' || move.classification === 'brilliant'
    )
    if (coordinationMoves.length > userMoves.length * 0.2) {
      elements.push({
        name: 'Piece Coordination',
        description: 'Excellent piece coordination with many best moves',
        strength: 'strong',
        moves: coordinationMoves.map(m => m.index),
        impact: 20
      })
    }

    return elements
  }, [userMoves])

  const strategicThemes = useMemo(() => {
    const themes: StrategicTheme[] = []
    
    // Analyze opening development
    const openingMoves = userMoves.slice(0, 10)
    const developmentMoves = openingMoves.filter(move => 
      move.san.includes('N') || move.san.includes('B') || move.san.includes('O-O')
    )
    if (developmentMoves.length >= 6) {
      themes.push({
        name: 'Rapid Development',
        description: 'Quick piece development in the opening',
        moves: developmentMoves.map(m => m.index),
        importance: 'important',
        playerAdvantage: true
      })
    }

    // Analyze center control
    const centerMoves = userMoves.filter(move => 
      move.san.includes('d4') || move.san.includes('d5') || 
      move.san.includes('e4') || move.san.includes('e5') ||
      move.san.includes('c4') || move.san.includes('c5') ||
      move.san.includes('f4') || move.san.includes('f5')
    )
    if (centerMoves.length > 0) {
      themes.push({
        name: 'Center Control',
        description: 'Active play in the center of the board',
        moves: centerMoves.map(m => m.index),
        importance: 'critical',
        playerAdvantage: true
      })
    }

    // Analyze attacking patterns
    const attackingMoves = userMoves.filter(move => 
      move.san.includes('+') || move.san.includes('x') ||
      (move.centipawnLoss && move.centipawnLoss < -100) // Moves that improve position significantly
    )
    if (attackingMoves.length > userMoves.length * 0.25) {
      themes.push({
        name: 'Attacking Play',
        description: 'Aggressive attacking style with many tactical moves',
        moves: attackingMoves.map(m => m.index),
        importance: 'important',
        playerAdvantage: true
      })
    }

    // Analyze defensive patterns
    const defensiveMoves = userMoves.filter(move => 
      move.classification === 'good' || move.classification === 'acceptable'
    )
    if (defensiveMoves.length > userMoves.length * 0.6) {
      themes.push({
        name: 'Solid Defense',
        description: 'Consistent solid play with good defensive moves',
        moves: defensiveMoves.map(m => m.index),
        importance: 'important',
        playerAdvantage: true
      })
    }

    return themes
  }, [userMoves])

  const positionalScore = useMemo(() => {
    const totalImpact = positionalElements.reduce((sum, element) => sum + element.impact, 0)
    const maxPossible = positionalElements.length * 20 // Assuming max impact of 20 per element
    return maxPossible > 0 ? Math.round((totalImpact / maxPossible) * 100) : 50
  }, [positionalElements])

  const getPositionalScore = (score: number) => {
    const numericalScore = Math.round((score / 100) * 10)
    if (numericalScore >= 9) return { score: numericalScore, color: 'text-green-600', bg: 'bg-green-100' }
    if (numericalScore >= 7) return { score: numericalScore, color: 'text-blue-600', bg: 'bg-blue-100' }
    if (numericalScore >= 5) return { score: numericalScore, color: 'text-yellow-600', bg: 'bg-yellow-100' }
    if (numericalScore >= 3) return { score: numericalScore, color: 'text-orange-600', bg: 'bg-orange-100' }
    return { score: numericalScore, color: 'text-red-600', bg: 'bg-red-100' }
  }

  const scoreInfo = getPositionalScore(positionalScore)

  return (
    <div className="space-y-6">
      {/* Positional Score Overview */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Positional Assessment</h3>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-gray-600">Overall Positional Play</h4>
            <p className="text-xs text-gray-500 mt-1">Based on piece activity, coordination, and strategic themes</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${scoreInfo.bg}`}>
              <span className={`text-2xl font-bold ${scoreInfo.color}`}>{scoreInfo.score}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">out of 10</p>
          </div>
        </div>
      </div>

      {/* Positional Elements */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Positional Elements</h3>
        {positionalElements.length > 0 ? (
          <div className="space-y-3">
            {positionalElements.map((element, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{element.name}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      element.strength === 'strong' ? 'bg-green-100 text-green-700' :
                      element.strength === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {element.strength}
                    </span>
                    <span className={`text-sm font-medium ${
                      element.impact > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {element.impact > 0 ? '+' : ''}{element.impact}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{element.description}</p>
                <div className="text-xs text-gray-500">
                  Moves: {element.moves.map(m => `#${m + 1}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No significant positional elements identified.</p>
        )}
      </div>

      {/* Strategic Themes */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Strategic Themes</h3>
        {strategicThemes.length > 0 ? (
          <div className="space-y-3">
            {strategicThemes.map((theme, index) => (
              <div key={index} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{theme.name}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      theme.importance === 'critical' ? 'bg-red-100 text-red-700' :
                      theme.importance === 'important' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {theme.importance}
                    </span>
                    <span className={`text-sm font-medium ${
                      theme.playerAdvantage ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {theme.playerAdvantage ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{theme.description}</p>
                <div className="text-xs text-gray-500">
                  Moves: {theme.moves.map(m => `#${m + 1}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-sm">No clear strategic themes identified.</p>
        )}
      </div>

      {/* Positional Recommendations */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Positional Recommendations</h3>
        <div className="space-y-2">
          {scoreInfo.score < 6 && (
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
              <span className="text-yellow-500 text-lg">⚠️</span>
              <div>
                <p className="text-sm font-medium text-yellow-800">Improve Positional Understanding</p>
                <p className="text-sm text-yellow-700">Focus on piece coordination, pawn structure, and strategic planning</p>
              </div>
            </div>
          )}
          
          {positionalElements.some(e => e.name === 'Piece Activity' && e.strength === 'weak') && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-500 text-lg">🎯</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Increase Piece Activity</p>
                <p className="text-sm text-blue-700">Look for opportunities to activate your pieces and create threats</p>
              </div>
            </div>
          )}

          {strategicThemes.some(t => t.name === 'Center Control') && (
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <span className="text-green-500 text-lg">✅</span>
              <div>
                <p className="text-sm font-medium text-green-800">Good Center Control</p>
                <p className="text-sm text-green-700">Continue focusing on central squares and space control</p>
              </div>
            </div>
          )}

          {scoreInfo.score >= 8 && (
            <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
              <span className="text-green-500 text-lg">🏆</span>
              <div>
                <p className="text-sm font-medium text-green-800">Excellent Positional Play</p>
                <p className="text-sm text-green-700">Your positional understanding is strong - keep up the good work!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
