/**
 * Play with Tal Coach Page
 * Interactive chess game against AI coach
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { Chess, type Square } from 'chess.js'
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
import { ProcessedMove } from '../GameAnalysisPage'
import { TalCoachIcon } from '../../components/ui/TalCoachIcon'
import { ChatPositionContext } from '../../types'
import { useCoachChat } from '../../contexts/CoachChatContext'
import { useChessSound } from '../../hooks/useChessSound'
import { useChessSoundSettings } from '../../contexts/ChessSoundContext'
import { getMoveSoundSimple } from '../../utils/chessSounds'
import { getMoveClassificationBgColor } from '../../utils/chessColors'

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
 */
function isRawEngineOutput(comment: string): boolean {
  const enginePatterns = [
    /\d+\s*centipawns?\b/i,
    /centipawn\s+loss/i,
    /[+-]?\d+\.?\d*\s*cp\b/i,
    /^cp\s+/i,
    /\bcp\s+(?:loss|gain|advantage)/i
  ]
  return enginePatterns.some(pattern => pattern.test(comment))
}

/**
 * Compact move cell for the two-column move history table.
 */
interface MoveCellProps {
  san: string
  halfMoveIndex: number
  isActive: boolean
  isUserMove: boolean
  hasComment: boolean
  isAnalyzing: boolean
  classification?: string
  onNavigate: () => void
  onRequestFeedback: () => void
  canRequestFeedback: boolean
}

function MoveCell({
  san, isActive, isUserMove, hasComment, isAnalyzing,
  classification, onNavigate, onRequestFeedback, canRequestFeedback
}: MoveCellProps) {
  return (
    <button
      onClick={onNavigate}
      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-all duration-150 gap-1 ${
        isActive
          ? 'bg-sky-500/25 text-white ring-1 ring-sky-400/40'
          : 'bg-white/5 text-slate-200 hover:bg-white/15 active:scale-95'
      }`}
    >
      <span className="text-xs font-medium truncate font-mono">{san}</span>
      <span className="flex items-center gap-1 flex-shrink-0">
        {hasComment && classification && (
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
            getMoveClassificationBgColor(classification)
          }`}>
            {classification.slice(0, 4)}
          </span>
        )}
        {isAnalyzing && (
          <span className="text-sky-400 text-[10px] animate-pulse">...</span>
        )}
        {isUserMove && canRequestFeedback && !isAnalyzing && (
          <button
            onClick={(e) => { e.stopPropagation(); onRequestFeedback() }}
            className="w-4 h-4 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center hover:bg-sky-500/40 transition-colors"
            title="Ask Coach Tal"
          >
            <span className="text-[8px] text-sky-300 font-bold">?</span>
          </button>
        )}
      </span>
    </button>
  )
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
  const [coachingComments, setCoachingComments] = useState<CoachingCommentsMap>(new Map())
  const [analyzingMoveIndex, setAnalyzingMoveIndex] = useState<number | null>(null)
  const analyzingMoveRef = useRef<{ moveNumber: number; san: string } | null>(null)
  const [showInitialGreeting, setShowInitialGreeting] = useState(true)
  // FEN before each move, keyed by half-move index — needed for on-demand analysis of past moves
  const moveFenHistoryRef = useRef<Map<number, string>>(new Map())
  // Move navigation: null = live position, number = viewing position after Nth half-move
  const [viewIndex, setViewIndex] = useState<number | null>(null)
  const moveListRef = useRef<HTMLDivElement>(null)

  // Coach chat context
  const { setPositionContext } = useCoachChat()

  // Chess sound support
  const { soundEnabled, volume } = useChessSoundSettings()
  const { playSound } = useChessSound({ enabled: soundEnabled, volume })

  // Position to display: historical when browsing, live otherwise
  const displayPosition = useMemo(() => {
    if (viewIndex === null) return gamePosition
    const tempGame = new Chess()
    for (let i = 0; i < viewIndex; i++) {
      if (i < moveHistory.length) {
        tempGame.move(moveHistory[i])
      }
    }
    return tempGame.fen()
  }, [viewIndex, gamePosition, moveHistory])

  const isViewingHistory = viewIndex !== null

  // Active half-move index for highlighting (0 = start, N = after Nth move)
  const activeHalfMoveIndex = useMemo(() => {
    if (viewIndex !== null) return viewIndex
    return moveHistory.length
  }, [viewIndex, moveHistory.length])

  // Check if it's engine's turn
  const isEngineTurn = useMemo(() => {
    const currentTurn = game.turn()
    const playerTurn = playerColor === 'white' ? 'w' : 'b'
    return currentTurn !== playerTurn
  }, [game, playerColor])

  // Navigate to a specific half-move position
  const navigateToMove = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(moveHistory.length, index))
    if (clamped === moveHistory.length) {
      setViewIndex(null)
    } else {
      setViewIndex(clamped)
    }
  }, [moveHistory.length])

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

      const gameCopy = new Chess(currentFen)
      const move = gameCopy.move({
        from: result.move.from,
        to: result.move.to,
        promotion: 'q',
      })

      if (move) {
        const soundType = getMoveSoundSimple(result.move.san)
        playSound(soundType)

        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, result.move.san])

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
      const timer = setTimeout(() => {
        makeEngineMove()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isEngineTurn, gameStatus, isEngineThinking, makeEngineMove])

  // Handle player move
  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (isEngineTurn || gameStatus !== 'playing' || isViewingHistory) return false

    try {
      const gameCopy = new Chess(game.fen())
      const piece = gameCopy.get(sourceSquare as Square)

      let actualTargetSquare = targetSquare
      if (piece?.type === 'k') {
        const sourceFile = sourceSquare[0]
        const targetFile = targetSquare[0]
        const rank = sourceSquare[1]

        if (sourceFile === 'e') {
          if (targetFile === 'h' && rank === '1') {
            actualTargetSquare = 'g1'
          } else if (targetFile === 'a' && rank === '1') {
            actualTargetSquare = 'c1'
          } else if (targetFile === 'h' && rank === '8') {
            actualTargetSquare = 'g8'
          } else if (targetFile === 'a' && rank === '8') {
            actualTargetSquare = 'c8'
          }
        }

        if (sourceFile === 'e' && (targetFile === 'g' || targetFile === 'c')) {
          actualTargetSquare = targetSquare
        }
      }

      const targetRank = actualTargetSquare[1]
      const isPromotion = piece?.type === 'p' &&
                        ((piece.color === 'w' && targetRank === '8') ||
                         (piece.color === 'b' && targetRank === '1'))

      const move = gameCopy.move({
        from: sourceSquare,
        to: actualTargetSquare,
        ...(isPromotion && { promotion: 'q' }),
      })

      if (move) {
        const fenBefore = game.fen()
        const halfMoveIndex = moveHistory.length

        const soundType = getMoveSoundSimple(move.san)
        playSound(soundType)

        // Return to live position
        setViewIndex(null)

        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, move.san])

        if (showInitialGreeting) {
          setShowInitialGreeting(false)
        }

        moveFenHistoryRef.current.set(halfMoveIndex, fenBefore)

        const moveNumber = Math.floor(halfMoveIndex / 2) + 1
        analyzeMoveForCoaching(fenBefore, move, moveNumber, halfMoveIndex)

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
    setCoachingComments(new Map())
    setAnalyzingMoveIndex(null)
    analyzingMoveRef.current = null
    moveFenHistoryRef.current = new Map()
    setShowInitialGreeting(true)
    setViewIndex(null)
  }

  // Determine if player won
  const playerWon = useMemo(() => {
    if (gameStatus !== 'checkmate') return false
    const currentTurn = game.turn()
    const engineColor = playerColor === 'white' ? 'b' : 'w'
    return currentTurn === engineColor
  }, [gameStatus, game, playerColor])

  // Helper to parse UCI move
  const parseUciMove = (uci: string) => {
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

  // Analyze a move on-demand for coaching feedback
  const analyzeMoveForCoaching = useCallback(async (fenBefore: string, move: any, moveNumber: number, halfMoveIndex: number) => {
    if (!user?.id) return

    if (analyzingMoveRef.current?.moveNumber === moveNumber &&
        analyzingMoveRef.current?.san === move.san) {
      return
    }

    analyzingMoveRef.current = { moveNumber, san: move.san }
    setAnalyzingMoveIndex(halfMoveIndex)

    try {
      const moveUci = `${move.from}${move.to}${move.promotion || ''}`

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
          depth: 8,
          fullmove_number: moveNumber,
          is_user_move: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        const moveAnalysis = extractMoveAnalysis(data)

        if (moveAnalysis) {
          if (moveAnalysis.coaching_comment && !isRawEngineOutput(moveAnalysis.coaching_comment)) {

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
              fenAfter: '',
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

            setCoachingComments(prev => {
              const newMap = new Map(prev)
              newMap.set(halfMoveIndex, moveComment)
              return newMap
            })
          }
        }
      } else {
        console.error('[TAL_COACH] API response not OK:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('[TAL_COACH] Error analyzing move for coaching:', err)
    } finally {
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

    try {
      let attempts = 0
      const maxAttempts = 20
      let analysisData = null

      while (attempts < maxAttempts) {
        try {
          const result = await fetchGameAnalysisData(user.id, 'lichess', gameId)

          if (result.analysis?.moves_analysis) {
            const movesWithComments = result.analysis.moves_analysis.filter(
              (move: any) => move.coaching_comment && move.coaching_comment.trim() &&
                !isRawEngineOutput(move.coaching_comment)
            )

            if (movesWithComments.length > 0 || attempts >= 5) {
              analysisData = result
              break
            }
          }

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
        const commentsMap = new Map<number, MoveWithComment>()
        const moves = analysisData.analysis.moves_analysis

        const chess = new Chess()
        moves.forEach((move: any, idx: number) => {
          try {
            const moveNumber = Math.floor(idx / 2) + 1
            const isUserMove = move.is_user_move ?? (idx % 2 === (playerColor === 'white' ? 0 : 1))

            let moveResult = null
            let san = move.move_san || ''

            try {
              const { from, to, promotion } = parseUciMove(move.move)
              moveResult = chess.move({ from, to, promotion })
              if (moveResult) {
                san = moveResult.san
              }
            } catch (uciErr) {
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
      const fullGame = new Chess()

      console.log('[REVIEW] Move history state:', moveHistory)
      console.log('[REVIEW] Rebuilding game from', moveHistory.length, 'moves')

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

      const pgn = fullGame.pgn({
        max_width: 80,
        newline: '\n'
      })

      console.log('[REVIEW] Reconstructed game history:', fullGame.history())
      console.log('[REVIEW] Generated PGN:', pgn)
      console.log('[REVIEW] Full game has', fullGame.history().length, 'moves')

      const playerName = user.email?.split('@')[0] || 'Player'
      const engineName = 'Tal Coach'
      const whitePlayer = playerColor === 'white' ? playerName : engineName
      const blackPlayer = playerColor === 'black' ? playerName : engineName

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

      const gameId = `coach-${Date.now()}-${Math.random().toString(36).substring(7)}`

      const pgnLines = fullPgn.split('\n')
      const headers: Record<string, string> = {}
      pgnLines.forEach(line => {
        const match = line.match(/\[(\w+)\s+"([^"]+)"\]/)
        if (match) {
          headers[match[1]] = match[2]
        }
      })

      const userIsWhite = headers.White === playerName
      const color = userIsWhite ? 'white' : 'black'
      let userResult: 'win' | 'loss' | 'draw' = 'draw'
      if (result === '1-0') {
        userResult = userIsWhite ? 'win' : 'loss'
      } else if (result === '0-1') {
        userResult = userIsWhite ? 'loss' : 'win'
      }

      const moveText = fullPgn.split('\n\n')[1] || ''
      const moveCount = moveText.trim().split(/\s+/).filter(m => m && !m.match(/^\d+\./)).length

      const parseDate = (dateStr: string | undefined): string => {
        if (!dateStr || dateStr.includes('?') || dateStr.trim() === '') {
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

      const analysisResponse = await UnifiedAnalysisService.analyze({
        user_id: user.id,
        platform: 'lichess',
        analysis_type: 'deep',
        pgn: fullPgn,
        depth: 10,
        game_id: gameId,
        provider_game_id: gameId,
      })

      if (analysisResponse.analysis_id || analysisResponse.success !== false) {
        const analysisId = analysisResponse.analysis_id || gameId
        console.log(`[REVIEW] Navigating to analysis page: /analysis/lichess/${user.id}/${analysisId}`)
        navigate(`/analysis/lichess/${user.id}/${analysisId}`)
      } else {
        throw new Error(analysisResponse.message || 'Failed to analyze game')
      }
    } catch (err) {
      console.error('Error reviewing game:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze game')
      setShowResultModal(true)
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
    setCoachingComments(new Map())
    setViewIndex(null)
  }

  // Request coach feedback for a specific half-move index
  const requestCoachFeedback = useCallback((halfMoveIndex: number) => {
    if (analyzingMoveIndex !== null) return
    const fenBefore = moveFenHistoryRef.current.get(halfMoveIndex)
    if (!fenBefore) return
    const san = moveHistory[halfMoveIndex]
    if (!san) return
    const moveNumber = Math.floor(halfMoveIndex / 2) + 1
    const tempGame = new Chess(fenBefore)
    const moveObj = tempGame.move(san)
    if (!moveObj) return
    analyzeMoveForCoaching(fenBefore, moveObj, moveNumber, halfMoveIndex)
  }, [analyzingMoveIndex, moveHistory, analyzeMoveForCoaching])

  // Publish position context to floating chat widget
  useEffect(() => {
    let lastUserMove: string | undefined
    let lastOpponentMove: string | undefined
    let moveClassification: string | undefined
    let evaluation: string | undefined
    for (let i = moveHistory.length - 1; i >= 0; i--) {
      const isUserMove = i % 2 === (playerColor === 'white' ? 0 : 1)
      if (isUserMove && !lastUserMove) {
        lastUserMove = moveHistory[i]
        if (coachingComments.has(i)) {
          const comment = coachingComments.get(i)
          moveClassification = comment?.processedMove?.classification
          evaluation = comment?.processedMove?.displayEvaluation
        }
      }
      if (!isUserMove && !lastOpponentMove) {
        lastOpponentMove = moveHistory[i]
      }
      if (lastUserMove && lastOpponentMove) break
    }

    const ctx: ChatPositionContext = {
      fen: gamePosition,
      moveHistory,
      playerColor,
      moveNumber: Math.floor(moveHistory.length / 2) + 1,
      lastMove: moveHistory[moveHistory.length - 1],
      lastUserMove,
      lastOpponentMove,
      gamePhase: moveHistory.length < 10 ? 'opening' : moveHistory.length > 40 ? 'endgame' : 'middlegame',
      contextType: 'play',
      moveClassification,
      evaluation,
    }
    setPositionContext(ctx)
    return () => setPositionContext(null)
  }, [gamePosition, moveHistory, playerColor, coachingComments, setPositionContext])

  // Keyboard navigation for move browsing
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      const currentPos = viewIndex ?? moveHistory.length

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          navigateToMove(currentPos - 1)
          break
        case 'ArrowRight':
          event.preventDefault()
          navigateToMove(currentPos + 1)
          break
        case 'Home':
          event.preventDefault()
          navigateToMove(0)
          break
        case 'End':
          event.preventDefault()
          navigateToMove(moveHistory.length)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewIndex, moveHistory.length, navigateToMove])

  // Auto-scroll move list to active move
  useEffect(() => {
    const container = moveListRef.current
    if (!container || moveHistory.length === 0) return

    const rowIndex = activeHalfMoveIndex > 0 ? Math.floor((activeHalfMoveIndex - 1) / 2) : 0
    const rows = container.querySelectorAll('tbody tr')
    const targetRow = rows[rowIndex] as HTMLElement

    if (targetRow) {
      const containerRect = container.getBoundingClientRect()
      const targetRect = targetRow.getBoundingClientRect()
      const relativeTop = targetRect.top - containerRect.top + container.scrollTop
      const scrollToPosition = relativeTop - container.clientHeight / 2 + targetRect.height / 2
      container.scrollTo({ top: Math.max(0, scrollToPosition), behavior: 'smooth' })
    }
  }, [activeHalfMoveIndex, moveHistory.length])

  // Get status message
  const getStatusMessage = () => {
    if (gameStatus === 'checkmate') {
      const winner = game.turn() === 'w' ? 'Black' : 'White'
      return `${winner} wins by checkmate!`
    }
    if (gameStatus === 'stalemate') return 'Draw by stalemate'
    if (gameStatus === 'draw') return 'Draw'
    if (isViewingHistory) return `Move ${viewIndex} of ${moveHistory.length}`
    if (isEngineThinking) return 'Tal is thinking...'
    if (isEngineTurn) return "Tal's turn..."
    return 'Your turn'
  }

  // Responsive board width
  const boardWidth = useMemo(() => {
    if (typeof window === 'undefined') return 480
    const isDesktop = window.innerWidth >= 1024
    if (isDesktop) {
      return Math.min(window.innerWidth - 420, 560)
    }
    return Math.min(window.innerWidth - 32, 560)
  }, [])

  const engineColor = playerColor === 'white' ? 'black' : 'white'

  // Navigation button styles
  const navBtnClass = 'min-h-[36px] min-w-[36px] rounded-full border border-white/10 bg-white/10 px-2.5 py-1.5 transition hover:border-white/30 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 text-sm font-mono'

  return (
    <PremiumGate>
      <div className="min-h-screen bg-slate-950 p-4 md:p-6">
        <div className="max-w-[1200px] mx-auto">
          {/* Compact Header */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/coach')}
              className="text-slate-400 hover:text-slate-300 transition-colors text-sm"
            >
              ← Coach
            </button>
            <span className="text-slate-600">|</span>
            <h1 className="text-lg font-semibold text-white">Play with Coach Tal</h1>
            {error && (
              <span className="ml-auto text-red-400 text-xs">{error}</span>
            )}
          </div>

          {/* Main Layout */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">

            {/* LEFT: Board Column */}
            <div className="flex-shrink-0 w-full lg:w-auto">
              {/* Opponent Bar */}
              <div className="flex items-center gap-2.5 mb-2 px-1">
                <div className={`w-3.5 h-3.5 rounded-sm border border-slate-600 ${
                  engineColor === 'white' ? 'bg-white' : 'bg-slate-800'
                }`} />
                <TalCoachIcon size={24} />
                <span className="text-white font-medium text-sm">Coach Tal</span>
                {moveHistory.length > 0 ? (
                  <span className="text-xs text-slate-500 ml-auto">Lvl {skillLevel}/20</span>
                ) : (
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-slate-500">Lvl</span>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={skillLevel}
                      onChange={(e) => setSkillLevel(Number(e.target.value))}
                      className="w-20 h-1 accent-sky-400 cursor-pointer"
                    />
                    <span className="text-xs text-white font-medium w-5 text-right">{skillLevel}</span>
                  </div>
                )}
              </div>

              {/* Chess Board */}
              <div className="flex justify-center">
                <div style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}>
                  <Chessboard
                    id="play-with-coach-board"
                    position={displayPosition}
                    onPieceDrop={onDrop}
                    arePiecesDraggable={!isEngineTurn && gameStatus === 'playing' && !isViewingHistory}
                    boardOrientation={playerColor}
                    boardWidth={boardWidth}
                    showBoardNotation={true}
                    {...getDarkChessBoardTheme('default')}
                  />
                </div>
              </div>

              {/* Player Bar + Navigation */}
              <div className="flex items-center gap-2.5 mt-2 px-1">
                {/* Player identity */}
                <div className={`w-3.5 h-3.5 rounded-sm border border-slate-600 ${
                  playerColor === 'white' ? 'bg-white' : 'bg-slate-800'
                }`} />
                <span className="text-white font-medium text-sm">You</span>
                <span className="text-xs text-slate-500">
                  {getStatusMessage()}
                </span>

                {/* Navigation buttons */}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => navigateToMove(0)}
                    disabled={moveHistory.length === 0}
                    className={navBtnClass}
                    aria-label="First position"
                  >
                    {'|<'}
                  </button>
                  <button
                    onClick={() => navigateToMove((viewIndex ?? moveHistory.length) - 1)}
                    disabled={activeHalfMoveIndex === 0}
                    className={navBtnClass}
                    aria-label="Previous move"
                  >
                    {'<'}
                  </button>
                  <button
                    onClick={() => navigateToMove((viewIndex ?? moveHistory.length) + 1)}
                    disabled={activeHalfMoveIndex >= moveHistory.length}
                    className={navBtnClass}
                    aria-label="Next move"
                  >
                    {'>'}
                  </button>
                  <button
                    onClick={() => navigateToMove(moveHistory.length)}
                    disabled={viewIndex === null}
                    className={navBtnClass}
                    aria-label="Current position"
                  >
                    {'>|'}
                  </button>
                </div>
              </div>

              {/* History viewing indicator */}
              {isViewingHistory && (
                <div className="mt-2 px-1">
                  <button
                    onClick={() => setViewIndex(null)}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    ← Return to live position
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT: Sidebar */}
            <div className="flex-1 min-w-0 lg:max-w-[340px] w-full">
              {/* Compact Welcome (pre-game only) */}
              {showInitialGreeting && moveHistory.length === 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-900/10 px-4 py-3 mb-3">
                  <TalCoachIcon size={24} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Make your first move to begin! Adjust my skill level above, then use the chat bubble to ask me for advice anytime.
                  </p>
                </div>
              )}

              {/* Two-Column Move History */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Moves</h3>
                {moveHistory.length === 0 ? (
                  <p className="text-slate-600 text-xs py-4 text-center">No moves yet</p>
                ) : (
                  <div ref={moveListRef} className="max-h-[350px] overflow-y-auto pr-1">
                    <table className="w-full table-fixed text-left">
                      <thead className="sticky top-0 bg-slate-950/95 backdrop-blur z-10">
                        <tr className="text-[10px] uppercase text-slate-500 tracking-wider">
                          <th className="w-8 py-1.5 px-1">#</th>
                          <th className="py-1.5 px-1">White</th>
                          <th className="py-1.5 px-1">Black</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, row) => {
                          const whiteIdx = row * 2
                          const blackIdx = row * 2 + 1
                          const whiteSan = moveHistory[whiteIdx]
                          const blackSan = moveHistory[blackIdx]

                          return (
                            <tr key={row} className="border-b border-white/5 last:border-b-0">
                              <td className="py-1 px-1 text-xs text-slate-600 font-medium">{row + 1}.</td>
                              <td className="py-1 px-1">
                                {whiteSan && (
                                  <MoveCell
                                    san={whiteSan}
                                    halfMoveIndex={whiteIdx}
                                    isActive={activeHalfMoveIndex === whiteIdx + 1}
                                    isUserMove={whiteIdx % 2 === (playerColor === 'white' ? 0 : 1)}
                                    hasComment={coachingComments.has(whiteIdx)}
                                    isAnalyzing={analyzingMoveIndex === whiteIdx}
                                    classification={coachingComments.get(whiteIdx)?.processedMove?.classification}
                                    onNavigate={() => navigateToMove(whiteIdx + 1)}
                                    onRequestFeedback={() => requestCoachFeedback(whiteIdx)}
                                    canRequestFeedback={
                                      analyzingMoveIndex === null &&
                                      !coachingComments.has(whiteIdx) &&
                                      moveFenHistoryRef.current.has(whiteIdx)
                                    }
                                  />
                                )}
                              </td>
                              <td className="py-1 px-1">
                                {blackSan ? (
                                  <MoveCell
                                    san={blackSan}
                                    halfMoveIndex={blackIdx}
                                    isActive={activeHalfMoveIndex === blackIdx + 1}
                                    isUserMove={blackIdx % 2 === (playerColor === 'white' ? 0 : 1)}
                                    hasComment={coachingComments.has(blackIdx)}
                                    isAnalyzing={analyzingMoveIndex === blackIdx}
                                    classification={coachingComments.get(blackIdx)?.processedMove?.classification}
                                    onNavigate={() => navigateToMove(blackIdx + 1)}
                                    onRequestFeedback={() => requestCoachFeedback(blackIdx)}
                                    canRequestFeedback={
                                      analyzingMoveIndex === null &&
                                      !coachingComments.has(blackIdx) &&
                                      moveFenHistoryRef.current.has(blackIdx)
                                    }
                                  />
                                ) : (
                                  <span className="text-slate-800 text-xs px-2">--</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Game Controls */}
              <div className="mt-3 space-y-2">
                {moveHistory.length > 0 && (
                  <button
                    onClick={reviewGame}
                    disabled={isAnalyzing}
                    className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Review Game'}
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={resetGame}
                    className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
                  >
                    New Game
                  </button>
                  <button
                    onClick={changeColor}
                    className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-sm transition-colors"
                  >
                    Flip Color
                  </button>
                </div>
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
