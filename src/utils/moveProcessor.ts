/**
 * Move processing utility - extracts shared move analysis logic
 * used by both GameAnalysisPage and GameReviewPage.
 */

import { Chess } from 'chess.js'
import { convertPvToSan } from './pvConverter'
import { generateChessComComment, formatChessComComment, type ChessComCommentContext } from './chessComStyleComments'
import { buildHumanComment, type HumanReasonContext } from './commentTemplates'

// ============================================================================
// Types
// ============================================================================

export interface EvaluationInfo {
  type: 'cp' | 'mate'
  value: number
  pv?: string[]
}

export interface AnalysisMoveRecord {
  move: string
  move_san: string
  fen_before?: string
  fen_after?: string
  evaluation?: EvaluationInfo
  best_move?: string
  best_move_san?: string
  best_move_pv?: string[]
  explanation?: string
  centipawn_loss?: number
  is_best?: boolean
  is_brilliant?: boolean
  is_great?: boolean
  is_excellent?: boolean
  is_blunder?: boolean
  is_mistake?: boolean
  is_inaccuracy?: boolean
  is_good?: boolean
  is_acceptable?: boolean
  coaching_comment?: string
  what_went_right?: string
  what_went_wrong?: string
  how_to_improve?: string
  tactical_insights?: string[]
  positional_insights?: string[]
  risks?: string[]
  benefits?: string[]
  learning_points?: string[]
  encouragement_level?: number
  move_quality?: string
  game_phase?: string
  is_user_move?: boolean
  player_color?: string
}

export type MoveClassification =
  | 'brilliant'
  | 'best'
  | 'excellent'
  | 'great'
  | 'good'
  | 'acceptable'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'uncategorized'

export interface ProcessedMove {
  index: number
  ply: number
  moveNumber: number
  player: 'white' | 'black'
  isUserMove: boolean
  san: string
  bestMoveSan: string | null
  evaluation: EvaluationInfo | null
  scoreForPlayer: number
  displayEvaluation: string
  centipawnLoss: number | null
  classification: MoveClassification
  explanation: string
  fenBefore: string
  fenAfter: string
  pvMoves?: string[]
  coachingComment?: string
  whatWentRight?: string
  whatWentWrong?: string
  howToImprove?: string
  tacticalInsights?: string[]
  positionalInsights?: string[]
  risks?: string[]
  benefits?: string[]
  learningPoints?: string[]
  encouragementLevel?: number
  moveQuality?: string
  gamePhase?: string
}

export interface KeyMoment {
  moveIndex: number
  move: ProcessedMove
  classification: 'blunder' | 'mistake' | 'inaccuracy'
  severity: number
}

// ============================================================================
// Constants
// ============================================================================

const EVAL_CAP = 500

export const classificationBadgeStyles: Record<MoveClassification, string> = {
  brilliant: 'shadow-card bg-purple-500/20 text-purple-200',
  best: 'shadow-card bg-emerald-500/20 text-emerald-200',
  excellent: 'shadow-card bg-cyan-500/20 text-cyan-200',
  great: 'shadow-card bg-cyan-500/20 text-cyan-200',
  good: 'shadow-card bg-sky-500/20 text-sky-200',
  acceptable: 'shadow-card bg-sky-500/20 text-sky-200',
  inaccuracy: 'shadow-card bg-amber-500/20 text-amber-200',
  mistake: 'shadow-card bg-orange-500/20 text-orange-200',
  blunder: 'shadow-card bg-rose-500/20 text-rose-200',
  uncategorized: 'shadow-card bg-slate-500/10 text-slate-200',
}

export const classificationLabel: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',
  best: 'Best',
  excellent: 'Excellent',
  great: 'Excellent',
  good: 'Good',
  acceptable: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  uncategorized: 'Move',
}

// ============================================================================
// Helper Functions
// ============================================================================

export const parseUciMove = (uci: string) => {
  if (!uci || typeof uci !== 'string' || uci.length < 4) {
    throw new Error(`Invalid UCI format: ${uci}`)
  }

  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci.slice(4) : undefined

  const squareRegex = /^[a-h][1-8]$/
  if (!squareRegex.test(from) || !squareRegex.test(to)) {
    throw new Error(`Invalid square format in UCI: ${uci}`)
  }

  return { from, to, promotion }
}

export const convertUciToSan = (fen: string, uci?: string | null): string | null => {
  if (!uci) {
    return null
  }
  try {
    const chess = new Chess(fen)
    const { from, to, promotion } = parseUciMove(uci)
    const result = chess.move({ from, to, promotion })
    return result ? result.san : null
  } catch (error) {
    console.warn('Unable to convert UCI to SAN', uci, error)
    return null
  }
}

export const determineClassification = (move: AnalysisMoveRecord): MoveClassification => {
  if (move.is_brilliant) return 'brilliant'
  if (move.is_best) return 'best'
  if (move.is_great) return 'great'
  if (move.is_excellent) return 'excellent'
  if (move.is_blunder) return 'blunder'
  if (move.is_mistake) return 'mistake'
  if (move.is_inaccuracy) return 'inaccuracy'
  if (move.is_good) return 'good'
  if (move.is_acceptable) return 'acceptable'
  return 'uncategorized'
}

export const formatEvaluation = (evaluation: EvaluationInfo | null, playerColor: 'white' | 'black') => {
  if (!evaluation) {
    return '--'
  }
  if (evaluation.type === 'mate') {
    const prefix = evaluation.value > 0 ? '#' : '#-'
    return `${prefix}${Math.abs(evaluation.value)}`
  }
  const score = evaluation.value / 100
  const adjusted = playerColor === 'white' ? score : -score
  return `${adjusted > 0 ? '+' : ''}${adjusted.toFixed(2)}`
}

export const evaluationToScoreForPlayer = (
  evaluation: EvaluationInfo | null,
  playerColor: 'white' | 'black'
): number => {
  if (!evaluation) {
    return 0
  }
  if (evaluation.type === 'mate') {
    const mateScore = evaluation.value > 0 ? EVAL_CAP : -EVAL_CAP
    return playerColor === 'white' ? mateScore : -mateScore
  }
  const score = evaluation.value
  return playerColor === 'white' ? score : -score
}

export const buildFallbackExplanation = (
  classification: MoveClassification,
  centipawnLoss: number | null,
  bestMoveSan: string | null
) => {
  switch (classification) {
    case 'brilliant':
      return '🌟 Brilliant tactical resource that demonstrates exceptional chess understanding. This move likely involves a calculated sacrifice, devastating combination, or sophisticated positional maneuver that maximizes your advantage.'
    case 'best':
      return '✅ Strong move that kept the engine evaluation on track. This is optimal play that maintains your position and shows excellent chess understanding.'
    case 'good':
    case 'acceptable':
      return '👍 Solid move that maintained a playable position. This shows reasonable chess understanding and keeps your position healthy.'
    case 'inaccuracy':
      return bestMoveSan
        ? `⚠️ Inaccuracy. The engine suggests ${bestMoveSan} would have been a stronger choice. This move slightly weakens your position, but the game remains competitive.`
        : '⚠️ Inaccuracy. This move weakens your position and allows your opponent to improve. Look for stronger moves that maintain your advantage better.'
    case 'mistake':
      return bestMoveSan
        ? `❌ Mistake. Consider ${bestMoveSan} next time - it would have been much stronger and maintained your advantage. This move creates difficulties for your position.`
        : '❌ Mistake. Position deteriorated noticeably and allows your opponent to improve their position. Look for moves that maintain your position better.'
    case 'blunder':
      return bestMoveSan
        ? `❌ Blunder. Engine preferred ${bestMoveSan}, which would have maintained your position much better. This is a significant error that could be game-changing.`
        : '❌ Blunder. Advantage swung heavily to your opponent. This move likely involves hanging material, weakening your king, or missing critical tactical threats.'
    default:
      return '📝 Played move recorded. Consider the position carefully and look for the best continuation.'
  }
}

export const buildEnhancedFallbackExplanation = (
  classification: MoveClassification,
  centipawnLoss: number | null,
  bestMoveSan: string | null,
  move: AnalysisMoveRecord,
  isUserMove: boolean = true,
  playerColor: string = 'white'
) => {
  const loss = centipawnLoss != null ? Math.round(centipawnLoss) : null
  const colorName = playerColor.charAt(0).toUpperCase() + playerColor.slice(1)

  const moveNumber = (move as any)?.moveNumber || 0
  const isOpeningMove = moveNumber <= 10 && (classification === 'best' || classification === 'excellent' || classification === 'good')

  if (isOpeningMove) {
    if (moveNumber === 1) {
      if (isUserMove) {
        return 'The adventure begins! Time to bring out your forces and claim the center.'
      } else {
        return `The game begins! ${colorName} makes the first move. The adventure is underway!`
      }
    }
    return 'Book move.'
  }

  if (!isUserMove) {
    switch (classification) {
      case 'brilliant':
        return `🌟 ${colorName} played a brilliant move! This shows exceptional tactical vision and demonstrates advanced chess understanding. Study this position carefully to understand the sophisticated tactics involved - this could involve a calculated sacrifice, devastating tactical combination, or sophisticated positional maneuver. This is the kind of move that wins games and shows real chess mastery.`
      case 'best':
        return `✅ ${colorName} played the best move available. This is solid, accurate play that maintains their position well and shows strong chess fundamentals. They found the optimal continuation that keeps their position on track.`
      case 'great': {
        const isOpponentOpeningMove = moveNumber <= 10
        const hasOpponentMinimalEvalChange = loss != null && loss < 20
        if (isOpponentOpeningMove) {
          return 'Book move.'
        } else if (hasOpponentMinimalEvalChange) {
          return `🎯 ${colorName} played a great move! This is very strong play that shows excellent chess understanding. They're playing accurately and keeping the position well-balanced.`
        } else {
          return `🎯 ${colorName} played a great move! This is very strong play that shows excellent chess understanding. They found a move that improves their position and demonstrates advanced tactical awareness.`
        }
      }
      case 'excellent':
        return `⭐ ${colorName} played an excellent move! This is nearly optimal play that shows strong chess fundamentals. They found a move that maintains their position well and demonstrates good tactical awareness.`
      case 'good':
        return `👍 ${colorName} made a good move. This maintains a solid position and shows reasonable chess understanding with sound positional play. They're making solid decisions that keep their position balanced.`
      case 'acceptable':
        return `⚠️ ${colorName}'s move is acceptable, but not the strongest choice. Better options were available that could have improved their position more significantly. This creates an opportunity.`
      case 'inaccuracy':
        return bestMoveSan
          ? `⚠️ ${colorName} made an inaccuracy. The engine suggests ${bestMoveSan} would have been stronger. This creates a small opportunity to improve the position.`
          : `❌ ${colorName} made an inaccuracy. This creates an opportunity to improve the position. Look for ways to exploit this weakness.`
      case 'mistake':
        return bestMoveSan
          ? `❌ ${colorName} made a mistake! They should have played ${bestMoveSan} instead. This creates tactical opportunities - look for ways to take advantage of their error and gain a significant advantage.`
          : `❌ ${colorName}'s move creates significant difficulties for them. Look for tactical opportunities to exploit this mistake and gain a substantial advantage. This could be a turning point in the game.`
      case 'blunder':
        return bestMoveSan
          ? `❌ ${colorName} blundered! They should have played ${bestMoveSan}. This is a major tactical error - look for immediate opportunities to win material or deliver checkmate. This could be game-changing!`
          : `❌ ${colorName} made a serious mistake that could be game-changing. This creates a major tactical opportunity - look for winning combinations and decisive tactics that could end the game.`
      default:
        return '📝 Opponent move recorded. Analyze the position carefully and look for the best response to maintain or improve the position.'
    }
  }

  switch (classification) {
    case 'brilliant':
      return '🌟 Outstanding! This move demonstrates exceptional chess understanding and tactical mastery. You\'ve found a brilliant resource that even strong players might miss - this could involve a calculated sacrifice, devastating tactical combination, or sophisticated positional maneuver. This is the kind of move that wins games and shows real chess mastery!'
    case 'best':
      return '✅ Perfect! This is exactly what the position demands. You\'ve found the strongest move available and kept your position on track with optimal play. This shows excellent chess understanding and tactical awareness. You\'re playing at a very high level!'
    case 'great': {
      const isUserOpeningMove = moveNumber <= 10
      const hasMinimalEvalChange = loss != null && loss < 20
      if (isUserOpeningMove) {
        return 'Book move.'
      } else if (hasMinimalEvalChange) {
        return '🎯 Excellent work! This is a great move that shows strong chess understanding and tactical awareness. You\'re playing accurately and keeping the position well-balanced. This kind of play will help you win more games!'
      } else {
        return '🎯 Excellent work! This is a great move that shows strong chess understanding and tactical awareness. You\'ve found a move that improves your position and demonstrates advanced chess skills. This kind of play will help you win more games!'
      }
    }
    case 'excellent':
      return '⭐ Very well played! This is an excellent move that shows good chess fundamentals and tactical awareness. You\'ve found a move that maintains your position well and demonstrates solid chess understanding. Keep up the good work!'
    case 'good':
      return '👍 Good move! This maintains a solid position and shows good chess understanding. You\'re making sound positional decisions and keeping your pieces well-coordinated. This is solid, reliable play that builds a strong foundation.'
    case 'acceptable':
      return '⚠️ This move is playable, but there were better options available that could have improved your position more significantly. Consider looking for moves that create more threats, improve piece coordination, or strengthen your position. Every move counts in chess!'
    case 'inaccuracy':
      return '❌ This move has some issues. It weakens your position and allows your opponent to improve. Look for moves that maintain your advantage better and avoid giving your opponent unnecessary opportunities. Take more time to calculate and consider all your options.'
    case 'mistake':
      return bestMoveSan
        ? `❌ This move has problems that weaken your position. Consider ${bestMoveSan} next time - it would have been much stronger and maintained your advantage. Learn from this to improve your tactical awareness and calculation. Always check for better moves before committing.`
        : '❌ This move creates difficulties and allows your opponent to improve their position. The position deteriorated noticeably - look for moves that maintain your position better and avoid tactical weaknesses. This is a learning opportunity to improve your game.'
    case 'blunder':
      return bestMoveSan
        ? `❌ This is a significant error that could be game-changing. The engine preferred ${bestMoveSan}, which would have maintained your position much better. This move likely involves hanging material, weakening your king, or missing a tactical threat. Don\'t worry - we all make blunders, but learn from this to avoid similar errors in the future.`
        : '❌ This move has serious consequences that could swing the advantage heavily to your opponent. This might involve hanging pieces, weakening your king\'s safety, or missing critical tactical threats. Take more time to calculate before moving and always check for hanging pieces and tactical threats.'
    default:
      return '📝 Move recorded. Consider the position carefully and look for the best continuation that improves your position or creates threats.'
  }
}

// ============================================================================
// Main Processing Functions
// ============================================================================

export interface ProcessedData {
  moves: ProcessedMove[]
  positions: string[]
}

/**
 * Build processed moves from raw analysis data.
 * Extracted from GameAnalysisPage useMemo for reuse by GameReviewPage.
 */
export function buildProcessedMoves(
  movesAnalysis: AnalysisMoveRecord[],
  playerColor: 'white' | 'black'
): ProcessedData {
  if (!movesAnalysis || !Array.isArray(movesAnalysis) || movesAnalysis.length === 0) {
    return { moves: [], positions: ['start'] }
  }

  const chess = new Chess()
  const startingFen = chess.fen()
  const positions: string[] = [startingFen]
  const moves: ProcessedMove[] = []
  const userIsWhite = playerColor === 'white'

  movesAnalysis.forEach((move, idx) => {
    const fenBefore = move.fen_before || positions[idx]

    try {
      chess.load(fenBefore)
    } catch (err) {
      console.warn(`Failed to load fenBefore for move ${idx}, using calculated position:`, err)
      if (positions[idx]) {
        try {
          chess.load(positions[idx])
        } catch (fallbackErr) {
          console.error(`Failed to load fallback position for move ${idx}:`, fallbackErr)
        }
      }
    }

    const moveNumber = Math.floor(idx / 2) + 1
    const player: 'white' | 'black' = idx % 2 === 0 ? 'white' : 'black'
    const moveIsUserFlag = typeof move.is_user_move === 'boolean' ? move.is_user_move : undefined
    const movePlayerColor = move.player_color?.toLowerCase()

    const effectivePlayerColor = movePlayerColor || player
    const isUserMoveByColor = userIsWhite ? effectivePlayerColor === 'white' : effectivePlayerColor === 'black'

    let isUserMove = isUserMoveByColor
    if (moveIsUserFlag != null && moveIsUserFlag !== isUserMoveByColor) {
      if (import.meta.env.DEV) {
        console.warn(`[MoveProcessor] Correcting is_user_move flag:`, {
          move: move.move_san, moveIndex: idx,
          backendFlag: moveIsUserFlag, colorBased: isUserMoveByColor,
        })
      }
      isUserMove = isUserMoveByColor
    } else if (moveIsUserFlag != null) {
      isUserMove = moveIsUserFlag
    }

    const evaluation: EvaluationInfo | null = move.evaluation ?? null
    const scoreForPlayer = isUserMove
      ? evaluationToScoreForPlayer(evaluation, playerColor)
      : evaluationToScoreForPlayer(evaluation, player === 'white' ? 'black' : 'white')

    const bestMoveSanRaw = move.best_move_san && move.best_move_san.trim() ? move.best_move_san : null
    const bestMoveSan = bestMoveSanRaw || (move.best_move ? convertUciToSan(fenBefore, move.best_move) : null) || null
    const classification = determineClassification(move)

    let displaySan = move.move_san
    if (!displaySan || displaySan === move.move) {
      const convertedSan = convertUciToSan(fenBefore, move.move)
      if (convertedSan) {
        displaySan = convertedSan
      }
    }

    // Build explanation: prioritize backend coaching comment, then chess.com style, then fallback
    let explanation: string

    if (move.coaching_comment && move.coaching_comment.trim() &&
        !move.coaching_comment.toLowerCase().includes('centipawn') &&
        !move.coaching_comment.toLowerCase().includes('cp')) {
      explanation = move.coaching_comment
    } else {
      try {
        const prevEvaluation: EvaluationInfo | null = idx > 0 && movesAnalysis[idx - 1]?.evaluation
          ? movesAnalysis[idx - 1].evaluation!
          : null

        const chessComContext: ChessComCommentContext = {
          classification,
          centipawnLoss: move.centipawn_loss ?? null,
          evaluation: evaluation,
          prevEvaluation: prevEvaluation,
          san: displaySan,
          bestMoveSan: bestMoveSan,
          isUserMove,
          player,
          fenBefore: fenBefore,
          fenAfter: '',
          tacticalInsights: move.tactical_insights,
          positionalInsights: move.positional_insights,
        }

        // Apply move to get fenAfter for comment context
        let moveApplied = false
        try {
          const { from, to, promotion } = parseUciMove(move.move)
          const moveResult = chess.move({ from, to, promotion })
          if (moveResult) {
            moveApplied = true
          }
        } catch (err) {
          try {
            if (move.move_san) {
              const moveResult = chess.move(move.move_san)
              if (moveResult) {
                moveApplied = true
              }
            }
          } catch (fallbackError) {
            // Both attempts failed
          }
        }

        if (moveApplied) {
          chessComContext.fenAfter = chess.fen()
        } else {
          chessComContext.fenAfter = fenBefore
        }

        const chessComComment = generateChessComComment(chessComContext)
        explanation = formatChessComComment(chessComComment, displaySan)
      } catch (error) {
        console.warn('Error generating Chess.com-style comment, falling back to standard comment', error)

        if (move.explanation) {
          explanation = move.explanation
        } else {
          const commentContext: HumanReasonContext = {
            classification,
            centipawnLoss: move.centipawn_loss ?? null,
            bestMoveSan: bestMoveSan,
            moveNumber: moveNumber,
            isUserMove,
            isOpeningMove: moveNumber <= 10 && (classification === 'best' || classification === 'excellent' || classification === 'good' || classification === 'great'),
            tacticalInsights: move.tactical_insights,
            positionalInsights: move.positional_insights,
            risks: move.risks,
            benefits: move.benefits,
            fenBefore: fenBefore,
            move: move.move_san,
          }
          explanation = buildHumanComment(commentContext)
        }
      }
    }

    // Apply move to board state for position tracking
    let moveAppliedToBoard = false

    const currentFenBeforeMove = chess.fen()
    if (currentFenBeforeMove !== fenBefore) {
      try {
        chess.load(fenBefore)
      } catch (err) {
        console.error(`Failed to reload fenBefore for move ${idx}:`, err)
      }
    }

    try {
      const { from, to, promotion } = parseUciMove(move.move)
      const moveResult = chess.move({ from, to, promotion })
      if (moveResult) {
        moveAppliedToBoard = true
      }
    } catch (err) {
      try {
        if (move.move_san) {
          const moveResult = chess.move(move.move_san)
          if (moveResult) {
            moveAppliedToBoard = true
          }
        }
      } catch (fallbackError) {
        console.warn(`Failed to apply move ${idx} to board state:`, {
          uci: move.move, san: move.move_san, error: fallbackError,
        })
      }
    }

    let fenAfter: string
    if (moveAppliedToBoard) {
      fenAfter = chess.fen()
    } else if (move.fen_after) {
      fenAfter = move.fen_after
      try {
        chess.load(fenAfter)
      } catch (err) {
        console.warn('Failed to load backend fenAfter, using current position:', err)
        fenAfter = chess.fen()
      }
    } else {
      console.warn(`Move ${idx} could not be applied and no backend fenAfter, keeping current position`)
      fenAfter = chess.fen()
    }

    positions.push(fenAfter)

    let pvMoves: string[] | undefined
    if (move.best_move_pv && Array.isArray(move.best_move_pv) && move.best_move_pv.length > 0) {
      pvMoves = convertPvToSan(fenBefore, move.best_move_pv)
    }

    moves.push({
      index: idx,
      ply: idx + 1,
      moveNumber,
      player,
      isUserMove,
      san: displaySan,
      bestMoveSan,
      evaluation,
      scoreForPlayer,
      displayEvaluation: formatEvaluation(evaluation, isUserMove ? playerColor : player === 'white' ? 'black' : 'white'),
      centipawnLoss: move.centipawn_loss ?? null,
      classification,
      explanation,
      fenBefore,
      fenAfter,
      pvMoves,
      coachingComment: move.coaching_comment || undefined,
      whatWentRight: move.what_went_right,
      whatWentWrong: move.what_went_wrong,
      howToImprove: move.how_to_improve,
      tacticalInsights: move.tactical_insights,
      positionalInsights: move.positional_insights,
      risks: move.risks,
      benefits: move.benefits,
      learningPoints: move.learning_points,
      encouragementLevel: move.encouragement_level,
      moveQuality: move.move_quality,
      gamePhase: move.game_phase,
    })
  })

  return { moves, positions }
}

// ============================================================================
// Key Moment Identification
// ============================================================================

const CRITICAL_CLASSIFICATIONS = new Set(['blunder', 'mistake', 'inaccuracy'])
const MAX_KEY_MOMENTS = 10

/**
 * Identify key moments (user's blunders, mistakes, inaccuracies) from processed moves.
 * Returns sorted by severity (blunders first, then by centipawn loss), capped at MAX_KEY_MOMENTS.
 */
export function identifyKeyMoments(moves: ProcessedMove[]): KeyMoment[] {
  const classOrder: Record<string, number> = { blunder: 0, mistake: 1, inaccuracy: 2 }

  return moves
    .filter(move =>
      move.isUserMove &&
      CRITICAL_CLASSIFICATIONS.has(move.classification)
    )
    .map(move => ({
      moveIndex: move.index,
      move,
      classification: move.classification as 'blunder' | 'mistake' | 'inaccuracy',
      severity: move.centipawnLoss ?? 0,
    }))
    .sort((a, b) => {
      // Sort by move order (chronological) so the review follows the game flow
      return a.moveIndex - b.moveIndex
    })
    .slice(0, MAX_KEY_MOMENTS)
}
