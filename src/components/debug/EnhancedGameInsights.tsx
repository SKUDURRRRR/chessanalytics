import React, { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { PositionalAnalysis } from './PositionalAnalysis'
import { OpeningTheoryAnalysis } from './OpeningTheoryAnalysis'
import { CriticalMomentBoard } from './CriticalMomentBoard'
import { getMoveClassificationBgColor } from '../../utils/chessColors'
import { calculateOpeningAccuracyChessCom } from '../../utils/accuracyCalculator'

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
  analysisRecord?: any
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
  const [showExplanation, setShowExplanation] = useState(false)
  const [showBoard, setShowBoard] = useState(false)

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
    <div className={`rounded-2xl border ${getBorderColor()} ${getBgColor()} p-3 overflow-hidden transition-all duration-200 hover:bg-opacity-80`}>
      {/* Header Row: Everything on one line */}
      <div className="flex items-center gap-3 mb-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold flex-shrink-0 ${getNumberBadgeClass()}`}>
          #{index + 1}
        </div>
        <span className="text-base font-bold text-white whitespace-nowrap">Move {move.moveNumber}: {move.san}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase whitespace-nowrap ${getMoveClassificationBgColor(move.classification)}`}>
          {move.classification}
        </span>
        <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-700/50 whitespace-nowrap">{gamePhase}</span>
        {move.centipawnLoss && (
          <>
            <span className="text-slate-400 text-xs">•</span>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                move.centipawnLoss > 500 ? 'bg-red-500' :
                move.centipawnLoss > 200 ? 'bg-orange-500' :
                'bg-yellow-500'
              }`}></div>
              <span className="text-xs text-slate-300 whitespace-nowrap">
                {move.centipawnLoss > 0 ? 'Lost' : 'Gained'} {Math.round(Math.abs(move.centipawnLoss))} pts
              </span>
              {impactSeverity && (
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${getImpactBadgeClass()}`}>
                  {impactSeverity}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Actions Row: Better move and all actions on one line */}
      <div className="flex items-center gap-2 flex-wrap">
        {move.bestMoveSan && (
          <>
            <span className="text-xs text-slate-400 whitespace-nowrap">Better:</span>
            <span className="font-mono font-semibold text-xs text-emerald-300 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded whitespace-nowrap">
              {move.bestMoveSan}
            </span>
            <span className="text-slate-400 text-xs">•</span>
          </>
        )}
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors duration-200 whitespace-nowrap"
        >
          {showExplanation ? '▲ Hide' : '▼ Read'} Explanation
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors duration-200 whitespace-nowrap"
        >
          {showDetails ? '▲ Hide' : '▼ Show'} Learning Points
        </button>
        <button
          onClick={() => setShowBoard(!showBoard)}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 whitespace-nowrap ${
            showBoard
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
              : 'bg-slate-700/50 text-slate-300 border border-white/10 hover:bg-slate-600/70'
          }`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          {showBoard ? 'Hide' : 'View'}
        </button>
      </div>

      {/* Collapsible Explanation */}
      {showExplanation && (
        <div className="mt-2">
          <div className="rounded-lg bg-slate-800/40 border border-slate-700/50 p-2">
            <p className="text-xs text-slate-200 leading-relaxed">{move.explanation}</p>
          </div>
        </div>
      )}

      {/* Collapsible Chess Board */}
      {showBoard && (
        <div className="mt-3">
          <div className="flex justify-center">
            <CriticalMomentBoard
              move={move}
              allMoves={allMoves}
              playerColor={playerColor}
            />
          </div>
        </div>
      )}

      {/* Expandable Learning Details */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showDetails ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
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
      </div>
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

export function EnhancedGameInsights({ moves, playerColor, currentMove, gameRecord, analysisRecord }: EnhancedGameInsightsProps) {
  const userMoves = moves.filter(move => move.isUserMove)
  const opponentMoves = moves.filter(move => !move.isUserMove)

  // Track whether to show all critical moments or just the first one
  const [showAllCriticalMoments, setShowAllCriticalMoments] = useState(false)


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
    const openingEnd = Math.min(10, Math.floor(totalMoves * 0.2))
    const middlegameEnd = Math.floor(totalMoves * 0.8)

    const phases: PhaseAnalysis[] = []

    // Opening phase
    const openingMoves = userMoves.slice(0, openingEnd)
    const openingAccuracy = calculateOpeningAccuracyChessCom(openingMoves)

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
      move.classification === 'mistake' ||
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
        analysisRecord={analysisRecord}
      />

      {/* Positional Analysis - REMOVED */}
      {/* <PositionalAnalysis
        moves={moves}
        playerColor={playerColor}
        currentMove={currentMove}
      /> */}

      {/* Phase Analysis */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Phase-by-Phase Analysis</h3>
        <div className="space-y-3">
          {phaseAnalysis.map((phase, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              {/* Header Row: Everything on one line */}
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-bold text-white capitalize text-base whitespace-nowrap">{phase.phase}</h4>
                <span className="text-xs text-slate-400 whitespace-nowrap">Moves {phase.startMove}-{phase.endMove}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
                  phase.accuracy > 80
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : phase.accuracy > 60
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-rose-500/20 text-rose-200'
                }`}>
                  {phase.accuracy.toFixed(1)}%
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <p className="text-sm text-slate-200 flex-1 truncate">{phase.summary}</p>
              </div>

              {/* Key Moments Row: All inline */}
              {phase.keyMoments.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide whitespace-nowrap">Key Moments:</span>
                  {phase.keyMoments.slice(0, 5).map((move, moveIndex) => (
                    <div key={moveIndex} className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-300 whitespace-nowrap">Move {move.moveNumber}: {move.san}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide whitespace-nowrap ${
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
                  {phase.keyMoments.length > 5 && (
                    <span className="text-xs text-slate-400 whitespace-nowrap">+{phase.keyMoments.length - 5} more</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Critical Moments - REMOVED */}
      {/* <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
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
            {(showAllCriticalMoments ? criticalMoments : criticalMoments.slice(0, 1)).map((move, index) => {
              const isBlunder = move.classification === 'blunder'
              const isBrilliant = move.classification === 'brilliant'
              const isMistake = move.classification === 'mistake'
              const gamePhase = move.moveNumber <= 10 ? 'Opening' : move.moveNumber <= 30 ? 'Middlegame' : 'Endgame'

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

            {criticalMoments.length > 1 && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setShowAllCriticalMoments(!showAllCriticalMoments)}
                  className="px-6 py-2.5 bg-slate-700/50 hover:bg-slate-600/70 text-white rounded-lg border border-white/10 hover:border-white/20 transition-all duration-200 hover:scale-105 font-medium text-sm"
                >
                  {showAllCriticalMoments ? 'See Less' : `See All (${criticalMoments.length - 1} more)`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm text-slate-300">No critical moments identified in this game.</p>
            <p className="text-xs text-slate-400 mt-1">This suggests consistent, solid play throughout!</p>
          </div>
        )}
      </div> */}

    </div>
  )
}
