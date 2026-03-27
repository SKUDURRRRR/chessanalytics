/**
 * Puzzle Solve Page
 * Interactive multi-move puzzle solver with rating, timer, and hints.
 * Supports both puzzle bank puzzles (multi-move) and personalized puzzles (single-move).
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { Chess, Square } from 'chess.js'
import { CoachingService } from '../../services/coachingService'
import { useAuth } from '../../contexts/AuthContext'
import { InlineCoachChat } from '../../components/coach/InlineCoachChat'
import { ModernChessArrows } from '../../components/chess/ModernChessArrows'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import type { ModernArrow } from '../../utils/chessArrows'
import type {
  BankPuzzle,
  PuzzleMoveResult,
  PuzzleCompletionResult,
  ChatPositionContext,
} from '../../types'

// Legacy single-move puzzle type (from personalized puzzles)
interface LegacyPuzzle {
  id?: string
  fen_position: string
  correct_move: string
  explanation: string
  difficulty_rating: number
  puzzle_category?: string
  tactical_theme?: string
}

type PuzzleStatus =
  | 'loading'
  | 'setup'           // Auto-playing the setup move
  | 'awaiting_move'   // Waiting for user to make a move
  | 'checking'        // Checking move with backend
  | 'opponent_moving' // Auto-playing opponent response
  | 'solved'          // Puzzle completed successfully
  | 'failed'          // User made wrong move
  | 'complete'        // After viewing results (legacy or bank)

// Location state types
interface BankPuzzleState {
  mode: 'bank'
  bankPuzzle?: BankPuzzle
  theme?: string
  dailyChallengeId?: string
}

interface LegacyPuzzleState {
  puzzle?: LegacyPuzzle
  puzzles?: LegacyPuzzle[]
  category?: string
}

type LocationState = BankPuzzleState | LegacyPuzzleState | null

export default function PuzzleSolvePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <p className="text-gray-500">Please log in to solve puzzles</p>
      </div>
    )
  }

  return <PuzzleSolveContent />
}

function PuzzleSolveContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const state = location.state as LocationState

  const isBankMode = state && 'mode' in state && state.mode === 'bank'

  if (isBankMode) {
    return (
      <BankPuzzleSolver
        initialPuzzle={(state as BankPuzzleState).bankPuzzle}
        theme={(state as BankPuzzleState).theme}
        dailyChallengeId={(state as BankPuzzleState).dailyChallengeId}
        authUserId={user?.id || ''}
        navigate={navigate}
      />
    )
  }

  // Legacy mode - personalized puzzles
  return (
    <LegacyPuzzleSolver
      state={state as LegacyPuzzleState}
      userId={user?.id || ''}
      navigate={navigate}
    />
  )
}

// =============================================================================
// BANK PUZZLE SOLVER (Multi-move)
// =============================================================================

function BankPuzzleSolver({
  initialPuzzle,
  theme,
  dailyChallengeId,
  authUserId,
  navigate,
}: {
  initialPuzzle?: BankPuzzle
  theme?: string
  dailyChallengeId?: string
  authUserId: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const [puzzle, setPuzzle] = useState<BankPuzzle | null>(initialPuzzle || null)
  const [status, setStatus] = useState<PuzzleStatus>(initialPuzzle ? 'setup' : 'loading')
  const [currentFen, setCurrentFen] = useState('')
  const [moveIndex, setMoveIndex] = useState(0)
  const [movesMade, setMovesMade] = useState<string[]>([])
  const [hintSquare, setHintSquare] = useState<string | null>(null)
  const [hintUsed, setHintUsed] = useState(false)
  const [completionResult, setCompletionResult] = useState<PuzzleCompletionResult | null>(null)
  const [incorrectMove, setIncorrectMove] = useState<string | null>(null)
  const [correctMoveArrow, setCorrectMoveArrow] = useState<[string, string][] | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [totalMoves, setTotalMoves] = useState(0)
  const [boardWidth, setBoardWidth] = useState(500)
  const startTimeRef = useRef(Date.now())
  const boardOrientationRef = useRef<'white' | 'black'>('white')
  const boardContainerRef = useRef<HTMLDivElement>(null)

  // Measure board width
  useEffect(() => {
    function update() {
      if (!boardContainerRef.current) return
      const w = boardContainerRef.current.clientWidth
      if (w > 0) setBoardWidth(w)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Build ModernArrow from correct move arrow data
  const modernArrows = useMemo<ModernArrow[]>(() => {
    if (!correctMoveArrow) return []
    return correctMoveArrow.map(([from, to]) => ({
      from: from as Square,
      to: to as Square,
      color: '#ef4444',
      classification: 'blunder',
      isBestMove: false,
    }))
  }, [correctMoveArrow])

  // Timer
  useEffect(() => {
    if (status === 'awaiting_move' || status === 'checking' || status === 'opponent_moving' || status === 'setup') {
      const interval = setInterval(() => {
        setTimerSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [status])

  // Load puzzle if not provided
  useEffect(() => {
    if (!initialPuzzle && status === 'loading') {
      CoachingService.getNextBankPuzzle(authUserId, theme, dailyChallengeId ? 'daily' : 'rated')
        .then((p) => {
          setPuzzle(p)
          setStatus('setup')
        })
        .catch(() => {
          navigate('/coach/puzzles')
        })
    }
  }, [initialPuzzle, status, authUserId, theme, dailyChallengeId, navigate])

  // Setup move animation
  useEffect(() => {
    if (status !== 'setup' || !puzzle) return

    const game = new Chess(puzzle.fen)
    setTotalMoves(puzzle.total_moves)

    // Determine board orientation based on who moves AFTER the setup move
    // Setup move is the opponent's move, so user plays the opposite color
    const setupColor = game.turn() // Who makes the setup move
    boardOrientationRef.current = setupColor === 'w' ? 'black' : 'white'

    // Show initial position briefly, then play setup move
    setCurrentFen(puzzle.fen)

    const timer = setTimeout(() => {
      try {
        // Parse setup move UCI and apply it
        const from = puzzle.setup_move.substring(0, 2) as Square
        const to = puzzle.setup_move.substring(2, 4) as Square
        const promotion = puzzle.setup_move.length > 4
          ? (puzzle.setup_move[4] as 'q' | 'r' | 'b' | 'n')
          : undefined
        game.move({ from, to, promotion })
        setCurrentFen(game.fen())
        setStatus('awaiting_move')
        startTimeRef.current = Date.now()
      } catch {
        // If setup move fails, just show the position
        setCurrentFen(puzzle.fen)
        setStatus('awaiting_move')
        startTimeRef.current = Date.now()
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [status, puzzle])

  // Build position context for inline coach chat
  const [localPositionContext, setLocalPositionContext] = useState<ChatPositionContext | null>(null)
  const [rightPanelTab, setRightPanelTab] = useState<'info' | 'coach'>('info')
  useEffect(() => {
    if (!puzzle || !currentFen) {
      setLocalPositionContext(null)
      return
    }
    setLocalPositionContext({
      fen: currentFen,
      moveHistory: movesMade,
      contextType: 'puzzle',
      puzzleTheme: puzzle.themes[0],
      puzzleCategory: 'tactical',
    })
  }, [currentFen, puzzle, movesMade])

  // Handle user's piece drop
  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (status !== 'awaiting_move' || !puzzle) return false

      try {
        const game = new Chess(currentFen)
        const piece = game.get(sourceSquare as Square)

        // Handle pawn promotion
        const targetRank = targetSquare[1]
        const isPromotion =
          piece?.type === 'p' &&
          ((piece.color === 'w' && targetRank === '8') ||
            (piece.color === 'b' && targetRank === '1'))

        const move = game.move({
          from: sourceSquare,
          to: targetSquare,
          ...(isPromotion && { promotion: 'q' }),
        })

        if (!move) return false

        const moveUci = `${move.from}${move.to}${move.promotion || ''}`
        setMovesMade((prev) => [...prev, moveUci])
        setCurrentFen(game.fen())
        setStatus('checking')
        setHintSquare(null)

        // Check move with backend
        CoachingService.checkPuzzleMove(puzzle.puzzle_id, moveUci, moveIndex, authUserId)
          .then((result: PuzzleMoveResult) => {
            if (result.is_correct) {
              if (result.is_complete) {
                // Puzzle solved!
                setStatus('solved')
                completePuzzle(true, game.fen())
              } else if (result.opponent_move) {
                // Play opponent response
                setStatus('opponent_moving')
                setTimeout(() => {
                  try {
                    const oppFrom = result.opponent_move!.substring(0, 2) as Square
                    const oppTo = result.opponent_move!.substring(2, 4) as Square
                    const oppPromo = result.opponent_move!.length > 4
                      ? (result.opponent_move![4] as 'q' | 'r' | 'b' | 'n')
                      : undefined
                    game.move({ from: oppFrom, to: oppTo, promotion: oppPromo })
                    setCurrentFen(game.fen())
                    setMoveIndex((prev) => prev + 1)
                    setStatus('awaiting_move')
                  } catch {
                    setStatus('awaiting_move')
                    setMoveIndex((prev) => prev + 1)
                  }
                }, 400)
              }
            } else {
              // Wrong move
              setIncorrectMove(moveUci)
              if (result.correct_move) {
                const cFrom = result.correct_move.substring(0, 2)
                const cTo = result.correct_move.substring(2, 4)
                setCorrectMoveArrow([[cFrom, cTo]])
              }
              setStatus('failed')
              completePuzzle(false, game.fen())
            }
          })
          .catch(() => {
            setStatus('awaiting_move')
          })

        return true
      } catch {
        return false
      }
    },
    [status, puzzle, currentFen, moveIndex, authUserId]
  )

  // Complete puzzle and get rating update
  const completePuzzle = useCallback(
    (solved: boolean, _finalFen: string) => {
      if (!puzzle) return
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      CoachingService.completeBankPuzzle(
        puzzle.puzzle_id,
        solved,
        elapsed,
        movesMade,
        authUserId
      )
        .then((result) => {
          setCompletionResult(result)
        })
        .catch(() => {
          // Still show basic result even if API fails
        })
    },
    [puzzle, movesMade, authUserId]
  )

  // Load next puzzle
  const loadNextPuzzle = useCallback(() => {
    setPuzzle(null)
    setStatus('loading')
    setMoveIndex(0)
    setMovesMade([])
    setHintSquare(null)
    setHintUsed(false)
    setCompletionResult(null)
    setIncorrectMove(null)
    setCorrectMoveArrow(null)
    setTimerSeconds(0)
    startTimeRef.current = Date.now()

    CoachingService.getNextBankPuzzle(authUserId, theme, dailyChallengeId ? 'daily' : 'rated')
      .then((p) => {
        setPuzzle(p)
        setStatus('setup')
      })
      .catch(() => {
        navigate('/coach/puzzles')
      })
  }, [authUserId, theme, dailyChallengeId, navigate])

  // Show hint
  const showHint = useCallback(() => {
    if (!puzzle || hintUsed) return
    // We don't have the solution on the client, but we can show a
    // visual hint based on the backend. For now, highlight that the user
    // should look for tactical themes.
    setHintUsed(true)
    // We'll highlight the hint by showing a message - the actual source square
    // isn't available client-side (solution is server-side only)
  }, [puzzle, hintUsed])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (status === 'loading' || !puzzle) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500">Loading puzzle...</p>
        </div>
      </div>
    )
  }

  const isSolvedOrFailed = status === 'solved' || status === 'failed'

  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-title font-semibold text-white">
              Puzzle
              {puzzle.rating && (
                <span className="ml-2 text-sm font-normal text-amber-400">
                  ~{puzzle.rating}
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 font-mono text-lg">{formatTime(timerSeconds)}</span>
            <button
              onClick={() => navigate('/coach/puzzles')}
              className="px-4 py-2 shadow-card bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm"
            >
              Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Board */}
          <div>
            {/* Status message */}
            <div className="mb-3 text-center">
              {status === 'setup' && (
                <p className="text-gray-500 text-sm animate-pulse">Setting up position...</p>
              )}
              {status === 'awaiting_move' && (
                <p className="text-white font-medium">
                  {boardOrientationRef.current === 'white' ? 'White' : 'Black'} to move &mdash;
                  find the best move!
                </p>
              )}
              {status === 'checking' && (
                <p className="text-emerald-400 text-sm animate-pulse">Checking...</p>
              )}
              {status === 'opponent_moving' && (
                <p className="text-gray-500 text-sm animate-pulse">Opponent responds...</p>
              )}
              {status === 'solved' && (
                <p className="text-emerald-400 font-semibold text-lg">Correct!</p>
              )}
              {status === 'failed' && (
                <p className="text-rose-400 font-semibold text-section">Incorrect</p>
              )}
            </div>

            <div ref={boardContainerRef} className="relative" style={{ padding: 1 }}>
              <Chessboard
                id="puzzle-board"
                position={currentFen}
                onPieceDrop={onDrop}
                boardOrientation={boardOrientationRef.current}
                {...getDarkChessBoardTheme('default')}
                arePiecesDraggable={status === 'awaiting_move'}
                customSquareStyles={
                  hintSquare
                    ? { [hintSquare]: { backgroundColor: 'rgba(34, 211, 238, 0.4)' } }
                    : {}
                }
              />
              {modernArrows.length > 0 && (
                <ModernChessArrows
                  arrows={modernArrows}
                  boardWidth={boardWidth}
                  boardOrientation={boardOrientationRef.current}
                  boardId="puzzle-board"
                />
              )}
            </div>
          </div>

          {/* Right panel: tabbed (Info / Coach Tal) */}
          <div className="rounded-lg shadow-card bg-surface-1 overflow-hidden flex flex-col h-full">
            {/* Tab header */}
            <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <button
                onClick={() => setRightPanelTab('info')}
                className={`flex-1 px-4 py-2.5 text-[12px] font-medium transition-colors ${
                  rightPanelTab === 'info' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                style={rightPanelTab === 'info' ? { background: 'rgba(255,255,255,0.04)' } : undefined}
              >
                Puzzle
              </button>
              <button
                onClick={() => setRightPanelTab('coach')}
                className={`flex-1 px-4 py-2.5 text-[12px] font-medium transition-colors ${
                  rightPanelTab === 'coach' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                style={rightPanelTab === 'coach' ? { background: 'rgba(255,255,255,0.04)' } : undefined}
              >
                Coach Tal
              </button>
            </div>

            {rightPanelTab === 'coach' ? (
              <div className="flex-1 min-h-0">
                <InlineCoachChat positionContext={localPositionContext} />
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Progress */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Progress</h3>
                <div className="flex items-center gap-2 mb-3">
                  {Array.from({ length: totalMoves }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                        i < moveIndex + (status === 'solved' ? 1 : 0)
                          ? 'bg-emerald-500 text-white'
                          : i === moveIndex && status === 'awaiting_move'
                            ? 'bg-emerald-500/30 shadow-card text-emerald-300'
                            : 'bg-white/10 text-gray-500'
                      }`}
                    >
                      {i < moveIndex + (status === 'solved' ? 1 : 0) ? '\u2713' : i + 1}
                    </div>
                  ))}
                  <span className="text-gray-500 text-xs ml-1">
                    Move {Math.min(moveIndex + 1, totalMoves)} of {totalMoves}
                  </span>
                </div>

                {/* Puzzle info */}
                <div className="space-y-1.5 text-sm">
                  {puzzle.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {puzzle.themes.slice(0, 4).map((t) => (
                        <span
                          key={t}
                          className="bg-white/10 text-gray-400 px-2 py-0.5 rounded text-xs capitalize"
                        >
                          {t.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>Your rating</span>
                    <span className="text-white">{puzzle.user_rating}</span>
                  </div>
                </div>
              </div>

              {/* Recommendation reason */}
              {puzzle.recommendation_reason && (
                <div className="rounded-lg shadow-card bg-white/[0.04] px-4 py-2.5">
                  <p className="text-gray-300 text-xs">
                    <span className="font-medium">Based on your games:</span>{' '}
                    {puzzle.recommendation_reason}
                  </p>
                </div>
              )}

              {/* Hint button */}
              {status === 'awaiting_move' && !hintUsed && (
                <button
                  onClick={showHint}
                  className="w-full rounded-lg shadow-card bg-amber-500/10 p-3 text-amber-300 text-sm font-medium hover:bg-amber-500/20 transition-colors"
                >
                  Show Hint (-50% XP)
                </button>
              )}

              {hintUsed && status === 'awaiting_move' && (
                <div className="rounded-lg shadow-card bg-amber-500/10 p-3">
                  <p className="text-amber-300 text-sm">
                    Look for a {puzzle.themes[0]?.replace(/([A-Z])/g, ' $1').trim().toLowerCase() || 'tactical'} pattern.
                  </p>
                </div>
              )}

              {/* Completion Result */}
              {isSolvedOrFailed && completionResult && (
                <div
                  className={`rounded-lg shadow-card p-5 ${
                    status === 'solved'
                      ? 'bg-emerald-500/10'
                      : 'bg-rose-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">Rating</span>
                    <span
                      className={`text-section font-semibold ${
                        completionResult.rating_change >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {completionResult.rating_change >= 0 ? '+' : ''}
                      {completionResult.rating_change}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">New Rating</span>
                    <span className="text-white font-semibold">{completionResult.new_rating}</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-sm">XP Earned</span>
                    <span className="text-rose-400 font-semibold">+{completionResult.xp_earned}</span>
                  </div>
                  {completionResult.level_up && (
                    <div className="bg-rose-500/20 shadow-card rounded-lg p-3 mb-3 text-center">
                      <p className="text-rose-300 font-semibold">Level Up!</p>
                      <p className="text-rose-200 text-sm">Level {completionResult.level}</p>
                    </div>
                  )}
                  {completionResult.daily_challenge_progress && (
                    <div className="text-gray-500 text-xs">
                      Daily: {completionResult.daily_challenge_progress}
                    </div>
                  )}
                  {completionResult.streak > 0 && (
                    <div className="text-amber-400 text-xs mt-1">
                      &#x1F525; {completionResult.streak} day streak
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {isSolvedOrFailed && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={loadNextPuzzle}
                    className="w-full bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2.5 px-4 rounded-md text-body transition-colors shadow-btn-primary"
                  >
                    Next Puzzle
                  </button>
                  <button
                    onClick={() => navigate('/coach/puzzles')}
                    className="w-full shadow-card bg-white/5 hover:bg-white/10 text-white py-2.5 px-4 rounded-lg transition-colors text-sm"
                  >
                    Back to Puzzles
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// LEGACY PUZZLE SOLVER (Single-move, backward compatible)
// =============================================================================

function LegacyPuzzleSolver({
  state,
  userId,
  navigate,
}: {
  state: LegacyPuzzleState | null
  userId: string
  navigate: ReturnType<typeof useNavigate>
}) {
  const puzzles = useMemo(() => {
    if (state?.puzzle) return [state.puzzle]
    if (state?.puzzles) return state.puzzles
    return []
  }, [state])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null)
  const [userMove, setUserMove] = useState<string | null>(null)
  const [rightPanelTab, setRightPanelTab] = useState<'info' | 'coach'>('info')
  const startTime = useMemo(() => Date.now(), [currentIndex])

  const currentPuzzle = puzzles[currentIndex]

  const [localPositionContext, setLocalPositionContext] = useState<ChatPositionContext | null>(null)
  useEffect(() => {
    if (!currentPuzzle) {
      setLocalPositionContext(null)
      return
    }
    setLocalPositionContext({
      fen: currentPuzzle.fen_position,
      moveHistory: [],
      contextType: 'puzzle',
      puzzleTheme: currentPuzzle.tactical_theme,
      puzzleCategory: currentPuzzle.puzzle_category,
    })
  }, [currentPuzzle])

  if (!currentPuzzle) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No puzzle data available.</p>
          <button
            onClick={() => navigate('/coach/puzzles')}
            className="px-6 py-3 bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium rounded-md text-body transition-colors shadow-btn-primary"
          >
            Back to Puzzles
          </button>
        </div>
      </div>
    )
  }

  const game = useMemo(() => new Chess(currentPuzzle.fen_position), [currentPuzzle.fen_position])
  const boardOrientation = game.turn() === 'w' ? 'white' : 'black'

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    if (result !== null) return false

    try {
      const gameCopy = new Chess(currentPuzzle.fen_position)
      const piece = gameCopy.get(sourceSquare as Square)

      const targetRank = targetSquare[1]
      const isPromotion =
        piece?.type === 'p' &&
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

      const correctUci = currentPuzzle.correct_move.toLowerCase()
      const isCorrect =
        moveUci.toLowerCase() === correctUci ||
        move.san.replace(/[+#]/g, '') === currentPuzzle.correct_move.replace(/[+#]/g, '')

      setResult(isCorrect ? 'correct' : 'incorrect')

      if (currentPuzzle.id && userId) {
        const timeTaken = Math.round((Date.now() - startTime) / 1000)
        CoachingService.recordPuzzleAttempt(currentPuzzle.id, isCorrect, timeTaken, [
          move.san,
        ]).catch(() => {})
      }

      return true
    } catch {
      return false
    }
  }

  const nextPuzzle = () => {
    if (currentIndex < puzzles.length - 1) {
      setCurrentIndex((prev) => prev + 1)
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
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-title font-semibold text-white">
              {state?.category ? `${state.category} Puzzles` : 'Puzzle'}
            </h1>
            {puzzles.length > 1 && (
              <p className="text-gray-500 text-sm mt-1">
                Puzzle {currentIndex + 1} of {puzzles.length}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate('/coach/puzzles')}
            className="px-4 py-2 shadow-card bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="p-1">
            <p className="text-gray-400 mb-3 text-center font-medium">
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

          {/* Right panel: tabbed (Info / Coach Tal) */}
          <div className="rounded-lg shadow-card bg-surface-1 overflow-hidden flex flex-col h-full">
            {/* Tab header */}
            <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <button
                onClick={() => setRightPanelTab('info')}
                className={`flex-1 px-4 py-2.5 text-[12px] font-medium transition-colors ${
                  rightPanelTab === 'info' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                style={rightPanelTab === 'info' ? { background: 'rgba(255,255,255,0.04)' } : undefined}
              >
                Puzzle
              </button>
              <button
                onClick={() => setRightPanelTab('coach')}
                className={`flex-1 px-4 py-2.5 text-[12px] font-medium transition-colors ${
                  rightPanelTab === 'coach' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
                style={rightPanelTab === 'coach' ? { background: 'rgba(255,255,255,0.04)' } : undefined}
              >
                Coach Tal
              </button>
            </div>

            {rightPanelTab === 'coach' ? (
              <div className="flex-1 min-h-0">
                <InlineCoachChat positionContext={localPositionContext} />
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h2 className="text-section font-semibold text-white mb-3">Puzzle Info</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Difficulty</span>
                    <span className="text-white">{currentPuzzle.difficulty_rating}</span>
                  </div>
                  {currentPuzzle.tactical_theme && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Theme</span>
                      <span className="text-white capitalize">
                        {currentPuzzle.tactical_theme.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {currentPuzzle.puzzle_category && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Category</span>
                      <span className="text-white capitalize">{currentPuzzle.puzzle_category}</span>
                    </div>
                  )}
                </div>
              </div>

              {result && (
                <div
                  className={`rounded-lg shadow-card p-6 ${
                    result === 'correct'
                      ? 'bg-emerald-500/10'
                      : 'bg-rose-500/10'
                  }`}
                >
                  <h3
                    className={`text-title font-semibold mb-2 ${
                      result === 'correct' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {result === 'correct' ? 'Correct!' : 'Incorrect'}
                  </h3>
                  {userMove && (
                    <p className="text-gray-400 text-sm mb-2">
                      You played: <span className="font-mono font-semibold">{userMove}</span>
                    </p>
                  )}
                  {result === 'incorrect' && (
                    <p className="text-gray-400 text-sm mb-2">
                      Best move:{' '}
                      <span className="font-mono font-semibold">{currentPuzzle.correct_move}</span>
                    </p>
                  )}
                  <p className="text-gray-500 text-sm mt-3">{currentPuzzle.explanation}</p>

                  <div className="flex gap-2 mt-4">
                    {result === 'incorrect' && (
                      <button
                        onClick={retryPuzzle}
                        className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={nextPuzzle}
                      className="flex-1 px-4 py-2 bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium rounded-md text-body transition-colors shadow-btn-primary"
                    >
                      {currentIndex < puzzles.length - 1 ? 'Next Puzzle' : 'Done'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
