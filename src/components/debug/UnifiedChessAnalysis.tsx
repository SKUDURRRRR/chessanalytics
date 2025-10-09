import { useMemo, useRef, useEffect } from 'react'
import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import { ModernChessArrows, ModernArrow } from '../chess/ModernChessArrows'
import { EnhancedMoveCoaching } from './EnhancedMoveCoaching'

interface ProcessedMove {
  index: number
  ply: number
  moveNumber: number
  player: 'white' | 'black'
  isUserMove: boolean
  san: string
  bestMoveSan: string | null
  evaluation: { type: 'cp' | 'mate'; value: number } | null
  scoreForPlayer: number
  displayEvaluation: string
  centipawnLoss: number | null
  classification: 'brilliant' | 'best' | 'good' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder' | 'uncategorized'
  explanation: string
  fenBefore: string
  fenAfter: string
}

interface UnifiedChessAnalysisProps {
  currentPosition: string
  currentMove: ProcessedMove | null
  allMoves: ProcessedMove[]
  playerColor: 'white' | 'black'
  currentIndex: number
  boardWidth: number
  currentMoveArrows: ModernArrow[]
  onMoveNavigation: (index: number) => void
  className?: string
}

const EVAL_CAP = 1000

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const MoveClassificationBadge = ({ classification }: { classification: string }) => {
  const classificationColors = {
    brilliant: 'border border-purple-400/40 bg-purple-500/20 text-purple-200',
    best: 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
    great: 'border border-teal-400/40 bg-teal-500/20 text-teal-200',
    excellent: 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-200',
    good: 'border border-sky-400/40 bg-sky-500/20 text-sky-200',
    acceptable: 'border border-slate-400/40 bg-slate-500/20 text-slate-200',
    inaccuracy: 'border border-amber-400/40 bg-amber-500/20 text-amber-200',
    mistake: 'border border-orange-400/40 bg-orange-500/20 text-orange-200',
    blunder: 'border border-rose-400/40 bg-rose-500/20 text-rose-200',
    uncategorized: 'border border-slate-400/30 bg-slate-500/10 text-slate-200'
  }

  const classificationLabels = {
    brilliant: 'Great',      // Chess.com: A move that altered the course of the game
    best: 'Best',            // Chess.com: The chess engine's top choice
    great: 'Great',          // Chess.com: A move that altered the course of the game
    excellent: 'Excellent',  // Chess.com: Almost as good as the best move
    good: 'Good',            // Chess.com: A decent move, but not the best
    acceptable: 'Book',      // Chess.com: A conventional opening move
    inaccuracy: 'Inaccuracy', // Chess.com: A weak move
    mistake: 'Mistake',      // Chess.com: A bad move that immediately worsens your position
    blunder: 'Blunder',      // Chess.com: A very bad move that loses material or the game
    uncategorized: 'Move'    // Fallback for uncategorized moves
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${classificationColors[classification as keyof typeof classificationColors]}`}>
      {classificationLabels[classification as keyof typeof classificationLabels]}
    </span>
  )
}

const EvaluationBar = ({
  score,
  playerColor,
  className = ''
}: {
  score: number
  playerColor: 'white' | 'black'
  className?: string
}) => {
  const clampedScore = clamp(score, -EVAL_CAP, EVAL_CAP)
  const percent = ((clampedScore + EVAL_CAP) / (EVAL_CAP * 2)) * 100
  const markerPosition = playerColor === 'white' ? 100 - percent : percent

  return (
    <div className={`relative h-full w-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-inner ${className}`}>
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-white" />
      <div className="absolute top-1/2 left-0 right-0 h-1/2 bg-slate-900" />
      <div
        className="absolute left-0 right-0 flex justify-center transition-all duration-700 ease-out"
        style={{ top: `${clamp(markerPosition, 2, 98)}%` }}
      >
        <span className="block h-1 w-10 rounded-full bg-orange-500 ring-2 ring-white/70 transition-all duration-500 ease-out" />
      </div>
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/40" />
    </div>
  )
}

const NAVIGATION_ICONS: Record<'first' | 'prev' | 'next' | 'last', string> = {
  first: '<<',
  prev: '<',
  next: '>',
  last: '>>'
}

export function UnifiedChessAnalysis({
  currentPosition,
  currentMove,
  allMoves,
  playerColor,
  currentIndex,
  boardWidth,
  currentMoveArrows,
  onMoveNavigation,
  className = ''
}: UnifiedChessAnalysisProps) {
  const currentScore = useMemo(() => {
    if (!currentMove?.evaluation) return 0
    return currentMove.evaluation.type === 'mate' 
      ? (currentMove.evaluation.value > 0 ? 1000 : -1000)
      : currentMove.evaluation.value
  }, [currentMove])

  // Auto-scroll to current move in timeline
  const timelineRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (timelineRef.current && currentMove) {
      // Calculate which row the current move is in (each row has 2 moves: white and black)
      // currentMove.index is 0-based, and we need to find the correct row
      // Row 0: moves 0,1 (index 0,1) -> move numbers 1,2
      // Row 1: moves 2,3 (index 2,3) -> move numbers 3,4
      // Row 2: moves 4,5 (index 4,5) -> move numbers 5,6
      const moveRowIndex = Math.floor(currentMove.index / 2)
      
      // Debug logging
      console.log('🔄 Auto-scroll debug:', {
        currentMoveIndex: currentMove.index,
        currentMoveSan: currentMove.san,
        moveRowIndex,
        currentIndex,
        totalMoves: allMoves.length
      })
      
      // Get the table row element to scroll to
      const tableRows = timelineRef.current.querySelectorAll('tbody tr')
      const targetRow = tableRows[moveRowIndex] as HTMLElement
      
      if (targetRow) {
        console.log('📍 Scrolling to row:', moveRowIndex, 'targetRow:', targetRow)
        
        // Calculate the scroll position within the timeline container
        const container = timelineRef.current
        const containerRect = container.getBoundingClientRect()
        const targetRect = targetRow.getBoundingClientRect()
        
        // Calculate the relative position of the target row within the container
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop
        
        // Calculate the center position within the container
        const containerHeight = container.clientHeight
        const targetHeight = targetRect.height
        const scrollToPosition = relativeTop - (containerHeight / 2) + (targetHeight / 2)
        
        // Smooth scroll within the timeline container only
        container.scrollTo({
          top: Math.max(0, scrollToPosition),
          behavior: 'smooth'
        })
      } else {
        console.warn('⚠️ Target row not found:', { moveRowIndex, totalRows: tableRows.length })
      }
    }
  }, [currentMove, currentIndex, allMoves.length])

  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-4 lg:p-6 shadow-2xl shadow-black/50 ${className}`}>
      {/* Mobile Layout: Stacked */}
      <div className="flex flex-col gap-4 lg:hidden">
        {/* Mobile: Chess Board */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-full flex justify-center max-w-full relative">
            <Chessboard
              id="unified-analysis-board-mobile"
              position={currentPosition}
              arePiecesDraggable={false}
              boardOrientation={playerColor}
              boardWidth={Math.min(boardWidth, 350)}
              showBoardNotation={true}
              {...getDarkChessBoardTheme('default')}
            />
            <ModernChessArrows
              arrows={currentMoveArrows}
              boardWidth={Math.min(boardWidth, 350)}
              boardOrientation={playerColor}
            />
          </div>
          
          {/* Mobile Navigation Controls */}
          <div className="mt-4 flex flex-col items-center justify-center gap-2 text-sm text-slate-200">
            <div className="text-xs text-slate-500">Use ← → arrow keys or click buttons to navigate</div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onMoveNavigation(0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(0)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="First move"
              >
                {NAVIGATION_ICONS.first}
              </button>
              <button
                onClick={() => onMoveNavigation(currentIndex - 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(currentIndex - 1)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="Previous move"
              >
                {NAVIGATION_ICONS.prev}
              </button>
              <button
                onClick={() => onMoveNavigation(currentIndex + 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(currentIndex + 1)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="Next move"
              >
                {NAVIGATION_ICONS.next}
              </button>
              <button
                onClick={() => onMoveNavigation(allMoves.length - 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(allMoves.length - 1)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="Last move"
              >
                {NAVIGATION_ICONS.last}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: Move Analysis */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4 shadow-xl shadow-black/40">
          {/* Current Move Analysis Section */}
          <div className="mb-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current Move</h3>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {currentMove ? currentMove.san : '—'}
                </div>
              </div>
            </div>
            
            {currentMove ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                  <span>{currentMove.player === 'white' ? 'White move' : 'Black move'}</span>
                  <span className="h-px w-8 bg-white/20" />
                  <span>Move {currentMove.moveNumber}</span>
                </div>
                
                {/* Enhanced Coaching Display */}
                <EnhancedMoveCoaching move={currentMove} className="text-sm" />
              </div>
            ) : (
              <p className="text-sm text-slate-300">Use the move timeline to explore Stockfish feedback for each position.</p>
            )}
          </div>

          {/* Divider */}
          <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          {/* Move Timeline Section */}
          <div>
            <div className="mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Move Timeline</h3>
              <div className="text-xs text-slate-500 mt-1">← → to navigate moves • Scroll to see all moves</div>
            </div>
            <div ref={timelineRef} className="max-h-[100px] overflow-y-auto pr-2 text-sm scrollbar-hide">
              <table className="w-full table-fixed text-left">
                <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                  <tr className="text-xs uppercase text-slate-400">
                    <th className="w-12 py-2">Move</th>
                    <th className="w-1/2 py-2">You</th>
                    <th className="w-1/2 py-2">Opponent</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.ceil(allMoves.length / 2) }).map((_, row) => {
                    const whiteMove = allMoves[row * 2]
                    const blackMove = allMoves[row * 2 + 1]
                    return (
                      <tr key={row} className="border-b border-white/10 last:border-b-0">
                        <td className="py-2 pr-2 text-xs text-slate-400">{row + 1}</td>
                        <td className="py-2 pr-2">
                          {whiteMove ? (
                            <button
                              onClick={() => onMoveNavigation(whiteMove.index + 1)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  onMoveNavigation(whiteMove.index + 1)
                                }
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition gap-1 ${
                                currentIndex === whiteMove.index + 1
                                  ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
                              }`}
                            >
                              <span className="text-xs font-medium truncate">{whiteMove.san}</span>
                              <MoveClassificationBadge classification={whiteMove.classification} />
                            </button>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {blackMove ? (
                            <button
                              onClick={() => onMoveNavigation(blackMove.index + 1)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  onMoveNavigation(blackMove.index + 1)
                                }
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition gap-1 ${
                                currentIndex === blackMove.index + 1
                                  ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
                              }`}
                            >
                              <span className="text-xs font-medium truncate">{blackMove.san}</span>
                              <MoveClassificationBadge classification={blackMove.classification} />
                            </button>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout: Side by Side */}
      <div className="hidden lg:flex gap-6">
        {/* Left: Evaluation Bar */}
        <div className="flex flex-col items-center justify-center">
          <div className="h-[400px] w-8">
            <EvaluationBar score={currentScore} playerColor={playerColor} />
          </div>
        </div>

        {/* Center: Chess Board */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-full flex justify-center max-w-full relative">
            <Chessboard
              id="unified-analysis-board"
              position={currentPosition}
              arePiecesDraggable={false}
              boardOrientation={playerColor}
              boardWidth={boardWidth}
              showBoardNotation={true}
              {...getDarkChessBoardTheme('default')}
            />
            <ModernChessArrows
              arrows={currentMoveArrows}
              boardWidth={boardWidth}
              boardOrientation={playerColor}
            />
          </div>
          
          {/* Navigation Controls */}
          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-slate-200">
            <div className="text-xs text-slate-500">Use ← → arrow keys or click buttons to navigate</div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onMoveNavigation(0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(0)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="First move"
              >
                {NAVIGATION_ICONS.first}
              </button>
              <button
                onClick={() => onMoveNavigation(currentIndex - 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(currentIndex - 1)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="Previous move"
              >
                {NAVIGATION_ICONS.prev}
              </button>
              <button
                onClick={() => onMoveNavigation(currentIndex + 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(currentIndex + 1)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="Next move"
              >
                {NAVIGATION_ICONS.next}
              </button>
              <button
                onClick={() => onMoveNavigation(allMoves.length - 1)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(allMoves.length - 1)
                  }
                }}
                className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                aria-label="Last move"
              >
                {NAVIGATION_ICONS.last}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Move Analysis */}
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-6 shadow-xl shadow-black/40 h-full">
            {/* Current Move Analysis Section */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current Move</h3>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {currentMove ? currentMove.san : '—'}
                  </div>
                </div>
              </div>
              
              {currentMove ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                    <span>{currentMove.player === 'white' ? 'White move' : 'Black move'}</span>
                    <span className="h-px w-8 bg-white/20" />
                    <span>Move {currentMove.moveNumber}</span>
                  </div>
                  
                  {/* Enhanced Coaching Display */}
                  <EnhancedMoveCoaching move={currentMove} className="text-sm" />
                </div>
              ) : (
                <p className="text-sm text-slate-300">Use the move timeline to explore Stockfish feedback for each position.</p>
              )}
            </div>

            {/* Divider */}
            <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

            {/* Move Timeline Section */}
            <div>
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Move Timeline</h3>
                <div className="text-xs text-slate-500 mt-1">← → to navigate moves • Scroll to see all moves</div>
              </div>
              <div ref={timelineRef} className="max-h-[200px] overflow-y-auto pr-2 text-sm scrollbar-hide">
                <table className="w-full table-fixed text-left">
                  <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                    <tr className="text-xs uppercase text-slate-400">
                      <th className="w-14 py-2">Move</th>
                      <th className="w-1/2 py-2">You</th>
                      <th className="w-1/2 py-2">Opponent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(allMoves.length / 2) }).map((_, row) => {
                      const whiteMove = allMoves[row * 2]
                      const blackMove = allMoves[row * 2 + 1]
                      return (
                        <tr key={row} className="border-b border-white/10 last:border-b-0">
                          <td className="py-2 pr-2 text-xs text-slate-400">{row + 1}</td>
                          <td className="py-2 pr-2">
                            {whiteMove ? (
                              <button
                                onClick={() => onMoveNavigation(whiteMove.index + 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onMoveNavigation(whiteMove.index + 1)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition gap-1 ${
                                  currentIndex === whiteMove.index + 1
                                    ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                                }`}
                              >
                                <span className="text-xs font-medium truncate">{whiteMove.san}</span>
                                <MoveClassificationBadge classification={whiteMove.classification} />
                              </button>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {blackMove ? (
                              <button
                                onClick={() => onMoveNavigation(blackMove.index + 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onMoveNavigation(blackMove.index + 1)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition gap-1 ${
                                  currentIndex === blackMove.index + 1
                                    ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                                }`}
                              >
                                <span className="text-xs font-medium truncate">{blackMove.san}</span>
                                <MoveClassificationBadge classification={blackMove.classification} />
                              </button>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
