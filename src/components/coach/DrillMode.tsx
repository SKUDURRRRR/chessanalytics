/**
 * Drill Mode Component
 * Sequential position drill for opening practice using interactive chessboard
 */

import { useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'

interface DrillPosition {
  fen: string
  move_number: number
  your_move: string
  classification: string
  description: string
}

interface DrillModeProps {
  positions: DrillPosition[]
  openingName: string
  onComplete: (correct: number, total: number) => void
  onClose: () => void
}

export function DrillMode({ positions, openingName, onComplete, onClose }: DrillModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [finished, setFinished] = useState(false)

  const theme = getDarkChessBoardTheme()
  const current = positions[currentIndex]

  const handleAnswer = (knew: boolean) => {
    const newResults = [...results, knew]
    setResults(newResults)
    setShowAnswer(false)

    if (currentIndex + 1 < positions.length) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setFinished(true)
      const correct = newResults.filter(Boolean).length
      onComplete(correct, newResults.length)
    }
  }

  if (!positions.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <p className="text-slate-400">No drill positions available for this opening.</p>
        <button onClick={onClose} className="mt-4 text-sm text-emerald-400 hover:text-emerald-300">
          Close
        </button>
      </div>
    )
  }

  if (finished) {
    const correct = results.filter(Boolean).length
    const pct = Math.round((correct / results.length) * 100)
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <h3 className="text-xl font-bold text-white mb-2">Drill Complete</h3>
        <p className="text-slate-300 mb-1">{openingName}</p>
        <p className="text-3xl font-bold text-emerald-400 my-4">{correct}/{results.length}</p>
        <p className="text-slate-400 text-sm mb-6">{pct}% correct</p>
        <button
          onClick={onClose}
          className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 px-6 rounded-xl transition-colors"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{openingName} Drill</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            {currentIndex + 1} / {positions.length}
          </span>
          <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-300">
            Close
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-80 flex-shrink-0">
          <Chessboard
            position={current.fen}
            boardWidth={320}
            arePiecesDraggable={false}
            customDarkSquareStyle={theme.customDarkSquareStyle}
            customLightSquareStyle={theme.customLightSquareStyle}
          />
        </div>

        <div className="flex-1">
          <p className="text-slate-300 text-sm mb-4">{current.description}</p>

          {!showAnswer ? (
            <div>
              <p className="text-white font-medium mb-3">What went wrong here?</p>
              <button
                onClick={() => setShowAnswer(true)}
                className="bg-white/[0.08] hover:bg-white/[0.12] text-white py-2 px-4 rounded-xl text-sm transition-colors"
              >
                Show Answer
              </button>
            </div>
          ) : (
            <div>
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 mb-4">
                <p className="text-sm text-rose-300">
                  You played <span className="font-bold">{current.your_move}</span> ({current.classification})
                </p>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Did you recognize the issue before seeing the answer?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAnswer(true)}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 py-2 px-4 rounded-xl text-sm transition-colors"
                >
                  Yes, I knew
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  className="bg-white/[0.06] hover:bg-white/[0.10] text-slate-300 border border-white/10 py-2 px-4 rounded-xl text-sm transition-colors"
                >
                  No, need practice
                </button>
              </div>
            </div>
          )}

          {/* Progress dots */}
          <div className="flex gap-1.5 mt-6">
            {positions.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < results.length
                    ? results[i]
                      ? 'bg-emerald-500'
                      : 'bg-rose-500'
                    : i === currentIndex
                      ? 'bg-white'
                      : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
