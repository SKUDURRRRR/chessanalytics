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
  'e4', 'd6', 'Nf3', 'Nf6', 'Bc4', 'h6',
]

const DEMO_CLASSIFICATIONS = [
  'good', 'good', 'best', 'good', 'good', 'excellent',
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
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-2 pb-6">
        {/* Board + Chat */}
        <div
          className="rounded-lg overflow-hidden mb-6"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)', background: '#0c0d0f' }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: 460 }}>
            {/* Left: Board */}
            <div className="flex flex-col items-center justify-center px-5 py-6 md:pl-8 md:pr-4">
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
    <div style={{ width: 320 }}>
      <Chessboard
        id="coach-dashboard-board"
        position={fen}
        arePiecesDraggable={false}
        boardWidth={320}
        showBoardNotation={false}
        {...getDarkChessBoardTheme('default')}
      />

      {/* Move info bar */}
      <div
        style={{
          width: 320,
          marginTop: 16,
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {currentMove ? (
            <>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f0' }}>{currentMove}</span>
              {classificationLabel && (
                <span className={badgeColor} style={{ fontSize: 9, fontWeight: 600, borderRadius: 9999, padding: '2px 8px' }}>
                  {classificationLabel}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 14, color: '#6b7280' }}>Starting position</span>
          )}
        </div>

        {/* Navigation arrows */}
        <div style={{ display: 'flex', gap: 4 }}>
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
              style={{
                fontSize: 9,
                color: btn.disabled ? '#374151' : '#6b7280',
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 4,
                padding: '2px 6px',
                cursor: btn.disabled ? 'default' : 'pointer',
                border: 'none',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opening info */}
      {currentMove && (
        <div style={{ width: 320, marginTop: 8, fontSize: 10, color: '#6b7280', lineHeight: '1.5' }}>
          {DEMO_OPENING} · Move {moveNumber} · {isWhiteMove ? 'White' : 'Black'}
        </div>
      )}
    </div>
  )
}
