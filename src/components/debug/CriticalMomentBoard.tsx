import React, { useState, useMemo, useEffect } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'

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

interface CriticalMomentBoardProps {
  move: ProcessedMove
  allMoves: ProcessedMove[]
  playerColor: 'white' | 'black'
  className?: string
}

export function CriticalMomentBoard({ move, allMoves, playerColor, className = '' }: CriticalMomentBoardProps) {
  const [currentMoveIndex, setCurrentMoveIndex] = useState(move.index)
  const [showBestMove, setShowBestMove] = useState(false)
  const [boardWidth, setBoardWidth] = useState(170)

  useEffect(() => {
    const updateBoardWidth = () => {
      if (window.innerWidth < 640) {
        setBoardWidth(140) // Small screens
      } else if (window.innerWidth < 768) {
        setBoardWidth(150) // Medium screens
      } else if (window.innerWidth < 1024) {
        setBoardWidth(160) // Large screens
      } else if (window.innerWidth < 1280) {
        setBoardWidth(170) // XL screens
      } else {
        setBoardWidth(180) // 2XL screens and up
      }
    }
    
    updateBoardWidth()
    window.addEventListener('resize', updateBoardWidth)
    return () => window.removeEventListener('resize', updateBoardWidth)
  }, [])

  const chess = useMemo(() => {
    const game = new Chess()
    // Replay moves up to the current move index
    for (let i = 0; i <= currentMoveIndex; i++) {
      if (allMoves[i]) {
        try {
          const moveData = allMoves[i]
          const { from, to, promotion } = parseUciMove(moveData.san)
          game.move({ from, to, promotion })
        } catch (err) {
          // If UCI parsing fails, try SAN
          try {
            game.move(allMoves[i].san)
          } catch (sanErr) {
            console.warn('Failed to apply move:', allMoves[i].san, sanErr)
          }
        }
      }
    }
    return game
  }, [currentMoveIndex, allMoves])

  const parseUciMove = (move: string) => {
    if (move.length === 4) {
      return {
        from: move.substring(0, 2) as any,
        to: move.substring(2, 4) as any,
        promotion: undefined
      }
    } else if (move.length === 5) {
      return {
        from: move.substring(0, 2) as any,
        to: move.substring(2, 4) as any,
        promotion: move.substring(4, 5) as any
      }
    }
    throw new Error('Invalid UCI move format')
  }

  const getCurrentFen = () => {
    return chess.fen()
  }

  const getBestMoveFen = () => {
    if (!move.bestMoveSan || !move.fenBefore) return null
    
    try {
      const game = new Chess(move.fenBefore)
      game.move(move.bestMoveSan)
      return game.fen()
    } catch (err) {
      console.warn('Failed to apply best move:', move.bestMoveSan, err)
      return null
    }
  }

  const getDisplayFen = () => {
    if (showBestMove && currentMoveIndex === move.index) {
      return getBestMoveFen() || getCurrentFen()
    }
    return getCurrentFen()
  }

  const getEvaluationColor = (evaluation: { type: 'cp' | 'mate'; value: number } | null) => {
    if (!evaluation) return 'text-slate-400'
    
    if (evaluation.type === 'mate') {
      return evaluation.value > 0 ? 'text-green-400' : 'text-red-400'
    }
    
    const score = evaluation.value
    if (score > 200) return 'text-green-400'
    if (score > 50) return 'text-green-300'
    if (score > -50) return 'text-slate-300'
    if (score > -200) return 'text-red-300'
    return 'text-red-400'
  }

  const getEvaluationBarData = (evaluation: { type: 'cp' | 'mate'; value: number } | null) => {
    if (!evaluation) return { percentage: 50, color: 'bg-slate-500', text: '0.0' }
    
    if (evaluation.type === 'mate') {
      const isWhiteWinning = evaluation.value > 0
      return {
        percentage: isWhiteWinning ? 100 : 0,
        color: isWhiteWinning ? 'bg-green-500' : 'bg-red-500',
        text: evaluation.value > 0 ? `+M${evaluation.value}` : `-M${Math.abs(evaluation.value)}`
      }
    }
    
    const score = evaluation.value
    const maxScore = 1000 // Cap at 1000 centipawns for bar display
    const clampedScore = Math.max(-maxScore, Math.min(maxScore, score))
    const percentage = 50 + (clampedScore / maxScore) * 50
    
    let color = 'bg-slate-500'
    if (score > 200) color = 'bg-green-500'
    else if (score > 50) color = 'bg-green-400'
    else if (score > -50) color = 'bg-slate-500'
    else if (score > -200) color = 'bg-red-400'
    else color = 'bg-red-500'
    
    return {
      percentage: Math.max(0, Math.min(100, percentage)),
      color,
      text: score > 0 ? `+${(score / 100).toFixed(1)}` : `${(score / 100).toFixed(1)}`
    }
  }

  const getMoveHighlight = () => {
    if (currentMoveIndex !== move.index) return {}
    
    try {
      const currentMove = allMoves[currentMoveIndex]
      if (!currentMove) return {}
      
      const game = new Chess()
      // Replay moves up to the current move
      for (let i = 0; i < currentMoveIndex; i++) {
        if (allMoves[i]) {
          try {
            const { from, to, promotion } = parseUciMove(allMoves[i].san)
            game.move({ from, to, promotion })
          } catch (err) {
            try {
              game.move(allMoves[i].san)
            } catch (sanErr) {
              console.warn('Failed to apply move:', allMoves[i].san, sanErr)
            }
          }
        }
      }
      
      const moveObj = game.move(currentMove.san)
      if (moveObj) {
        return {
          [moveObj.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' },
          [moveObj.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
        }
      }
    } catch (err) {
      console.warn('Failed to highlight move:', allMoves[currentMoveIndex]?.san, err)
    }
    return {}
  }

  const getBestMoveHighlight = () => {
    if (!move.bestMoveSan || currentMoveIndex !== move.index) return {}
    
    try {
      const game = new Chess()
      // Replay moves up to the critical move
      for (let i = 0; i < move.index; i++) {
        if (allMoves[i]) {
          try {
            const { from, to, promotion } = parseUciMove(allMoves[i].san)
            game.move({ from, to, promotion })
          } catch (err) {
            try {
              game.move(allMoves[i].san)
            } catch (sanErr) {
              console.warn('Failed to apply move:', allMoves[i].san, sanErr)
            }
          }
        }
      }
      
      const moveObj = game.move(move.bestMoveSan)
      if (moveObj) {
        return {
          [moveObj.from]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' },
          [moveObj.to]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' }
        }
      }
    } catch (err) {
      console.warn('Failed to highlight best move:', move.bestMoveSan, err)
    }
    return {}
  }

  const getSquareStyles = () => {
    if (showBestMove && currentMoveIndex === move.index) {
      return getBestMoveHighlight()
    }
    return getMoveHighlight()
  }

  const currentMove = allMoves[currentMoveIndex]
  const isAtCriticalMove = currentMoveIndex === move.index
  const canGoBack = currentMoveIndex > 0
  const canGoForward = currentMoveIndex < allMoves.length - 1

  const navigateToMove = (direction: 'prev' | 'next' | 'first' | 'last' | 'critical') => {
    switch (direction) {
      case 'prev':
        if (canGoBack) setCurrentMoveIndex(currentMoveIndex - 1)
        break
      case 'next':
        if (canGoForward) setCurrentMoveIndex(currentMoveIndex + 1)
        break
      case 'first':
        setCurrentMoveIndex(0)
        break
      case 'last':
        setCurrentMoveIndex(allMoves.length - 1)
        break
      case 'critical':
        setCurrentMoveIndex(move.index)
        setShowBestMove(false)
        break
    }
  }

  return (
    <div className={`space-y-2 w-full max-w-[400px] ${className}`}>
      {/* Board with custom coordinate styling */}
      <div className="relative bg-slate-800/20 rounded-lg p-4 pb-6">
        <style>{`
          #critical-moment-${move.index} .react-chessboard-notation {
            font-size: 5px !important;
            font-weight: 500 !important;
          }
        `}</style>
        <div className="flex justify-center">
          <Chessboard
            id={`critical-moment-${move.index}`}
            position={getDisplayFen()}
            arePiecesDraggable={false}
            boardOrientation={playerColor}
            boardWidth={boardWidth}
            showNotation={true}
            customSquareStyles={getSquareStyles()}
            {...getDarkChessBoardTheme('default')}
          />
        </div>
      </div>

      {/* Move Info Header */}
      <div className="text-center bg-slate-800/30 rounded-lg p-2">
        <div className="text-base font-bold text-white">
          Move {move.moveNumber} • {move.player === 'white' ? 'White' : 'Black'}
        </div>
        <div className="text-sm font-bold text-emerald-300 mt-0.5">
          {move.san}
        </div>
        {move.bestMoveSan && (
          <div className="text-xs text-slate-400 mt-0.5">
            Best: <span className="text-emerald-300 font-semibold">{move.bestMoveSan}</span>
          </div>
        )}
      </div>

      {/* Compact Navigation - Minimal */}
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => navigateToMove('first')}
          disabled={!canGoBack}
          className="rounded p-1 text-[10px] bg-slate-600/20 text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="First move"
        >
          ⏮
        </button>
        <button
          onClick={() => navigateToMove('prev')}
          disabled={!canGoBack}
          className="rounded p-1 text-[10px] bg-slate-600/20 text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous move"
        >
          ◀
        </button>
        <button
          onClick={() => navigateToMove('critical')}
          className={`rounded p-1 text-[10px] transition ${
            isAtCriticalMove 
              ? 'bg-amber-500/30 text-amber-200' 
              : 'bg-amber-600/20 text-slate-300 hover:bg-amber-600/40'
          }`}
          title="Go to critical moment"
        >
          🎯
        </button>
        <button
          onClick={() => navigateToMove('next')}
          disabled={!canGoForward}
          className="rounded p-1 text-[10px] bg-slate-600/20 text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next move"
        >
          ▶
        </button>
        <button
          onClick={() => navigateToMove('last')}
          disabled={!canGoForward}
          className="rounded p-1 text-[10px] bg-slate-600/20 text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Last move"
        >
          ⏭
        </button>
      </div>

      {/* Show Best Button - Only if at critical move */}
      {isAtCriticalMove && move.bestMoveSan && (
        <button
          onClick={() => setShowBestMove(!showBestMove)}
          className={`w-full rounded py-1 text-[10px] font-medium transition ${
            showBestMove
              ? 'bg-emerald-500/20 text-emerald-200'
              : 'bg-slate-600/20 text-slate-300 hover:bg-slate-600/40'
          }`}
        >
          {showBestMove ? '✓ Best' : 'Show Best'}
        </button>
      )}
    </div>
  )
}
