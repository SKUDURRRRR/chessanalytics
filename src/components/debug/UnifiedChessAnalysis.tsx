import React, { useMemo, useRef, useEffect, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import type { ModernArrow } from '../../utils/chessArrows'
import { ModernChessArrows } from '../chess/ModernChessArrows'
import { EnhancedMoveCoaching } from './EnhancedMoveCoaching'
import { FollowUpExplorer } from '../chess/FollowUpExplorer'
import { useChessSound } from '../../hooks/useChessSound'
import { useChessSoundSettings } from '../../contexts/ChessSoundContext'
import { getMoveSoundSimple } from '../../utils/chessSounds'
import type { ExplorationAnalysis } from '../../hooks/useExplorationAnalysis'

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
  classification: 'brilliant' | 'best' | 'great' | 'excellent' | 'good' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder' | 'uncategorized'
  explanation: string
  fenBefore: string
  fenAfter: string
  gamePhase?: string  // Optional: 'OPENING', 'MIDDLEGAME', 'ENDGAME'

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
  isExploringFollowUp?: boolean
  isFreeExploration?: boolean
  explorationMoves?: string[]
  explorationAnalysis?: ExplorationAnalysis | null
  onExploringChange?: (exploring: boolean) => void
  onExitFreeExploration?: () => void
  onResetExploration?: () => void
  onUndoExplorationMove?: () => void
  onAddExplorationMove?: (move: string) => void
  onPieceDrop?: (sourceSquare: string, targetSquare: string) => boolean
  isLoadingAIComments?: boolean
  className?: string
}

const EVAL_CAP = 1000

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// Classification label mapping - used across components
const classificationLabels = {
  brilliant: 'Brilliant',  // Spectacular tactical move with sacrifice or forced mate
  best: 'Best',            // Chess.com: The chess engine's top choice
  excellent: 'Excellent',  // Merged: Nearly optimal (5-25cp loss)
  great: 'Excellent',      // Alias: Maps to excellent
  good: 'Good',            // Merged: Solid play (25-100cp loss)
  acceptable: 'Good',      // Alias: Maps to good
  inaccuracy: 'Inaccuracy', // Chess.com: A weak move
  mistake: 'Mistake',      // Chess.com: A bad move that immediately worsens your position
  blunder: 'Blunder',      // Chess.com: A very bad move that loses material or the game
  uncategorized: 'Move'    // Fallback for uncategorized moves
}

// Helper function to get classification display label
const getClassificationLabel = (classification: string): string => {
  return classificationLabels[classification as keyof typeof classificationLabels] || classification
}

const MoveClassificationBadge = ({ classification }: { classification: string }) => {
  const classificationColors = {
    brilliant: 'shadow-card bg-purple-500/20 text-purple-200',
    best: 'shadow-card bg-emerald-500/20 text-emerald-200',
    excellent: 'shadow-card bg-cyan-500/20 text-cyan-200',  // Merged great+excellent
    great: 'shadow-card bg-cyan-500/20 text-cyan-200',  // Alias for excellent
    good: 'shadow-card bg-sky-500/20 text-sky-200',  // Merged good+acceptable
    acceptable: 'shadow-card bg-sky-500/20 text-sky-200',  // Alias for good
    inaccuracy: 'shadow-card bg-amber-500/20 text-amber-200',
    mistake: 'shadow-card bg-orange-500/20 text-orange-200',
    blunder: 'shadow-card bg-rose-500/20 text-rose-200',
    uncategorized: 'shadow-card bg-surface-1 text-gray-300'
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${classificationColors[classification as keyof typeof classificationColors]}`}>
      {getClassificationLabel(classification)}
    </span>
  )
}

const EvaluationBar = ({
  score,
  playerColor,
  className = '',
  width = 24,
  height,
  offsetTop = 0
}: {
  score: number
  playerColor: 'white' | 'black'
  className?: string
  width?: number
  height?: number
  offsetTop?: number
}) => {
  const clampedScore = clamp(score, -EVAL_CAP, EVAL_CAP)
  const percent = ((clampedScore + EVAL_CAP) / (EVAL_CAP * 2)) * 100
  const markerPosition = playerColor === 'white' ? 100 - percent : percent

  // Calculate white's advantage percentage (0-100%)
  // When percent is 100, white is maximally ahead
  // When percent is 0, black is maximally ahead
  const whiteAdvantagePercent = percent

  // The bar orientation should match the board orientation
  // When viewing from white's perspective (white at bottom): white section at bottom
  // When viewing from black's perspective (black at bottom): black section at bottom
  const isWhiteAtBottom = playerColor === 'white'

  return (
    <div
      className={`relative h-full overflow-hidden rounded-lg border-2 border-white/[0.04] shadow-card ${className}`}
      style={{ width, height, marginTop: offsetTop }}
    >
      {/* Top section with liquid effect */}
      <div
        className={`absolute top-0 left-0 right-0 ${
          isWhiteAtBottom ? 'bg-surface-1' : 'bg-white'
        }`}
        style={{
          height: isWhiteAtBottom
            ? `${100 - whiteAdvantagePercent}%`  // Black section when white at bottom
            : `${whiteAdvantagePercent}%`,        // White section when black at bottom
          transition: 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', // Spring-like bounce
        }}
      >
        {/* Flat depth overlay */}
        <div className={`absolute inset-0 ${
          isWhiteAtBottom
            ? 'bg-surface-2'
            : 'bg-surface-3'
        }`} />
      </div>

      {/* Bottom section with liquid effect */}
      <div
        className={`absolute bottom-0 left-0 right-0 ${
          isWhiteAtBottom ? 'bg-white' : 'bg-surface-1'
        }`}
        style={{
          height: isWhiteAtBottom
            ? `${whiteAdvantagePercent}%`         // White section when white at bottom
            : `${100 - whiteAdvantagePercent}%`,  // Black section when black at bottom
          transition: 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', // Spring-like bounce
        }}
      >
        {/* Flat depth overlay */}
        <div className={`absolute inset-0 ${
          isWhiteAtBottom
            ? 'bg-surface-3'
            : 'bg-surface-2'
        }`} />
      </div>

      {/* Liquid wave effect at the boundary */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: isWhiteAtBottom
            ? `${100 - whiteAdvantagePercent}%`
            : `${whiteAdvantagePercent}%`,
          transform: 'translateY(-50%)',
          transition: 'top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          height: '6px',
          zIndex: 10
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 6"
          preserveAspectRatio="none"
          className="w-full h-full opacity-40"
        >
          <path
            d="M 0 3 Q 12.5 0, 25 3 T 50 3 T 75 3 T 100 3 L 100 6 L 0 6 Z"
            fill="rgba(148, 163, 184, 0.5)"
            style={{
              animation: 'wave 2s ease-in-out infinite'
            }}
          />
        </svg>
      </div>

      {/* Center line marker */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-500/40" />

      {/* Position indicator with glow */}
      <div
        className="absolute left-0 right-0 flex justify-center"
        style={{
          top: `${clamp(markerPosition, 2, 98)}%`,
          transition: 'top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
          zIndex: 20
        }}
      >
        <span className="block h-1 w-full bg-orange-400 transition-colors duration-500 ease-out"
              style={{
                boxShadow: '0 0 8px rgba(251, 146, 60, 0.8), 0 0 4px rgba(251, 146, 60, 0.6)'
              }} />
      </div>

      <style>{`
        @keyframes shimmerBlob {
          0%, 100% {
            transform: translate(-20%, -30%) scale(1);
            opacity: 0.6;
          }
          25% {
            transform: translate(30%, 20%) scale(1.2);
            opacity: 0.9;
          }
          50% {
            transform: translate(60%, -10%) scale(0.9);
            opacity: 1;
          }
          75% {
            transform: translate(20%, 40%) scale(1.1);
            opacity: 0.8;
          }
        }

        @keyframes shimmerBlob2 {
          0%, 100% {
            transform: translate(20%, 30%) scale(1);
            opacity: 0.5;
          }
          33% {
            transform: translate(-30%, -20%) scale(1.3);
            opacity: 0.8;
          }
          66% {
            transform: translate(10%, 50%) scale(0.8);
            opacity: 0.9;
          }
        }

        @keyframes colorBlobShift {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
            opacity: 0.7;
          }
          25% {
            transform: translate(-30%, 20%) scale(1.3);
            opacity: 0.9;
          }
          50% {
            transform: translate(20%, -30%) scale(0.9);
            opacity: 1;
          }
          75% {
            transform: translate(-10%, 40%) scale(1.2);
            opacity: 0.8;
          }
        }

        @keyframes colorBlobShift2 {
          0%, 100% {
            transform: translate(0%, 0%) scale(1);
            opacity: 0.6;
          }
          30% {
            transform: translate(30%, -20%) scale(1.2);
            opacity: 0.9;
          }
          60% {
            transform: translate(-20%, 30%) scale(1.1);
            opacity: 1;
          }
          90% {
            transform: translate(10%, -10%) scale(0.9);
            opacity: 0.7;
          }
        }

        @keyframes gentlePulse {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes shadowPulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes wave {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(2%);
          }
        }
      `}</style>
    </div>
  )
}

const NAVIGATION_ICONS: Record<'first' | 'prev' | 'next' | 'last', string> = {
  first: '<<',
  prev: '<',
  next: '>',
  last: '>>'
}

// Helper function to get text color based on move classification
const getMoveTextColor = (classification: string): string => {
  const colorMap: Record<string, string> = {
    brilliant: 'text-purple-200',
    best: 'text-emerald-200',
    great: 'text-teal-200',
    excellent: 'text-cyan-200',
    good: 'text-sky-200',
    acceptable: 'text-gray-300',
    inaccuracy: 'text-amber-200',
    mistake: 'text-orange-200',
    blunder: 'text-rose-200',
    uncategorized: 'text-gray-300'
  }
  return colorMap[classification] || 'text-white'
}

// Helper function to get badge styles based on move classification
const getMoveQualityColor = (classification: string): string => {
  const colorMap: Record<string, string> = {
    brilliant: 'text-purple-300 bg-purple-500/20 shadow-card',
    best: 'text-emerald-300 bg-emerald-500/20 shadow-card',
    great: 'text-teal-300 bg-teal-500/20 shadow-card',
    excellent: 'text-cyan-300 bg-cyan-500/20 shadow-card',
    good: 'text-sky-300 bg-sky-500/20 shadow-card',
    acceptable: 'text-gray-400 bg-surface-1 shadow-card',
    inaccuracy: 'text-amber-300 bg-amber-500/20 shadow-card',
    mistake: 'text-orange-300 bg-orange-500/20 shadow-card',
    blunder: 'text-rose-300 bg-rose-500/20 shadow-card',
    uncategorized: 'text-gray-400 bg-surface-1 shadow-card'
  }
  return colorMap[classification] || 'text-gray-400 bg-surface-1 shadow-card'
}


const getGamePhase = (moveNumber: number, fen: string): string => {
  // Count pieces from FEN
  const piecePlacement = fen.split(' ')[0]
  const pieceCount = piecePlacement.replace(/[^a-zA-Z]/g, '').length

  // Opening: first 10 moves with most pieces on board
  if (moveNumber <= 10 && pieceCount >= 28) {
    return 'OPENING PHASE'
  }

  // Endgame: few pieces remaining (kings + 5 or fewer other pieces)
  if (pieceCount <= 7) {
    return 'ENDGAME'
  }

  // Middlegame: everything else
  return 'MIDDLEGAME'
}

const normalizeGamePhase = (phase: string): string => {
  // Normalize backend phase names to uppercase
  const phaseMap: Record<string, string> = {
    'opening': 'OPENING PHASE',
    'opening phase': 'OPENING PHASE',
    'middlegame': 'MIDDLEGAME',
    'endgame': 'ENDGAME',
  }
  return phaseMap[phase.toLowerCase()] || phase.toUpperCase()
}

const getGamePhaseColor = (phase: string): string => {
  const colorMap: Record<string, string> = {
    'OPENING PHASE': 'text-blue-400',
    'MIDDLEGAME': 'text-amber-400',
    'ENDGAME': 'text-purple-400',
  }
  return colorMap[phase] || 'text-gray-500'
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
  isExploringFollowUp = false,
  isFreeExploration = false,
  explorationMoves = [],
  explorationAnalysis,
  onExploringChange,
  onExitFreeExploration,
  onResetExploration,
  onUndoExplorationMove,
  onAddExplorationMove,
  onPieceDrop,
  isLoadingAIComments = false,
  className = ''
}: UnifiedChessAnalysisProps) {

  // Chess sound integration
  const { soundEnabled, volume } = useChessSoundSettings()
  const { playSound } = useChessSound({ enabled: soundEnabled, volume })
  const prevIndexRef = useRef(currentIndex)
  const [isMoveListOpen, setIsMoveListOpen] = useState(false)
  const [showMoveAnalysis, setShowMoveAnalysis] = useState(true)
  // State to track user-drawn arrows (right-click drag) - these will be rendered via ModernChessArrows
  const [userDrawnArrows, setUserDrawnArrows] = useState<ModernArrow[]>([])
  const desktopBoardContainerRef = useRef<HTMLDivElement>(null)
  const mobileBoardContainerRef = useRef<HTMLDivElement>(null)

  // Use exploration analysis if available, otherwise use current move
  const currentScore = useMemo(() => {
    // If exploring, use the exploration analysis evaluation
    if ((isExploringFollowUp || isFreeExploration) && explorationAnalysis && !explorationAnalysis.isAnalyzing) {
      const score = explorationAnalysis.evaluation.scoreForWhite * 100
      return score
    }

    // The evaluation bar should show the position evaluation from White's perspective
    // evaluation.value is ALWAYS from White's perspective (positive = white ahead)
    // scoreForPlayer is calculated for the move's player, not the viewing player
    // So we should use evaluation.value directly, NOT scoreForPlayer
    if (!currentMove) {
      return 0
    }

    // CRITICAL: Check if the position after the move is in checkmate
    // If so, the winning side should show dominance in the evaluation bar
    try {
      if (currentMove.fenAfter) {
        const chess = new Chess(currentMove.fenAfter)
        if (chess.isCheckmate()) {
          // The side to move is the one in checkmate (the losing side)
          // If it's White's turn, White is in checkmate, so Black wins -> return -1000
          // If it's Black's turn, Black is in checkmate, so White wins -> return +1000
          const isWhiteToMove = chess.turn() === 'w'
          return isWhiteToMove ? -1000 : 1000
        }
      }
    } catch (error) {
      // If FEN parsing fails, fall through to normal evaluation logic
      console.warn('Failed to parse FEN for checkmate detection:', error)
    }

    // For mate positions, evaluation.value is the mate value from White's perspective
    // Positive = white wins (mate in N), negative = black wins (mate in -N)
    // If value is 0 (old bug), treat as unknown and use a neutral score
    if (currentMove.evaluation?.type === 'mate') {
      const mateValue = currentMove.evaluation.value
      if (mateValue === 0) {
        // Old bug: mate evaluations were stored as 0, fallback to checking if it's actually a mate
        // Try to detect checkmate from FEN if available
        try {
          if (currentMove.fenAfter) {
            const chess = new Chess(currentMove.fenAfter)
            if (chess.isCheckmate()) {
              const isWhiteToMove = chess.turn() === 'w'
              return isWhiteToMove ? -1000 : 1000
            }
          }
        } catch (error) {
          // Ignore errors, fall through to neutral
        }
        return 0
      }
      return mateValue > 0 ? 1000 : -1000
    }

    // Use evaluation.value directly - it's always from White's perspective
    // This is what the EvaluationBar expects (positive = white ahead, negative = black ahead)
    return currentMove.evaluation?.value || 0
  }, [currentMove, isExploringFollowUp, isFreeExploration, explorationAnalysis, playerColor])

  // Generate arrows from exploration analysis if available
  const displayArrows = useMemo(() => {

    const arrows: ModernArrow[] = []

    // Add user-drawn arrows (right-click drag) - these are orange
    arrows.push(...userDrawnArrows)

    // If exploring and we have analysis with a best move, show arrow for that
    if ((isExploringFollowUp || isFreeExploration) && explorationAnalysis?.bestMove) {
      arrows.push({
        from: explorationAnalysis.bestMove.from,
        to: explorationAnalysis.bestMove.to,
        color: 'rgb(74, 222, 128)', // Green for exploration best move
        classification: 'best',
        isBestMove: true
      })
    } else {
      // Otherwise use the current move arrows
      arrows.push(...currentMoveArrows)
    }

    return arrows
  }, [isExploringFollowUp, isFreeExploration, explorationAnalysis, currentMoveArrows, userDrawnArrows])

  // Handler to intercept user-drawn arrows from react-chessboard
  // This will be called when user right-clicks and drags to draw an arrow
  const handleArrowsChange = React.useCallback((arrows: Array<[string, string, string?]>) => {

    const modernArrows: ModernArrow[] = arrows.map(([from, to, color]) => ({
      from: from as any,
      to: to as any,
      color: color || 'rgb(255, 170, 0)', // Default to orange
      classification: 'uncategorized',
      isBestMove: false,
      isUserMove: true
    }))

    setUserDrawnArrows(modernArrows)
  }, [])

  // Clear user-drawn arrows when position changes
  useEffect(() => {
    setUserDrawnArrows([])
  }, [currentPosition])

  // Effect to actively hide react-chessboard's native arrow rendering
  // This ensures native arrows are always hidden, even if CSS doesn't catch them
  useEffect(() => {
    const hideNativeArrows = (container: HTMLElement | null) => {
      if (!container) return

      // Find all SVG elements that are not our ModernChessArrows
      const allSvgs = container.querySelectorAll('svg')

      allSvgs.forEach((svg) => {
        // Skip our ModernChessArrows
        if (svg.classList.contains('modern-chess-arrows')) {
          return
        }

        // Check if it contains arrow elements
        const hasArrowPath = svg.querySelector('path[stroke]')
        const hasArrowPolygon = svg.querySelector('polygon[fill]')
        const hasArrowLine = svg.querySelector('line[stroke]')

        // If it has arrow-like elements and is positioned absolutely, hide it
        if ((hasArrowPath || hasArrowPolygon || hasArrowLine) &&
            (svg.getAttribute('style')?.includes('position: absolute') ||
             svg.getAttribute('style')?.includes('position:absolute'))) {
          ;(svg as HTMLElement).style.display = 'none'
          // Also hide all children just in case
          svg.querySelectorAll('path, polygon, line').forEach((el) => {
            ;(el as HTMLElement).style.display = 'none'
          })
        }
      })
    }

    const hideAllNativeArrows = () => {
      hideNativeArrows(desktopBoardContainerRef.current)
      hideNativeArrows(mobileBoardContainerRef.current)
    }

    // Hide arrows immediately
    hideAllNativeArrows()

    // Use MutationObserver to watch for new arrows being added
    const observers: MutationObserver[] = []

    if (desktopBoardContainerRef.current) {
      const observer = new MutationObserver(hideAllNativeArrows)
      observer.observe(desktopBoardContainerRef.current, {
        childList: true,
        subtree: true
      })
      observers.push(observer)
    }

    if (mobileBoardContainerRef.current) {
      const observer = new MutationObserver(hideAllNativeArrows)
      observer.observe(mobileBoardContainerRef.current, {
        childList: true,
        subtree: true
      })
      observers.push(observer)
    }

    // Also check periodically as a fallback
    const interval = setInterval(hideAllNativeArrows, 50)

    return () => {
      observers.forEach(obs => obs.disconnect())
      clearInterval(interval)
    }
  }, [currentPosition, boardWidth])

  // Note: Native arrow hiding is now handled purely by CSS in index.css
  // DOM manipulation via JS was causing coordinate calculation issues during piece drags

  const mobileBoardSize = Math.min(boardWidth, 400)
  const mobileEvaluationBarWidth = Math.max(12, Math.round(mobileBoardSize * 0.04))
  const desktopEvaluationBarWidth = Math.max(18, Math.round(boardWidth * 0.04))
  const mobileEvaluationBarHeight = mobileBoardSize * 0.92
  const desktopEvaluationBarHeight = boardWidth * 0.92
  const mobileEvaluationBarOffset = (mobileBoardSize - mobileEvaluationBarHeight) / 2 + mobileBoardSize * 0.02
  const desktopEvaluationBarOffset = (boardWidth - desktopEvaluationBarHeight) / 2 + boardWidth * 0.02

  // Auto-scroll to current move in timeline
  const timelineRef = useRef<HTMLDivElement>(null)
  const mobileTimelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scrollTimeline = (container: HTMLElement | null) => {
      if (!container || !currentMove) return

      const moveRowIndex = Math.floor(currentMove.index / 2)
      const tableRows = container.querySelectorAll('tbody tr')
      const targetRow = tableRows[moveRowIndex] as HTMLElement

      if (targetRow) {
        const containerRect = container.getBoundingClientRect()
        const targetRect = targetRow.getBoundingClientRect()
        const relativeTop = targetRect.top - containerRect.top + container.scrollTop
        const containerHeight = container.clientHeight
        const targetHeight = targetRect.height
        const scrollToPosition = relativeTop - (containerHeight / 2) + (targetHeight / 2)

        container.scrollTo({
          top: Math.max(0, scrollToPosition),
          behavior: 'smooth'
        })
      }
    }

    // Scroll both desktop and mobile timelines
    scrollTimeline(timelineRef.current)
    scrollTimeline(mobileTimelineRef.current)
  }, [currentMove, currentIndex, allMoves.length])

  // Play sound when navigating to a new move
  useEffect(() => {
    // Don't play sound on initial mount or if index hasn't changed
    if (prevIndexRef.current === currentIndex) {
      return
    }

    // Play sound when navigating to a move (forward or backward)
    if (currentMove && currentIndex > 0) {
      const soundType = getMoveSoundSimple(currentMove.san)
      playSound(soundType)
    }

    prevIndexRef.current = currentIndex
  }, [currentIndex, currentMove, playSound])

  return (
    <>
      <div className={`rounded-lg bg-surface-1 p-4 lg:p-6 shadow-card ${className}`}>
        {/* Mobile Layout: Stacked */}
        <div className="flex flex-col gap-4 lg:hidden">
        {/* Mobile: chessdata.app Badge */}
        <div className="flex items-center justify-center mb-2">
          <div className="inline-flex items-center gap-2 rounded-full shadow-card px-3 py-1 text-xs uppercase tracking-wide text-cyan-100 font-semibold bg-cyan-500/20">
              <span>chessdata.app</span>
            </div>
        </div>

        {/* Mobile: Evaluation Bar + Chess Board */}
        <div className="flex justify-center gap-5">
          {/* Mobile: Evaluation Bar */}
          <div
            className="flex-shrink-0 flex items-center"
            style={{ height: `${mobileBoardSize}px` }}
          >
            <EvaluationBar
              score={currentScore}
              playerColor={playerColor}
              width={mobileEvaluationBarWidth}
              className="relative"
              height={mobileEvaluationBarHeight}
              offsetTop={mobileEvaluationBarOffset}
            />
          </div>

          {/* Mobile: Chess Board */}
          <div className="flex-shrink-0">
            <div ref={mobileBoardContainerRef} className="relative" style={{ width: `${mobileBoardSize}px`, height: `${mobileBoardSize}px` }}>
              <Chessboard
                id="unified-analysis-board-mobile"
                position={currentPosition}
                arePiecesDraggable={true}
                onPieceDrop={onPieceDrop}
                boardOrientation={playerColor}
                boardWidth={mobileBoardSize}
                showBoardNotation={true}
                  onArrowsChange={handleArrowsChange}

                {...getDarkChessBoardTheme('default')}
              />
                {/* Show arrows unless in follow-up mode (follow-up has its own UI) */}
                {!isExploringFollowUp && (
                  <ModernChessArrows
                    arrows={displayArrows}
                    boardWidth={mobileBoardSize}
                    boardOrientation={playerColor}
                    squareSize={mobileBoardSize / 8}
                  />
                )}
            </div>
          </div>

          {/* Mobile: Symmetry spacer to balance evaluation bar width */}
          <div
            className="flex-shrink-0"
            style={{
              height: `${mobileBoardSize}px`,
              width: `${mobileEvaluationBarWidth}px`,
              marginTop: `${mobileEvaluationBarOffset}px`
            }}
            aria-hidden="true"
          />
        </div>

          {/* Mobile Navigation Controls */}
          <div className="mt-4 flex flex-col items-center justify-center gap-3 text-sm text-gray-300">
            <div className="text-xs text-gray-500">Use ← → arrow keys or tap buttons to navigate</div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onMoveNavigation(0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(0)
                  }
                }}
                className="btn-touch-sm rounded-full shadow-card bg-white/10 transition-colors hover:bg-white/[0.04]"
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
                className="btn-touch-sm rounded-full shadow-card bg-white/10 transition-colors hover:bg-white/[0.04]"
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
                className="btn-touch-sm rounded-full shadow-card bg-white/10 transition-colors hover:bg-white/[0.04]"
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
                className="btn-touch-sm rounded-full shadow-card bg-white/10 transition-colors hover:bg-white/[0.04]"
                aria-label="Last move"
              >
                {NAVIGATION_ICONS.last}
              </button>
            </div>
          </div>

          {/* Mobile: Current Move Analysis */}
          {currentMove && showMoveAnalysis && (
            <div className="mt-4 rounded-lg bg-surface-1 p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {currentMove.san}
                  </h3>
                  <span className="text-xs text-gray-500">
                    Move {currentMove.moveNumber} • {currentMove.isUserMove ? 'You' : 'Opponent'}
                  </span>
                </div>
                <button
                  onClick={() => setShowMoveAnalysis(false)}
                  className="text-gray-500 hover:text-white transition-colors p-1"
                  aria-label="Hide analysis"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <EnhancedMoveCoaching move={currentMove} className="text-xs" />

              {/* Mobile Follow-Up Explorer */}
              {currentMove && onExploringChange && onResetExploration && onUndoExplorationMove && (
                <div className="mt-3">
                  <FollowUpExplorer
                    currentMove={currentMove}
                    isExploring={isExploringFollowUp}
                    explorationMoves={explorationMoves}
                    onExploringChange={onExploringChange}
                    onResetExploration={onResetExploration}
                    onUndoExplorationMove={onUndoExplorationMove}
                    onAddExplorationMove={onAddExplorationMove}
                  />
                </div>
              )}
            </div>
          )}

          {/* Mobile: Exploration Analysis */}
          {!currentMove && isFreeExploration && explorationAnalysis && (
            <div className="mt-4 rounded-lg bg-blue-500/10 p-4 shadow-card">
              <h3 className="text-sm font-semibold text-blue-300 mb-2">Position Analysis</h3>
              <div className="space-y-2">
                {explorationAnalysis.isAnalyzing ? (
                  <p className="text-gray-300 text-xs leading-relaxed flex items-center gap-2">
                    <svg className="animate-spin h-3 w-3 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </p>
                ) : explorationAnalysis.error ? (
                  <p className="text-red-300 text-xs">{explorationAnalysis.error}</p>
                ) : (
                  <>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      {explorationAnalysis.bestMove ? (
                        <>
                          <span className="font-semibold text-blue-300">Best: {explorationAnalysis.bestMove.san}</span>
                          {' '}Eval: {explorationAnalysis.evaluation.type === 'mate'
                            ? `M${Math.abs(explorationAnalysis.evaluation.value)}`
                            : `${explorationAnalysis.evaluation.scoreForWhite > 0 ? '+' : ''}${(explorationAnalysis.evaluation.scoreForWhite).toFixed(2)}`
                          }
                        </>
                      ) : (
                        <>
                          Eval: {explorationAnalysis.evaluation.type === 'mate'
                            ? `M${Math.abs(explorationAnalysis.evaluation.value)}`
                            : `${explorationAnalysis.evaluation.scoreForWhite > 0 ? '+' : ''}${(explorationAnalysis.evaluation.scoreForWhite).toFixed(2)}`
                          }
                        </>
                      )}
                    </p>
                    {explorationAnalysis.pvLine && explorationAnalysis.pvLine.length > 0 && (
                      <p className="text-gray-400 text-xs">
                        <span className="font-semibold">Line:</span> {explorationAnalysis.pvLine.slice(0, 3).join(' ')}
                        {explorationAnalysis.pvLine.length > 3 && '...'}
                      </p>
                    )}
                    <p className="text-gray-400 text-xs leading-relaxed pt-1 border-t border-white/10">
                      {(() => {
                        const moveCount = explorationMoves.length
                        if (moveCount <= 10) {
                          return 'Develop pieces and control the center.'
                        } else if (moveCount <= 30) {
                          return 'Look for tactics and coordinate pieces.'
                        } else {
                          return 'Activate king and push passed pawns.'
                        }
                      })()}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mobile Free Exploration Indicator - Show regardless of currentMove */}
          {isFreeExploration && onExitFreeExploration && (
            <div className="mt-3 rounded-lg shadow-card bg-blue-500/10 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <span className="text-sm font-medium text-blue-300">
                      Free Exploration
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/80">
                    {explorationMoves.length === 0
                      ? 'Drag pieces to explore variations from this position'
                      : `Exploring: ${explorationMoves.join(' ')}`
                    }
                  </p>
                </div>
                <button
                  onClick={onExitFreeExploration}
                  className="flex items-center gap-1.5 rounded-lg shadow-card bg-surface-1 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.04]"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Exit
                </button>
              </div>
              {explorationMoves.length > 0 && onResetExploration && onUndoExplorationMove && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={onUndoExplorationMove}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg shadow-card bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Undo
                  </button>
                  <button
                    onClick={onResetExploration}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg shadow-card bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Reset
                  </button>
                </div>
              )}
            </div>
          )}

          {!showMoveAnalysis && currentMove && (
            <button
              onClick={() => setShowMoveAnalysis(true)}
              className="mt-4 w-full rounded-lg shadow-card bg-surface-1 p-3 text-sm text-gray-400 hover:bg-white/[0.04] transition-colors"
            >
              Show Move Analysis
            </button>
          )}

          {/* Mobile: Moves List Accordion */}
          <div className="mt-4">
            <button
              onClick={() => setIsMoveListOpen(!isMoveListOpen)}
              className="w-full flex items-center justify-between rounded-lg shadow-card bg-surface-1 p-4 text-left hover:bg-white/[0.04] transition-colors"
              aria-expanded={isMoveListOpen}
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isMoveListOpen ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-white">All Moves</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{allMoves.length} moves in this game</p>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {isMoveListOpen ? 'Hide' : 'Show'}
              </div>
            </button>

            <div
              className={`overflow-hidden transition-colors duration-300 ease-in-out ${
                isMoveListOpen ? 'max-h-[400px] opacity-100 mt-3' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="rounded-lg shadow-card bg-surface-1 p-3">
                <div ref={mobileTimelineRef} className="max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-surface-3 scrollbar-track-transparent">
                  <table className="w-full table-fixed text-left">
                    <thead className="sticky top-0 bg-surface-1 z-10">
                      <tr className="text-xs uppercase text-gray-500 border-b border-white/10">
                        <th className="w-12 py-2 px-1">No.</th>
                        <th className="w-1/2 py-2 px-1">You</th>
                        <th className="w-1/2 py-2 px-1">Opponent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: Math.ceil(allMoves.length / 2) }).map((_, row) => {
                        const move1 = allMoves[row * 2]
                        const move2 = allMoves[row * 2 + 1]

                        // Determine which move is the user's and which is the opponent's
                        // based on isUserMove flag, not just color (white/black)
                        const userMove = move1?.isUserMove ? move1 : move2
                        const opponentMove = move1?.isUserMove ? move2 : move1

                        return (
                          <tr key={row} className="border-b border-white/5 last:border-b-0">
                            <td className="py-2 px-1 text-xs text-gray-500 font-medium">{row + 1}</td>
                            <td className="py-2 px-1">
                              {userMove ? (
                                <button
                                  onClick={() => onMoveNavigation(userMove.index + 1)}
                                  className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors duration-200 gap-1 ${
                                    currentIndex === userMove.index + 1
                                      ? 'bg-white/25 text-white shadow-md shadow-black/40 scale-[1.02]'
                                      : 'bg-white/5 text-gray-300 hover:bg-white/15 active:scale-95'
                                  }`}
                                >
                                  <span className="text-xs font-medium truncate">{userMove.san}</span>
                                  <MoveClassificationBadge classification={userMove.classification} />
                                </button>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
                              )}
                            </td>
                            <td className="py-2 px-1">
                              {opponentMove ? (
                                <button
                                  onClick={() => onMoveNavigation(opponentMove.index + 1)}
                                  className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors duration-200 gap-1 ${
                                    currentIndex === opponentMove.index + 1
                                      ? 'bg-white/25 text-white shadow-md shadow-black/40 scale-[1.02]'
                                      : 'bg-white/5 text-gray-300 hover:bg-white/15 active:scale-95'
                                  }`}
                                >
                                  <span className="text-xs font-medium truncate">{opponentMove.san}</span>
                                  <MoveClassificationBadge classification={opponentMove.classification} />
                                </button>
                              ) : (
                                <span className="text-gray-600 text-xs">—</span>
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

        {/* Desktop Layout: Side by Side */}
        <div className="hidden lg:flex gap-8 items-start">
        {/* Left: Evaluation Bar */}
        <div className="flex-shrink-0 flex flex-col">
          {/* Spacer to match Game Phase Indicator height */}
          {currentMove && (
            <div className="h-[40px] mb-4"></div>
          )}
          <div className="flex items-center justify-center" style={{ height: `${boardWidth}px` }}>
            <EvaluationBar
              score={currentScore}
              playerColor={playerColor}
              width={desktopEvaluationBarWidth}
              className="relative"
              height={desktopEvaluationBarHeight}
              offsetTop={desktopEvaluationBarOffset}
            />
          </div>
        </div>

        {/* Center: Chess Board */}
        <div className="flex-shrink-0 flex flex-col items-center">
          {/* Desktop: chessdata.app Badge */}
          <div className="flex items-center justify-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-full shadow-card px-4 py-1.5 text-sm uppercase tracking-wide text-cyan-100 font-semibold bg-cyan-500/20">
              <span>chessdata.app</span>
            </div>
          </div>

          <div ref={desktopBoardContainerRef} className="relative" style={{ width: `${boardWidth}px`, height: `${boardWidth}px` }}>
            <Chessboard
              id="unified-analysis-board"
              position={currentPosition}
              arePiecesDraggable={true}
              onPieceDrop={onPieceDrop}
              boardOrientation={playerColor}
              boardWidth={boardWidth}
              showBoardNotation={true}
                  onArrowsChange={handleArrowsChange}

              {...getDarkChessBoardTheme('default')}
            />
              {/* Modern Chess Arrows */}
              {!isExploringFollowUp && (
                <ModernChessArrows
                  arrows={displayArrows}
                  boardWidth={boardWidth}
                  boardOrientation={playerColor}
                  squareSize={boardWidth / 8}
                />
              )}
          </div>

          {/* Navigation Controls */}
          <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-gray-300">
            <div className="text-xs text-gray-500">Use ← → arrow keys or click buttons to navigate</div>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onMoveNavigation(0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onMoveNavigation(0)
                  }
                }}
                className="rounded-full shadow-card bg-white/10 px-2 py-1 transition-colors hover:bg-white/[0.04]"
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
                className="rounded-full shadow-card bg-white/10 px-2 py-1 transition-colors hover:bg-white/[0.04]"
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
                className="rounded-full shadow-card bg-white/10 px-2 py-1 transition-colors hover:bg-white/[0.04]"
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
                className="rounded-full shadow-card bg-white/10 px-2 py-1 transition-colors hover:bg-white/[0.04]"
                aria-label="Last move"
              >
                {NAVIGATION_ICONS.last}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Move Analysis */}
        <div className="flex-1 min-w-0">
          <div className="rounded-lg bg-surface-1 p-6 shadow-card h-full">
            {/* Current Move Analysis Section */}
            <div className="mb-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Move</h3>
                    {isLoadingAIComments && (
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-transparent"></div>
                        <span className="text-xs text-purple-300">Coach Tal loading...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className={`text-3xl font-semibold ${
                      currentMove ? getMoveTextColor(currentMove.classification) :
                      isFreeExploration && explorationMoves.length > 0 ? 'text-sky-300' : 'text-white'
                    }`}>
                      {currentMove ? currentMove.san :
                       isFreeExploration && explorationMoves.length > 0 ? explorationMoves[explorationMoves.length - 1] :
                       '—'}
                    </div>
                    {/* Show evaluation badge for exploration mode */}
                    {isFreeExploration && explorationAnalysis && !explorationAnalysis.isAnalyzing && explorationMoves.length > 0 && (() => {
                      const evalScore = Math.abs(explorationAnalysis.evaluation.scoreForWhite)
                      let badge = { text: 'Good', color: 'text-sky-300 bg-sky-500/20 shadow-card' }

                      if (evalScore < 0.15) {
                        badge = { text: 'Best', color: 'text-emerald-300 bg-emerald-500/20 shadow-card' }
                      } else if (evalScore < 0.35) {
                        badge = { text: 'Excellent', color: 'text-sky-300 bg-sky-500/20 shadow-card' }
                      } else if (evalScore < 0.75) {
                        badge = { text: 'Good', color: 'text-sky-300 bg-sky-500/20 shadow-card' }
                      } else if (evalScore < 1.5) {
                        badge = { text: 'Acceptable', color: 'text-amber-300 bg-amber-500/20 shadow-card' }
                      } else {
                        badge = { text: 'Inaccuracy', color: 'text-orange-300 bg-orange-500/20 shadow-card' }
                      }

                      return (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                          {badge.text}
                        </span>
                      )
                    })()}
                    {/* Show classification badge for normal moves */}
                    {currentMove && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMoveQualityColor(currentMove.classification)}`}>
                        {getClassificationLabel(currentMove.classification)}
                      </span>
                    )}
                    {/* Show game phase badge */}
                    {currentMove && (() => {
                      const rawPhase = currentMove.gamePhase || getGamePhase(currentMove.moveNumber, currentMove.fenAfter || currentMove.fenBefore || '')
                      const gamePhase = normalizeGamePhase(rawPhase)
                      return (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold shadow-card bg-surface-2/40 ${getGamePhaseColor(gamePhase)}`}>
                          {gamePhase}
                        </span>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {currentMove ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                    <span>{currentMove.isUserMove ? 'Your move' : 'Opponent move'}</span>
                    <span className="h-px w-8 bg-white/20" />
                    <span>Move {currentMove.moveNumber}</span>
                  </div>

                  {/* Enhanced Coaching Display */}
                  <EnhancedMoveCoaching move={currentMove} className="text-sm" />

                  {/* Desktop Follow-Up Explorer */}
                  {onExploringChange && onResetExploration && onUndoExplorationMove && (
                    <div className="pt-2">
                      <FollowUpExplorer
                        currentMove={currentMove}
                        isExploring={isExploringFollowUp}
                        explorationMoves={explorationMoves}
                        onExploringChange={onExploringChange}
                        onResetExploration={onResetExploration}
                        onUndoExplorationMove={onUndoExplorationMove}
                        onAddExplorationMove={onAddExplorationMove}
                      />
                    </div>
                  )}
                </div>
              ) : isFreeExploration && explorationAnalysis && !explorationAnalysis.isAnalyzing ? (
                <>
                  {/* Create a mock ProcessedMove from exploration analysis to use the same coaching component */}
                  {(() => {
                    const evalText = explorationAnalysis.evaluation.type === 'mate'
                      ? `Mate in ${Math.abs(explorationAnalysis.evaluation.value)}`
                      : `${explorationAnalysis.evaluation.scoreForWhite > 0 ? '+' : ''}${(explorationAnalysis.evaluation.scoreForWhite).toFixed(2)}`

                    // Create coaching comment - let EnhancedMoveCoaching add the positional guidance
                    let coachingComment = ''
                    if (explorationAnalysis.bestMove) {
                      coachingComment = `Best move is ${explorationAnalysis.bestMove.san}. This maintains a strong position and keeps options open.`
                    } else {
                      coachingComment = 'Continue to look for the best continuation in this position.'
                    }

                    // Determine classification and encouragement level based on evaluation
                    let classification: 'best' | 'excellent' | 'good' | 'acceptable' | 'uncategorized' = 'uncategorized'
                    let encouragementLevel = 3
                    const evalScore = Math.abs(explorationAnalysis.evaluation.scoreForWhite)

                    if (evalScore < 0.15) {
                      classification = 'best'
                      encouragementLevel = 5
                    } else if (evalScore < 0.35) {
                      classification = 'excellent'
                      encouragementLevel = 4
                    } else if (evalScore < 0.75) {
                      classification = 'good'
                      encouragementLevel = 4
                    } else if (evalScore < 1.5) {
                      classification = 'acceptable'
                      encouragementLevel = 3
                    }

                    // Create a mock ProcessedMove object that matches the normal move format
                    const mockMove: ProcessedMove = {
                      index: currentIndex,
                      ply: explorationMoves.length + 1,
                      moveNumber: Math.floor(explorationMoves.length / 2) + 1,
                      player: explorationMoves.length % 2 === 0 ? 'white' : 'black',
                      isUserMove: true,
                      san: explorationMoves.length > 0 ? explorationMoves[explorationMoves.length - 1] : '',
                      bestMoveSan: explorationAnalysis.bestMove?.san || null,
                      evaluation: explorationAnalysis.evaluation,
                      scoreForPlayer: explorationAnalysis.evaluation.scoreForWhite,
                      displayEvaluation: evalText,
                      centipawnLoss: null,
                      classification: classification,
                      explanation: coachingComment,
                      fenBefore: currentPosition,
                      fenAfter: currentPosition,
                      coachingComment: coachingComment,
                      encouragementLevel: encouragementLevel,
                      // Don't set moveQuality to avoid showing the bottom badge
                      gamePhase: explorationMoves.length <= 10 ? 'opening' : explorationMoves.length <= 30 ? 'middlegame' : 'endgame'
                    }

                    return (
                      <EnhancedMoveCoaching move={mockMove} className="text-sm" />
                    )
                  })()}
                </>
              ) : isFreeExploration && explorationAnalysis?.isAnalyzing ? (
                <div className="bg-surface-2 p-4 rounded-lg border-l-4 border-sky-400 lg:h-48 flex flex-col">
                  <p className="text-gray-300 leading-relaxed flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing position with Stockfish...
                  </p>
                </div>
              ) : isFreeExploration && explorationAnalysis?.error ? (
                <div className="bg-surface-2 p-4 rounded-lg border-l-4 border-rose-400 lg:h-48 flex flex-col">
                  <p className="text-red-300">{explorationAnalysis.error}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Use the move timeline to explore Stockfish feedback for each position.</p>
              )}

              {/* Desktop Free Exploration Indicator - Show regardless of currentMove */}
              {isFreeExploration && onExitFreeExploration && (
                <div className="pt-2 rounded-lg shadow-card bg-blue-500/10 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                        </svg>
                        <span className="text-sm font-medium text-blue-300">
                          Free Exploration
                        </span>
                      </div>
                      <p className="text-xs text-blue-200/80">
                        {explorationMoves.length === 0
                          ? 'Drag pieces to explore variations from this position'
                          : `Exploring: ${explorationMoves.join(' ')}`
                        }
                      </p>
                    </div>
                    <button
                      onClick={onExitFreeExploration}
                      className="flex items-center gap-1.5 rounded-lg shadow-card bg-surface-1 px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.04]"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Exit
                    </button>
                  </div>
                  {explorationMoves.length > 0 && onResetExploration && onUndoExplorationMove && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={onUndoExplorationMove}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg shadow-card bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Undo
                      </button>
                      <button
                        onClick={onResetExploration}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg shadow-card bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="my-8 h-px" style={{ background: 'rgba(255,255,255,0.03)' }}></div>

            {/* Move Timeline Section */}
            <div>
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Move Timeline</h3>
                <div className="text-xs text-gray-500 mt-1">← → to navigate moves • Scroll to see all moves</div>
              </div>
              <div ref={timelineRef} className="max-h-[200px] overflow-y-auto pr-2 text-sm scrollbar-hide">
                <table className="w-full table-fixed text-left">
                  <thead className="sticky top-0 bg-surface-base">
                    <tr className="text-xs uppercase text-gray-500">
                      <th className="w-14 py-2">Move</th>
                      <th className="w-1/2 py-2">You</th>
                      <th className="w-1/2 py-2">Opponent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(allMoves.length / 2) }).map((_, row) => {
                      const move1 = allMoves[row * 2]
                      const move2 = allMoves[row * 2 + 1]

                      // Determine which move is the user's and which is the opponent's
                      // based on isUserMove flag, not just color (white/black)
                      const userMove = move1?.isUserMove ? move1 : move2
                      const opponentMove = move1?.isUserMove ? move2 : move1

                      return (
                        <tr key={row} className="border-b border-white/10 last:border-b-0">
                          <td className="py-2 pr-2 text-xs text-gray-500">{row + 1}</td>
                          <td className="py-2 pr-2">
                            {userMove ? (
                              <button
                                onClick={() => onMoveNavigation(userMove.index + 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onMoveNavigation(userMove.index + 1)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors gap-1 ${
                                  currentIndex === userMove.index + 1
                                    ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                <span className="text-xs font-medium truncate">{userMove.san}</span>
                                <MoveClassificationBadge classification={userMove.classification} />
                              </button>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {opponentMove ? (
                              <button
                                onClick={() => onMoveNavigation(opponentMove.index + 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onMoveNavigation(opponentMove.index + 1)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors gap-1 ${
                                  currentIndex === opponentMove.index + 1
                                    ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                              >
                                <span className="text-xs font-medium truncate">{opponentMove.san}</span>
                                <MoveClassificationBadge classification={opponentMove.classification} />
                              </button>
                            ) : (
                              <span className="text-gray-600">—</span>
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
    </>
  )
}
