/**
 * Show Follow-Up Button Component
 *
 * Displays a "Show Follow-Up" button similar to Chess.com's interface
 * that demonstrates the tactical/positional sequence after a move.
 */

import { useState } from 'react'
import { Chess } from 'chess.js'

interface ShowFollowUpButtonProps {
  // The current FEN position after the move
  fenAfter: string
  // Optional follow-up moves in SAN notation
  followUpMoves?: string[]
  // The move classification
  classification: string
  // Whether this is a critical move (mistake, blunder, or brilliant)
  isCritical: boolean
  // Callback when follow-up is shown/hidden
  onToggle?: (isShowing: boolean) => void
}

export function ShowFollowUpButton({
  fenAfter,
  followUpMoves = [],
  classification,
  isCritical,
  onToggle
}: ShowFollowUpButtonProps) {
  const [isShowing, setIsShowing] = useState(false)

  // Only show the button for critical moves (mistakes, blunders, brilliant moves)
  if (!isCritical) {
    return null
  }

  const handleClick = () => {
    const newState = !isShowing
    setIsShowing(newState)
    if (onToggle) {
      onToggle(newState)
    }
  }

  // Generate follow-up sequence if not provided
  const sequence = followUpMoves.length > 0
    ? followUpMoves
    : generateFollowUpSequence(fenAfter, classification)

  return (
    <div className="mt-2">
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-sm text-white transition-all duration-200"
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isShowing ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>{isShowing ? 'Hide Follow-Up' : 'Show Follow-Up'}</span>
      </button>

      {isShowing && sequence.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-white/10">
          <div className="text-xs text-slate-400 mb-2">
            {classification === 'brilliant'
              ? 'Best continuation:'
              : classification === 'blunder' || classification === 'mistake'
              ? 'What could have happened:'
              : 'Follow-up sequence:'}
          </div>
          <div className="flex flex-wrap gap-2">
            {sequence.map((move, idx) => (
              <div
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-sm text-white"
              >
                {idx > 0 && idx % 2 === 0 && (
                  <span className="text-slate-500 mr-1">{Math.floor(idx / 2) + 1}.</span>
                )}
                {move}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Generate a follow-up sequence for demonstration purposes
 * In a real implementation, this would use the chess engine
 */
function generateFollowUpSequence(fenAfter: string, classification: string): string[] {
  try {
    const chess = new Chess(fenAfter)
    const moves: string[] = []

    // For brilliant moves, show a few continuation moves
    // For mistakes/blunders, show what the opponent could have done
    // This is a simplified implementation - in production, you'd use engine analysis

    const legalMoves = chess.moves()
    if (legalMoves.length === 0) {
      return []
    }

    // Generate 2-3 plausible moves as a demonstration
    // In production, these would come from engine analysis
    const numMoves = classification === 'brilliant' ? 3 : 2

    for (let i = 0; i < numMoves && chess.moves().length > 0; i++) {
      const moves = chess.moves()
      // Pick a capture if available, otherwise a check, otherwise first move
      const move = moves.find(m => m.includes('x'))
                || moves.find(m => m.includes('+'))
                || moves[0]

      if (move) {
        chess.move(move)
        moves.push(move)
      }
    }

    return moves
  } catch (error) {
    console.error('Error generating follow-up sequence:', error)
    return []
  }
}

/**
 * Enhanced version with arrows visualization
 */
interface ShowFollowUpWithArrowsProps extends ShowFollowUpButtonProps {
  // Callback to update board arrows
  onArrowsChange?: (arrows: Array<{ from: string; to: string; color: string }>) => void
}

export function ShowFollowUpWithArrows({
  fenAfter,
  followUpMoves = [],
  classification,
  isCritical,
  onToggle,
  onArrowsChange
}: ShowFollowUpWithArrowsProps) {
  const [isShowing, setIsShowing] = useState(false)

  if (!isCritical) {
    return null
  }

  const handleClick = () => {
    const newState = !isShowing
    setIsShowing(newState)

    if (newState && onArrowsChange) {
      // Generate arrows for the follow-up sequence
      const arrows = generateFollowUpArrows(fenAfter, followUpMoves, classification)
      onArrowsChange(arrows)
    } else if (!newState && onArrowsChange) {
      // Clear arrows when hiding
      onArrowsChange([])
    }

    if (onToggle) {
      onToggle(newState)
    }
  }

  const sequence = followUpMoves.length > 0
    ? followUpMoves
    : generateFollowUpSequence(fenAfter, classification)

  return (
    <div className="mt-2">
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-sm text-white transition-all duration-200"
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isShowing ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>{isShowing ? 'Hide Follow-Up' : 'Show Follow-Up'}</span>
      </button>

      {isShowing && sequence.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-slate-800/50 border border-white/10">
          <div className="text-xs text-slate-400 mb-2">
            {classification === 'brilliant'
              ? 'Best continuation:'
              : classification === 'blunder' || classification === 'mistake'
              ? 'What could have happened:'
              : 'Follow-up sequence:'}
          </div>
          <div className="flex flex-wrap gap-2">
            {sequence.map((move, idx) => {
              const moveNumber = Math.floor(idx / 2) + 1
              const isWhiteMove = idx % 2 === 0

              return (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-sm text-white"
                >
                  {isWhiteMove && (
                    <span className="text-slate-500 mr-1">{moveNumber}.</span>
                  )}
                  {move}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Generate arrows for follow-up sequence visualization
 */
function generateFollowUpArrows(
  fenAfter: string,
  followUpMoves: string[],
  classification: string
): Array<{ from: string; to: string; color: string }> {
  try {
    const chess = new Chess(fenAfter)
    const arrows: Array<{ from: string; to: string; color: string }> = []

    // Color based on classification
    const arrowColor = classification === 'brilliant'
      ? '#10b981' // green for brilliant moves
      : classification === 'blunder' || classification === 'mistake'
      ? '#ef4444' // red for mistakes/blunders
      : '#3b82f6' // blue for other moves

    const sequence = followUpMoves.length > 0
      ? followUpMoves
      : generateFollowUpSequence(fenAfter, classification)

    // Generate arrow for first move in sequence
    if (sequence.length > 0) {
      const move = chess.move(sequence[0])
      if (move) {
        arrows.push({
          from: move.from,
          to: move.to,
          color: arrowColor
        })
      }
    }

    return arrows
  } catch (error) {
    console.error('Error generating follow-up arrows:', error)
    return []
  }
}
