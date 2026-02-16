/**
 * Puzzle Solve Page
 * Minimal interactive puzzle solver - loads FEN, accepts move, checks solution.
 */

import { useState, useMemo, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { Chess, Square } from 'chess.js'
import { CoachingService } from '../../services/coachingService'
import { useAuth } from '../../contexts/AuthContext'
import { useCoachChat } from '../../contexts/CoachChatContext'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import { ChatPositionContext } from '../../types'

interface Puzzle {
  id?: string
  fen_position: string
  correct_move: string
  explanation: string
  difficulty_rating: number
  puzzle_category?: string
  tactical_theme?: string
}

export default function PuzzleSolvePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to solve puzzles</p>
      </div>
    )
  }

  return (
    <>
      <PuzzleSolveContent />
    </>
  )
}

function PuzzleSolveContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const state = location.state as { puzzle?: Puzzle; puzzles?: Puzzle[]; category?: string } | null

  const puzzles = useMemo(() => {
    if (state?.puzzle) return [state.puzzle]
    if (state?.puzzles) return state.puzzles
    return []
  }, [state])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null)
  const [userMove, setUserMove] = useState<string | null>(null)
  const startTime = useMemo(() => Date.now(), [currentIndex])
  const { setPositionContext } = useCoachChat()

  const currentPuzzle = puzzles[currentIndex]

  if (!currentPuzzle) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">No puzzle data available.</p>
          <button
            onClick={() => navigate('/coach/puzzles')}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors"
          >
            Back to Puzzles
          </button>
        </div>
      </div>
    )
  }

  const game = new Chess(currentPuzzle.fen_position)
  const boardOrientation = game.turn() === 'w' ? 'white' : 'black'

  // Publish position context to floating chat widget
  useEffect(() => {
    const ctx: ChatPositionContext = {
      fen: currentPuzzle.fen_position,
      moveHistory: [],
      contextType: 'puzzle',
      puzzleTheme: currentPuzzle.tactical_theme,
      puzzleCategory: currentPuzzle.puzzle_category,
    }
    setPositionContext(ctx)
    return () => setPositionContext(null)
  }, [currentPuzzle.fen_position, currentPuzzle.tactical_theme, currentPuzzle.puzzle_category, setPositionContext])

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (result !== null) return false

    try {
      const gameCopy = new Chess(currentPuzzle.fen_position)
      const piece = gameCopy.get(sourceSquare as Square)

      // Handle pawn promotion
      const targetRank = targetSquare[1]
      const isPromotion = piece?.type === 'p' &&
        ((piece.color === 'w' && targetRank === '8') ||
         (piece.color === 'b' && targetRank === '1'))

      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        ...(isPromotion && { promotion: 'q' }),
      })

      if (!move) return false

      const moveUci = `${move.from}${move.to}${move.promotion || ''}`
      setUserMove(move.san)

      // Check against correct move (compare UCI)
      const correctUci = currentPuzzle.correct_move.toLowerCase()
      const isCorrect = moveUci.toLowerCase() === correctUci ||
                        move.san.replace(/[+#]/g, '') === currentPuzzle.correct_move.replace(/[+#]/g, '')

      setResult(isCorrect ? 'correct' : 'incorrect')

      // Record attempt
      if (currentPuzzle.id && user?.id) {
        const timeTaken = Math.round((Date.now() - startTime) / 1000)
        CoachingService.recordPuzzleAttempt(currentPuzzle.id, isCorrect, timeTaken, [move.san]).catch(() => {})
      }

      return true
    } catch {
      return false
    }
  }

  const nextPuzzle = () => {
    if (currentIndex < puzzles.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setResult(null)
      setUserMove(null)
    } else {
      navigate('/coach/puzzles')
    }
  }

  const retryPuzzle = () => {
    setResult(null)
    setUserMove(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {state?.category ? `${state.category} Puzzles` : 'Puzzle'}
            </h1>
            {puzzles.length > 1 && (
              <p className="text-slate-400 text-sm mt-1">
                Puzzle {currentIndex + 1} of {puzzles.length}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/coach/puzzles')}
            className="px-4 py-2 border border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
          >
            Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Board */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-slate-300 mb-3 text-center font-medium">
              {game.turn() === 'w' ? 'White' : 'Black'} to move - find the best move!
            </p>
            <Chessboard
              position={currentPuzzle.fen_position}
              onPieceDrop={onDrop}
              boardOrientation={boardOrientation}
              {...getDarkChessBoardTheme('default')}
              arePiecesDraggable={result === null}
            />
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* Puzzle Info */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
              <h2 className="text-lg font-bold text-white mb-3">Puzzle Info</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Difficulty</span>
                  <span className="text-white">{currentPuzzle.difficulty_rating}</span>
                </div>
                {currentPuzzle.tactical_theme && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Theme</span>
                    <span className="text-white capitalize">{currentPuzzle.tactical_theme.replace('_', ' ')}</span>
                  </div>
                )}
                {currentPuzzle.puzzle_category && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Category</span>
                    <span className="text-white capitalize">{currentPuzzle.puzzle_category}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Result */}
            {result && (
              <div className={`rounded-3xl border p-6 ${
                result === 'correct'
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-red-500/50 bg-red-500/10'
              }`}>
                <h3 className={`text-xl font-bold mb-2 ${
                  result === 'correct' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {result === 'correct' ? 'Correct!' : 'Incorrect'}
                </h3>
                {userMove && (
                  <p className="text-slate-300 text-sm mb-2">
                    You played: <span className="font-mono font-bold">{userMove}</span>
                  </p>
                )}
                {result === 'incorrect' && (
                  <p className="text-slate-300 text-sm mb-2">
                    Best move: <span className="font-mono font-bold">{currentPuzzle.correct_move}</span>
                  </p>
                )}
                <p className="text-slate-400 text-sm mt-3">{currentPuzzle.explanation}</p>

                <div className="flex gap-2 mt-4">
                  {result === 'incorrect' && (
                    <button
                      onClick={retryPuzzle}
                      className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={nextPuzzle}
                    className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors"
                  >
                    {currentIndex < puzzles.length - 1 ? 'Next Puzzle' : 'Done'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
