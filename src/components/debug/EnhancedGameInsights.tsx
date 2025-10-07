import React, { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { PositionalAnalysis } from './PositionalAnalysis'
import { OpeningTheoryAnalysis } from './OpeningTheoryAnalysis'
import { ComparativeAnalysis } from './ComparativeAnalysis'
import { CriticalMomentBoard } from './CriticalMomentBoard'
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

interface CriticalMomentCardProps {
  move: ProcessedMove
  index: number
  allMoves: ProcessedMove[]
  playerColor: 'white' | 'black'
  isBlunder: boolean
  isBrilliant: boolean
  isMistake: boolean
  gamePhase: string
}

function CriticalMomentCard({ 
  move, 
  index, 
  allMoves, 
  playerColor, 
  isBlunder, 
  isBrilliant, 
  isMistake,
  gamePhase
}: CriticalMomentCardProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const impactSeverity = move.centipawnLoss ? 
    (move.centipawnLoss > 500 ? 'Severe Impact' : 
     move.centipawnLoss > 200 ? 'Significant Impact' : 'Moderate Impact') : null

  const getBorderColor = () => {
    if (isBlunder) return 'border-rose-500/40'
    if (isBrilliant) return 'border-purple-500/40'
    return 'border-amber-500/40'
  }

  const getBgColor = () => {
    if (isBlunder) return 'bg-rose-500/5'
    if (isBrilliant) return 'bg-purple-500/5'
    return 'bg-amber-500/5'
  }

  const getAccentColor = () => {
    if (isBlunder) return 'rose'
    if (isBrilliant) return 'purple'
    return 'amber'
  }

  const accentColor = getAccentColor()

  const getNumberBadgeClass = () => {
    if (isBlunder) return 'bg-rose-500/20 text-rose-200'
    if (isBrilliant) return 'bg-purple-500/20 text-purple-200'
    return 'bg-amber-500/20 text-amber-200'
  }

  const getImpactBadgeClass = () => {
    if (isBlunder) return 'bg-rose-500/20 text-rose-200'
    if (isBrilliant) return 'bg-purple-500/20 text-purple-200'
    return 'bg-amber-500/20 text-amber-200'
  }

  return (
    <div className={`rounded-2xl border ${getBorderColor()} ${getBgColor()} overflow-hidden transition-all duration-200`}>
      {/* Compact Header */}
      <div className="p-4">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          {/* Left: Move Info */}
          <div className="flex-1 w-full lg:w-auto min-w-0 order-1 lg:order-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${getNumberBadgeClass()}`}>
                #{index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-white">Move {move.moveNumber}: {move.san}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${getMoveClassificationBgColor(move.classification)}`}>
                    {move.classification}
                  </span>
                  <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-700/50">{gamePhase}</span>
                </div>
                {move.centipawnLoss && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-2 w-2 rounded-full ${
                      move.centipawnLoss > 500 ? 'bg-red-500' : 
                      move.centipawnLoss > 200 ? 'bg-orange-500' : 
                      'bg-yellow-500'
                    }`}></div>
                    <span className="text-sm text-slate-300">
                      {move.centipawnLoss > 0 ? 'Lost' : 'Gained'} {Math.round(Math.abs(move.centipawnLoss))} cp
                    </span>
                    {impactSeverity && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getImpactBadgeClass()}`}>
                        {impactSeverity}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Explanation - Always Visible */}
            <div className="mt-3 rounded-lg bg-slate-800/40 border border-slate-700/50 p-3">
              <p className="text-sm text-slate-200 leading-relaxed">{move.explanation}</p>
            </div>

            {/* Best Move Suggestion */}
            {move.bestMoveSan && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-slate-400">Better:</span>
                <span className="font-mono font-semibold text-emerald-300">{move.bestMoveSan}</span>
              </div>
            )}

            {/* Expandable Details Toggle */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-slate-300 hover:text-white"
            >
              <span>{showDetails ? 'Hide' : 'Show'} Learning Points</span>
              <span className="text-xs">{showDetails ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* Right: Chess Board */}
          <div className="flex-shrink-0 w-full lg:w-auto order-2 lg:order-2">
            <CriticalMomentBoard
              move={move}
              allMoves={allMoves}
              playerColor={playerColor}
              className="lg:sticky lg:top-4"
            />
          </div>
        </div>
      </div>

      {/* Expandable Learning Details */}
      {showDetails && (
        <div className="border-t border-white/10 bg-black/20 p-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Key Learning Points</h4>
            
            {isBlunder && (
              <div className="space-y-2">
                <LearningPoint 
                  icon="⚠️" 
                  text="This move significantly weakened your position. Focus on calculating candidate moves more thoroughly."
                  color="rose"
                />
                <LearningPoint 
                  icon="🔍" 
                  text='Before moving, ask: "What are all the forcing moves? What does my opponent threaten?"'
                  color="rose"
                />
              </div>
            )}
            
            {isBrilliant && (
              <div className="space-y-2">
                <LearningPoint 
                  icon="✨" 
                  text="Excellent tactical awareness! This type of resourceful play can turn games around."
                  color="purple"
                />
                <LearningPoint 
                  icon="🎯" 
                  text="Look for similar tactical patterns in future games - this shows strong calculation skills."
                  color="purple"
                />
              </div>
            )}
            
            {isMistake && (
              <div className="space-y-2">
                <LearningPoint 
                  icon="💡" 
                  text="Consider the engine's suggestion next time. This position required more precise calculation."
                  color="amber"
                />
                <LearningPoint 
                  icon="⚖️" 
                  text="Practice evaluating candidate moves systematically - pros and cons of each option."
                  color="amber"
                />
              </div>
            )}
            
            <LearningPoint 
              icon="📚" 
              text={
                gamePhase === 'Opening' 
                  ? 'Study opening principles and common patterns in this line. Focus on development and center control.'
                  : gamePhase === 'Middlegame'
                  ? 'Focus on tactical patterns and positional understanding. Practice calculation in complex positions.'
                  : 'Practice endgame technique and calculation. Study king activity and pawn structures.'
              }
              color="sky"
            />

            {move.evaluation && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Position Evaluation:</span>
                  <span className={`font-semibold ${
                    move.scoreForPlayer > 100 ? 'text-green-400' : 
                    move.scoreForPlayer > 0 ? 'text-slate-300' : 
                    'text-red-400'
                  }`}>
                    {move.displayEvaluation}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LearningPoint({ icon, text, color }: { icon: string; text: string; color: string }) {
  const getColorClasses = () => {
    switch (color) {
      case 'rose':
        return 'bg-rose-500/10 border-rose-500/20'
      case 'purple':
        return 'bg-purple-500/10 border-purple-500/20'
      case 'amber':
        return 'bg-amber-500/10 border-amber-500/20'
      case 'sky':
        return 'bg-sky-500/10 border-sky-500/20'
      default:
        return 'bg-slate-500/10 border-slate-500/20'
    }
  }

  return (
    <div className={`flex items-start gap-3 p-2.5 rounded-lg border ${getColorClasses()}`}>
      <span className="text-base flex-shrink-0">{icon}</span>
      <span className="text-sm text-slate-200 leading-relaxed">{text}</span>
    </div>
  )
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
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Tactical Patterns</h3>
        {tacticalPatterns.length > 0 ? (
          <div className="space-y-3">
            {tacticalPatterns.map((pattern, index) => (
              <div
                key={index}
                className={`rounded-2xl border-l-4 p-4 ${
                  pattern.severity === 'high'
                    ? 'border-rose-500 bg-rose-500/10'
                    : pattern.severity === 'medium'
                      ? 'border-amber-400 bg-amber-500/10'
                      : 'border-sky-400 bg-sky-500/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-white">{pattern.name}</h4>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                    pattern.severity === 'high'
                      ? 'bg-rose-500/20 text-rose-200'
                      : pattern.severity === 'medium'
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-sky-500/20 text-sky-200'
                  }`}>
                    {pattern.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-200">{pattern.description}</p>
                <div className="mt-2 text-xs text-slate-400">
                  Moves: {pattern.moves.map(m => `#${m + 1}`).join(', ')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-300">No significant tactical patterns detected in this game.</p>
        )}
      </div>

      {/* Phase Analysis */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Phase-by-Phase Analysis</h3>
        <div className="space-y-4">
          {phaseAnalysis.map((phase, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-medium text-white capitalize">{phase.phase}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">Moves {phase.startMove}-{phase.endMove}</span>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                    phase.accuracy > 80
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : phase.accuracy > 60
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'bg-rose-500/20 text-rose-200'
                  }`}>
                    {phase.accuracy.toFixed(1)}% accuracy
                  </span>
                </div>
              </div>
              <p className="mb-3 text-sm text-slate-200">{phase.summary}</p>
              
              {phase.keyMoments.length > 0 && (
                <div className="mt-3">
                  <h5 className="mb-2 text-sm font-medium text-slate-300">Key Moments:</h5>
                  <div className="space-y-1">
                    {phase.keyMoments.slice(0, 3).map((move, moveIndex) => (
                      <div key={moveIndex} className="flex items-center justify-between text-xs text-slate-200">
                        <span>Move {move.moveNumber}: {move.san}</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wide ${
                          move.classification === 'blunder'
                            ? 'bg-rose-500/20 text-rose-200'
                            : move.classification === 'mistake'
                              ? 'bg-amber-500/20 text-amber-200'
                              : move.classification === 'brilliant'
                                ? 'bg-purple-500/20 text-purple-200'
                                : 'bg-sky-500/20 text-sky-200'
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
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold text-white">Critical Moments</h3>
          <p className="text-sm text-slate-400">Key turning points that shaped the game's outcome</p>
          {criticalMoments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="flex items-center gap-1 rounded-full bg-slate-700/50 px-3 py-1 text-xs">
                <span className="text-slate-300">Total:</span>
                <span className="font-semibold text-white">{criticalMoments.length}</span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-1 text-xs">
                <span className="text-rose-200">Blunders:</span>
                <span className="font-semibold text-rose-100">{criticalMoments.filter(m => m.classification === 'blunder').length}</span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-purple-500/20 px-3 py-1 text-xs">
                <span className="text-purple-200">Brilliant:</span>
                <span className="font-semibold text-purple-100">{criticalMoments.filter(m => m.classification === 'brilliant').length}</span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs">
                <span className="text-amber-200">Mistakes:</span>
                <span className="font-semibold text-amber-100">{criticalMoments.filter(m => m.classification === 'mistake').length}</span>
              </div>
            </div>
          )}
        </div>
        {criticalMoments.length > 0 ? (
          <div className="space-y-4">
            {criticalMoments.slice(0, 5).map((move, index) => {
              const isBlunder = move.classification === 'blunder'
              const isBrilliant = move.classification === 'brilliant'
              const isMistake = move.classification === 'mistake'
              const gamePhase = move.moveNumber <= 12 ? 'Opening' : move.moveNumber <= 30 ? 'Middlegame' : 'Endgame'
              
              return (
                <CriticalMomentCard
                  key={index}
                  move={move}
                  index={index}
                  allMoves={moves}
                  playerColor={playerColor}
                  isBlunder={isBlunder}
                  isBrilliant={isBrilliant}
                  isMistake={isMistake}
                  gamePhase={gamePhase}
                />
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm text-slate-300">No critical moments identified in this game.</p>
            <p className="text-xs text-slate-400 mt-1">This suggests consistent, solid play throughout!</p>
          </div>
        )}
      </div>

      {/* Learning Recommendations */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Learning Recommendations</h3>
        {learningRecommendations.length > 0 ? (
          <div className="space-y-2">
            {learningRecommendations.map((recommendation, index) => (
              <div key={index} className="flex items-center gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3">
                <span className="text-lg">💡</span>
                <p className="text-sm text-slate-200">{recommendation}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-300">Great game! Continue practicing to maintain your current level.</p>
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
