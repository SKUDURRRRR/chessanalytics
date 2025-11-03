/**
 * Utility functions for generating chess arrows from move analysis data
 */

import { Chess, Square } from 'chess.js'

export type Arrow = [Square, Square, string?]

export interface ModernArrow {
  from: Square
  to: Square
  color: string
  classification: string
  isBestMove: boolean
}

export type MoveClassification =
  | 'brilliant'
  | 'best'
  | 'excellent'  // Merged: great+excellent (5-25cp loss)
  | 'great'  // Kept for backward compatibility, maps to excellent
  | 'good'  // Merged: good+acceptable (25-100cp loss)
  | 'acceptable'  // Kept for backward compatibility, maps to good
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'uncategorized'

export interface MoveAnalysis {
  san: string
  bestMoveSan?: string | null
  classification: MoveClassification
  isUserMove: boolean
}

/**
 * Color mapping for different move classifications
 * Following chess.com conventions:
 * - Green: Best moves
 * - Blue: Good moves
 * - Purple: Brilliant moves
 * - Yellow: Acceptable moves
 * - Red: Mistakes/blunders
 */
export const ARROW_COLORS: Record<MoveClassification, string> = {
  brilliant: '#8b5cf6', // Purple
  best: '#10b981',      // Green
  great: '#3b82f6',     // Blue
  excellent: '#06b6d4', // Cyan
  good: '#3b82f6',      // Blue
  acceptable: '#f59e0b', // Yellow
  inaccuracy: '#f59e0b', // Yellow
  mistake: '#ef4444',   // Red
  blunder: '#dc2626',   // Dark Red
  uncategorized: '#6b7280' // Gray
}

/**
 * Convert SAN move to UCI format for arrow generation
 * Enhanced with better error handling and fallback mechanisms for ambiguous moves
 */
export function sanToUci(san: string, chess: Chess): { from: Square; to: Square } | null {
  if (!san || !san.trim()) {
    console.warn('[sanToUci] Empty or invalid SAN:', san)
    return null
  }

  try {
    // Clone the chess instance to avoid modifying the original
    const testChess = new Chess(chess.fen())

    // Log the position we're trying to make the move from (debug only)
    if (process.env.NODE_ENV === 'development') {
      console.debug('[sanToUci] Converting move:', san, 'from position:', chess.fen().split(' ')[0])
    }

    // Try to make the move on the cloned instance
    const move = testChess.move(san)
    if (move) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[sanToUci] Successfully converted:', san, '→', `${move.from}${move.to}`)
      }
      return {
        from: move.from as Square,
        to: move.to as Square
      }
    }

    // If move is null, try fallback: parse all legal moves and find matching SAN
    // This helps with ambiguous notation or edge cases
    console.warn('[sanToUci] Move returned null, trying fallback for:', san)
    const legalMoves = testChess.moves({ verbose: true })
    const matchingMove = legalMoves.find(m => m.san === san || m.san === san.replace(/^([NBRQK])/, '$1'))

    if (matchingMove) {
      console.log('[sanToUci] Fallback successful:', san, '→', `${matchingMove.from}${matchingMove.to}`)
      return {
        from: matchingMove.from as Square,
        to: matchingMove.to as Square
      }
    }
  } catch (error) {
    // Log detailed error information - always log for brilliant moves to help diagnose
    const errorDetails = {
      san,
      position: chess.fen(),
      turn: chess.turn(),
      error: error instanceof Error ? error.message : String(error)
    }

    // Always log errors (not just in development) to help diagnose brilliant move arrow issues
    console.warn('[sanToUci] Failed to convert SAN to UCI:', errorDetails)

    // Try one more fallback: check if the position is valid and try to find the move manually
    try {
      const testChess2 = new Chess(chess.fen())
      const allMoves = testChess2.moves({ verbose: true })

      // Try to match by destination square and piece type
      const sanMatch = san.match(/^([NBRQK])?([a-h])?([1-8])?[x-]?([a-h])([1-8])/);
      if (sanMatch) {
        const destFile = sanMatch[4]
        const destRank = sanMatch[5]
        const destSquare = `${destFile}${destRank}` as Square

        // Find moves that go to the destination square
        const movesToDest = allMoves.filter(m => m.to === destSquare)

        if (movesToDest.length === 1) {
          // Only one move to this square, must be it
          console.log('[sanToUci] Fallback by destination successful:', san, '→', `${movesToDest[0].from}${movesToDest[0].to}`)
          return {
            from: movesToDest[0].from as Square,
            to: movesToDest[0].to as Square
          }
        } else if (movesToDest.length > 1) {
          // Multiple moves to same square - try to match by piece type
          const pieceType = sanMatch[1] // N, B, R, Q, K
          if (pieceType) {
            const pieceMap: Record<string, string> = {
              'N': 'n', 'B': 'b', 'R': 'r', 'Q': 'q', 'K': 'k'
            }
            const pieceColor = testChess2.turn() === 'w' ? pieceMap[pieceType]?.toUpperCase() : pieceMap[pieceType]
            const matchingPiece = movesToDest.find(m => {
              const piece = testChess2.get(m.from)
              return piece && piece.type.toLowerCase() === pieceType.toLowerCase()
            })

            if (matchingPiece) {
              console.log('[sanToUci] Fallback by piece type successful:', san, '→', `${matchingPiece.from}${matchingPiece.to}`)
              return {
                from: matchingPiece.from as Square,
                to: matchingPiece.to as Square
              }
            }
          }
        }
      }
    } catch (fallbackError) {
      console.warn('[sanToUci] Fallback also failed:', fallbackError)
    }
  }

  return null
}

/**
 * Generate arrows for a move analysis
 */
export function generateMoveArrows(
  moveAnalysis: MoveAnalysis,
  chess: Chess
): Arrow[] {
  const arrows: Arrow[] = []

  // Add arrow for the actual move played
  const actualMove = sanToUci(moveAnalysis.san, chess)
  if (actualMove) {
    const color = ARROW_COLORS[moveAnalysis.classification]
    arrows.push([actualMove.from, actualMove.to, color])
  }

  // Add arrow for best move if different from actual move
  if (moveAnalysis.bestMoveSan && moveAnalysis.bestMoveSan !== moveAnalysis.san) {
    const bestMove = sanToUci(moveAnalysis.bestMoveSan, chess)
    if (bestMove) {
      // Use green for best move suggestions
      arrows.push([bestMove.from, bestMove.to, '#10b981'])
    }
  }

  return arrows
}

/**
 * Generate arrows for multiple moves
 */
export function generateMultipleMoveArrows(
  moves: MoveAnalysis[],
  chess: Chess
): Arrow[] {
  const allArrows: Arrow[] = []

  for (const move of moves) {
    const moveArrows = generateMoveArrows(move, chess)
    allArrows.push(...moveArrows)
  }

  return allArrows
}

/**
 * Get arrow color for a specific classification
 */
export function getArrowColor(classification: MoveClassification): string {
  return ARROW_COLORS[classification]
}

/**
 * Generate modern arrows for a move analysis
 */
export function generateModernMoveArrows(
  moveAnalysis: MoveAnalysis,
  chess: Chess
): ModernArrow[] {
  console.log('[generateModernMoveArrows] Called with:', {
    san: moveAnalysis.san,
    classification: moveAnalysis.classification,
    bestMoveSan: moveAnalysis.bestMoveSan,
    fen: chess.fen()
  })

  const arrows: ModernArrow[] = []

  // Determine if we should show the best move suggestion
  // Show best move arrow for any move that is NOT "best" or "brilliant"
  const shouldShowBestMove =
    moveAnalysis.bestMoveSan &&
    moveAnalysis.bestMoveSan !== moveAnalysis.san &&
    !['best', 'brilliant'].includes(moveAnalysis.classification)

  // Add arrow for the actual move played
  const actualMove = sanToUci(moveAnalysis.san, chess)

  if (actualMove) {
    console.log('[generateModernMoveArrows] Adding arrow for actual move:', actualMove, 'classification:', moveAnalysis.classification)
    arrows.push({
      from: actualMove.from,
      to: actualMove.to,
      color: ARROW_COLORS[moveAnalysis.classification],
      classification: moveAnalysis.classification,
      isBestMove: false
    })
  } else {
    // Enhanced logging for brilliant moves specifically
    const isBrilliant = moveAnalysis.classification === 'brilliant'
    const logLevel = isBrilliant ? 'error' : 'warn'
    console[logLevel]('[generateModernMoveArrows] ⚠️ Failed to convert SAN to UCI for',
      moveAnalysis.classification.toUpperCase(), 'move:', {
      san: moveAnalysis.san,
      classification: moveAnalysis.classification,
      fen: chess.fen(),
      turn: chess.turn(),
      isUserMove: moveAnalysis.isUserMove
    })

    // For brilliant moves, this is particularly concerning - log additional debug info
    if (isBrilliant) {
      console.error('[generateModernMoveArrows] ❌ BRILLIANT MOVE ARROW MISSING!', {
        san: moveAnalysis.san,
        position: chess.fen(),
        legalMoves: chess.moves({ verbose: true }).slice(0, 5) // First 5 for debugging
      })
    }
  }

  // Add arrow for best move suggestion when move was suboptimal
  if (shouldShowBestMove) {
    const bestMove = sanToUci(moveAnalysis.bestMoveSan!, chess)

    if (bestMove) {
      console.log('[generateModernMoveArrows] Adding arrow for best move:', bestMove)
      arrows.push({
        from: bestMove.from,
        to: bestMove.to,
        color: '#10b981', // Green for best move
        classification: 'best',
        isBestMove: true
      })
    }
  }

  console.log('[generateModernMoveArrows] Returning', arrows.length, 'arrows:', arrows)
  return arrows
}

/**
 * Generate modern arrows for multiple moves
 */
export function generateMultipleModernMoveArrows(
  moves: MoveAnalysis[],
  chess: Chess
): ModernArrow[] {
  const allArrows: ModernArrow[] = []

  for (const move of moves) {
    const moveArrows = generateModernMoveArrows(move, chess)
    allArrows.push(...moveArrows)
  }

  return allArrows
}

/**
 * Generate arrows for the current position showing better options
 * This is used when showing "better options were available" analysis
 */
export function generateBetterOptionsArrows(
  currentMove: MoveAnalysis,
  betterMoves: string[],
  chess: Chess
): Arrow[] {
  const arrows: Arrow[] = []

  // Add the actual move in red (mistake)
  const actualMove = sanToUci(currentMove.san, chess)
  if (actualMove) {
    arrows.push([actualMove.from, actualMove.to, '#ef4444']) // Red for mistake
  }

  // Add better moves in green
  for (const betterMove of betterMoves) {
    const betterMoveUci = sanToUci(betterMove, chess)
    if (betterMoveUci) {
      arrows.push([betterMoveUci.from, betterMoveUci.to, '#10b981']) // Green for better
    }
  }

  return arrows
}

/**
 * Generate modern arrows for better options
 */
export function generateModernBetterOptionsArrows(
  currentMove: MoveAnalysis,
  betterMoves: string[],
  chess: Chess
): ModernArrow[] {
  const arrows: ModernArrow[] = []

  // Add the actual move in red (mistake)
  const actualMove = sanToUci(currentMove.san, chess)
  if (actualMove) {
    arrows.push({
      from: actualMove.from,
      to: actualMove.to,
      color: '#ef4444',
      classification: currentMove.classification,
      isBestMove: false
    })
  }

  // Add better moves in green
  for (const betterMove of betterMoves) {
    const betterMoveUci = sanToUci(betterMove, chess)
    if (betterMoveUci) {
      arrows.push({
        from: betterMoveUci.from,
        to: betterMoveUci.to,
        color: '#10b981',
        classification: 'best',
        isBestMove: true
      })
    }
  }

  return arrows
}
