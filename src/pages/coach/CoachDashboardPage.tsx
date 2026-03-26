/**
 * Coach Dashboard Page
 * Integrated board + chat layout with Coach Tal
 */

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import { getMoveClassificationBgColor } from '../../utils/chessColors'
import { InlineCoachChat } from '../../components/coach/InlineCoachChat'
import { useCoachUser } from '../../hooks/useCoachUser'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'
import { BookOpen, Puzzle, TrendingUp, Swords, FolderOpen, CalendarDays } from 'lucide-react'
import type { ChatPositionContext } from '../../types'

// Demo game moves (Pirc Defense) for initial board state
const DEMO_MOVES = [
  'e4', 'd6', 'Nf3', 'Nf6', 'd3', 'h6', 'Bc4',
]

const DEMO_CLASSIFICATIONS = [
  'good', 'good', 'best', 'good', 'acceptable', 'excellent', 'good',
]

const DEMO_OPENING = 'Pirc Defense'

export default function CoachDashboardPage() {
  const { authenticatedUserId, platformUsername, isLoading } = useCoachUser()

  return (
    <CoachPageGuard isLoading={isLoading} authenticatedUserId={authenticatedUserId} platformUsername={platformUsername}>
      <CoachDashboardContent />
    </CoachPageGuard>
  )
}

function CoachDashboardContent() {
  const [moveIndex, setMoveIndex] = useState(DEMO_MOVES.length - 1)

  // Build chess positions for each move
  const positions = useMemo(() => {
    const game = new Chess()
    const fens: string[] = [game.fen()]
    for (const move of DEMO_MOVES) {
      game.move(move)
      fens.push(game.fen())
    }
    return fens
  }, [])

  const currentFen = positions[moveIndex + 1] || positions[0]
  const currentMove = moveIndex >= 0 ? DEMO_MOVES[moveIndex] : null
  const currentClassification = moveIndex >= 0 ? DEMO_CLASSIFICATIONS[moveIndex] : null
  const moveNumber = Math.floor(moveIndex / 2) + 1
  const isWhiteMove = moveIndex % 2 === 0

  // Position context for the chat
  const [positionContext, setPositionContext] = useState<ChatPositionContext | null>(null)

  useEffect(() => {
    setPositionContext({
      fen: currentFen,
      moveHistory: DEMO_MOVES.slice(0, moveIndex + 1),
      contextType: 'game-review',
      playerColor: 'white',
      moveNumber,
      lastMove: currentMove || undefined,
      moveClassification: currentClassification || undefined,
      gamePhase: 'opening',
    })
  }, [currentFen, moveIndex, currentMove, currentClassification, moveNumber])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') {
        setMoveIndex(prev => Math.max(-1, prev - 1))
      } else if (e.key === 'ArrowRight') {
        setMoveIndex(prev => Math.min(DEMO_MOVES.length - 1, prev + 1))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const goFirst = () => setMoveIndex(-1)
  const goPrev = () => setMoveIndex(prev => Math.max(-1, prev - 1))
  const goNext = () => setMoveIndex(prev => Math.min(DEMO_MOVES.length - 1, prev + 1))
  const goLast = () => setMoveIndex(DEMO_MOVES.length - 1)

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-10">
        {/* Board + Chat */}
        <div
          className="rounded-lg overflow-hidden mb-6"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)', background: '#0c0d0f' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: 420 }}>
            {/* Left: Board */}
            <div className="flex flex-col items-center justify-center p-5 md:p-6">
              <BoardSection
                fen={currentFen}
                currentMove={currentMove}
                classification={currentClassification}
                moveNumber={moveNumber}
                isWhiteMove={isWhiteMove}
                moveIndex={moveIndex}
                totalMoves={DEMO_MOVES.length}
                onFirst={goFirst}
                onPrev={goPrev}
                onNext={goNext}
                onLast={goLast}
              />
            </div>

            {/* Right: Chat */}
            <InlineCoachChat positionContext={positionContext} />
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {QUICK_LINKS.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg px-3 py-3 text-center transition-colors hover:bg-white/[0.04]"
              style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }}
            >
              <link.icon className="w-4 h-4 mx-auto mb-1.5 text-gray-500" />
              <span className="text-[11px] text-gray-400 font-medium">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

const QUICK_LINKS = [
  { to: '/coach/review', label: 'Game Review', icon: BookOpen },
  { to: '/coach/puzzles', label: 'Puzzles', icon: Puzzle },
  { to: '/coach/progress', label: 'Progress', icon: TrendingUp },
  { to: '/coach/play', label: 'Play Tal', icon: Swords },
  { to: '/coach/openings', label: 'Openings', icon: FolderOpen },
  { to: '/coach/study-plan', label: 'Study Plan', icon: CalendarDays },
]

interface BoardSectionProps {
  fen: string
  currentMove: string | null
  classification: string | null
  moveNumber: number
  isWhiteMove: boolean
  moveIndex: number
  totalMoves: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
}

function BoardSection({
  fen,
  currentMove,
  classification,
  moveNumber,
  isWhiteMove,
  moveIndex,
  totalMoves,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: BoardSectionProps) {
  const classificationLabel = classification
    ? classification.charAt(0).toUpperCase() + classification.slice(1)
    : null
  const badgeColor = classification
    ? getMoveClassificationBgColor(classification)
    : ''

  return (
    <div className="w-full max-w-[360px]">
      <Chessboard
        id="coach-dashboard-board"
        position={fen}
        arePiecesDraggable={false}
        boardWidth={360}
        showBoardNotation={false}
        {...getDarkChessBoardTheme('default')}
      />

      {/* Move info bar */}
      <div
        className="mt-4 pt-2 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2">
          {currentMove ? (
            <>
              <span className="text-sm font-semibold text-white">{currentMove}</span>
              {classificationLabel && (
                <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 ${badgeColor}`}>
                  {classificationLabel}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-gray-500">Starting position</span>
          )}
        </div>

        {/* Navigation arrows */}
        <div className="flex gap-1">
          {[
            { label: '<<', onClick: onFirst, disabled: moveIndex <= -1 },
            { label: '<', onClick: onPrev, disabled: moveIndex <= -1 },
            { label: '>', onClick: onNext, disabled: moveIndex >= totalMoves - 1 },
            { label: '>>', onClick: onLast, disabled: moveIndex >= totalMoves - 1 },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              disabled={btn.disabled}
              className="text-[9px] text-gray-500 rounded px-1.5 py-0.5 transition-colors hover:text-gray-300 disabled:opacity-30 disabled:cursor-default"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opening info */}
      {currentMove && (
        <div className="mt-2 text-[10px] text-gray-600 leading-relaxed">
          {DEMO_OPENING} · Move {moveNumber} · {isWhiteMove ? 'White' : 'Black'}
        </div>
      )}
    </div>
  )
}
