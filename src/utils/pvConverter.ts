/**
 * Utility functions for converting Stockfish Principal Variation (PV) moves
 * from UCI notation to SAN (Standard Algebraic Notation)
 */

import { Chess } from 'chess.js'

/**
 * Convert a UCI PV line to SAN notation
 * @param fen The position FEN where the PV starts
 * @param pvUci Array of UCI moves from Stockfish (e.g. ['e2e4', 'e7e5', 'g1f3'])
 * @returns Array of SAN moves (e.g. ['e4', 'e5', 'Nf3'])
 */
export function convertPvToSan(fen: string, pvUci: string[]): string[] {
  if (!pvUci || pvUci.length === 0) {
    return []
  }

  try {
    const chess = new Chess(fen)
    const sanMoves: string[] = []

    console.log('🔍 Converting PV to SAN:', {
      startingFen: fen,
      pvUci: pvUci,
      pvLength: pvUci.length
    })

    for (let i = 0; i < pvUci.length; i++) {
      const uciMove = pvUci[i]

      // Validate UCI format before attempting conversion
      if (!uciMove || typeof uciMove !== 'string' || uciMove.length < 4) {
        console.warn(`❌ Invalid UCI format at index ${i}:`, {
          uciMove,
          currentFen: chess.fen(),
          convertedSoFar: sanMoves
        })
        // Skip invalid format but continue with rest of PV
        continue
      }

      try {
        // Convert UCI to SAN by making the move
        const move = chess.move(uciMove)
        if (!move) {
          // If move is illegal, skip it but continue with rest of PV
          console.warn(`❌ Illegal UCI move in PV at index ${i}:`, {
            uciMove,
            currentFen: chess.fen(),
            convertedSoFar: sanMoves
          })
          continue
        }
        sanMoves.push(move.san)
        console.log(`✅ Converted move ${i}:`, uciMove, '→', move.san)
      } catch (error) {
        // If any error occurs, skip this move but continue with rest of PV
        console.warn(`❌ Error converting UCI move at index ${i}:`, {
          uciMove,
          error,
          currentFen: chess.fen(),
          convertedSoFar: sanMoves
        })
        continue
      }
    }

    console.log('✅ PV conversion complete:', {
      inputLength: pvUci.length,
      outputLength: sanMoves.length,
      sanMoves
    })

    return sanMoves
  } catch (error) {
    console.error('❌ Error converting PV to SAN:', error)
    return []
  }
}

/**
 * Extract the PV moves starting from the best move position
 * (The first move in PV is the best move, the rest is the continuation)
 * @param pvSan Array of SAN moves from the PV
 * @param includeBestMove If true, includes the best move as first move. If false, returns only the continuation after the best move
 * @returns Array of follow-up moves
 */
export function extractFollowUpMoves(pvSan: string[], includeBestMove: boolean = false): string[] {
  if (!pvSan || pvSan.length === 0) {
    return []
  }

  // If including best move, return all moves
  // If not, skip the first move (which is the best move itself)
  return includeBestMove ? pvSan : pvSan.slice(1)
}

/**
 * Format PV moves for display with move numbers
 * @param pvSan Array of SAN moves
 * @param startMoveNumber The move number where the PV starts
 * @param startingPlayer 'white' or 'black' - who plays the first move in the PV
 * @returns Formatted string like "16...Nxd3 17.Bxd3 Qxd3"
 */
export function formatPvForDisplay(
  pvSan: string[],
  startMoveNumber: number,
  startingPlayer: 'white' | 'black'
): string {
  if (!pvSan || pvSan.length === 0) {
    return ''
  }

  const formatted: string[] = []
  let currentMoveNumber = startMoveNumber
  let currentPlayer = startingPlayer

  for (let i = 0; i < pvSan.length; i++) {
    const move = pvSan[i]

    if (currentPlayer === 'white') {
      formatted.push(`${currentMoveNumber}.${move}`)
      currentPlayer = 'black'
    } else {
      // For black moves, only show move number if it's the first move
      if (i === 0) {
        formatted.push(`${currentMoveNumber}...${move}`)
      } else {
        formatted.push(move)
      }
      currentPlayer = 'white'
      currentMoveNumber++
    }
  }

  return formatted.join(' ')
}

/**
 * Get a truncated version of the PV for compact display
 * @param pvSan Array of SAN moves
 * @param maxMoves Maximum number of moves to show
 * @returns Truncated array with indicator if truncated
 */
export function truncatePv(pvSan: string[], maxMoves: number = 10): { moves: string[], truncated: boolean } {
  if (!pvSan || pvSan.length <= maxMoves) {
    return { moves: pvSan || [], truncated: false }
  }

  return {
    moves: pvSan.slice(0, maxMoves),
    truncated: true
  }
}
