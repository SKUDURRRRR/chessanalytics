import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import { analyzeExplorationPosition } from '../../utils/explorationAnalysis'

interface ProcessedMove {
  index: number
  ply: number
  moveNumber: number
  player: 'white' | 'black'
  isUserMove: boolean
  san: string
  bestMoveSan: string | null
  evaluation: { type: 'cp' | 'mate'; value: number; pv?: string[] } | null
  scoreForPlayer: number
  displayEvaluation: string
  centipawnLoss: number | null
  classification: 'brilliant' | 'best' | 'great' | 'excellent' | 'good' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder' | 'uncategorized'
  explanation: string
  fenBefore: string
  fenAfter: string
  pvMoves?: string[]  // Principal Variation in SAN notation

  // Enhanced coaching fields
  coachingComment?: string
  whatWentRight?: string
  whatWentWrong?: string
  howToImprove?: string
  tacticalInsights?: string[]
  positionalInsights?: string[]
  risks?: string[]
  benefits?: string[]
  learningPoints?: string[]
  encouragementLevel?: number
  moveQuality?: string
  gamePhase?: string
}

interface FollowUpExplorerProps {
  currentMove: ProcessedMove
  isExploring: boolean
  explorationMoves: string[]
  onExploringChange: (exploring: boolean) => void
  onResetExploration: () => void
  onUndoExplorationMove: () => void
  onAddExplorationMove?: (move: string) => void  // NEW: Add a move programmatically
  className?: string
}

export function FollowUpExplorer({
  currentMove,
  isExploring,
  explorationMoves,
  onExploringChange,
  onResetExploration,
  onUndoExplorationMove,
  onAddExplorationMove,
  className = ''
}: FollowUpExplorerProps) {
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null)
  const explorationMovesRef = useRef<string[]>([])

  // Keep ref in sync with props
  useEffect(() => {
    explorationMovesRef.current = explorationMoves
  }, [explorationMoves])

  // Check if this move has a better alternative
  // Show for any move that has a different best move, excluding truly best moves (centipawnLoss === 0)
  const hasBetterMove = useMemo(() => {
    const hasDifferentBestMove = currentMove.bestMoveSan &&
                                currentMove.bestMoveSan !== currentMove.san

    // If classified as "best" or "brilliant", only show if it has centipawn loss (not truly best)
    if (['best', 'brilliant'].includes(currentMove.classification)) {
      return hasDifferentBestMove && (currentMove.centipawnLoss ?? 0) > 0
    }

    // For all other classifications, show if there's a different best move
    return hasDifferentBestMove
  }, [currentMove])

  // Calculate current exploration position and generate analysis
  const explorationAnalysis = useMemo(() => {
    if (!isExploring || !currentMove.bestMoveSan) return null

    try {
      // Build the position
      const game = new Chess(currentMove.fenBefore)
      game.move(currentMove.bestMoveSan)

      // Apply exploration moves
      let lastMove = currentMove.bestMoveSan
      for (const move of explorationMoves) {
        game.move(move)
        lastMove = move
      }

      // Get the last move played (or null if we're just at the best move)
      const lastMoveSan = explorationMoves.length > 0
        ? explorationMoves[explorationMoves.length - 1]
        : null

      // Analyze the current position
      return analyzeExplorationPosition(
        game.fen(),
        lastMoveSan,
        currentMove.moveNumber
      )
    } catch (err) {
      console.warn('Error analyzing exploration position:', err)
      return null
    }
  }, [isExploring, currentMove, explorationMoves])

  // Clean up timer on unmount or when exploration stops
  useEffect(() => {
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [])

  // Stop auto-play when exploration stops
  useEffect(() => {
    if (!isExploring && isAutoPlaying) {
      setIsAutoPlaying(false)
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current)
        autoPlayTimerRef.current = null
      }
    }
  }, [isExploring, isAutoPlaying])

  // Auto-play function
  const startAutoPlay = useCallback(() => {
    console.log('🔍 DEBUG: startAutoPlay called with currentMove:', {
      san: currentMove.san,
      bestMoveSan: currentMove.bestMoveSan,
      hasPvMoves: !!currentMove.pvMoves,
      pvMoves: currentMove.pvMoves,
      pvLength: currentMove.pvMoves?.length || -1,
      evaluation: currentMove.evaluation,
      fullMove: currentMove
    })

    if (!onAddExplorationMove || !currentMove.pvMoves || currentMove.pvMoves.length === 0) {
      console.warn('⚠️ Cannot start auto-play:', {
        hasCallback: !!onAddExplorationMove,
        hasPvMoves: !!currentMove.pvMoves,
        pvLength: currentMove.pvMoves?.length || -1,
        reason: !onAddExplorationMove ? 'No callback' : !currentMove.pvMoves ? 'No pvMoves' : 'Empty pvMoves'
      })
      return
    }

    console.log('🎬 Starting auto-play!', {
      pvMoves: currentMove.pvMoves,
      pvLength: currentMove.pvMoves.length
    })

    setIsAutoPlaying(true)

    const playNextMove = () => {
      const pvMoves = currentMove.pvMoves || []
      const currentExplorationMoves = explorationMovesRef.current // Use ref to get latest value

      // Calculate which move to play next
      // pvMoves[0] = best move (e.g., Nc3) - already on board when exploration starts
      // pvMoves[1] = opponent response (e.g., Bg4) - first exploration move
      // pvMoves[2] = our next move (e.g., Qc3) - second exploration move
      // explorationMoves.length tells us how many moves we've played
      const nextMoveIndex = currentExplorationMoves.length + 1 // +1 because pvMoves[0] is best move

      console.log('🎮 Auto-play state:', {
        explorationMovesCount: currentExplorationMoves.length,
        explorationMoves: currentExplorationMoves,
        nextMoveIndex,
        pvLength: pvMoves.length,
        nextMove: pvMoves[nextMoveIndex],
        allPvMoves: pvMoves
      })

      if (nextMoveIndex < pvMoves.length) {
        const moveToPlay = pvMoves[nextMoveIndex]

        console.log(`🎮 [${nextMoveIndex}/${pvMoves.length}] Will play: "${moveToPlay}"`)

        // Try to apply the move
        try {
          const game = new Chess(currentMove.fenBefore)

          console.log('🎮 Starting from fenBefore:', currentMove.fenBefore)

          // Apply best move first (pvMoves[0])
          if (currentMove.bestMoveSan) {
            const bestMoveResult = game.move(currentMove.bestMoveSan)
            console.log('🎮 Applied best move:', currentMove.bestMoveSan, '→', bestMoveResult?.san)
          }

          // Apply all previous exploration moves
          console.log('🎮 Applying', currentExplorationMoves.length, 'previous exploration moves:', currentExplorationMoves)
          for (let i = 0; i < currentExplorationMoves.length; i++) {
            const prevMove = currentExplorationMoves[i]
            const result = game.move(prevMove)
            console.log(`🎮   [${i}] Applied: ${prevMove} →`, result?.san)
          }

          const currentFen = game.fen()
          console.log('🎮 Current position:', currentFen)
          console.log('🎮 Attempting to play:', moveToPlay)

          // Try to apply the next move
          const result = game.move(moveToPlay)

          if (result && onAddExplorationMove) {
            console.log('✅ Successfully played:', moveToPlay, '→', result.san)
            console.log('🎮 Adding to exploration moves...')
            onAddExplorationMove(moveToPlay)
            console.log('🎮 Scheduling next move in 700ms...')

            // Schedule next move
            autoPlayTimerRef.current = setTimeout(playNextMove, 700) // 0.7 second delay
          } else {
            // Move failed, stop auto-play
            console.warn('❌ Move failed:', {
              moveToPlay,
              result,
              hasCallback: !!onAddExplorationMove
            })
            setIsAutoPlaying(false)
          }
        } catch (error) {
          console.error('❌ Auto-play move failed with exception:', {
            error,
            moveToPlay,
            nextMoveIndex
          })
          setIsAutoPlaying(false)
        }
      } else {
        // Reached end of PV
        console.log('🏁 Reached end of PV line!')
        setIsAutoPlaying(false)
      }
    }

    // Start playing after initial delay
    console.log('🎮 Scheduling first move in 700ms...')
    autoPlayTimerRef.current = setTimeout(playNextMove, 700)
  }, [currentMove, onAddExplorationMove]) // Removed explorationMoves from dependencies

  const stopAutoPlay = useCallback(() => {
    setIsAutoPlaying(false)
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current)
      autoPlayTimerRef.current = null
    }
  }, [])

  const handleShowFollowUp = () => {
    onExploringChange(true)
    // Don't auto-start playback - let user click Play button
  }

  const handleHideFollowUp = () => {
    stopAutoPlay()
    onExploringChange(false)
  }

  if (!hasBetterMove) {
    return null
  }

  return (
    <div className={className}>
      {/* Show/Hide Follow-Up Button */}
      {!isExploring ? (
        <button
          onClick={handleShowFollowUp}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-all hover:bg-emerald-500/20 hover:border-emerald-400/50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Show Follow-Up
        </button>
      ) : (
        <div className="space-y-3">
          {/* Exploration Info */}
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-emerald-300">
                Exploring Best Line: {currentMove.bestMoveSan}
              </span>
            </div>

            {/* Show Stockfish PV line if available */}
            {currentMove.pvMoves && currentMove.pvMoves.length > 0 ? (
              <div className="text-xs text-emerald-200/90 mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-400/20">
                <span className="font-semibold text-emerald-100">Stockfish's continuation ({currentMove.pvMoves.length} moves): </span>
                <span className="font-mono">{currentMove.pvMoves.join(' ')}</span>
              </div>
            ) : (
              <div className="text-xs text-yellow-200/90 mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-400/20">
                <span className="font-semibold text-yellow-100">⚠️ No PV data available</span>
                <br />
                <span className="text-yellow-200/70">This game may need to be re-analyzed to show the complete Stockfish continuation.</span>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex gap-1">
            {/* Play/Pause Auto-play */}
            {currentMove.pvMoves && currentMove.pvMoves.length > 1 && (
              <button
                onClick={isAutoPlaying ? stopAutoPlay : startAutoPlay}
                disabled={explorationMoves.length >= currentMove.pvMoves.length - 1}
                className="flex-1 flex items-center justify-center gap-1 rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-1 text-[11px] font-medium text-emerald-300 transition-all hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
              >
                {isAutoPlaying ? (
                  <>
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate">Pause</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate">{explorationMoves.length > 0 ? 'Resume' : 'Play'}</span>
                  </>
                )}
              </button>
            )}

            {explorationMoves.length > 0 && (
              <>
                <button
                  onClick={onUndoExplorationMove}
                  disabled={isAutoPlaying}
                  className="flex-1 flex items-center justify-center gap-1 rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-1 text-[11px] font-medium text-sky-300 transition-all hover:bg-sky-500/20 disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
                >
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="truncate">Undo</span>
                </button>
                <button
                  onClick={() => {
                    stopAutoPlay()
                    onResetExploration()
                  }}
                  disabled={isAutoPlaying}
                  className="flex-1 flex items-center justify-center gap-1 rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-1 text-[11px] font-medium text-amber-300 transition-all hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
                >
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="truncate">Reset</span>
                </button>
              </>
            )}
            <button
              onClick={handleHideFollowUp}
              className={`${explorationMoves.length > 0 || (currentMove.pvMoves && currentMove.pvMoves.length > 1) ? 'flex-1' : 'w-full'} flex items-center justify-center gap-1 rounded border border-slate-400/30 bg-slate-500/10 px-1.5 py-1 text-[11px] font-medium text-slate-300 transition-all hover:bg-slate-500/20 min-w-0`}
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="truncate">Hide Follow-Up</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
