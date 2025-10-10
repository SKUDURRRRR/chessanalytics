/**
 * Position-Specific Comment Generator
 * 
 * Generates specific, contextual comments based on actual board analysis.
 * Uses chess.js to analyze positions and detect specific tactical patterns.
 */

import { Chess } from 'chess.js'

interface PositionAnalysisResult {
  hangingPieces: Array<{ square: string; piece: string; pieceType: string }>
  threatenedPieces: Array<{ square: string; piece: string; pieceType: string; attacker: string }>
  checks: string[]
  forks: string[]
  pins: string[]
  discoveredAttacks: string[]
  mateThreats: string[]
}

const PIECE_VALUES: Record<string, number> = {
  'p': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9,
  'k': 0
}

const PIECE_NAMES: Record<string, string> = {
  'p': 'pawn',
  'n': 'knight',
  'b': 'bishop',
  'r': 'rook',
  'q': 'queen',
  'k': 'king'
}

/**
 * Analyze position after a move to detect specific tactical patterns
 */
export function analyzePositionAfterMove(fenBefore: string, move: string): PositionAnalysisResult {
  const result: PositionAnalysisResult = {
    hangingPieces: [],
    threatenedPieces: [],
    checks: [],
    forks: [],
    pins: [],
    discoveredAttacks: [],
    mateThreats: []
  }

  try {
    const chess = new Chess(fenBefore)
    const moveObj = chess.move(move)
    if (!moveObj) return result

    // Check for hanging pieces (pieces that are attacked and not defended)
    result.hangingPieces = detectHangingPieces(chess)
    
    // Check for threatened pieces (pieces under attack)
    result.threatenedPieces = detectThreatenedPieces(chess)
    
    // Check if king is in check
    if (chess.inCheck()) {
      result.checks.push(`King in check`)
    }
    
    // Check for mate threats
    if (chess.isCheckmate()) {
      result.mateThreats.push(`Checkmate!`)
    }

  } catch (error) {
    console.warn('Error analyzing position:', error)
  }

  return result
}

/**
 * Detect hanging (undefended) pieces
 */
function detectHangingPieces(chess: Chess): Array<{ square: string; piece: string; pieceType: string }> {
  const hanging: Array<{ square: string; piece: string; pieceType: string }> = []
  const board = chess.board()
  const turn = chess.turn()

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (piece && piece.color === turn) {
        const square = String.fromCharCode(97 + col) + (8 - row)
        
        // Check if piece is attacked
        if (isSquareAttacked(chess, square, turn === 'w' ? 'b' : 'w')) {
          // Check if piece is defended
          if (!isSquareDefended(chess, square, turn)) {
            hanging.push({
              square,
              piece: piece.type.toUpperCase(),
              pieceType: PIECE_NAMES[piece.type]
            })
          }
        }
      }
    }
  }

  return hanging
}

/**
 * Detect threatened pieces (attacked but may be defended)
 */
function detectThreatenedPieces(chess: Chess): Array<{ square: string; piece: string; pieceType: string; attacker: string }> {
  const threatened: Array<{ square: string; piece: string; pieceType: string; attacker: string }> = []
  const board = chess.board()
  const turn = chess.turn()

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (piece && piece.color === turn) {
        const square = String.fromCharCode(97 + col) + (8 - row)
        
        // Check if piece is attacked
        const attackers = getAttackers(chess, square, turn === 'w' ? 'b' : 'w')
        if (attackers.length > 0) {
          const defenders = getAttackers(chess, square, turn)
          
          // If more attackers than defenders, it's threatened
          if (attackers.length > defenders.length) {
            threatened.push({
              square,
              piece: piece.type.toUpperCase(),
              pieceType: PIECE_NAMES[piece.type],
              attacker: attackers[0]
            })
          }
        }
      }
    }
  }

  return threatened
}

/**
 * Check if a square is attacked by a given color
 */
function isSquareAttacked(chess: Chess, square: string, byColor: 'w' | 'b'): boolean {
  const attacks = getAttackers(chess, square, byColor)
  return attacks.length > 0
}

/**
 * Check if a square is defended by a given color
 */
function isSquareDefended(chess: Chess, square: string, byColor: 'w' | 'b'): boolean {
  const defenders = getAttackers(chess, square, byColor)
  return defenders.length > 0
}

/**
 * Get all pieces of a given color that attack a square
 */
function getAttackers(chess: Chess, square: string, byColor: 'w' | 'b'): string[] {
  const attackers: string[] = []
  const board = chess.board()
  const [file, rank] = [square.charCodeAt(0) - 97, parseInt(square[1]) - 1]

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (piece && piece.color === byColor) {
        const fromSquare = String.fromCharCode(97 + col) + (8 - row)
        
        // Check if this piece can move to the target square
        const moves = chess.moves({ square: fromSquare, verbose: true })
        if (moves.some(m => m.to === square)) {
          attackers.push(fromSquare)
        }
      }
    }
  }

  return attackers
}

/**
 * Generate a specific blunder comment based on position analysis
 */
export function generateSpecificBlunderComment(
  fenBefore: string,
  move: string,
  bestMoveSan: string,
  centipawnLoss: number
): string {
  const analysis = analyzePositionAfterMove(fenBefore, move)
  const details: string[] = []

  // Check for hanging pieces
  if (analysis.hangingPieces.length > 0) {
    const mostValuable = analysis.hangingPieces.reduce((max, piece) => {
      const pieceValue = PIECE_VALUES[piece.piece.toLowerCase()]
      const maxValue = PIECE_VALUES[max.piece.toLowerCase()]
      return pieceValue > maxValue ? piece : max
    })
    details.push(`Your ${mostValuable.pieceType} on ${mostValuable.square} is now hanging`)
  }

  // Check for threatened pieces
  if (analysis.threatenedPieces.length > 0 && analysis.hangingPieces.length === 0) {
    const piece = analysis.threatenedPieces[0]
    details.push(`Your ${piece.pieceType} on ${piece.square} is under attack`)
  }

  // Check for checks
  if (analysis.checks.length > 0) {
    details.push(`This move exposes your king to check`)
  }

  // Build the comment
  if (details.length > 0) {
    const specific = details.slice(0, 2).join(', ')
    if (centipawnLoss > 300) {
      return `This is a catastrophic blunder. ${specific.charAt(0).toUpperCase() + specific.slice(1)}. Consider ${bestMoveSan} instead to avoid this disaster.`
    } else if (centipawnLoss > 200) {
      return `This is a major blunder. ${specific.charAt(0).toUpperCase() + specific.slice(1)}. Consider ${bestMoveSan} instead to keep your pieces safe.`
    } else if (centipawnLoss > 100) {
      return `This is a serious mistake. ${specific.charAt(0).toUpperCase() + specific.slice(1)}. Consider ${bestMoveSan} instead to avoid these issues.`
    } else {
      return `This creates problems. ${specific.charAt(0).toUpperCase() + specific.slice(1)}. Consider ${bestMoveSan} instead.`
    }
  }

  // Fallback to generic comment
  if (centipawnLoss > 300) {
    return `This is a catastrophic blunder - you likely hung a major piece or allowed mate. Consider ${bestMoveSan} instead.`
  } else if (centipawnLoss > 200) {
    return `This is a major blunder - you probably lost a piece or created fatal weaknesses. Consider ${bestMoveSan} instead.`
  } else {
    return `This creates serious problems for your position. Consider ${bestMoveSan} instead.`
  }
}

/**
 * Generate a specific brilliant move comment based on position analysis
 */
export function generateSpecificBrilliantComment(
  fenBefore: string,
  move: string
): string {
  try {
    const chess = new Chess(fenBefore)
    const moveObj = chess.move(move)
    if (!moveObj) return "Brilliant move!"

    const details: string[] = []
    const pieceName = PIECE_NAMES[moveObj.piece]
    const toSquare = moveObj.to

    // Check if it was a sacrifice (captured or moved to attacked square)
    if (moveObj.captured) {
      const capturedName = PIECE_NAMES[moveObj.captured]
      details.push(`You captured the ${capturedName} with your ${pieceName}`)
    }

    // Check for check/checkmate
    if (chess.inCheck()) {
      details.push(`This delivers check to the king`)
      
      if (chess.isCheckmate()) {
        details.push(`It's checkmate`)
      }
    }

    // Build the comment
    if (details.length > 0) {
      const specific = details.slice(0, 2).join(', ')
      return `Brilliant! ${specific} - this shows exceptional tactical vision and creates winning chances.`
    }

    return `Brilliant! ${pieceName.charAt(0).toUpperCase() + pieceName.slice(1)} to ${toSquare} is an exceptional move that creates winning chances.`
  } catch (error) {
    return "Brilliant move!"
  }
}

/**
 * Generate a specific mistake comment based on position analysis
 */
export function generateSpecificMistakeComment(
  fenBefore: string,
  move: string,
  bestMoveSan: string,
  centipawnLoss: number
): string {
  const analysis = analyzePositionAfterMove(fenBefore, move)
  const details: string[] = []

  // Check for hanging pieces
  if (analysis.hangingPieces.length > 0) {
    const piece = analysis.hangingPieces[0]
    details.push(`Your ${piece.pieceType} on ${piece.square} is now unprotected`)
  }

  // Check for threatened pieces
  if (analysis.threatenedPieces.length > 0 && analysis.hangingPieces.length === 0) {
    const piece = analysis.threatenedPieces[0]
    details.push(`Your ${piece.pieceType} on ${piece.square} is under attack`)
  }

  // Build the comment
  if (details.length > 0) {
    const specific = details.slice(0, 1).join('; ')
    return `This isn't right. ${specific.charAt(0).toUpperCase() + specific.slice(1)}. Consider ${bestMoveSan} instead, which would avoid these issues.`
  }

  // Fallback to generic comment
  return `This isn't right. This creates serious problems for your position. Consider ${bestMoveSan} instead, which would be much better.`
}

