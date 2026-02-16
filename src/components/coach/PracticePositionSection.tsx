/**
 * Practice Position Section
 * Interactive chessboard for practice positions in lessons.
 * Supports quiz mode (What would you play?) and display-only mode.
 */

import { useState, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { PracticePosition } from '../../types'
import { validateMove, uciToArrow } from '../../utils/moveValidator'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'

interface PracticePositionSectionProps {
  positions: PracticePosition[]
}

export function PracticePositionSection({ positions }: PracticePositionSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null)
  const [userMove, setUserMove] = useState<string | null>(null)

  const position = positions[currentIndex]

  if (!position?.fen) return null

  const game = new Chess(position.fen)
  const boardOrientation = game.turn() === 'w' ? 'white' : 'black'
  const hasQuiz = !!position.correct_move

  const onDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (result !== null || !hasQuiz) return false

    const validation = validateMove(position.fen, sourceSquare, targetSquare, position.correct_move)

    if (!validation.isValid) return false

    setUserMove(validation.moveSan)
    setResult(validation.isCorrect ? 'correct' : 'incorrect')
    return true
  }, [result, hasQuiz, position.fen, position.correct_move])

  const goToPosition = (index: number) => {
    setCurrentIndex(index)
    setResult(null)
    setUserMove(null)
  }

  // Build arrows to show correct move when answer is revealed
  const customArrows: [string, string, string][] = []
  if (result === 'incorrect' && position.correct_move) {
    const arrow = uciToArrow(position.correct_move)
    customArrows.push([arrow[0], arrow[1], 'rgba(34, 197, 94, 0.7)'])
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Practice Positions</h2>
        {positions.length > 1 && (
          <span className="text-sm text-slate-400">
            {currentIndex + 1} of {positions.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Board */}
        <div>
          {hasQuiz && result === null && (
            <p className="text-cyan-400 mb-3 text-center font-medium">
              What would you play? ({game.turn() === 'w' ? 'White' : 'Black'} to move)
            </p>
          )}
          {!hasQuiz && (
            <p className="text-slate-400 mb-3 text-center text-sm">
              Study this position ({game.turn() === 'w' ? 'White' : 'Black'} to move)
            </p>
          )}
          <Chessboard
            position={position.fen}
            onPieceDrop={onDrop}
            boardOrientation={boardOrientation}
            {...getDarkChessBoardTheme('default')}
            arePiecesDraggable={hasQuiz && result === null}
            customArrows={customArrows}
            boardWidth={400}
          />
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          {/* Position description */}
          <div className="rounded-xl bg-slate-900/50 p-4">
            <p className="text-slate-300 text-sm">{position.description}</p>
          </div>

          {/* Result feedback */}
          {result && (
            <div className={`rounded-xl border p-4 ${
              result === 'correct'
                ? 'border-emerald-500/50 bg-emerald-500/10'
                : 'border-red-500/50 bg-red-500/10'
            }`}>
              <h3 className={`text-lg font-bold mb-1 ${
                result === 'correct' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {result === 'correct' ? 'Correct!' : 'Not quite'}
              </h3>
              {userMove && (
                <p className="text-slate-300 text-sm">
                  You played: <span className="font-mono font-bold">{userMove}</span>
                </p>
              )}
              {result === 'incorrect' && position.correct_move && (
                <p className="text-slate-300 text-sm mt-1">
                  Best move: <span className="font-mono font-bold text-emerald-400">{position.correct_move}</span>
                  <span className="text-slate-500 ml-1">(shown as green arrow)</span>
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          {positions.length > 1 && (
            <div className="flex gap-2">
              <button
                onClick={() => goToPosition(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="flex-1 px-4 py-2 border border-white/20 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => goToPosition(Math.min(positions.length - 1, currentIndex + 1))}
                disabled={currentIndex === positions.length - 1}
                className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
