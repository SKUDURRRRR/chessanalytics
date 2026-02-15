/**
 * Play with Tal Coach Page
 * Interactive chess game against AI coach
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { CoachingService } from '../../services/coachingService'
import UnifiedAnalysisService from '../../services/unifiedAnalysisService'
import { fetchGameAnalysisData } from '../../services/gameAnalysisService'
import { PremiumGate } from '../../components/coach/PremiumGate'
import LoadingModal from '../../components/LoadingModal'
import { GameResultModal } from '../../components/coach/GameResultModal'
import { useAuth } from '../../contexts/AuthContext'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import { config } from '../../lib/config'
import { supabase } from '../../lib/supabase'
import { EnhancedMoveCoaching } from '../../components/debug/EnhancedMoveCoaching'
import { ProcessedMove } from '../GameAnalysisPage'
import { TalCoachIcon } from '../../components/ui/TalCoachIcon'
import { useChessSound } from '../../hooks/useChessSound'
import { useChessSoundSettings } from '../../contexts/ChessSoundContext'
import { getMoveSoundSimple } from '../../utils/chessSounds'

type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resignation'

interface MoveWithComment {
  moveNumber: number
  san: string
  isUserMove: boolean
  coachingComment?: string
  processedMove?: ProcessedMove
}

// Key: half-move index (0-based position in moveHistory array)
type CoachingCommentsMap = Map<number, MoveWithComment>

/**
 * Extract move analysis from the backend response, handling all known response shapes.
 */
function extractMoveAnalysis(data: any): any | null {
  if (!data?.data) return null
  // Shape 1: Single move analysis (data.data IS the MoveAnalysis)
  if (data.data.move || data.data.move_san) {
    return data.data
  }
  // Shape 2: Game analysis with moves_analysis array
  if (data.data.moves_analysis?.length > 0) {
    return data.data.moves_analysis[0]
  }
  // Shape 3: Root-level moves_analysis (legacy)
  if (data.moves_analysis?.length > 0) {
    return data.moves_analysis[0]
  }
  return null
}

/**
 * Check if a coaching comment is raw engine output that should be filtered.
 * More precise than blanket "contains centipawn" filtering.
 */
function isRawEngineOutput(comment: string): boolean {
  const enginePatterns = [
    /\d+\s*centipawns?\b/i,          // "150 centipawns"
    /centipawn\s+loss/i,              // "centipawn loss"
    /[+-]?\d+\.?\d*\s*cp\b/i,        // "+3.2 cp" or "150 cp"
    /^cp\s+/i,                        // starts with "cp "
    /\bcp\s+(?:loss|gain|advantage)/i // "cp loss", "cp advantage"
  ]
  return enginePatterns.some(pattern => pattern.test(comment))
}

export default function PlayWithCoachPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [game, setGame] = useState(new Chess())
  const [gamePosition, setGamePosition] = useState(game.fen())
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white')
  const [isEngineThinking, setIsEngineThinking] = useState(false)
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing')
  const [moveHistory, setMoveHistory] = useState<string[]>([])
  const [skillLevel, setSkillLevel] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [showResultModal, setShowResultModal] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzedGameId, setAnalyzedGameId] = useState<string | null>(null)
  const [coachingComments, setCoachingComments] = useState<CoachingCommentsMap>(new Map())
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [analyzingMoveIndex, setAnalyzingMoveIndex] = useState<number | null>(null)
  const analyzingMoveRef = useRef<{ moveNumber: number; san: string } | null>(null)
  const [showInitialGreeting, setShowInitialGreeting] = useState(true)
  // FEN before each move, keyed by half-move index — needed for on-demand analysis of past moves
  const moveFenHistoryRef = useRef<Map<number, string>>(new Map())
  // Which comment to show in the sidebar (half-move index). null = show most recent.
  const [selectedCommentIndex, setSelectedCommentIndex] = useState<number | null>(null)

  // Chess sound support
  const { soundEnabled, volume } = useChessSoundSettings()
  const { playSound } = useChessSound({ enabled: soundEnabled, volume })

  // Derive displayed comment — either explicitly selected or most recent
  const currentMoveComment = useMemo(() => {
    if (moveHistory.length === 0 || showInitialGreeting) return null
    // If a specific move is selected and has a comment, show it
    if (selectedCommentIndex !== null && coachingComments.has(selectedCommentIndex)) {
      return coachingComments.get(selectedCommentIndex) || null
    }
    // Otherwise show the most recent user move's comment
    for (let i = moveHistory.length - 1; i >= 0; i--) {
      const isUserMove = i % 2 === (playerColor === 'white' ? 0 : 1)
      if (isUserMove && coachingComments.has(i)) {
        return coachingComments.get(i) || null
      }
    }
    return null
  }, [moveHistory.length, coachingComments, playerColor, showInitialGreeting, selectedCommentIndex])

  // Check if it's engine's turn
  // Engine plays the opposite color of the player
  const isEngineTurn = useMemo(() => {
    const currentTurn = game.turn() // 'w' for white, 'b' for black
    const playerTurn = playerColor === 'white' ? 'w' : 'b'
    return currentTurn !== playerTurn
  }, [game, playerColor])

  // Handle engine move
  const makeEngineMove = useCallback(async () => {
    if (!isEngineTurn || gameStatus !== 'playing' || isEngineThinking) return

    setIsEngineThinking(true)
    setError(null)

    try {
      const currentFen = game.fen()
      const result = await CoachingService.getEngineMove(
        currentFen,
        skillLevel,
        10,
        user?.id
      )

      // Create a new game instance from current position
      const gameCopy = new Chess(currentFen)
      const move = gameCopy.move({
        from: result.move.from,
        to: result.move.to,
        promotion: 'q', // Always promote to queen for simplicity
      })

      if (move) {
        // Play sound for engine move
        const soundType = getMoveSoundSimple(result.move.san)
        playSound(soundType)

        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, result.move.san])

        // No comment preservation needed - currentMoveComment is derived via useMemo
        // and stays stable through engine move re-renders

        // Check game status
        if (gameCopy.isCheckmate()) {
          setGameStatus('checkmate')
          setShowResultModal(true)
        } else if (gameCopy.isStalemate()) {
          setGameStatus('stalemate')
          setShowResultModal(true)
        } else if (gameCopy.isDraw()) {
          setGameStatus('draw')
          setShowResultModal(true)
        }
      } else {
        setError('Engine move failed')
      }
    } catch (err) {
      console.error('Error getting engine move:', err)
      setError(err instanceof Error ? err.message : 'Failed to get engine move')
    } finally {
      setIsEngineThinking(false)
    }
  }, [game, isEngineTurn, gameStatus, isEngineThinking, skillLevel, user?.id])

  // Trigger engine move when it's engine's turn
  useEffect(() => {
    if (isEngineTurn && gameStatus === 'playing' && !isEngineThinking) {
      // Small delay to make it feel more natural
      const timer = setTimeout(() => {
        makeEngineMove()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isEngineTurn, gameStatus, isEngineThinking, makeEngineMove])

  // Handle player move
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (isEngineTurn || gameStatus !== 'playing') return false

    try {
      const gameCopy = new Chess(game.fen())
      const piece = gameCopy.get(sourceSquare)

      // Handle castling: if king is dragged to rook square, convert to proper castling move
      let actualTargetSquare = targetSquare
      if (piece?.type === 'k') {
        const sourceFile = sourceSquare[0]
        const targetFile = targetSquare[0]
        const rank = sourceSquare[1]

        // Check if this might be a castling attempt (dragging to rook square)
        // Kingside: king on e-file, trying to move to h-file (rook square)
        // Queenside: king on e-file, trying to move to a-file (rook square)
        if (sourceFile === 'e') {
          if (targetFile === 'h' && rank === '1') {
            // White kingside castling attempt - move to g1 instead
            actualTargetSquare = 'g1'
          } else if (targetFile === 'a' && rank === '1') {
            // White queenside castling attempt - move to c1 instead
            actualTargetSquare = 'c1'
          } else if (targetFile === 'h' && rank === '8') {
            // Black kingside castling attempt - move to g8 instead
            actualTargetSquare = 'g8'
          } else if (targetFile === 'a' && rank === '8') {
            // Black queenside castling attempt - move to c8 instead
            actualTargetSquare = 'c8'
          }
        }

        // Also handle if user drags king two squares (proper castling move)
        // This should work automatically, but we ensure it's handled
        // e1->g1 (white kingside), e1->c1 (white queenside)
        // e8->g8 (black kingside), e8->c8 (black queenside)
        if (sourceFile === 'e' && (targetFile === 'g' || targetFile === 'c')) {
          // This is already a valid castling move, let it through
          actualTargetSquare = targetSquare
        }
      }

      // Check if this is a pawn promotion before attempting the move
      const targetRank = actualTargetSquare[1]
      const isPromotion = piece?.type === 'p' &&
                        ((piece.color === 'w' && targetRank === '8') ||
                         (piece.color === 'b' && targetRank === '1'))

      // Try to make the move - let chess.js determine the move type automatically
      // Only specify promotion if it's actually a pawn promotion
      const move = gameCopy.move({
        from: sourceSquare,
        to: actualTargetSquare,
        ...(isPromotion && { promotion: 'q' }), // Only add promotion for pawn promotions
      })

      if (move) {
        // Store FEN before move for analysis
        const fenBefore = game.fen()
        const halfMoveIndex = moveHistory.length // Current length = index of the move about to be added

        // Play sound for player move
        const soundType = getMoveSoundSimple(move.san)
        playSound(soundType)

        // Update game state first
        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, move.san])

        // Hide initial greeting once player makes first move
        if (showInitialGreeting) {
          setShowInitialGreeting(false)
        }

        // Store FEN for on-demand analysis later
        moveFenHistoryRef.current.set(halfMoveIndex, fenBefore)
        // Clear selected comment so sidebar shows "Ask Coach" prompt for new move
        setSelectedCommentIndex(null)

        // Check game status
        if (gameCopy.isCheckmate()) {
          setGameStatus('checkmate')
          setShowResultModal(true)
        } else if (gameCopy.isStalemate()) {
          setGameStatus('stalemate')
          setShowResultModal(true)
        } else if (gameCopy.isDraw()) {
          setGameStatus('draw')
          setShowResultModal(true)
        }

        // The useEffect will automatically trigger engine move when isEngineTurn becomes true
        return true
      }
      return false
    } catch (error) {
      console.error('Move error:', error)
      return false
    }
  }

  // Reset game
  const resetGame = () => {
    const newGame = new Chess()
    setGame(newGame)
    setGamePosition(newGame.fen())
    setGameStatus('playing')
    setMoveHistory([])
    setError(null)
    setShowResultModal(false)
    setAnalyzedGameId(null)
    setCoachingComments(new Map())
    setIsLoadingComments(false)
    setAnalyzingMoveIndex(null)
    analyzingMoveRef.current = null
    moveFenHistoryRef.current = new Map()
    setSelectedCommentIndex(null)
    setShowInitialGreeting(true)
  }

  // Determine if player won
  const playerWon = useMemo(() => {
    if (gameStatus !== 'checkmate') return false
    // If it's checkmate, the player won if the current turn is the engine's color
    const currentTurn = game.turn() // 'w' or 'b'
    const engineColor = playerColor === 'white' ? 'b' : 'w'
    // If it's the engine's turn now, that means the engine is in checkmate, so player won
    return currentTurn === engineColor
  }, [gameStatus, game, playerColor])

  // Helper to parse UCI move (matches GameAnalysisPage implementation)
  const parseUciMove = (uci: string) => {
    // Validate UCI format
    if (!uci || typeof uci !== 'string' || uci.length < 4) {
      throw new Error(`Invalid UCI format: ${uci}`)
    }

    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci.slice(4) : undefined

    // Validate square format (should be like 'e2', 'a1', etc.)
    const squareRegex = /^[a-h][1-8]$/
    if (!squareRegex.test(from) || !squareRegex.test(to)) {
      throw new Error(`Invalid square format in UCI: ${uci}`)
    }

    return { from, to, promotion }
  }

  // Analyze a move on-demand for coaching feedback
  const analyzeMoveForCoaching = useCallback(async (fenBefore: string, move: any, moveNumber: number, halfMoveIndex: number) => {
    if (!user?.id) return

    // Check if we're already analyzing this exact move
    if (analyzingMoveRef.current?.moveNumber === moveNumber &&
        analyzingMoveRef.current?.san === move.san) {
      return // Already analyzing this move
    }

    // Mark that we're analyzing this specific move index
    analyzingMoveRef.current = { moveNumber, san: move.san }
    setAnalyzingMoveIndex(halfMoveIndex)

    try {
      // Convert move to UCI format
      const moveUci = `${move.from}${move.to}${move.promotion || ''}`

      // Call the backend to analyze this single move
      const baseUrl = config.getApi().baseUrl
      const response = await fetch(`${baseUrl}/api/v1/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          platform: 'lichess',
          analysis_type: 'deep',
          fen: fenBefore,
          move: moveUci,
          depth: 8, // Faster analysis for real-time feedback
          fullmove_number: moveNumber, // Required for AI coaching comments
          is_user_move: true, // This is always a user move in coaching context
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Extract move analysis using unified response parser
        const moveAnalysis = extractMoveAnalysis(data)

        if (moveAnalysis) {
          if (moveAnalysis.coaching_comment && !isRawEngineOutput(moveAnalysis.coaching_comment)) {

            // Create ProcessedMove-like object for display
            const processedMove: ProcessedMove = {
              index: moveNumber * 2 - 2,
              ply: moveNumber * 2 - 1,
              moveNumber,
              player: playerColor,
              isUserMove: true,
              san: move.san,
              bestMoveSan: moveAnalysis.best_move_san || null,
              evaluation: moveAnalysis.evaluation || null,
              scoreForPlayer: moveAnalysis.evaluation?.value || 0,
              displayEvaluation: '',
              centipawnLoss: moveAnalysis.centipawn_loss || null,
              classification: moveAnalysis.is_brilliant ? 'brilliant' :
                             moveAnalysis.is_best ? 'best' :
                             moveAnalysis.is_great ? 'great' :
                             moveAnalysis.is_excellent ? 'excellent' :
                             moveAnalysis.is_good ? 'good' :
                             moveAnalysis.is_acceptable ? 'acceptable' :
                             moveAnalysis.is_inaccuracy ? 'inaccuracy' :
                             moveAnalysis.is_mistake ? 'mistake' :
                             moveAnalysis.is_blunder ? 'blunder' : 'acceptable',
              explanation: moveAnalysis.explanation || '',
              fenBefore: fenBefore,
              fenAfter: '', // Will be set after analysis
              coachingComment: moveAnalysis.coaching_comment,
              whatWentRight: moveAnalysis.what_went_right,
              whatWentWrong: moveAnalysis.what_went_wrong,
              howToImprove: moveAnalysis.how_to_improve,
              tacticalInsights: moveAnalysis.tactical_insights,
              positionalInsights: moveAnalysis.positional_insights,
              risks: moveAnalysis.risks,
              benefits: moveAnalysis.benefits,
              learningPoints: moveAnalysis.learning_points,
              encouragementLevel: moveAnalysis.encouragement_level,
              moveQuality: moveAnalysis.move_quality,
              gamePhase: moveAnalysis.game_phase,
            }

            const moveComment: MoveWithComment = {
              moveNumber,
              san: move.san,
              isUserMove: true,
              coachingComment: moveAnalysis.coaching_comment,
              processedMove,
            }

            // Save to comments map keyed by half-move index
            setCoachingComments(prev => {
              const newMap = new Map(prev)
              newMap.set(halfMoveIndex, moveComment)
              return newMap
            })
            // Auto-select this comment for display
            setSelectedCommentIndex(halfMoveIndex)
          }
        }
      } else {
        console.error('[TAL_COACH] ❌ API response not OK:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('[TAL_COACH] ❌ Error analyzing move for coaching:', err)
      // Don't show error to user - just silently fail
    } finally {
      // Only clear analyzing state if this is still the current move being analyzed
      if (analyzingMoveRef.current?.moveNumber === moveNumber &&
          analyzingMoveRef.current?.san === move.san) {
        setAnalyzingMoveIndex(null)
        analyzingMoveRef.current = null
      }
    }
  }, [user?.id, playerColor])

  // Fetch coaching comments for analyzed game
  const fetchCoachingComments = useCallback(async (gameId: string) => {
    if (!user?.id) return

    setIsLoadingComments(true)
    try {
      // Poll for analysis to be ready with AI comments
      let attempts = 0
      const maxAttempts = 20 // Wait up to 100 seconds (5s intervals)
      let analysisData = null

      while (attempts < maxAttempts) {
        try {
          const result = await fetchGameAnalysisData(user.id, 'lichess', gameId)

          if (result.analysis?.moves_analysis) {
            const movesWithComments = result.analysis.moves_analysis.filter(
              (move: any) => move.coaching_comment && move.coaching_comment.trim() &&
                !isRawEngineOutput(move.coaching_comment)
            )

            // If we have comments, process them
            if (movesWithComments.length > 0 || attempts >= 5) {
              analysisData = result
              break
            }
          }

          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, 5000))
          attempts++
        } catch (err) {
          console.error('Error fetching analysis:', err)
          attempts++
          if (attempts >= maxAttempts) break
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }

      if (analysisData?.analysis?.moves_analysis) {
        // Process moves and create a map keyed by half-move index
        const commentsMap = new Map<number, MoveWithComment>()
        const moves = analysisData.analysis.moves_analysis

        // Reconstruct move history with coaching data
        const chess = new Chess()
        moves.forEach((move: any, idx: number) => {
          try {
            const moveNumber = Math.floor(idx / 2) + 1
            const isUserMove = move.is_user_move ?? (idx % 2 === (playerColor === 'white' ? 0 : 1))

            let moveResult = null
            let san = move.move_san || ''

            // Try to apply move using UCI first
            try {
              const { from, to, promotion } = parseUciMove(move.move)
              moveResult = chess.move({ from, to, promotion })
              if (moveResult) {
                san = moveResult.san
              }
            } catch (uciErr) {
              // If UCI parsing fails, try using SAN directly
              if (move.move_san) {
                try {
                  moveResult = chess.move(move.move_san)
                  san = move.move_san
                } catch (sanErr) {
                  console.warn(`Failed to apply move ${move.move} (SAN: ${move.move_san}):`, sanErr)
                }
              }
            }

            if (moveResult && san) {
              // Create ProcessedMove-like object for EnhancedMoveCoaching
              const processedMove: ProcessedMove = {
                index: idx,
                ply: idx + 1,
                moveNumber,
                player: idx % 2 === 0 ? 'white' : 'black',
                isUserMove,
                san: san,
                bestMoveSan: move.best_move_san || null,
                evaluation: move.evaluation || null,
                scoreForPlayer: move.evaluation?.value || 0,
                displayEvaluation: '',
                centipawnLoss: move.centipawn_loss || null,
                classification: move.is_brilliant ? 'brilliant' :
                               move.is_best ? 'best' :
                               move.is_great ? 'great' :
                               move.is_excellent ? 'excellent' :
                               move.is_good ? 'good' :
                               move.is_acceptable ? 'acceptable' :
                               move.is_inaccuracy ? 'inaccuracy' :
                               move.is_mistake ? 'mistake' :
                               move.is_blunder ? 'blunder' : 'acceptable',
                explanation: move.explanation || '',
                fenBefore: move.fen_before || '',
                fenAfter: chess.fen(),
                coachingComment: move.coaching_comment,
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
              }

              // Store by half-move index for consistent lookup
              if (isUserMove && move.coaching_comment) {
                commentsMap.set(idx, {
                  moveNumber,
                  san: san,
                  isUserMove: true,
                  coachingComment: move.coaching_comment,
                  processedMove,
                })
              }
            }
          } catch (err) {
            console.warn('Error processing move for coaching:', err)
          }
        })

        console.log(`[COACHING] Loaded ${commentsMap.size} coaching comments for game ${gameId}`)
        setCoachingComments(commentsMap)
      }
    } catch (err) {
      console.error('Error fetching coaching comments:', err)
    } finally {
      setIsLoadingComments(false)
    }
  }, [user?.id, playerColor])

  // Convert game to PGN and analyze it
  const reviewGame = useCallback(async () => {
    if (!user?.id) {
      setError('Please log in to review games')
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setShowResultModal(false)

    try {
      // Rebuild the game from move history to ensure we have all moves
      // This is necessary because the game state might have been reset
      const fullGame = new Chess()

      console.log('[REVIEW] Move history state:', moveHistory)
      console.log('[REVIEW] Rebuilding game from', moveHistory.length, 'moves')

      // Apply all moves from history to reconstruct the complete game
      let reconstructionFailed = false
      for (let i = 0; i < moveHistory.length; i++) {
        try {
          const result = fullGame.move(moveHistory[i])
          if (!result) {
            console.error(`[REVIEW] Move returned null at index ${i}: ${moveHistory[i]}`)
            reconstructionFailed = true
            break
          }
        } catch (err) {
          console.error(`[REVIEW] Failed to apply move ${i}: ${moveHistory[i]}`, err)
          reconstructionFailed = true
          break
        }
      }

      if (reconstructionFailed) {
        setError(`Game reconstruction failed. ${fullGame.history().length} of ${moveHistory.length} moves could be replayed.`)
        setIsAnalyzing(false)
        return
      }

      // Get PGN from the reconstructed game - it will include all moves
      const pgn = fullGame.pgn({
        max_width: 80,
        newline: '\n'
      })

      console.log('[REVIEW] Reconstructed game history:', fullGame.history())
      console.log('[REVIEW] Generated PGN:', pgn)
      console.log('[REVIEW] Full game has', fullGame.history().length, 'moves')

      // Add game headers
      const playerName = user.email?.split('@')[0] || 'Player'
      const engineName = 'Tal Coach'
      const whitePlayer = playerColor === 'white' ? playerName : engineName
      const blackPlayer = playerColor === 'black' ? playerName : engineName

      // Determine result
      let result = '*'
      if (gameStatus === 'checkmate') {
        result = playerWon ? (playerColor === 'white' ? '1-0' : '0-1') : (playerColor === 'white' ? '0-1' : '1-0')
      } else if (gameStatus === 'stalemate' || gameStatus === 'draw') {
        result = '1/2-1/2'
      }

      const fullPgn = `[Event "Casual Game"]
[Site "Chess Analytics"]
[Date "${new Date().toISOString().split('T')[0]}"]
[Round "-"]
[White "${whitePlayer}"]
[Black "${blackPlayer}"]
[Result "${result}"]
[TimeControl "-"]

${pgn} ${result}`

      // Generate a unique game ID for this coach game
      const gameId = `coach-${Date.now()}-${Math.random().toString(36).substring(7)}`

      // Parse PGN to extract game info
      const pgnLines = fullPgn.split('\n')
      const headers: Record<string, string> = {}
      pgnLines.forEach(line => {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/)
        if (match) {
          headers[match[1]] = match[2]
        }
      })

      // Determine user's color and result
      const userIsWhite = headers.White === playerName
      const color = userIsWhite ? 'white' : 'black'
      let userResult: 'win' | 'loss' | 'draw' = 'draw'
      if (result === '1-0') {
        userResult = userIsWhite ? 'win' : 'loss'
      } else if (result === '0-1') {
        userResult = userIsWhite ? 'loss' : 'win'
      }

      // Count moves from PGN
      const moveText = fullPgn.split('\n\n')[1] || ''
      const moveCount = moveText.trim().split(/\s+/).filter(m => m && !m.match(/^\d+\./)).length

      // Validate and parse date from headers
      const parseDate = (dateStr: string | undefined): string => {
        if (!dateStr || dateStr.includes('?') || dateStr.trim() === '') {
          // Coach games always have valid dates, so this shouldn't happen
          console.warn(`[REVIEW] Invalid date string: "${dateStr}", using current time`)
          return new Date().toISOString()
        }

        try {
          if (dateStr.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
            const [year, month, day] = dateStr.split('.')
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            if (!isNaN(date.getTime())) return date.toISOString()
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const date = new Date(dateStr + 'T00:00:00Z')
            if (!isNaN(date.getTime())) return date.toISOString()
          } else {
            const date = new Date(dateStr)
            if (!isNaN(date.getTime())) return date.toISOString()
          }
        } catch {
          // Fall through to warning
        }

        console.warn(`[REVIEW] Could not parse date: "${dateStr}", using current time`)
        return new Date().toISOString()
      }

      const playedAt = parseDate(headers.Date)

      // Create game record in database first (required for analysis to save)
      const { error: gameError } = await supabase
        .from('games')
        .upsert({
          user_id: user.id,
          platform: 'lichess',
          provider_game_id: gameId,
          result: userResult,
          color: color,
          time_control: '-',
          opening: 'Casual Game',
          opening_family: 'Casual Game',
          opening_normalized: 'Casual Game',
          opponent_rating: null,
          my_rating: null,
          total_moves: moveCount,
          played_at: playedAt,
          opponent_name: userIsWhite ? headers.Black : headers.White,
        }, {
          onConflict: 'user_id,platform,provider_game_id'
        })

      if (gameError) {
        console.error('Failed to create game record:', gameError)
        throw new Error(`Failed to create game record: ${gameError.message}`)
      }

      // Save PGN to database (only if game creation succeeded)
      const { error: pgnError } = await supabase
        .from('games_pgn')
        .upsert({
          user_id: user.id,
          platform: 'lichess',
          provider_game_id: gameId,
          pgn: fullPgn,
        }, {
          onConflict: 'user_id,platform,provider_game_id'
        })

      if (pgnError) {
        console.error('Failed to save PGN:', pgnError)
        throw new Error(`Failed to save PGN: ${pgnError.message}`)
      }

      // Analyze the game with a specific game_id so it can be saved
      const analysisResponse = await UnifiedAnalysisService.analyze({
        user_id: user.id,
        platform: 'lichess',
        analysis_type: 'deep', // Use deep analysis to get coaching comments
        pgn: fullPgn,
        depth: 10,
        game_id: gameId,
        provider_game_id: gameId,
      })

      // Store the game ID for fetching comments
      setAnalyzedGameId(gameId)

      // Check if analysis was successful
      if (analysisResponse.analysis_id || analysisResponse.success !== false) {
        // Navigate to analysis page to see full game review
        const analysisId = analysisResponse.analysis_id || gameId
        console.log(`[REVIEW] Navigating to analysis page: /analysis/lichess/${user.id}/${analysisId}`)
        navigate(`/analysis/lichess/${user.id}/${analysisId}`)
      } else {
        // If analysis failed, show error
        throw new Error(analysisResponse.message || 'Failed to analyze game')
      }
    } catch (err) {
      console.error('Error reviewing game:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze game')
      setShowResultModal(true) // Reopen modal to show error
    } finally {
      setIsAnalyzing(false)
    }
  }, [game, moveHistory, playerColor, gameStatus, playerWon, user, navigate, fetchCoachingComments])

  // Change player color
  const changeColor = () => {
    const newColor = playerColor === 'white' ? 'black' : 'white'
    setPlayerColor(newColor)
    const newGame = new Chess()
    setGame(newGame)
    setGamePosition(newGame.fen())
    setGameStatus('playing')
    setMoveHistory([])
    setError(null)
    setShowInitialGreeting(true)
    setAnalyzingMoveIndex(null)
    analyzingMoveRef.current = null
    moveFenHistoryRef.current = new Map()
    setSelectedCommentIndex(null)
    setCoachingComments(new Map())
  }

  // Request coach feedback for a specific half-move index
  const requestCoachFeedback = useCallback((halfMoveIndex: number) => {
    if (analyzingMoveIndex !== null) return // Already analyzing
    const fenBefore = moveFenHistoryRef.current.get(halfMoveIndex)
    if (!fenBefore) return
    const san = moveHistory[halfMoveIndex]
    if (!san) return
    const moveNumber = Math.floor(halfMoveIndex / 2) + 1
    // Reconstruct the move object from FEN + SAN so analyzeMoveForCoaching can build UCI
    const tempGame = new Chess(fenBefore)
    const moveObj = tempGame.move(san)
    if (!moveObj) return
    setSelectedCommentIndex(halfMoveIndex)
    analyzeMoveForCoaching(fenBefore, moveObj, moveNumber, halfMoveIndex)
  }, [analyzingMoveIndex, moveHistory, analyzeMoveForCoaching])

  // Find the most recent user move index that has no comment yet (for the prominent button)
  const lastUncommentedUserMoveIndex = useMemo(() => {
    for (let i = moveHistory.length - 1; i >= 0; i--) {
      const isUserMove = i % 2 === (playerColor === 'white' ? 0 : 1)
      if (isUserMove && !coachingComments.has(i)) return i
    }
    return null
  }, [moveHistory.length, playerColor, coachingComments])

  // Get status message
  const getStatusMessage = () => {
    if (gameStatus === 'checkmate') {
      const winner = game.turn() === 'w' ? 'Black' : 'White'
      return `${winner} wins by checkmate!`
    }
    if (gameStatus === 'stalemate') {
      return 'Draw by stalemate'
    }
    if (gameStatus === 'draw') {
      return 'Draw'
    }
    if (isEngineThinking) {
      return 'Tal Coach is thinking...'
    }
    if (isEngineTurn) {
      return "Waiting for Tal Coach's move..."
    }
    return 'Your turn'
  }

  const boardWidth = Math.min(window.innerWidth - 64, 600)

  return (
    <PremiumGate>
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/coach')}
              className="mb-4 text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-2"
            >
              ← Back to Coach Dashboard
            </button>
            <h1 className="text-4xl font-bold text-white mb-2">Play with Tal Coach</h1>
            <p className="text-slate-400">Practice against an AI coach that adapts to your skill level</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chess Board */}
            <div className="lg:col-span-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                {/* Status Bar */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-white font-semibold">{getStatusMessage()}</div>
                  {error && (
                    <div className="text-red-400 text-sm">{error}</div>
                  )}
                </div>

                {/* Board */}
                <div className="flex justify-center">
                  <div style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}>
                    <Chessboard
                      id="play-with-coach-board"
                      position={gamePosition}
                      onPieceDrop={onDrop}
                      arePiecesDraggable={!isEngineTurn && gameStatus === 'playing'}
                      boardOrientation={playerColor}
                      boardWidth={boardWidth}
                      showBoardNotation={true}
                      {...getDarkChessBoardTheme('default')}
                    />
                  </div>
                </div>

                {/* Controls */}
                <div className="mt-6 flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={resetGame}
                    className="px-4 py-2 rounded-lg border border-slate-400/30 bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 transition-colors"
                  >
                    New Game
                  </button>
                  <button
                    onClick={changeColor}
                    className="px-4 py-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  >
                    Play as {playerColor === 'white' ? 'Black' : 'White'}
                  </button>
                  {gameStatus !== 'playing' && (
                    <button
                      onClick={() => navigate('/coach')}
                      className="px-4 py-2 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 transition-colors"
                    >
                      Back to Dashboard
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Initial Tal Coach Greeting */}
              {showInitialGreeting && moveHistory.length === 0 && (
                <div className="rounded-3xl border border-sky-400/30 bg-gradient-to-br from-sky-900/20 to-blue-900/20 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0">
                      <TalCoachIcon size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-sky-300">Coach Tal</h2>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400">
                      <p className="text-slate-200 leading-relaxed text-base">
                        Welcome to the board! The pieces are ready, and so are you. I'm Tal Coach, and I'm here to challenge you and help you grow. Every move is a learning opportunity, and I'll be with you every step of the way. Let's see what magic you create today!
                      </p>
                    </div>
                    <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
                      <h4 className="text-emerald-300 font-semibold mb-2 flex items-center gap-2">
                        <span className="text-lg">⚔️</span>
                        Ready to Play?
                      </h4>
                      <p className="text-emerald-100 text-sm leading-relaxed">
                        Make your first move! After any move, click "Ask Coach Tal" to get my analysis and feedback. Whether it's brilliant or needs improvement, we'll learn together!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tal Coach Live Commentary */}
              {!showInitialGreeting && currentMoveComment?.processedMove && (
                <div className="rounded-3xl border border-sky-400/30 bg-gradient-to-br from-sky-900/20 to-blue-900/20 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0">
                      <TalCoachIcon size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-sky-300">Coach Tal</h2>
                  </div>
                  <EnhancedMoveCoaching
                    move={currentMoveComment.processedMove}
                    className="text-sm"
                  />
                </div>
              )}
              {/* Show "thinking" when analyzing a requested move */}
              {!showInitialGreeting && analyzingMoveIndex !== null && (
                <div className="rounded-3xl border border-sky-400/30 bg-gradient-to-br from-sky-900/20 to-blue-900/20 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 animate-pulse">
                      <TalCoachIcon size={40} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-sky-300">Tal Coach is thinking...</h2>
                      <p className="text-sm text-slate-400 mt-1">Analyzing your move...</p>
                    </div>
                  </div>
                </div>
              )}
              {/* Ask Coach button — shown when there's a user move without a comment */}
              {!showInitialGreeting && analyzingMoveIndex === null && lastUncommentedUserMoveIndex !== null && (
                <button
                  onClick={() => requestCoachFeedback(lastUncommentedUserMoveIndex)}
                  className="w-full rounded-3xl border border-sky-400/30 bg-gradient-to-br from-sky-900/20 to-blue-900/20 p-5 hover:from-sky-900/30 hover:to-blue-900/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <TalCoachIcon size={40} />
                    </div>
                    <div className="text-left">
                      <h2 className="text-lg font-bold text-sky-300 group-hover:text-sky-200 transition-colors">Ask Coach Tal</h2>
                      <p className="text-sm text-slate-400">Get feedback on your last move</p>
                    </div>
                  </div>
                </button>
              )}

              {/* Game Info */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-xl font-bold text-white mb-4">Game Info</h2>
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Status</div>
                    <div className="text-white font-semibold capitalize">{gameStatus}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">You are playing as</div>
                    <div className="text-white font-semibold capitalize">{playerColor}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-1">Skill Level</div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={skillLevel}
                      onChange={(e) => setSkillLevel(Number(e.target.value))}
                      className="w-full"
                      disabled={gameStatus !== 'playing' || moveHistory.length > 0}
                    />
                    <div className="text-white text-sm mt-1">{skillLevel}/20</div>
                  </div>
                </div>

                {/* Action Buttons */}
                {moveHistory.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                    <button
                      onClick={reviewGame}
                      disabled={isAnalyzing}
                      className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                    >
                      {isAnalyzing ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin">⏳</span>
                          Analyzing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <span>📊</span>
                          Review Game
                        </span>
                      )}
                    </button>
                    {gameStatus !== 'playing' && (
                      <button
                        onClick={resetGame}
                        className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold transition-all"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span>🔄</span>
                          New Game
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Move History with Coaching Comments */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-xl font-bold text-white mb-4">Move History</h2>
                {moveHistory.length === 0 ? (
                  <p className="text-slate-400 text-sm">No moves yet</p>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {moveHistory.map((move, index) => {
                      const moveNumber = Math.floor(index / 2) + 1
                      const isUserMove = index % 2 === (playerColor === 'white' ? 0 : 1)
                      const hasComment = isUserMove && coachingComments.has(index)
                      const isAnalyzingThis = analyzingMoveIndex === index
                      const hasFen = moveFenHistoryRef.current.has(index)
                      const isSelected = selectedCommentIndex === index

                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-mono min-w-[60px] ${isSelected ? 'text-sky-300' : 'text-slate-300'}`}>
                              {moveNumber}.{index % 2 === 0 ? '' : '..'} {move}
                            </span>
                            {isUserMove && (
                              <span className="text-xs text-slate-500">(You)</span>
                            )}
                            {isUserMove && hasComment && (
                              <button
                                onClick={() => setSelectedCommentIndex(index)}
                                className={`text-xs px-1.5 py-0.5 rounded transition-colors ${isSelected ? 'text-sky-300 bg-sky-500/20' : 'text-sky-400/60 hover:text-sky-300 hover:bg-sky-500/10'}`}
                                title="View coach feedback"
                              >
                                Tal
                              </button>
                            )}
                            {isUserMove && !hasComment && hasFen && !isAnalyzingThis && (
                              <button
                                onClick={() => requestCoachFeedback(index)}
                                disabled={analyzingMoveIndex !== null}
                                className="text-xs px-1.5 py-0.5 rounded text-slate-500 hover:text-sky-300 hover:bg-sky-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Ask Coach Tal about this move"
                              >
                                Ask
                              </button>
                            )}
                            {isAnalyzingThis && (
                              <span className="text-xs text-sky-400 animate-pulse">...</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Game Result Modal */}
        {(gameStatus === 'checkmate' || gameStatus === 'stalemate' || gameStatus === 'draw') && (
          <GameResultModal
            isOpen={showResultModal}
            onClose={() => setShowResultModal(false)}
            playerWon={playerWon}
            resultType={gameStatus}
            playerColor={playerColor}
            onNewGame={resetGame}
            onReviewGame={reviewGame}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* Loading Modal for Analysis */}
        {isAnalyzing && (
          <LoadingModal isOpen={true} message="Analyzing game..." subtitle="This may take a moment" />
        )}
      </div>
    </PremiumGate>
  )
}
