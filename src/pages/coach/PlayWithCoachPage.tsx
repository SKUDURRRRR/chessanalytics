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

type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resignation'

interface MoveWithComment {
  moveNumber: number
  san: string
  isUserMove: boolean
  coachingComment?: string
  processedMove?: ProcessedMove
}

// Change Map type from number to string (SAN-based)
type CoachingCommentsMap = Map<string, MoveWithComment>

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
  const [currentMoveComment, setCurrentMoveComment] = useState<MoveWithComment | null>(null)
  const [isAnalyzingMove, setIsAnalyzingMove] = useState(false)
  const analyzingMoveRef = useRef<{ moveNumber: number; san: string } | null>(null)
  const [showInitialGreeting, setShowInitialGreeting] = useState(true)
  const lastCommentRef = useRef<MoveWithComment | null>(null) // Persist comment through re-renders

  // Sync ref with state to persist comments through re-renders
  useEffect(() => {
    if (currentMoveComment) {
      lastCommentRef.current = currentMoveComment
    }
  }, [currentMoveComment])

  // Restore comment from move history if it disappears (e.g., after engine move)
  useEffect(() => {
    // Only restore if we don't have a current comment but have moves
    if (!currentMoveComment && moveHistory.length > 0 && !showInitialGreeting && !isAnalyzingMove) {
      // Find the last user move and restore its comment
      for (let i = moveHistory.length - 1; i >= 0; i--) {
        const isUserMove = i % 2 === (playerColor === 'white' ? 0 : 1)
        if (isUserMove) {
          const moveNumber = Math.floor(i / 2) + 1
          const savedComment = coachingComments.get(moveNumber.toString()) ||
                              coachingComments.get(moveNumber)
          if (savedComment) {
            console.log('[TAL_COACH] 🔄 Auto-restoring comment from move history for move', moveNumber, {
              hasProcessedMove: !!savedComment.processedMove,
              commentPreview: savedComment.coachingComment?.substring(0, 50)
            })
            setCurrentMoveComment(savedComment)
            lastCommentRef.current = savedComment
            break
          }
        }
      }
    }
  }, [moveHistory.length, currentMoveComment, coachingComments, playerColor, showInitialGreeting, isAnalyzingMove])

  // Also restore when game state changes (e.g., after engine move)
  useEffect(() => {
    if (!currentMoveComment && !lastCommentRef.current && moveHistory.length > 0 && !showInitialGreeting) {
      // Small delay to ensure state has settled after engine move
      const timer = setTimeout(() => {
        for (let i = moveHistory.length - 1; i >= 0; i--) {
          const isUserMove = i % 2 === (playerColor === 'white' ? 0 : 1)
          if (isUserMove) {
            const moveNumber = Math.floor(i / 2) + 1
            const savedComment = coachingComments.get(moveNumber.toString()) ||
                                coachingComments.get(moveNumber)
            if (savedComment && savedComment.processedMove) {
              console.log('[TAL_COACH] 🔄 Delayed restore after state change for move', moveNumber)
              setCurrentMoveComment(savedComment)
              lastCommentRef.current = savedComment
              break
            }
          }
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [gamePosition, currentMoveComment, coachingComments, moveHistory.length, playerColor, showInitialGreeting])

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
        // Preserve current comment in ref before state updates
        const commentToPreserve = currentMoveComment || lastCommentRef.current
        if (commentToPreserve) {
          lastCommentRef.current = commentToPreserve
          console.log('[TAL_COACH] 💾 Preserving comment before engine move:', commentToPreserve.moveNumber)
        }

        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, result.move.san])

        // Restore comment after state update using ref (ensures we have the latest)
        setTimeout(() => {
          const preservedComment = lastCommentRef.current
          // Use functional update to get current state
          setCurrentMoveComment(prev => {
            if (!prev && preservedComment) {
              console.log('[TAL_COACH] 🔄 Restored preserved comment after engine move')
              return preservedComment
            }
            return prev
          })
        }, 50) // Small delay to let state settle

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
        const moveNumber = Math.floor(moveHistory.length / 2) + 1

        // Update game state first
        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, move.san])

        // Hide initial greeting once player makes first move
        if (showInitialGreeting) {
          setShowInitialGreeting(false)
        }

        // Analyze the move in real-time for coaching feedback
        // Don't clear current comment - let it show until new analysis completes
        analyzeMoveForCoaching(fenBefore, move, moveNumber)

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
    setCurrentMoveComment(null)
    lastCommentRef.current = null
    setIsAnalyzingMove(false)
    analyzingMoveRef.current = null
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

  // Normalize SAN string for matching (remove check/mate symbols, etc.)
  const normalizeSan = (san: string): string => {
    if (!san) return ''
    // Remove check (+), checkmate (#), and other annotations
    return san.replace(/[+#!?]/g, '').trim()
  }

  // Analyze a move in real-time for coaching feedback
  const analyzeMoveForCoaching = useCallback(async (fenBefore: string, move: any, moveNumber: number) => {
    if (!user?.id) return

    // Check if we're already analyzing this exact move
    if (analyzingMoveRef.current?.moveNumber === moveNumber &&
        analyzingMoveRef.current?.san === move.san) {
      return // Already analyzing this move
    }

    // Mark that we're analyzing this move
    analyzingMoveRef.current = { moveNumber, san: move.san }
    setIsAnalyzingMove(true)
    // IMPORTANT: Don't clear current comment - let it show until new one is ready
    // This ensures comments persist through engine moves

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
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('[TAL_COACH] Analysis response:', {
          hasData: !!data.data,
          hasMovesAnalysis: !!data.data?.moves_analysis,
          hasMoveField: !!data.data?.move,
          hasMoveSan: !!data.data?.move_san,
          responseKeys: Object.keys(data),
          dataKeys: data.data ? Object.keys(data.data) : []
        })

        // Extract move analysis from response
        // Single move analysis returns MoveAnalysis object directly in data.data
        // Game analysis returns GameAnalysis with moves_analysis array
        let moveAnalysis = null

        if (data.data) {
          // Check if this is a single move analysis (has 'move' or 'move_san' field directly)
          if (data.data.move || data.data.move_san) {
            // Single move analysis - data.data IS the MoveAnalysis object
            moveAnalysis = data.data
            console.log('[TAL_COACH] ✅ Detected single move analysis format')
          }
          // Check if this is a game analysis with moves_analysis array
          else if (data.data.moves_analysis && Array.isArray(data.data.moves_analysis) && data.data.moves_analysis.length > 0) {
            // Game analysis format - extract first move from array
            moveAnalysis = data.data.moves_analysis[0]
            console.log('[TAL_COACH] ✅ Detected game analysis format with moves_analysis array')
          }
          // Fallback: check if moves_analysis is at root level
          else if (data.moves_analysis && Array.isArray(data.moves_analysis) && data.moves_analysis.length > 0) {
            moveAnalysis = data.moves_analysis[0]
            console.log('[TAL_COACH] ✅ Detected moves_analysis at root level')
          }
        }

        if (moveAnalysis) {
          console.log('[TAL_COACH] Move analysis extracted:', {
            hasComment: !!moveAnalysis.coaching_comment,
            commentPreview: moveAnalysis.coaching_comment?.substring(0, 50),
            moveNumber,
            san: move.san,
            moveFromResponse: moveAnalysis.move_san || moveAnalysis.move
          })

          if (moveAnalysis.coaching_comment &&
              !moveAnalysis.coaching_comment.toLowerCase().includes('centipawn') &&
              !moveAnalysis.coaching_comment.toLowerCase().includes('cp')) {

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

            // Always save to comments map first (for persistence)
            setCoachingComments(prev => {
              const newMap = new Map(prev)
              newMap.set(moveNumber.toString(), moveComment) // Use string key for consistency
              newMap.set(moveNumber, moveComment) // Also keep number key for backward compatibility
              console.log('[TAL_COACH] 💾 Saved comment to map for move', moveNumber, 'Total comments:', newMap.size)
              return newMap
            })

            // Update current comment if this is still the move we're analyzing
            // BUT: Also update if we don't have a current comment (to restore lost comments)
            const shouldUpdate = (analyzingMoveRef.current?.moveNumber === moveNumber &&
                                 analyzingMoveRef.current?.san === move.san) ||
                                 !currentMoveComment // Always set if we don't have one

            if (shouldUpdate) {
              console.log('[TAL_COACH] ✅ Setting comment for move', moveNumber, move.san, {
                matchesRef: analyzingMoveRef.current?.moveNumber === moveNumber,
                noCurrentComment: !currentMoveComment
              })
              setCurrentMoveComment(moveComment)
              lastCommentRef.current = moveComment // Persist in ref
            } else {
              console.log('[TAL_COACH] ⚠️ Comment saved but not displayed - move changed', {
                expected: analyzingMoveRef.current,
                actual: { moveNumber, san: move.san },
                hasCurrentComment: !!currentMoveComment
              })
            }
          } else {
            console.log('[TAL_COACH] ⚠️ No valid coaching comment in response', {
              hasComment: !!moveAnalysis.coaching_comment,
              commentValue: moveAnalysis.coaching_comment?.substring(0, 100)
            })
          }
        } else {
          console.log('[TAL_COACH] ⚠️ Could not extract move analysis from response', {
            hasData: !!data.data,
            dataType: typeof data.data,
            dataKeys: data.data ? Object.keys(data.data) : []
          })
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
        setIsAnalyzingMove(false)
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
                !move.coaching_comment.toLowerCase().includes('centipawn') &&
                !move.coaching_comment.toLowerCase().includes('cp')
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
        // Process moves and create a map of SAN strings to coaching data
        // We use SAN as key because moveHistory stores SAN strings
        const commentsMap = new Map<string, MoveWithComment>()
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

              // Store by normalized SAN string for matching with moveHistory
              if (isUserMove && move.coaching_comment) {
                const normalizedSan = normalizeSan(san)
                commentsMap.set(normalizedSan, {
                  moveNumber,
                  san: san,
                  isUserMove: true,
                  coachingComment: move.coaching_comment,
                  processedMove,
                })
                console.log(`[COACHING] Stored comment for move: ${san} (normalized: ${normalizedSan})`)
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
      // Use the current game state which already has all moves
      // Get PGN from chess.js - it will include all moves from the game
      const pgn = game.pgn({
        max_width: 80,
        newline: '\n'
      })

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
        if (!dateStr) return new Date().toISOString()

        // Check for invalid date patterns
        if (dateStr.includes('?') || dateStr === '????.??.??' || dateStr.trim() === '') {
          return new Date().toISOString()
        }

        // Try to parse the date
        try {
          // Handle YYYY.MM.DD format
          if (dateStr.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
            const [year, month, day] = dateStr.split('.')
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            if (!isNaN(date.getTime())) {
              return date.toISOString()
            }
          }
          // Handle YYYY-MM-DD format
          else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const date = new Date(dateStr + 'T00:00:00Z')
            if (!isNaN(date.getTime())) {
              return date.toISOString()
            }
          }
          // Try parsing as ISO string
          else {
            const date = new Date(dateStr)
            if (!isNaN(date.getTime())) {
              return date.toISOString()
            }
          }
        } catch (e) {
          // If parsing fails, use current date
        }

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
        // Start fetching coaching comments
        fetchCoachingComments(gameId)

        // Optionally navigate to analysis page, or stay here to see comments
        // Uncomment the line below if you want to navigate immediately
        // navigate(`/analysis/lichess/${user.id}/${analysisResponse.analysis_id || gameId}`)
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
    setCurrentMoveComment(null)
    lastCommentRef.current = null
    setIsAnalyzingMove(false)
    analyzingMoveRef.current = null
    setCoachingComments(new Map())
  }

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
                        Make your first move and I'll analyze it in real-time, giving you instant feedback on your decisions. Whether it's brilliant or needs improvement, we'll learn together!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tal Coach Live Commentary */}
              {/* Show comment if we have one, regardless of whether we're analyzing a new move */}
              {/* Use ref as fallback to ensure comment persists through re-renders */}
              {!showInitialGreeting && (currentMoveComment || lastCommentRef.current) && (currentMoveComment?.processedMove || lastCommentRef.current?.processedMove) && (
                <div className="rounded-3xl border border-sky-400/30 bg-gradient-to-br from-sky-900/20 to-blue-900/20 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-shrink-0">
                      <TalCoachIcon size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-sky-300">Coach Tal</h2>
                  </div>
                  <EnhancedMoveCoaching
                    move={(currentMoveComment || lastCommentRef.current)!.processedMove!}
                    className="text-sm"
                  />
                </div>
              )}
              {/* Show "thinking" only if we're analyzing AND don't have a comment yet */}
              {!showInitialGreeting && isAnalyzingMove && !currentMoveComment && !lastCommentRef.current && (
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
              {/* Show "thinking" overlay if analyzing a new move while previous comment is still visible */}
              {!showInitialGreeting && isAnalyzingMove && (currentMoveComment || lastCommentRef.current) && (
                <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-900/20 to-orange-900/20 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl animate-pulse">⏳</span>
                    <div>
                      <p className="text-sm text-amber-300 font-medium">Analyzing your latest move...</p>
                    </div>
                  </div>
                </div>
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
                      // Try to get comment by move number (primary) or normalized SAN (fallback)
                      const normalizedMove = normalizeSan(move)
                      const moveComment = coachingComments.get(moveNumber.toString()) ||
                                          coachingComments.get(moveNumber) ||
                                          coachingComments.get(normalizedMove)
                      const hasComment = moveComment && moveComment.isUserMove && isUserMove

                      // Debug logging for first few moves
                      if (index < 4 && isUserMove) {
                        console.log(`[COACHING] Move ${index}: ${move} (normalized: ${normalizedMove}), hasComment: ${!!moveComment}`)
                      }

                      return (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300 text-sm font-mono min-w-[60px]">
                              {moveNumber}.{index % 2 === 0 ? '' : '..'} {move}
                            </span>
                            {isUserMove && (
                              <span className="text-xs text-slate-500">(You)</span>
                            )}
                          </div>
                          {hasComment && moveComment.processedMove && (
                            <div className="ml-0 mt-2">
                              <EnhancedMoveCoaching
                                move={moveComment.processedMove}
                                className="text-sm"
                              />
                            </div>
                          )}
                          {isLoadingComments && isUserMove && !hasComment && (
                            <div className="ml-0 mt-1 text-xs text-slate-500 italic">
                              Loading coaching comment...
                            </div>
                          )}
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
