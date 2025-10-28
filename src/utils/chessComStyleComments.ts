/**
 * Chess.com-Style Comment Generator
 *
 * Replicates the tone, content, and insights from Chess.com's game review comments.
 * Key characteristics:
 * - Concise and direct (1-2 sentences)
 * - Evaluation change shown (+X.XX or -X.XX)
 * - Specific tactical/positional themes mentioned
 * - Clear consequences explained
 * - "Show Follow-Up" functionality for sequences
 */

import { Chess } from 'chess.js'

export interface ChessComCommentContext {
  classification: string
  centipawnLoss: number | null
  evaluation: {
    type: 'cp' | 'mate'
    value: number
  } | null
  prevEvaluation: {
    type: 'cp' | 'mate'
    value: number
  } | null
  san: string
  bestMoveSan: string | null
  isUserMove: boolean
  player: 'white' | 'black'
  fenBefore: string
  fenAfter: string
  tacticalInsights?: string[]
  positionalInsights?: string[]
}

export interface ChessComComment {
  // Main comment text (e.g., "b3 is a miss")
  classification: string
  // Evaluation change (e.g., "-4.35" or "+2.43")
  evaluationChange: string
  // Brief explanation (1-2 sentences)
  explanation: string
  // Follow-up sequence if applicable
  followUpMoves?: string[]
  followUpFens?: string[]
}

/**
 * Generate a Chess.com-style comment for a move
 */
export function generateChessComComment(context: ChessComCommentContext): ChessComComment {
  const { classification, centipawnLoss, evaluation, prevEvaluation, san, bestMoveSan, isUserMove, player, fenBefore, fenAfter } = context

  // Calculate evaluation change
  const evaluationChange = calculateEvaluationChange(evaluation, prevEvaluation, player, isUserMove)

  // Generate explanation based on classification
  const explanation = generateExplanation(context)

  // Generate follow-up sequence if applicable
  const { followUpMoves, followUpFens } = generateFollowUpSequence(context)

  return {
    classification: getDisplayClassification(classification),
    evaluationChange,
    explanation,
    followUpMoves,
    followUpFens
  }
}

/**
 * Calculate evaluation change with proper sign for display
 */
function calculateEvaluationChange(
  evaluation: { type: 'cp' | 'mate'; value: number } | null,
  prevEvaluation: { type: 'cp' | 'mate'; value: number } | null,
  player: 'white' | 'black',
  isUserMove: boolean
): string {
  if (!evaluation || !prevEvaluation) return '0.00'

  // Handle mate scenarios
  if (evaluation.type === 'mate') {
    return evaluation.value > 0 ? '+M' : '-M'
  }
  if (prevEvaluation.type === 'mate') {
    return prevEvaluation.value > 0 ? '-M' : '+M'
  }

  // Calculate centipawn change from player's perspective
  const evalNow = evaluation.value
  const evalBefore = prevEvaluation.value

  // Adjust for player color
  const playerMultiplier = player === 'white' ? 1 : -1
  const change = (evalNow - evalBefore) * playerMultiplier

  // If it's user's move, show the impact on their position
  // Positive = good for player, Negative = bad for player
  const displayChange = isUserMove ? change : -change

  // Format as Chess.com does: +X.XX or -X.XX
  const formattedChange = (displayChange / 100).toFixed(2)
  return displayChange >= 0 ? `+${formattedChange}` : formattedChange
}

/**
 * Get display classification (Chess.com terminology)
 */
function getDisplayClassification(classification: string): string {
  const map: Record<string, string> = {
    'brilliant': 'brilliant',
    'best': 'best',
    'great': 'great',
    'excellent': 'excellent',
    'good': 'good',
    'acceptable': 'book',
    'inaccuracy': 'inaccuracy',
    'mistake': 'mistake',
    'blunder': 'miss' // Chess.com uses "miss" for blunders
  }
  return map[classification] || classification
}

/**
 * Generate concise, tactical explanation like Chess.com
 */
function generateExplanation(context: ChessComCommentContext): string {
  const { classification, centipawnLoss, san, bestMoveSan, isUserMove, fenBefore, fenAfter, tacticalInsights, positionalInsights } = context

  // Analyze position for specific tactical/positional themes
  const themes = detectThemes(fenBefore, fenAfter, san, tacticalInsights, positionalInsights)

  // Generate explanation based on classification and themes
  switch (classification) {
    case 'brilliant':
      return generateBrilliantExplanation(themes, isUserMove)

    case 'best':
      return generateBestExplanation(themes, isUserMove)

    case 'great':
      return generateGreatExplanation(themes, isUserMove)

    case 'excellent':
      return generateExcellentExplanation(themes, isUserMove)

    case 'good':
      return generateGoodExplanation(themes, isUserMove)

    case 'acceptable':
      return generateAcceptableExplanation(themes, isUserMove)

    case 'inaccuracy':
      return generateInaccuracyExplanation(themes, isUserMove, bestMoveSan)

    case 'mistake':
      return generateMistakeExplanation(themes, isUserMove, bestMoveSan, centipawnLoss)

    case 'blunder':
      return generateBlunderExplanation(themes, isUserMove, bestMoveSan, centipawnLoss)

    default:
      return 'Move played.'
  }
}

interface PositionThemes {
  // Tactical themes
  fork?: { targets: string[] }
  pin?: { pinnedPiece: string; pinnedTo: string }
  skewer?: { target: string }
  discoveredAttack?: boolean
  doubleAttack?: { targets: string[] }
  capture?: { piece: string; value: number }
  check?: boolean
  checkmate?: boolean
  promotion?: boolean

  // Material themes
  winsMaterial?: { piece: string; value: number }
  losesMaterial?: { piece: string; value: number }
  sacrifice?: { piece: string; compensation: string }

  // Positional themes
  centralControl?: boolean
  kingSafety?: { improves: boolean }
  pawnStructure?: { type: string } // "double pawns", "isolated pawn", etc.
  pieceActivity?: { improves: boolean }
  spaceAdvantage?: boolean

  // Strategic themes
  winningAdvantage?: boolean
  losesAdvantage?: boolean
  equalizesPosition?: boolean
  developmentLead?: boolean
}

/**
 * Detect tactical and positional themes from position analysis
 */
function detectThemes(
  fenBefore: string,
  fenAfter: string,
  san: string,
  tacticalInsights?: string[],
  positionalInsights?: string[]
): PositionThemes {
  const themes: PositionThemes = {}
  const chess = new Chess(fenBefore)

  // Basic move info
  themes.check = san.includes('+') && !san.includes('#')
  themes.checkmate = san.includes('#')
  themes.capture = san.includes('x')
  themes.promotion = san.includes('=')

  // Parse tactical insights
  if (tacticalInsights && tacticalInsights.length > 0) {
    tacticalInsights.forEach(insight => {
      const lower = insight.toLowerCase()

      if (lower.includes('fork')) {
        themes.fork = { targets: [] }
      }
      if (lower.includes('pin')) {
        themes.pin = { pinnedPiece: '', pinnedTo: '' }
      }
      if (lower.includes('skewer')) {
        themes.skewer = { target: '' }
      }
      if (lower.includes('discovered attack')) {
        themes.discoveredAttack = true
      }
      if (lower.includes('double attack')) {
        themes.doubleAttack = { targets: [] }
      }
      if (lower.includes('win') && (lower.includes('material') || lower.includes('piece'))) {
        themes.winsMaterial = { piece: '', value: 0 }
      }
      if (lower.includes('lose') && (lower.includes('material') || lower.includes('piece'))) {
        themes.losesMaterial = { piece: '', value: 0 }
      }
      if (lower.includes('sacrifice')) {
        themes.sacrifice = { piece: '', compensation: '' }
      }
    })
  }

  // Parse positional insights
  if (positionalInsights && positionalInsights.length > 0) {
    positionalInsights.forEach(insight => {
      const lower = insight.toLowerCase()

      if (lower.includes('center') || lower.includes('central')) {
        themes.centralControl = true
      }
      if (lower.includes('king safety')) {
        themes.kingSafety = { improves: !lower.includes('weaken') }
      }
      if (lower.includes('double pawn') || lower.includes('doubled pawn')) {
        themes.pawnStructure = { type: 'double pawns' }
      }
      if (lower.includes('isolated pawn')) {
        themes.pawnStructure = { type: 'isolated pawn' }
      }
      if (lower.includes('activity') || lower.includes('active')) {
        themes.pieceActivity = { improves: !lower.includes('weaken') && !lower.includes('passive') }
      }
      if (lower.includes('space')) {
        themes.spaceAdvantage = true
      }
      if (lower.includes('winning') || lower.includes('decisive')) {
        themes.winningAdvantage = true
      }
      if (lower.includes('lose') && lower.includes('advantage')) {
        themes.losesAdvantage = true
      }
      if (lower.includes('equal') || lower.includes('balanced')) {
        themes.equalizesPosition = true
      }
    })
  }

  return themes
}

/**
 * Generate explanation for brilliant moves
 */
function generateBrilliantExplanation(themes: PositionThemes, isUserMove: boolean): string {
  const subject = isUserMove ? 'You are' : 'They are'
  const verb = isUserMove ? 'have' : 'have'

  if (themes.sacrifice) {
    return `${subject} sacrificing material for a decisive attack.`
  }
  if (themes.checkmate) {
    return `${subject} forcing checkmate!`
  }
  if (themes.fork && themes.winsMaterial) {
    return `${subject} tactically winning material through a brilliant combination.`
  }

  return `${subject} playing a spectacular tactical move.`
}

/**
 * Generate explanation for best moves
 */
function generateBestExplanation(themes: PositionThemes, isUserMove: boolean): string {
  const subject = isUserMove ? 'This is' : 'This is'

  if (themes.centralControl) {
    return `${subject} the most accurate move, controlling the center.`
  }
  if (themes.pieceActivity?.improves) {
    return `${subject} the best move, improving piece activity.`
  }
  if (themes.kingSafety?.improves) {
    return `${subject} the strongest move, securing king safety.`
  }

  return `${subject} the engine's top choice.`
}

/**
 * Generate explanation for great moves
 */
function generateGreatExplanation(themes: PositionThemes, isUserMove: boolean): string {
  const subject = isUserMove ? 'You are' : 'They are'

  if (themes.fork) {
    return `${subject} creating a fork, attacking multiple pieces.`
  }
  if (themes.pin) {
    return `${subject} pinning a piece, restricting opponent movement.`
  }
  if (themes.doubleAttack) {
    return `${subject} creating a double attack on multiple targets.`
  }
  if (themes.centralControl) {
    return `${subject} gaining strong central control.`
  }

  return `${subject} making a very strong move.`
}

/**
 * Generate explanation for excellent moves
 */
function generateExcellentExplanation(themes: PositionThemes, isUserMove: boolean): string {
  const subject = isUserMove ? 'You are' : 'They are'

  if (themes.winsMaterial) {
    return `${subject} threatening to tactically win a pawn.`
  }
  if (themes.pieceActivity?.improves) {
    return `${subject} improving piece coordination.`
  }
  if (themes.developmentLead) {
    return `${subject} maintaining a development advantage.`
  }

  return `${subject} making an excellent move.`
}

/**
 * Generate explanation for good moves
 */
function generateGoodExplanation(themes: PositionThemes, isUserMove: boolean): string {
  const subject = isUserMove ? 'You are' : 'They are'

  if (themes.pawnStructure?.type === 'double pawns') {
    return `${subject} forcing your opponent to double pawns.`
  }
  if (themes.kingSafety?.improves) {
    return `${subject} improving king safety.`
  }
  if (themes.spaceAdvantage) {
    return `${subject} gaining space advantage.`
  }
  if (themes.centralControl) {
    return `${subject} maintaining central control.`
  }

  return `${subject} making a solid move.`
}

/**
 * Generate explanation for acceptable moves
 */
function generateAcceptableExplanation(themes: PositionThemes, isUserMove: boolean): string {
  return 'This follows opening theory.'
}

/**
 * Generate explanation for inaccuracies
 */
function generateInaccuracyExplanation(themes: PositionThemes, isUserMove: boolean, bestMoveSan: string | null): string {
  const subject = isUserMove ? 'You' : 'They'
  const verb = isUserMove ? 'lose' : 'lose'

  if (themes.losesAdvantage) {
    return `${subject} ${verb} some advantage, allowing opponent counterplay.`
  }
  if (themes.losesMaterial) {
    return `${subject} ${verb} a small amount of material.`
  }
  if (themes.kingSafety && !themes.kingSafety.improves) {
    return `${subject} slightly weaken king safety.`
  }

  return `${subject} ${verb} a small advantage. Better was ${bestMoveSan || 'a different move'}.`
}

/**
 * Generate explanation for mistakes
 */
function generateMistakeExplanation(themes: PositionThemes, isUserMove: boolean, bestMoveSan: string | null, centipawnLoss: number | null): string {
  const subject = isUserMove ? 'You' : 'They'
  const opponentSubject = isUserMove ? 'your opponent' : 'you'

  if (themes.losesMaterial) {
    return `This permits ${opponentSubject} to capture a pawn and win material after the follow-up trades.`
  }
  if (themes.fork) {
    return `${opponentSubject} ${isUserMove ? 'are' : 'is'} now able to win a bishop through a fork.`
  }
  if (themes.pin) {
    return `This allows ${opponentSubject} to pin a piece and win material.`
  }
  if (themes.losesAdvantage) {
    return `${subject} lost your advantage, and now the position is balanced.`
  }
  if (themes.kingSafety && !themes.kingSafety.improves) {
    return `This weakens king safety, allowing tactical threats.`
  }

  // Default mistake explanation
  const consequence = centipawnLoss && centipawnLoss > 300 ? 'significant material' : 'an advantage'
  return `This permits ${opponentSubject} to gain ${consequence}.`
}

/**
 * Generate explanation for blunders ("miss" in Chess.com)
 */
function generateBlunderExplanation(themes: PositionThemes, isUserMove: boolean, bestMoveSan: string | null, centipawnLoss: number | null): string {
  const subject = isUserMove ? 'This' : 'This'
  const opponentSubject = isUserMove ? 'the opponent' : 'you'

  if (themes.checkmate) {
    return `${subject} permits ${opponentSubject} to deliver checkmate.`
  }
  if (themes.losesMaterial) {
    return `${subject} permits ${opponentSubject} to capture a pawn and win material after the follow-up trades. This misses an opportunity to capture a free bishop.`
  }
  if (themes.fork) {
    return `${subject} allows ${opponentSubject} to win material through a devastating fork.`
  }
  if (themes.pin) {
    return `${subject} allows ${opponentSubject} to pin and win a piece.`
  }

  // Default blunder explanation
  return `${subject} permits ${opponentSubject} to gain a decisive advantage.`
}

/**
 * Generate follow-up sequence showing why the move is good/bad
 */
function generateFollowUpSequence(context: ChessComCommentContext): { followUpMoves?: string[]; followUpFens?: string[] } {
  const { classification, fenAfter, bestMoveSan } = context

  // Only generate follow-ups for mistakes, blunders, and brilliant moves
  if (!['mistake', 'blunder', 'brilliant'].includes(classification)) {
    return {}
  }

  try {
    const chess = new Chess(fenAfter)
    const moves: string[] = []
    const fens: string[] = [fenAfter]

    // For mistakes/blunders, show the opponent's best continuation
    // For brilliant moves, show the winning sequence
    if (classification === 'mistake' || classification === 'blunder') {
      // Show 2-3 moves of opponent's best play
      // This would require engine analysis in a real implementation
      // For now, we'll return empty to be filled by the engine
      return {}
    } else if (classification === 'brilliant') {
      // Show the brilliant continuation
      return {}
    }

    return { followUpMoves: moves, followUpFens: fens }
  } catch (error) {
    console.error('Error generating follow-up sequence:', error)
    return {}
  }
}

/**
 * Format full Chess.com-style comment for display
 */
export function formatChessComComment(comment: ChessComComment, san: string): string {
  const { classification, evaluationChange, explanation } = comment

  // Format: "b3 is a miss (-4.35) - Explanation here."
  return `${san} is ${classification === 'miss' ? 'a miss' : classification} (${evaluationChange}) - ${explanation}`
}
