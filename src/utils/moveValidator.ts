/**
 * Move validation utility for chess practice positions and puzzles.
 * Extracts shared logic from PuzzleSolvePage for reuse.
 */

import { Chess, Square } from 'chess.js'

interface MoveValidationResult {
  isValid: boolean
  isCorrect: boolean
  moveSan: string
  moveUci: string
}

/**
 * Validate a chess move against a position and optionally check if it matches the correct move.
 *
 * @param fen - The FEN position to validate against
 * @param sourceSquare - Source square (e.g., 'e2')
 * @param targetSquare - Target square (e.g., 'e4')
 * @param correctMove - Optional correct move to check against (UCI or SAN format)
 * @returns Validation result with move details
 */
export function validateMove(
  fen: string,
  sourceSquare: string,
  targetSquare: string,
  correctMove?: string
): MoveValidationResult {
  const game = new Chess(fen)
  const piece = game.get(sourceSquare as Square)

  // Handle pawn promotion
  const targetRank = targetSquare[1]
  const isPromotion = piece?.type === 'p' &&
    ((piece.color === 'w' && targetRank === '8') ||
     (piece.color === 'b' && targetRank === '1'))

  const move = game.move({
    from: sourceSquare,
    to: targetSquare,
    ...(isPromotion && { promotion: 'q' }),
  })

  if (!move) {
    return { isValid: false, isCorrect: false, moveSan: '', moveUci: '' }
  }

  const moveUci = `${move.from}${move.to}${move.promotion || ''}`

  let isCorrect = false
  if (correctMove) {
    const correctUci = correctMove.toLowerCase()
    isCorrect = moveUci.toLowerCase() === correctUci ||
      move.san.replace(/[+#]/g, '') === correctMove.replace(/[+#]/g, '')
  }

  return { isValid: true, isCorrect, moveSan: move.san, moveUci }
}

/**
 * Convert a UCI move string (e.g., 'e2e4') to arrow coordinates for react-chessboard.
 *
 * @param uciMove - Move in UCI format
 * @returns Array with [from, to] squares for customArrows prop
 */
export function uciToArrow(uciMove: string): [string, string] {
  return [uciMove.slice(0, 2), uciMove.slice(2, 4)]
}
