/**
 * Play with Tal Coach Page
 * Interactive chess game against AI coach
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { CoachingService } from '../../services/coachingService'
import UnifiedAnalysisService from '../../services/unifiedAnalysisService'
import { PremiumGate } from '../../components/coach/PremiumGate'
import LoadingModal from '../../components/LoadingModal'
import { GameResultModal } from '../../components/coach/GameResultModal'
import { useAuth } from '../../contexts/AuthContext'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import { config } from '../../lib/config'
import { supabase } from '../../lib/supabase'

type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resignation'

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
        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, result.move.san])

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
        // Update game state first
        setGame(gameCopy)
        setGamePosition(gameCopy.fen())
        setMoveHistory(prev => [...prev, move.san])

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
          played_at: headers.Date || new Date().toISOString(),
          opponent_name: userIsWhite ? headers.Black : headers.White,
        }, {
          onConflict: 'user_id,platform,provider_game_id'
        })

      if (gameError) {
        console.warn('Failed to create game record:', gameError)
        // Continue anyway - backend might create it
      }

      // Save PGN to database
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
        console.warn('Failed to save PGN:', pgnError)
        // Continue anyway - backend might handle it
      }

      // Analyze the game with a specific game_id so it can be saved
      const analysisResponse = await UnifiedAnalysisService.analyze({
        user_id: user.id,
        platform: 'lichess',
        analysis_type: 'stockfish',
        pgn: fullPgn,
        depth: 10,
        game_id: gameId,
        provider_game_id: gameId,
      })

      // Check if analysis was successful
      if (analysisResponse.analysis_id) {
        // Navigate to analysis page using the analysis_id
        navigate(`/analysis/lichess/${user.id}/${analysisResponse.analysis_id}`)
      } else if (analysisResponse.success === false) {
        // If analysis failed, show error
        throw new Error(analysisResponse.message || 'Failed to analyze game')
      } else {
        // Fallback: try using the game_id even if analysis_id is missing
        navigate(`/analysis/lichess/${user.id}/${gameId}`)
      }
    } catch (err) {
      console.error('Error reviewing game:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze game')
      setShowResultModal(true) // Reopen modal to show error
    } finally {
      setIsAnalyzing(false)
    }
  }, [game, moveHistory, playerColor, gameStatus, playerWon, user, navigate])

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

              {/* Move History */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <h2 className="text-xl font-bold text-white mb-4">Move History</h2>
                {moveHistory.length === 0 ? (
                  <p className="text-slate-400 text-sm">No moves yet</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {moveHistory.map((move, index) => (
                      <div key={index} className="text-slate-300 text-sm font-mono">
                        {index + 1}. {move}
                      </div>
                    ))}
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
