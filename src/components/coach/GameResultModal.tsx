/**
 * Game Result Modal
 * Shows celebration or encouragement based on game outcome
 */

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

interface GameResultModalProps {
  isOpen: boolean
  onClose: () => void
  playerWon: boolean
  resultType: 'checkmate' | 'stalemate' | 'draw'
  playerColor: 'white' | 'black'
  onNewGame: () => void
  onReviewGame?: () => void
  isAnalyzing?: boolean
}

export function GameResultModal({
  isOpen,
  onClose,
  playerWon,
  resultType,
  playerColor,
  onNewGame,
  onReviewGame,
  isAnalyzing = false
}: GameResultModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  const getTitle = () => {
    if (resultType === 'checkmate') {
      return playerWon ? 'Congratulations!' : 'Great Game!'
    }
    if (resultType === 'stalemate') {
      return 'Stalemate!'
    }
    return 'Draw!'
  }

  const getMessage = () => {
    if (resultType === 'checkmate') {
      if (playerWon) {
        return [
          'You checkmated Tal Coach!',
          'Your strategic thinking and tactical skills led to victory.',
          'Keep practicing to maintain this level!'
        ]
      } else {
        return [
          'Tal Coach checkmated you this time.',
          'Every game is a learning opportunity.',
          'Review the game to see what you can improve!'
        ]
      }
    }
    if (resultType === 'stalemate') {
      return [
        'The game ended in a stalemate.',
        'Neither side can make a legal move.',
        'A well-fought game by both players!'
      ]
    }
    return [
      'The game ended in a draw.',
      'Both players played well.',
      'Try again to get a decisive result!'
    ]
  }

  const getButtonText = () => {
    if (resultType === 'checkmate' && playerWon) {
      return 'Play Again!'
    }
    return 'Try Again'
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`rounded-3xl border-2 ${
          playerWon
            ? 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_32px_rgba(16,185,129,0.3)]'
            : resultType === 'draw' || resultType === 'stalemate'
            ? 'border-amber-400/50 bg-amber-500/10 shadow-[0_0_32px_rgba(245,158,11,0.3)]'
            : 'border-sky-400/50 bg-sky-500/10 shadow-[0_0_32px_rgba(14,165,233,0.3)]'
        } bg-white/[0.08] p-8 text-center shadow-2xl shadow-black/50 max-w-md w-full mx-4 ${
          isAnimating ? 'animate-pulse' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2 className={`text-3xl font-bold mb-4 ${
          playerWon ? 'text-emerald-300' : resultType === 'draw' || resultType === 'stalemate' ? 'text-amber-300' : 'text-sky-300'
        }`}>
          {getTitle()}
        </h2>

        {/* Messages */}
        <div className="space-y-3 mb-6">
          {getMessage().map((msg, index) => (
            <p
              key={index}
              className={`text-base ${
                index === 0 ? 'text-white font-semibold' : 'text-slate-300'
              }`}
            >
              {msg}
            </p>
          ))}
        </div>

        {/* Result Details */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/50 border border-white/10">
          <p className="text-sm text-slate-400 mb-1">Game Result</p>
          <p className="text-lg font-semibold text-white capitalize">
            {resultType === 'checkmate'
              ? `${playerWon ? 'You' : 'Tal Coach'} won by checkmate`
              : resultType === 'stalemate'
              ? 'Stalemate'
              : 'Draw'}
          </p>
          <p className="text-sm text-slate-400 mt-2">
            You played as <span className="capitalize font-semibold text-slate-300">{playerColor}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {onReviewGame && (
            <button
              onClick={onReviewGame}
              disabled={isAnalyzing}
              className="flex-1 py-3 px-6 rounded-xl font-semibold border border-amber-400/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
            >
              {isAnalyzing ? 'Analyzing...' : 'Review Game'}
            </button>
          )}
          <button
            onClick={onNewGame}
            disabled={isAnalyzing}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              playerWon
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                : 'bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30'
            }`}
          >
            {getButtonText()}
          </button>
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="flex-1 py-3 px-6 rounded-xl font-semibold border border-white/20 bg-white/[0.05] text-slate-300 hover:bg-white/[0.08] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
