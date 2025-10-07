import React, { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { PositionalAnalysisBoard } from './PositionalAnalysisBoard'
import { ChessBoardTest } from './ChessBoardTest'
import { getMoveClassificationBgColor } from '../../utils/chessColors'

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
  // Force re-render with timestamp
  const renderKey = Date.now()
  const userMoves = moves.filter(move => move.isUserMove)
  const opponentMoves = moves.filter(move => !move.isUserMove)
  
  // Track current move for each element
  const [elementMoveStates, setElementMoveStates] = useState<{[key: string]: {moveIndex: number, move: ProcessedMove | null, isElementMove: boolean}}>({})

  const getMoveExplanation = (elementName: string, move: ProcessedMove) => {
    const explanations: { [key: string]: string } = {
      'Piece Activity': `This move demonstrates ${move.san} - ${move.explanation || 'an active piece move that creates threats or improves piece coordination'}. In positional play, piece activity is crucial for maintaining pressure and creating tactical opportunities.`,
      'King Safety': `Castling with ${move.san} - ${move.explanation || 'securing the king in a safe position'}. King safety is fundamental in chess; a well-castled king is protected and allows other pieces to focus on attack.`,
      'Piece Coordination': `Excellent coordination with ${move.san} - ${move.explanation || 'this move works harmoniously with other pieces'}. Good piece coordination means pieces support each other and work together toward common goals.`,
      'Center Control': `Central play with ${move.san} - ${move.explanation || 'controlling key central squares'}. The center is the heart of the board; controlling it gives your pieces more mobility and restricts your opponent's options.`,
      'Attacking Play': `Aggressive move ${move.san} - ${move.explanation || 'creating threats and maintaining initiative'}. Attacking play keeps pressure on the opponent and can force defensive moves that weaken their position.`,
      'Rapid Development': `Quick development with ${move.san} - ${move.explanation || 'bringing pieces into active positions'}. Fast development in the opening gives you more options and can catch unprepared opponents off-guard.`,
      'Solid Defense': `Solid defensive move ${move.san} - ${move.explanation || 'maintaining a strong position'}. Solid defense prevents your opponent from creating threats while keeping your position flexible for future plans.`,
      'Pawn Structure': `Pawn move ${move.san} - ${move.explanation || 'structuring pawns strategically'}. Good pawn structure controls key squares and creates long-term advantages.`
    }

    return explanations[elementName] || `${move.san} - ${move.explanation || 'This move contributes to the overall positional theme'}.`
  }

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

  const detailedMetrics = useMemo(() => {
    const totalMoves = userMoves.length
    const bestMoves = userMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length
    const goodMoves = userMoves.filter(m => m.classification === 'good').length
    const blunders = userMoves.filter(m => m.classification === 'blunder').length
    const mistakes = userMoves.filter(m => m.classification === 'mistake' || m.classification === 'blunder').length
    const inaccuracies = userMoves.filter(m => m.classification === 'inaccuracy').length
    
    // Accuracy now measures blunder avoidance (percentage of moves that are NOT blunders)
    const accuracy = totalMoves > 0 ? Math.round(((totalMoves - blunders) / totalMoves) * 100) : 0
    const solidity = totalMoves > 0 ? Math.round(((bestMoves + goodMoves) / totalMoves) * 100) : 0
    const errorRate = totalMoves > 0 ? Math.round((mistakes / totalMoves) * 100) : 0
    
    // Calculate average centipawn loss
    const movesWithLoss = userMoves.filter(m => m.centipawnLoss !== null)
    const avgCentipawnLoss = movesWithLoss.length > 0 
      ? Math.round(movesWithLoss.reduce((sum, m) => sum + (m.centipawnLoss || 0), 0) / movesWithLoss.length)
      : 0

    // Calculate consistency (streak of good moves)
    let maxStreak = 0
    let currentStreak = 0
    for (const move of userMoves) {
      if (move.classification === 'best' || move.classification === 'brilliant' || move.classification === 'good') {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }

    return {
      accuracy,
      solidity,
      errorRate,
      avgCentipawnLoss,
      maxStreak,
      totalMoves,
      bestMoves,
      goodMoves,
      blunders,
      mistakes,
      inaccuracies
    }
  }, [userMoves])

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
    <div key={renderKey} className="space-y-6">
      {/* Test Chess Board */}
      <ChessBoardTest />
      
      {/* Positional Score Overview */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-6 text-lg font-semibold text-white">Positional Assessment</h3>
        
        {/* Header with Score */}
        <div className="mb-6 flex items-start gap-4">
          {/* Score Circle - Moved to left side */}
          <div className="flex flex-col items-center">
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 ${scoreInfo.bg.replace('bg-', 'bg-opacity-30 bg-')}`}>
              <span className={`text-lg font-bold ${scoreInfo.color.replace('text-', 'text-')}`}>{scoreInfo.score}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">out of 10</p>
            <div className="text-xs text-slate-500">
              {scoreInfo.score >= 9 ? 'Outstanding' : 
               scoreInfo.score >= 7 ? 'Strong' : 
               scoreInfo.score >= 5 ? 'Average' : 'Needs work'}
            </div>
          </div>
          
          <div className="flex-1">
            <h4 className="text-sm font-medium text-slate-300">Overall Positional Play</h4>
            <p className="mt-1 text-xs text-slate-400">Based on piece activity, coordination, and strategic themes</p>
          </div>
        </div>

        {/* Detailed Metrics Grid */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Accuracy</span>
                  <span className="text-sm font-semibold text-emerald-300">{detailedMetrics.accuracy}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, detailedMetrics.accuracy)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Percentage of moves that avoid blunders
                </div>
              </div>
              
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Solidity</span>
                  <span className="text-sm font-semibold text-sky-300">{detailedMetrics.solidity}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
                  <div 
                    className="h-full bg-sky-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, detailedMetrics.solidity)}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Percentage of best, brilliant, and good moves played
                </div>
              </div>
              
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Avg Loss</span>
                  <span className="text-sm font-semibold text-amber-300">{detailedMetrics.avgCentipawnLoss}cp</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {detailedMetrics.avgCentipawnLoss < 20 ? 'Excellent' : 
                   detailedMetrics.avgCentipawnLoss < 50 ? 'Good' : 
                   detailedMetrics.avgCentipawnLoss < 100 ? 'Average' : 'Needs improvement'}
                </div>
              </div>
              
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Max Streak</span>
                  <span className="text-sm font-semibold text-purple-300">{detailedMetrics.maxStreak}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {detailedMetrics.maxStreak >= 5 ? 'Very consistent' : 
                   detailedMetrics.maxStreak >= 3 ? 'Consistent' : 'Inconsistent'}
                </div>
              </div>
            </div>
        </div>
      </div>

      {/* Positional Elements */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-6 text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          Positional Elements
          <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full ml-2">UPDATED</span>
        </h3>
        {positionalElements.length > 0 ? (
          <div className="space-y-4">
            {positionalElements.map((element, index) => {
              const elementKey = `element-${index}`
              const currentElementState = elementMoveStates[elementKey]
              
              return (
                <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-all duration-200">
                  <div className="flex flex-col lg:flex-row items-start gap-6">
                    {/* Element Info */}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                          <span className="text-emerald-400">✓</span>
                          {element.name}
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                            element.strength === 'strong'
                              ? 'bg-rose-500/30 text-rose-100 border border-rose-400/30'
                              : element.strength === 'moderate'
                                ? 'bg-sky-500/30 text-sky-100 border border-sky-400/30'
                                : 'bg-slate-500/30 text-slate-100 border border-slate-400/30'
                          }`}>
                            {element.strength === 'strong' ? 'CRITICAL' : 
                             element.strength === 'moderate' ? 'IMPORTANT' : 'MINOR'}
                          </span>
                          <span className={`text-lg font-bold ${
                            element.impact > 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}>
                            {element.impact > 0 ? '✓' : '✗'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{element.description}</p>
                      <div className="text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2 max-h-20 overflow-y-auto">
                        <span className="font-medium">Key Moves:</span> 
                        <div className="mt-1 flex flex-wrap gap-1">
                          {element.moves.map(m => (
                            <span key={m} className="bg-slate-700/50 px-2 py-1 rounded text-xs">
                              #{m + 1}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Move Explanation - Now in left panel */}
                      {currentElementState?.isElementMove && currentElementState.move && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-blue-400">💡</span>
                            <h5 className="text-xs font-semibold text-white">Move Explanation</h5>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed break-words">
                            {getMoveExplanation(element.name, currentElementState.move)}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Chess Board */}
                    <div className="flex-shrink-0 w-full lg:w-auto">
                      <PositionalAnalysisBoard
                        element={element}
                        allMoves={moves}
                        playerColor={playerColor}
                        className="lg:sticky lg:top-4"
                        onMoveChange={(moveIndex, move, isElementMove) => {
                          setElementMoveStates(prev => ({
                            ...prev,
                            [elementKey]: { moveIndex, move, isElementMove }
                          }))
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-300 text-lg">No significant positional elements identified.</p>
          </div>
        )}
      </div>

      {/* Strategic Themes */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-6 text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          Strategic Themes
          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full ml-2">UPDATED</span>
        </h3>
        {strategicThemes.length > 0 ? (
          <div className="space-y-4">
            {strategicThemes.map((theme, index) => {
              const themeKey = `theme-${index}`
              const currentThemeState = elementMoveStates[themeKey]
              
              return (
                <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-all duration-200">
                  <div className="flex flex-col lg:flex-row items-start gap-6">
                    {/* Theme Info */}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                          <span className="text-emerald-400">✓</span>
                          {theme.name}
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                            theme.importance === 'critical'
                              ? 'bg-rose-500/30 text-rose-100 border border-rose-400/30'
                              : theme.importance === 'important'
                                ? 'bg-sky-500/30 text-sky-100 border border-sky-400/30'
                                : 'bg-slate-500/30 text-slate-100 border border-slate-400/30'
                          }`}>
                            {theme.importance}
                          </span>
                          <span className={`text-lg font-bold ${
                            theme.playerAdvantage ? 'text-emerald-300' : 'text-rose-300'
                          }`}>
                            {theme.playerAdvantage ? '✓' : '✗'}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed">{theme.description}</p>
                      <div className="text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2 max-h-20 overflow-y-auto">
                        <span className="font-medium">Key Moves:</span> 
                        <div className="mt-1 flex flex-wrap gap-1">
                          {theme.moves.map(m => (
                            <span key={m} className="bg-slate-700/50 px-2 py-1 rounded text-xs">
                              #{m + 1}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {/* Move Explanation - Now in left panel */}
                      {currentThemeState?.isElementMove && currentThemeState.move && (
                        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-blue-400">💡</span>
                            <h5 className="text-xs font-semibold text-white">Move Explanation</h5>
                          </div>
                          <p className="text-xs text-slate-200 leading-relaxed break-words">
                            {getMoveExplanation(theme.name, currentThemeState.move)}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Chess Board */}
                    <div className="flex-shrink-0 w-full lg:w-auto">
                      <PositionalAnalysisBoard
                        element={theme}
                        allMoves={moves}
                        playerColor={playerColor}
                        className="lg:sticky lg:top-4"
                        onMoveChange={(moveIndex, move, isElementMove) => {
                          setElementMoveStates(prev => ({
                            ...prev,
                            [themeKey]: { moveIndex, move, isElementMove }
                          }))
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-300 text-lg">No clear strategic themes identified.</p>
          </div>
        )}
      </div>

      {/* Positional Recommendations */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Positional Recommendations</h3>
        <div className="space-y-3">
          {scoreInfo.score < 6 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-white">Improve Positional Understanding</p>
                <p className="text-xs text-amber-100">Focus on piece coordination, pawn structure, and strategic planning</p>
              </div>
            </div>
          )}
          
          {positionalElements.some(e => e.name === 'Piece Activity' && e.strength === 'weak') && (
            <div className="flex items-start gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
              <span className="text-lg">🎯</span>
              <div>
                <p className="text-sm font-semibold text-white">Increase Piece Activity</p>
                <p className="text-xs text-sky-100">Look for opportunities to activate your pieces and create threats</p>
              </div>
            </div>
          )}

          {strategicThemes.some(t => t.name === 'Center Control') && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <span className="text-lg">✅</span>
              <div>
                <p className="text-sm font-semibold text-white">Good Center Control</p>
                <p className="text-xs text-emerald-100">Continue focusing on central squares and space control</p>
              </div>
            </div>
          )}

          {scoreInfo.score >= 8 && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-sm font-semibold text-white">Excellent Positional Play</p>
                <p className="text-xs text-emerald-100">Your positional understanding is strong - keep up the good work!</p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
