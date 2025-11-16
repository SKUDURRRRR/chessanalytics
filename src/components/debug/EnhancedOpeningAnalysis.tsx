import React, { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { identifyOpening } from '../../utils/openingIdentification'
import { getPlayerPerspectiveOpeningShort } from '../../utils/playerPerspectiveOpening'
import { EnhancedOpeningAnalysis, OpeningMistake, StudyRecommendation, PeerComparison, RepertoireAnalysis } from '../../types'
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

interface EnhancedOpeningAnalysisProps {
  moves: ProcessedMove[]
  playerColor: 'white' | 'black'
  gameRecord: any
  analysisRecord?: any
  openingStats?: Array<{
    opening: string
    openingFamily: string
    games: number
    winRate: number
    averageElo: number
  }>
  totalGames?: number
}

export function EnhancedOpeningAnalysis({
  moves,
  playerColor,
  gameRecord,
  analysisRecord,
  openingStats = [],
  totalGames = 0
}: EnhancedOpeningAnalysisProps) {
  const [selectedMistake, setSelectedMistake] = useState<OpeningMistake | null>(null)
  const [showStudyResources, setShowStudyResources] = useState(false)

  const userMoves = moves.filter(move => move.isUserMove)
  const openingMoves = userMoves.slice(0, 10) // First 10 moves typically cover opening

  // For opening identification, we need ALL moves (both colors) to properly detect openings
  // The identification logic expects alternating White-Black move sequences
  const allOpeningMoves = moves.slice(0, 20).map(m => m.san) // First ~20 moves (10 per player)

  // Use database values if available, otherwise calculate from moves
  const hasDbValues = analysisRecord?.middle_game_accuracy !== undefined || analysisRecord?.endgame_accuracy !== undefined

  // Improved phase boundaries to match backend logic:
  // - Opening: first 10 moves (or fewer if game is shorter)
  // - Endgame: last 10 moves (or proportional for short games)
  // - Middlegame: everything in between
  const totalUserMoves = userMoves.length
  const openingEnd = Math.min(10, totalUserMoves)

  // For very short games (≤15 moves), there's no real middlegame
  let endgameStart
  if (totalUserMoves <= 15) {
    endgameStart = openingEnd  // No middlegame
  } else {
    // For longer games, endgame is the last 10 moves, but at least move 11
    endgameStart = Math.max(openingEnd, totalUserMoves - 10)
  }

  // Split moves by phase (for fallback)
  const middlegameMoves = userMoves.slice(openingEnd, endgameStart)
  const endgameMoves = userMoves.slice(endgameStart)

  const enhancedAnalysis = useMemo((): EnhancedOpeningAnalysis => {
    console.log('EnhancedOpeningAnalysis - openingMoves:', openingMoves.length, openingMoves)
    console.log('EnhancedOpeningAnalysis - gameRecord:', gameRecord)
    console.log('EnhancedOpeningAnalysis - playerColor:', playerColor)
    console.log('EnhancedOpeningAnalysis - analysisRecord:', analysisRecord)
    console.log('EnhancedOpeningAnalysis - middle_game_accuracy from DB:', analysisRecord?.middle_game_accuracy)
    console.log('EnhancedOpeningAnalysis - endgame_accuracy from DB:', analysisRecord?.endgame_accuracy)
    console.log('EnhancedOpeningAnalysis - middlegameMoves length:', middlegameMoves.length)
    console.log('EnhancedOpeningAnalysis - endgameMoves length:', endgameMoves.length)

    // If no opening moves are available, return a default analysis
    if (openingMoves.length === 0) {
      return {
        openingName: 'Unknown Opening',
        openingFamily: 'Unknown',
        accuracy: 0,
        theoryKnowledge: 0,
        gamesPlayed: totalGames,
        specificMistakes: [],
        commonPatterns: ['General opening principles'],
        strengths: [],
        weaknesses: ['Game analysis required to identify strengths and areas for improvement'],
        studyRecommendations: [],
        practicePositions: [],
        peerComparison: {
          percentile: 0,
          ratingRange: 'Unknown'
        },
        repertoireAnalysis: {
          diversity: 0,
          colorPerformance: { white: 0, black: 0 },
          familyStrengths: [],
          familyWeaknesses: [],
          mostPlayed: 'None',
          leastPlayed: 'None',
          recommendation: 'Analyze games to build your repertoire'
        },
        improvementTrend: [],
        nextGoals: ['Analyze this game to get personalized recommendations'],
        focusAreas: ['Game analysis required']
      }
    }

    // Use the same opening identification function as Game Overview to ensure consistency
    // This ensures both sections use the same source of truth for opening names
    const openingInput = gameRecord?.opening_family ?? gameRecord?.opening ?? gameRecord?.opening_normalized
    console.log('🔍 EnhancedOpeningAnalysis - Opening input:', {
      opening_family: gameRecord?.opening_family,
      opening: gameRecord?.opening,
      opening_normalized: gameRecord?.opening_normalized,
      selectedInput: openingInput,
      playerColor,
      userMovesOnly: openingMoves.map(m => m.san),
      allMoves: allOpeningMoves,
      movesCount: moves.length
    })

    // IMPORTANT: Pass ALL moves (both colors), not just user moves
    // The opening detection logic needs to see the full move sequence
    const openingName = getPlayerPerspectiveOpeningShort(
      openingInput,
      playerColor,
      gameRecord,
      allOpeningMoves // Use all moves instead of just user moves
    )

    console.log('🎯 EnhancedOpeningAnalysis - Computed opening name:', openingName)

    // Also get the full identification result for additional metadata if needed
    // Pass all moves for proper identification
    const identifiedVariation = identifyOpening(gameRecord, allOpeningMoves, playerColor)

    // Calculate basic metrics using Chess.com method
    const openingAccuracy = calculateOpeningAccuracyChessCom(openingMoves)

    // Use database values if available, otherwise calculate
    const middlegameAccuracy = analysisRecord?.middle_game_accuracy ??
      (middlegameMoves.length > 0 ? calculateOpeningAccuracyChessCom(middlegameMoves) : 0)
    const endgameAccuracy = analysisRecord?.endgame_accuracy ??
      (endgameMoves.length > 0 ? calculateOpeningAccuracyChessCom(endgameMoves) : 0)

    // Theory knowledge should correlate with opening accuracy
    // Use a formula that maps accuracy percentage to a 0-10 score
    // This ensures consistency: high accuracy = high theory score
    const theoryKnowledge = Math.min(10, Math.max(0, Math.round(openingAccuracy / 10)))

    // Identify specific mistakes
    const specificMistakes: OpeningMistake[] = openingMoves
      .filter(move => ['inaccuracy', 'mistake', 'blunder'].includes(move.classification))
      .map(move => ({
        move: move.moveNumber,
        moveNotation: move.san,
        mistake: move.san,
        correctMove: move.bestMoveSan || 'N/A',
        explanation: move.explanation || 'Consider the engine recommendation',
        severity: move.classification === 'blunder' ? 'critical' :
                 move.classification === 'mistake' ? 'major' : 'minor',
        centipawnLoss: move.centipawnLoss || 0,
        classification: move.classification as 'blunder' | 'mistake' | 'inaccuracy'
      }))

    // Identify common patterns
    const commonPatterns = identifyCommonPatterns(openingMoves)

    // Identify strengths and weaknesses - look at ALL moves to find good plays throughout the game
    const { strengths, weaknesses } = identifyStrengthsAndWeaknesses(userMoves, specificMistakes)

    // Generate study recommendations
    // Use the consistent opening name for user-facing content
    const studyRecommendations: StudyRecommendation[] = generateStudyRecommendations(
      openingName,
      specificMistakes,
      openingAccuracy
    )

    // Generate practice positions
    // Use the consistent opening name for user-facing content
    const practicePositions = generatePracticePositions(openingName, specificMistakes)

    // Calculate peer comparison
    const peerComparison: PeerComparison = calculatePeerComparison(openingAccuracy, totalGames)

    // Calculate repertoire analysis
    const repertoireAnalysis: RepertoireAnalysis = calculateRepertoireAnalysis(openingStats)

    // Generate improvement trend (mock data for now)
    const improvementTrend = generateImprovementTrend(openingAccuracy)

    // Generate next goals and focus areas
    const nextGoals = generateNextGoals(specificMistakes, openingAccuracy)
    const focusAreas = generateFocusAreas(specificMistakes, commonPatterns)

    return {
      openingName: openingName, // Use the same function as Game Overview for consistency
      openingFamily: identifiedVariation.name, // Keep original for internal use
      accuracy: openingAccuracy,
      middlegameAccuracy,
      endgameAccuracy,
      theoryKnowledge,
      gamesPlayed: totalGames,
      specificMistakes,
      commonPatterns,
      strengths,
      weaknesses,
      studyRecommendations,
      practicePositions,
      peerComparison,
      repertoireAnalysis,
      improvementTrend,
      nextGoals,
      focusAreas
    }
  }, [openingMoves, middlegameMoves, endgameMoves, gameRecord, playerColor, openingStats, totalGames])

  return (
    <div className="space-y-6">
      {/* Enhanced Opening Overview */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-2">Opening Analysis</h3>
          <h4 className="text-lg font-semibold text-sky-300">{enhancedAnalysis.openingName}</h4>
          <p className="text-sm text-slate-300">Comprehensive analysis with actionable insights</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-300">{enhancedAnalysis.theoryKnowledge}/10</div>
            <div className="text-xs text-slate-300">Theory Knowledge</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-sky-300">{Math.round(enhancedAnalysis.accuracy)}%</div>
            <div className="text-xs text-slate-300">Opening Accuracy</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-300">
              {middlegameMoves.length > 0 && enhancedAnalysis.middlegameAccuracy !== undefined
                ? `${Math.round(enhancedAnalysis.middlegameAccuracy)}%`
                : 'N/A'}
            </div>
            <div className="text-xs text-slate-300">Middlegame Accuracy</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-300">
              {endgameMoves.length > 0 && enhancedAnalysis.endgameAccuracy !== undefined
                ? `${Math.round(enhancedAnalysis.endgameAccuracy)}%`
                : 'N/A'}
            </div>
            <div className="text-xs text-slate-300">Endgame Accuracy</div>
          </div>
        </div>

        {/* Quick Assessment */}
        <div className="bg-slate-800/30 rounded-xl p-4 mb-6">
          <h5 className="font-semibold text-white mb-2">Quick Assessment</h5>
          <p className="text-sm text-slate-200 leading-relaxed">
            {generateQuickAssessment(enhancedAnalysis, openingMoves)}
          </p>
        </div>
      </div>

      {/* Specific Mistakes Analysis - HIDDEN */}
      {false && enhancedAnalysis.specificMistakes.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🎯</span>
            Specific Mistakes & Improvements
          </h3>

          <div className="space-y-3">
            {enhancedAnalysis.specificMistakes.map((mistake, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border cursor-pointer transition-all hover:bg-slate-800/30 ${
                  mistake.severity === 'critical' ? 'border-red-400/50 bg-red-500/10' :
                  mistake.severity === 'major' ? 'border-orange-400/50 bg-orange-500/10' :
                  'border-yellow-400/50 bg-yellow-500/10'
                }`}
                onClick={() => setSelectedMistake(mistake)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      Move {mistake.move}: {mistake.moveNotation}
                    </div>
                    <div className="text-sm text-slate-300">
                      {mistake.classification.charAt(0).toUpperCase() + mistake.classification.slice(1)} •
                      {mistake.centipawnLoss} point loss
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-sky-300">
                      Best: {mistake.correctMove}
                    </div>
                    <div className="text-xs text-slate-400">
                      Click for details
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mistake Detail Modal */}
          {selectedMistake && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xl font-bold text-white">
                    Move {selectedMistake.move} Analysis
                  </h4>
                  <button
                    onClick={() => setSelectedMistake(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-400">Your Move</div>
                      <div className="text-lg font-semibold text-red-300">{selectedMistake.moveNotation}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Best Move</div>
                      <div className="text-lg font-semibold text-green-300">{selectedMistake.correctMove}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-slate-400">Explanation</div>
                    <div className="text-slate-200">{selectedMistake.explanation}</div>
                  </div>

                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-2">Learning Tip</div>
                    <div className="text-slate-200">
                      {getLearningTip(selectedMistake.classification, selectedMistake.move)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Study Recommendations */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <span className="mr-2">📚</span>
            Study Recommendations
          </h3>
          <button
            onClick={() => setShowStudyResources(!showStudyResources)}
            className="text-sky-300 hover:text-sky-200 text-sm"
          >
            {showStudyResources ? 'Hide' : 'Show All'}
          </button>
        </div>

        <div className="space-y-3">
          {enhancedAnalysis.studyRecommendations
            .filter(rec => showStudyResources || rec.priority === 'high')
            .map((rec, index) => (
            <div key={index} className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getRecommendationIcon(rec.type)}</span>
                    <h4 className="font-semibold text-white">{rec.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs ${
                      rec.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                      rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-green-500/20 text-green-300'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{rec.description}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span>⏱️ {rec.estimatedTime}</span>
                    <span>📊 {rec.difficulty}</span>
                    {rec.url && (
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-300 hover:text-sky-200"
                      >
                        Open Resource →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2 text-green-400">✅</span>
            Strengths
          </h3>
          <div className="space-y-2">
            {enhancedAnalysis.strengths.length > 0 ? (
              enhancedAnalysis.strengths.map((strength, index) => (
                <div key={index} className="flex items-center text-sm">
                  <span className="mr-2 text-green-400">•</span>
                  <span>{strength}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400 italic">
                No analysis data available
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2 text-red-400">⚠️</span>
            Areas to Improve
          </h3>
          <div className="space-y-2">
            {enhancedAnalysis.weaknesses.length > 0 ? (
              enhancedAnalysis.weaknesses.map((weakness, index) => (
                <div key={index} className="flex items-center text-sm">
                  <span className="mr-2 text-red-400">•</span>
                  <span>{weakness}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400 italic">
                No analysis data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions

function generateQuickAssessment(analysis: EnhancedOpeningAnalysis, openingMoves: ProcessedMove[]): string {
  const { accuracy, specificMistakes, openingName } = analysis

  // Count move types for detailed insights
  const brilliantMoves = openingMoves.filter(m => m.classification === 'brilliant').length
  const blunders = specificMistakes.filter(m => m.classification === 'blunder').length
  const mistakes = specificMistakes.filter(m => m.classification === 'mistake').length
  const inaccuracies = specificMistakes.filter(m => m.classification === 'inaccuracy').length

  // Build specific, data-driven assessment
  let assessment = ''

  // Main performance assessment
  if (accuracy >= 85) {
    assessment = `Outstanding opening performance with ${accuracy}% accuracy in the ${openingName}. `
    if (brilliantMoves > 0) {
      assessment += `You played ${brilliantMoves} brilliant ${brilliantMoves === 1 ? 'move' : 'moves'}, demonstrating deep understanding. `
    }
    if (specificMistakes.length === 0) {
      assessment += `Perfect execution with no mistakes!`
    } else if (inaccuracies > 0 && blunders === 0 && mistakes === 0) {
      assessment += `Only ${inaccuracies} minor ${inaccuracies === 1 ? 'inaccuracy' : 'inaccuracies'} - easily correctable.`
    }
  } else if (accuracy >= 70) {
    assessment = `Solid opening play with ${accuracy}% accuracy. `
    if (blunders > 0) {
      assessment += `However, ${blunders} critical ${blunders === 1 ? 'blunder' : 'blunders'} cost you significant advantage. `
    } else if (mistakes > 0) {
      assessment += `You made ${mistakes} notable ${mistakes === 1 ? 'mistake' : 'mistakes'} that weakened your position. `
    } else {
      assessment += `Your ${inaccuracies} ${inaccuracies === 1 ? 'inaccuracy' : 'inaccuracies'} slightly reduced your advantage. `
    }
    assessment += `Focus on the highlighted areas to reach the next level.`
  } else if (accuracy >= 50) {
    assessment = `Your opening needs improvement (${accuracy}% accuracy). `
    if (blunders > 0) {
      assessment += `${blunders} critical ${blunders === 1 ? 'blunder' : 'blunders'} gave your opponent a winning advantage. `
    }
    if (mistakes > 0) {
      assessment += `Additionally, ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'} compounded the problems. `
    }
    assessment += `Study the ${openingName} fundamentals to build a stronger foundation.`
  } else {
    assessment = `Significant opening struggles with ${accuracy}% accuracy in the ${openingName}. `
    const totalErrors = blunders + mistakes
    if (totalErrors > 0) {
      assessment += `${totalErrors} serious ${totalErrors === 1 ? 'error' : 'errors'} (${blunders} ${blunders === 1 ? 'blunder' : 'blunders'}, ${mistakes} ${mistakes === 1 ? 'mistake' : 'mistakes'}) put you in a difficult position early. `
    }
    assessment += `Work on basic opening principles and tactical awareness.`
  }

  return assessment
}

function identifyCommonPatterns(moves: ProcessedMove[]): string[] {
  const patterns: string[] = []

  // Check for common opening patterns
  const moveSequence = moves.map(m => m.san).join(' ')

  if (moveSequence.includes('e4 e5 Nf3 Nc6 Bb5')) {
    patterns.push('Ruy Lopez patterns')
  }
  if (moveSequence.includes('d4 Nf6 c4 g6')) {
    patterns.push('King\'s Indian Defense patterns')
  }
  if (moves.some(m => m.san.includes('O-O'))) {
    patterns.push('Castling patterns')
  }
  if (moves.filter(m => m.san.includes('N')).length > 3) {
    patterns.push('Knight development patterns')
  }

  return patterns.length > 0 ? patterns : ['General opening principles']
}

function identifyStrengthsAndWeaknesses(moves: ProcessedMove[], mistakes: OpeningMistake[]): { strengths: string[], weaknesses: string[] } {
  const strengths: string[] = []
  const weaknesses: string[] = []

  console.log('identifyStrengthsAndWeaknesses - moves:', moves.length, 'mistakes:', mistakes.length)
  console.log('Move classifications:', moves.map(m => ({ san: m.san, classification: m.classification })))

  const userMoves = moves.filter(m => m.isUserMove)
  const bestMoves = userMoves.filter(m => m.classification === 'best' || m.classification === 'brilliant')
  const goodMoves = userMoves.filter(m => m.classification === 'good')
  const blunders = userMoves.filter(m => m.classification === 'blunder')
  const mistakeMoves = userMoves.filter(m => m.classification === 'mistake')
  const inaccuracies = userMoves.filter(m => m.classification === 'inaccuracy')

  // ===== IDENTIFY 3 SPECIFIC STRENGTHS =====

  // Helper to determine game phase
  const getPhase = (moveNum: number) => {
    if (moveNum <= 10) return ''  // Opening - no prefix needed
    if (moveNum <= 25) return 'Middlegame: '
    return 'Endgame: '
  }

  // Strength 1: Identify excellent moves with specific examples
  const brilliantMoves = userMoves.filter(m => m.classification === 'brilliant')
  if (brilliantMoves.length > 0) {
    const firstBrilliant = brilliantMoves[0]
    const phase = getPhase(firstBrilliant.moveNumber)
    strengths.push(`${phase}Brilliant ${firstBrilliant.san} on move ${firstBrilliant.moveNumber}${brilliantMoves.length > 1 ? ` (${brilliantMoves.length} brilliant moves!)` : ''}`)
  } else if (bestMoves.length >= 3 && bestMoves.length / userMoves.length >= 0.4) {
    // Only show percentage if at least 40% were perfect (actually impressive)
    const examples = bestMoves.slice(0, 2).map(m => `${m.moveNumber}.${m.san}`).join(', ')
    strengths.push(`Precise play: ${examples} were engine moves (${bestMoves.length}/${userMoves.length} perfect)`)
  } else if (bestMoves.length >= 2 && userMoves.length <= 5) {
    // Early game with multiple perfect moves
    const examples = bestMoves.map(m => `${m.moveNumber}.${m.san}`).join(', ')
    strengths.push(`Strong theoretical knowledge: ${examples} matched top engine play`)
  } else if (bestMoves.length === 2 && userMoves.length >= 6) {
    // Found 2 perfect moves even if overall stats aren't great
    const examples = bestMoves.map(m => `${m.moveNumber}.${m.san}`).join(', ')
    const phase = getPhase(bestMoves[0].moveNumber)
    strengths.push(`${phase}Accurate play: ${examples} were perfect moves`)
  } else if (bestMoves.length === 1 && userMoves.length >= 3) {
    // At least one perfect move
    const bestMove = bestMoves[0]
    const phase = getPhase(bestMove.moveNumber)
    strengths.push(`${phase}Good move ${bestMove.moveNumber}.${bestMove.san} matched engine's top choice`)
  }

  // Strength 2: Identify strong sequences or patterns
  let hasStrongSequence = false
  for (let i = 0; i < userMoves.length - 2; i++) {
    if (['best', 'brilliant', 'good'].includes(userMoves[i].classification) &&
        ['best', 'brilliant', 'good'].includes(userMoves[i+1].classification) &&
        ['best', 'brilliant', 'good'].includes(userMoves[i+2].classification)) {
      strengths.push(`Strong play from moves ${userMoves[i].moveNumber}-${userMoves[i+2].moveNumber}: ${userMoves[i].san}, ${userMoves[i+1].san}, ${userMoves[i+2].san}`)
      hasStrongSequence = true
      break
    }
  }

  // Strength 3: Low centipawn loss or good recovery
  const avgCPL = userMoves
    .filter(m => m.centipawnLoss !== null)
    .reduce((sum, m) => sum + (m.centipawnLoss || 0), 0) / userMoves.filter(m => m.centipawnLoss !== null).length

  if (!hasStrongSequence && avgCPL < 20 && userMoves.length >= 5) {
    strengths.push(`Consistent accuracy throughout opening (avg ${Math.round(avgCPL)} centipawn loss)`)
  } else if (userMoves.length >= 6 && (bestMoves.length + goodMoves.length) / userMoves.length >= 0.75) {
    // Only show if 75%+ accuracy (strong understanding)
    const accurateCount = bestMoves.length + goodMoves.length
    strengths.push(`Solid understanding demonstrated in ${accurateCount} of ${userMoves.length} moves`)
  }

  // Ensure we have 3 strengths (add general ones if needed, but only if actually strong)
  if (strengths.length < 3 && userMoves.length > 0) {
    const earlyMoves = userMoves.slice(0, Math.min(5, userMoves.length))
    const earlyAccuracy = earlyMoves.filter(m => ['best', 'brilliant', 'good'].includes(m.classification)).length
    const earlyAccuracyPercent = earlyAccuracy / earlyMoves.length

    // Only show as strength if 80%+ accuracy in opening
    if (earlyAccuracyPercent >= 0.8 && earlyMoves.length >= 4 && strengths.length < 3) {
      strengths.push(`Strong opening fundamentals (${earlyAccuracy}/${earlyMoves.length} accurate in first ${earlyMoves.length} moves)`)
    }

    if (mistakes.length === 0 && userMoves.length >= 6 && strengths.length < 3) {
      strengths.push(`Clean opening play with no significant mistakes detected`)
    }

    // Find castling moves that were good/best
    const castlingMove = userMoves.find(m =>
      (m.san === 'O-O' || m.san === 'O-O-O') &&
      ['best', 'brilliant', 'good'].includes(m.classification)
    )
    if (castlingMove && strengths.length < 3) {
      const timing = castlingMove.moveNumber <= 8 ? 'timely' : 'well-timed'
      strengths.push(`King safety prioritized: ${timing} ${castlingMove.san} on move ${castlingMove.moveNumber}`)
    }

    // Find any good tactical or positional plays
    const goodTacticalMoves = userMoves.filter(m =>
      m.classification === 'good' &&
      (m.explanation.toLowerCase().includes('attack') ||
       m.explanation.toLowerCase().includes('threat') ||
       m.explanation.toLowerCase().includes('pressure'))
    )
    if (goodTacticalMoves.length > 0 && strengths.length < 3) {
      const move = goodTacticalMoves[0]
      const phase = getPhase(move.moveNumber)
      strengths.push(`${phase}Good tactical awareness: ${move.moveNumber}.${move.san} created threats`)
    }

    // Find center control moves
    const centerMoves = userMoves.filter(m =>
      ['best', 'good'].includes(m.classification) &&
      (m.explanation.toLowerCase().includes('center') ||
       m.explanation.toLowerCase().includes('central') ||
       m.san.match(/^[de][34]/)) // d4, e4, d3, e3 type moves
    )
    if (centerMoves.length >= 2 && strengths.length < 3) {
      const examples = centerMoves.slice(0, 2).map(m => `${m.moveNumber}.${m.san}`).join(', ')
      strengths.push(`Good center control with moves like ${examples}`)
    }

    // Find development moves that were at least good
    if (strengths.length < 3) {
      const devMove = userMoves.find(m =>
        m.explanation.toLowerCase().includes('development') &&
        ['best', 'brilliant', 'good'].includes(m.classification)
      )
      if (devMove) {
        const quality = devMove.classification === 'best' ? 'Excellent' : 'Good'
        strengths.push(`${quality} piece development with ${devMove.san} on move ${devMove.moveNumber}`)
      }
    }

    // Recognize avoiding mistakes after an inaccuracy (good recovery)
    for (let i = 0; i < userMoves.length - 1; i++) {
      if (userMoves[i].classification === 'inaccuracy' &&
          ['best', 'good'].includes(userMoves[i + 1].classification) &&
          strengths.length < 3) {
        const phase = getPhase(userMoves[i + 1].moveNumber)
        strengths.push(`${phase}Good recovery: ${userMoves[i + 1].moveNumber}.${userMoves[i + 1].san} corrected course after ${userMoves[i].san}`)
        break
      }
    }

    // Find moves that maintained/increased advantage
    const advantageMoves = userMoves.filter(m =>
      ['best', 'good'].includes(m.classification) &&
      m.centipawnLoss !== null &&
      m.centipawnLoss <= 5
    )
    if (advantageMoves.length >= 3 && strengths.length < 3) {
      strengths.push(`Consistent accuracy: ${advantageMoves.length} moves maintained your position`)
    }

    // Look for good pawn structure moves
    const pawnMoves = userMoves.filter(m =>
      ['best', 'good'].includes(m.classification) &&
      m.san.match(/^[a-h]/) && // Pawn moves
      !m.san.includes('x') // Not captures
    )
    if (pawnMoves.length >= 2 && strengths.length < 3) {
      const move = pawnMoves[0]
      const phase = getPhase(move.moveNumber)
      strengths.push(`${phase}Good pawn structure: ${move.moveNumber}.${move.san} built solid foundation`)
    }

    // Find any above-average moves if nothing else
    if (strengths.length < 3 && goodMoves.length >= 2) {
      const examples = goodMoves.slice(0, 2).map(m => `${m.moveNumber}.${m.san}`).join(', ')
      strengths.push(`Solid moves like ${examples} showed good chess understanding`)
    }

    // Low centipawn loss on individual moves
    const veryAccurateMoves = userMoves.filter(m =>
      m.centipawnLoss !== null &&
      m.centipawnLoss <= 3 &&
      m.classification !== 'uncategorized'
    )
    if (veryAccurateMoves.length >= 4 && strengths.length < 3) {
      strengths.push(`${veryAccurateMoves.length} moves were extremely precise (≤3 centipawn loss)`)
    }
  }

  // ===== IDENTIFY 3 SPECIFIC WEAKNESSES =====

  // Weakness 1: Identify worst blunder/mistake with specifics
  if (blunders.length > 0) {
    const worstBlunder = blunders.sort((a, b) => (b.centipawnLoss || 0) - (a.centipawnLoss || 0))[0]
    const cpLoss = worstBlunder.centipawnLoss ? Math.abs(worstBlunder.centipawnLoss) : 0
    const phase = getPhase(worstBlunder.moveNumber)
    weaknesses.push(`${phase}Critical blunder ${worstBlunder.san} on move ${worstBlunder.moveNumber} (${cpLoss} centipawns lost)${worstBlunder.bestMoveSan ? ` - ${worstBlunder.bestMoveSan} was better` : ''}`)
  } else if (mistakeMoves.length > 0) {
    const worstMistake = mistakeMoves.sort((a, b) => (b.centipawnLoss || 0) - (a.centipawnLoss || 0))[0]
    const cpLoss = worstMistake.centipawnLoss ? Math.abs(worstMistake.centipawnLoss) : 0
    const phase = getPhase(worstMistake.moveNumber)
    weaknesses.push(`${phase}Tactical oversight ${worstMistake.san} on move ${worstMistake.moveNumber} (${cpLoss} centipawns)${worstMistake.bestMoveSan ? ` - ${worstMistake.bestMoveSan} maintains edge` : ''}`)
  }

  // Weakness 2: Identify pattern-based issues
  const earlyMistakes = mistakes.filter(m => m.move <= 5)
  const lateMistakes = mistakes.filter(m => m.move > 10)

  if (earlyMistakes.length >= 2 && weaknesses.length < 3) {
    weaknesses.push(`Opening preparation needs work: ${earlyMistakes.length} mistakes in first 5 moves`)
  } else if (inaccuracies.length >= 3 && weaknesses.length < 3) {
    const inaccuracyMoves = inaccuracies.slice(0, 2).map(m => `${m.moveNumber}.${m.san}`).join(', ')
    weaknesses.push(`Several small inaccuracies (${inaccuracyMoves}, +${inaccuracies.length - 2} more) compound over time`)
  } else if (lateMistakes.length >= 2 && weaknesses.length < 3) {
    weaknesses.push(`Transitioning from opening to middlegame: mistakes after move 10`)
  }

  // Weakness 3: Thematic or strategic issues
  const developmentIssues = mistakes.filter(m =>
    m.explanation.toLowerCase().includes('development') ||
    m.explanation.toLowerCase().includes('develop')
  )
  const centerIssues = mistakes.filter(m =>
    m.explanation.toLowerCase().includes('center') ||
    m.explanation.toLowerCase().includes('central') ||
    m.explanation.toLowerCase().includes('space')
  )
  const safetyIssues = mistakes.filter(m =>
    m.explanation.toLowerCase().includes('king') ||
    m.explanation.toLowerCase().includes('castle') ||
    m.explanation.toLowerCase().includes('safety')
  )

  if (safetyIssues.length > 0 && weaknesses.length < 3) {
    const issue = safetyIssues[0]
    weaknesses.push(`King safety concern: ${issue.moveNotation} on move ${issue.move} exposed weaknesses`)
  } else if (developmentIssues.length > 0 && weaknesses.length < 3) {
    const issue = developmentIssues[0]
    weaknesses.push(`Piece development timing: ${issue.moveNotation} on move ${issue.move} delayed development`)
  } else if (centerIssues.length > 0 && weaknesses.length < 3) {
    const issue = centerIssues[0]
    weaknesses.push(`Center control: ${issue.moveNotation} on move ${issue.move} weakened central position`)
  }

  // Fill remaining weakness slots with general but specific feedback
  if (weaknesses.length < 3 && userMoves.length > 0) {
    if (avgCPL > 50 && weaknesses.length < 3) {
      weaknesses.push(`High average centipawn loss (${Math.round(avgCPL)} per move) - needs more accuracy`)
    } else if (avgCPL > 30 && weaknesses.length < 3) {
      weaknesses.push(`Moderate accuracy issues (avg ${Math.round(avgCPL)} centipawn loss) - review key positions`)
    }

    const accuracyRate = (bestMoves.length + goodMoves.length) / userMoves.length
    if (accuracyRate < 0.4 && weaknesses.length < 3) {
      weaknesses.push(`Limited opening theory: only ${bestMoves.length + goodMoves.length}/${userMoves.length} moves were strong`)
    } else if (accuracyRate < 0.6 && weaknesses.length < 3 && userMoves.length >= 6) {
      weaknesses.push(`Opening knowledge gaps: ${bestMoves.length + goodMoves.length}/${userMoves.length} accurate moves (aim for 75%+)`)
    }

    if (weaknesses.length < 3) {
      weaknesses.push(`Study this opening's main lines and typical plans`)
    }
  }

  // Ensure we have exactly 3 of each (trim if too many)
  const finalStrengths = strengths.slice(0, 3)
  const finalWeaknesses = weaknesses.slice(0, 3)

  console.log('Final strengths and weaknesses:', { strengths: finalStrengths, weaknesses: finalWeaknesses })

  return { strengths: finalStrengths, weaknesses: finalWeaknesses }
}

function generateStudyRecommendations(openingName: string, mistakes: OpeningMistake[], accuracy: number): StudyRecommendation[] {
  const recommendations: StudyRecommendation[] = []

  // Base recommendations
  recommendations.push({
    type: 'video',
    title: `${openingName} - Complete Guide`,
    description: `Learn the fundamental principles and main lines of ${openingName}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(openingName + ' chess opening')}`,
    difficulty: 'intermediate',
    estimatedTime: '15-30 min',
    priority: 'high'
  })

  // Mistake-specific recommendations
  if (mistakes.some(m => m.classification === 'blunder')) {
    recommendations.push({
      type: 'practice',
      title: 'Avoiding Opening Blunders',
      description: 'Practice common opening positions to avoid critical mistakes',
      difficulty: 'beginner',
      estimatedTime: '10-15 min',
      priority: 'high'
    })
  }

  if (mistakes.some(m => m.explanation.toLowerCase().includes('development'))) {
    recommendations.push({
      type: 'article',
      title: 'Opening Development Principles',
      description: 'Master the art of piece development in the opening',
      url: 'https://www.chess.com/learn-how-to-play-chess#opening',
      difficulty: 'beginner',
      estimatedTime: '5-10 min',
      priority: 'medium'
    })
  }

  if (accuracy < 50) {
    recommendations.push({
      type: 'course',
      title: 'Chess Opening Fundamentals',
      description: 'Comprehensive course covering all major opening principles',
      difficulty: 'beginner',
      estimatedTime: '2-3 hours',
      priority: 'high'
    })
  }

  return recommendations
}

function generatePracticePositions(openingName: string, mistakes: OpeningMistake[]): Array<{ position: string, description: string, difficulty: 'beginner' | 'intermediate' | 'advanced' }> {
  return [
    {
      position: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R',
      description: 'Typical position after 4 moves in many openings',
      difficulty: 'beginner'
    },
    {
      position: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R',
      description: 'Key tactical patterns in the opening',
      difficulty: 'intermediate'
    }
  ]
}

function calculatePeerComparison(accuracy: number, totalGames: number): PeerComparison {
  // Mock calculation - in real implementation, this would use actual peer data
  const averageAccuracy = 45 + Math.random() * 20 // 45-65% range
  const percentile = accuracy > averageAccuracy ? 60 + Math.random() * 30 : 20 + Math.random() * 40
  const trend = totalGames > 10 ? (Math.random() > 0.5 ? 'improving' : 'stable') : 'stable'

  return {
    averageAccuracy: Math.round(averageAccuracy),
    percentile: Math.round(percentile),
    trend,
    gamesPlayed: totalGames,
    ratingRange: '1200-1600'
  }
}

function calculateRepertoireAnalysis(openingStats: Array<{ opening: string, games: number, winRate: number }>): RepertoireAnalysis {
  if (openingStats.length === 0) {
    return {
      diversity: 0,
      colorPerformance: { white: 0, black: 0 },
      familyStrengths: [],
      familyWeaknesses: [],
      mostPlayed: 'None',
      leastPlayed: 'None',
      recommendation: 'Start building your opening repertoire'
    }
  }

  const totalGames = openingStats.reduce((sum, stat) => sum + stat.games, 0)
  const diversity = Math.min(100, (openingStats.length / 5) * 100) // Max 5 openings = 100%

  const sortedByGames = [...openingStats].sort((a, b) => b.games - a.games)
  const mostPlayed = sortedByGames[0]?.opening || 'None'
  const leastPlayed = sortedByGames[sortedByGames.length - 1]?.opening || 'None'

  const strengths = openingStats.filter(s => s.winRate > 60).map(s => s.opening)
  const weaknesses = openingStats.filter(s => s.winRate < 40).map(s => s.opening)

  return {
    diversity: Math.round(diversity),
    colorPerformance: { white: 50, black: 50 }, // Mock data
    familyStrengths: strengths,
    familyWeaknesses: weaknesses,
    mostPlayed,
    leastPlayed,
    recommendation: diversity < 30 ? 'Expand your opening repertoire' : 'Focus on improving existing openings'
  }
}

function generateImprovementTrend(accuracy: number): Array<{ date: string, accuracy: number, games: number }> {
  // Mock trend data
  const trend = []
  const baseDate = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - i * 7)
    trend.push({
      date: date.toISOString().split('T')[0],
      accuracy: Math.max(0, accuracy - Math.random() * 20 + Math.random() * 10),
      games: Math.floor(Math.random() * 5) + 1
    })
  }
  return trend
}

function generateNextGoals(mistakes: OpeningMistake[], accuracy: number): string[] {
  const goals = []

  if (mistakes.length > 0) {
    goals.push(`Reduce mistakes from ${mistakes.length} to ${Math.max(0, mistakes.length - 2)} in next game`)
  }

  if (accuracy < 70) {
    goals.push(`Improve opening accuracy to ${Math.min(100, accuracy + 10)}%`)
  }

  goals.push('Study the recommended resources')
  goals.push('Practice the key positions')

  return goals
}

function generateFocusAreas(mistakes: OpeningMistake[], patterns: string[]): string[] {
  const areas = []

  if (mistakes.some(m => m.classification === 'blunder')) {
    areas.push('Avoiding critical mistakes')
  }

  if (mistakes.some(m => m.explanation.toLowerCase().includes('development'))) {
    areas.push('Piece development')
  }

  if (mistakes.some(m => m.explanation.toLowerCase().includes('center'))) {
    areas.push('Center control')
  }

  areas.push('Opening theory')
  areas.push('Tactical awareness')

  return areas
}

function getLearningTip(classification: string, moveNumber: number): string {
  const tips = {
    blunder: 'This was a critical mistake. Take time to understand why this move is bad and what the correct continuation should be.',
    mistake: 'This move gives your opponent a significant advantage. Focus on the fundamental principles you violated.',
    inaccuracy: 'This move is not the best but not terrible. Look for ways to improve your position more efficiently.'
  }

  return tips[classification] || 'Review this move and understand the engine\'s recommendation.'
}

function getRecommendationIcon(type: string): string {
  const icons = {
    video: '🎥',
    article: '📄',
    practice: '♟️',
    game: '🎮',
    course: '📚'
  }
  return icons[type] || '📖'
}
