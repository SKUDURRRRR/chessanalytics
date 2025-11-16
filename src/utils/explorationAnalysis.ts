import { Chess } from 'chess.js'

export interface ExplorationPositionAnalysis {
  fen: string
  lastMove: string | null
  evaluation: string
  comment: string
  tacticalThemes: string[]
  positionType: 'opening' | 'middlegame' | 'endgame'
  materialBalance: number
  activePlayer: 'white' | 'black'
}

/**
 * Analyzes a chess position and generates insights for exploration mode
 */
export function analyzeExplorationPosition(
  fen: string,
  lastMoveSan: string | null,
  moveNumber: number
): ExplorationPositionAnalysis {
  const chess = new Chess(fen)
  const activePlayer = chess.turn() === 'w' ? 'white' : 'black'

  // Determine game phase
  const positionType = determineGamePhase(chess, moveNumber)

  // Calculate material balance
  const materialBalance = calculateMaterialBalance(chess)

  // Detect tactical themes
  const tacticalThemes = detectTacticalThemes(chess, lastMoveSan)

  // Generate position evaluation
  const evaluation = generateEvaluationText(materialBalance, chess)

  // Generate contextual comment
  const comment = generateExplorationComment(
    chess,
    lastMoveSan,
    positionType,
    materialBalance,
    tacticalThemes,
    activePlayer
  )

  return {
    fen,
    lastMove: lastMoveSan,
    evaluation,
    comment,
    tacticalThemes,
    positionType,
    materialBalance,
    activePlayer
  }
}

function determineGamePhase(chess: Chess, moveNumber: number): 'opening' | 'middlegame' | 'endgame' {
  if (moveNumber <= 10) return 'opening'

  // Count pieces to determine if it's endgame
  const board = chess.board()
  let pieceCount = 0
  let queenCount = 0

  for (const row of board) {
    for (const square of row) {
      if (square) {
        pieceCount++
        if (square.type === 'q') queenCount++
      }
    }
  }

  // Endgame: <= 12 pieces or no queens
  if (pieceCount <= 12 || (queenCount === 0 && pieceCount <= 16)) {
    return 'endgame'
  }

  return 'middlegame'
}

function calculateMaterialBalance(chess: Chess): number {
  const pieceValues: Record<string, number> = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0
  }

  const board = chess.board()
  let balance = 0

  for (const row of board) {
    for (const square of row) {
      if (square) {
        const value = pieceValues[square.type] || 0
        balance += square.color === 'w' ? value : -value
      }
    }
  }

  return balance
}

function detectTacticalThemes(chess: Chess, lastMoveSan: string | null): string[] {
  const themes: string[] = []

  if (!lastMoveSan) return themes

  // Check for checks
  if (chess.inCheck()) {
    themes.push('Check')
  }

  // Check for checkmate
  if (chess.isCheckmate()) {
    themes.push('Checkmate')
  }

  // Check for captures (contains 'x')
  if (lastMoveSan.includes('x')) {
    themes.push('Capture')
  }

  // Check for promotion (contains '=')
  if (lastMoveSan.includes('=')) {
    themes.push('Promotion')
  }

  // Check for castling
  if (lastMoveSan === 'O-O' || lastMoveSan === 'O-O-O') {
    themes.push(lastMoveSan === 'O-O' ? 'Kingside Castling' : 'Queenside Castling')
  }

  return themes
}

function generateEvaluationText(materialBalance: number, chess: Chess): string {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? 'Black wins' : 'White wins'
  }

  if (chess.isDraw() || chess.isStalemate()) {
    return 'Draw'
  }

  if (Math.abs(materialBalance) === 0) {
    return 'Equal position'
  } else if (Math.abs(materialBalance) <= 2) {
    return materialBalance > 0
      ? 'White is slightly better'
      : 'Black is slightly better'
  } else if (Math.abs(materialBalance) <= 5) {
    return materialBalance > 0
      ? 'White is better'
      : 'Black is better'
  } else {
    return materialBalance > 0
      ? 'White is winning'
      : 'Black is winning'
  }
}

function generateExplorationComment(
  chess: Chess,
  lastMoveSan: string | null,
  positionType: 'opening' | 'middlegame' | 'endgame',
  materialBalance: number,
  tacticalThemes: string[],
  activePlayer: 'white' | 'black'
): string {
  // Handle terminal positions
  if (chess.isCheckmate()) {
    return `Checkmate! ${chess.turn() === 'w' ? 'Black' : 'White'} has won the game.`
  }

  if (chess.isStalemate()) {
    return `Stalemate! The game ends in a draw as ${activePlayer} has no legal moves.`
  }

  if (chess.isDraw()) {
    if (chess.isThreefoldRepetition()) {
      return 'Draw by threefold repetition.'
    }
    if (chess.isInsufficientMaterial()) {
      return 'Draw due to insufficient material.'
    }
    return 'The position is a draw.'
  }

  // Generate contextual comments based on position
  const comments: string[] = []

  // Comment on the last move if it exists
  if (lastMoveSan && tacticalThemes.length > 0) {
    if (tacticalThemes.includes('Checkmate')) {
      return `${lastMoveSan} delivers checkmate!`
    }
    if (tacticalThemes.includes('Check')) {
      comments.push(`${lastMoveSan} puts the king in check.`)
    } else if (tacticalThemes.includes('Capture')) {
      comments.push(`${lastMoveSan} captures material.`)
    } else if (tacticalThemes.includes('Promotion')) {
      comments.push(`${lastMoveSan} promotes the pawn.`)
    } else if (tacticalThemes.includes('Kingside Castling') || tacticalThemes.includes('Queenside Castling')) {
      comments.push(`${lastMoveSan} improves king safety.`)
    }
  }

  // Add position-specific guidance
  if (positionType === 'opening') {
    const developmentAdvice = [
      'Focus on developing pieces and controlling the center.',
      'Look to develop knights and bishops toward the center.',
      'Consider castling to ensure king safety.',
      'Control central squares with pawns and pieces.'
    ]
    comments.push(developmentAdvice[Math.floor(Math.random() * developmentAdvice.length)])
  } else if (positionType === 'middlegame') {
    const middlegameAdvice = [
      'Look for tactical opportunities and threats.',
      'Evaluate pawn structure and weak squares.',
      'Look for ways to improve piece placement.',
      'Search for tactical motifs like pins, forks, or skewers.'
    ]
    comments.push(middlegameAdvice[Math.floor(Math.random() * middlegameAdvice.length)])
  } else if (positionType === 'endgame') {
    const endgameAdvice = [
      'Activate your king - it\'s a strong piece in the endgame.',
      'Push passed pawns and restrict opponent\'s pawns.',
      'Look for opportunities to create passed pawns.',
      'Coordinate pieces to support pawn advancement.',
      'Calculate carefully - precision matters in the endgame.'
    ]
    comments.push(endgameAdvice[Math.floor(Math.random() * endgameAdvice.length)])
  }

  // Add material balance context if significant
  if (Math.abs(materialBalance) >= 3) {
    const leader = materialBalance > 0 ? 'White' : 'Black'
    const trailing = materialBalance > 0 ? 'Black' : 'White'
    if (Math.abs(materialBalance) >= 5) {
      comments.push(`${leader} has a significant material advantage and should look to convert it.`)
    } else {
      comments.push(`${leader} is up material. ${trailing} needs to create counterplay.`)
    }
  }

  return comments.join(' ')
}

/**
 * Generates a simple positional evaluation comment
 */
export function generateSimpleEvaluation(chess: Chess): string {
  if (chess.isCheckmate()) return 'Checkmate!'
  if (chess.isStalemate()) return 'Stalemate'
  if (chess.isDraw()) return 'Draw'
  if (chess.inCheck()) return 'Check!'

  const moves = chess.moves()
  if (moves.length === 0) return 'No legal moves'
  if (moves.length < 10) return 'Limited options'
  if (moves.length > 30) return 'Many possibilities'

  return 'Explore the position'
}
