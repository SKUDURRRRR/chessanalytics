import { Chess } from 'chess.js'
import { ChessSoundType } from '../hooks/useChessSound'

/**
 * Determines which sound to play based on the chess move
 *
 * @param san - Standard Algebraic Notation of the move (e.g., "Nf3", "exd5", "O-O")
 * @param chess - Chess.js instance after the move has been played
 * @returns The type of sound to play
 */
export function getMoveSound(san: string, chess: Chess): ChessSoundType {
  // Check for castling (highest priority - exact match)
  if (san === 'O-O' || san === 'O-O-O') {
    return 'castle'
  }

  // Check for check or checkmate (both use check sound)
  if (san.includes('+') || san.includes('#')) {
    return 'check'
  }

  // Check for capture
  if (san.includes('x')) {
    return 'capture'
  }

  // Promotion and normal moves use the same sound
  return 'move'
}

/**
 * Simplified version that works without chess.js instance
 * Only uses the SAN notation to determine sound
 */
export function getMoveSoundSimple(san: string): ChessSoundType {
  // Check for castling (exact match)
  if (san === 'O-O' || san === 'O-O-O') return 'castle'

  // Check or checkmate (both use check sound)
  if (san.includes('+') || san.includes('#')) return 'check'

  // Capture
  if (san.includes('x')) return 'capture'

  // Promotion and normal moves use the same sound
  return 'move'
}
