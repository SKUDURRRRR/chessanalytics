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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0d0f]/90 p-4"
      onClick={onClose}
    >
      <div
        className={`rounded-lg ${
          playerWon
            ? 'bg-emerald-500/10'
            : resultType === 'draw' || resultType === 'stalemate'
            ? 'bg-amber-500/10'
            : 'bg-sky-500/10'
        } bg-surface-1 p-8 text-center shadow-card max-w-md w-full mx-4 ${
          isAnimating ? 'animate-pulse' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2 className={`text-3xl font-semibold mb-4 ${
          playerWon ? 'text-emerald-300' : resultType === 'draw' || resultType === 'stalemate' ? 'text-amber-300' : 'text-sky-300'
        }`}>
          {getTitle()}
        </h2>

        {/* Messages */}
        <div className="space-y-3 mb-6">
          {getMessage().map((msg, index) => (
            <p
              key={index}
              className={`text-sm ${
                index === 0 ? 'text-white font-semibold' : 'text-gray-400'
              }`}
            >
              {msg}
            </p>
          ))}
        </div>

        {/* Result Details */}
        <div className="mb-6 p-4 rounded-lg bg-surface-1/50 shadow-card">
          <p className="text-sm text-gray-500 mb-1">Game Result</p>
          <p className="text-lg font-semibold text-white capitalize">
            {resultType === 'checkmate'
              ? `${playerWon ? 'You' : 'Tal Coach'} won by checkmate`
              : resultType === 'stalemate'
              ? 'Stalemate'
              : 'Draw'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            You played as <span className="capitalize font-semibold text-gray-400">{playerColor}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {onReviewGame && (
            <button
              onClick={onReviewGame}
              disabled={isAnalyzing}
              className="flex-1 py-3 px-6 rounded-lg font-medium shadow-card bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? 'Analyzing...' : 'Review Game'}
            </button>
          )}
          <button
            onClick={onNewGame}
            disabled={isAnalyzing}
            className={`flex-1 py-3 px-6 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              playerWon
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-sky-500 hover:bg-sky-600 text-white'
            }`}
          >
            {getButtonText()}
          </button>
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="flex-1 py-3 px-6 rounded-lg font-medium shadow-card bg-surface-1 text-gray-400 hover:bg-white/[0.04] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
