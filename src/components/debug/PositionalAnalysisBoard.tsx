import React, { useState, useMemo, useEffect } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
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

interface PositionalElement {
  name: string
  description: string
  strength: 'strong' | 'moderate' | 'weak'
  moves: number[]
  impact: number
}

interface StrategicTheme {
  name: string
  description: string
  moves: number[]
  importance: 'critical' | 'important' | 'minor'
  playerAdvantage: boolean
}

interface PositionalAnalysisBoardProps {
  element: PositionalElement | StrategicTheme
  allMoves: ProcessedMove[]
  playerColor: 'white' | 'black'
  className?: string
  onMoveChange?: (moveIndex: number, move: ProcessedMove | null, isElementMove: boolean) => void
}

export function PositionalAnalysisBoard({ element, allMoves, playerColor, className = '', onMoveChange }: PositionalAnalysisBoardProps) {
  const [boardWidth, setBoardWidth] = useState(200)

  // Debug logging
  console.log('PositionalAnalysisBoard - element:', element)
  console.log('PositionalAnalysisBoard - allMoves length:', allMoves.length)
  console.log('PositionalAnalysisBoard - playerColor:', playerColor)
  console.log('PositionalAnalysisBoard - element.moves:', element.moves)
  console.log('PositionalAnalysisBoard - first few allMoves:', allMoves.slice(0, 3))

  // Get the moves for this element/theme
  const elementMoves = useMemo(() => {
    return element.moves
      .map(moveIndex => allMoves.find(m => m.index === moveIndex))
      .filter(Boolean) as ProcessedMove[]
  }, [element.moves, allMoves])

  // Initialize currentMoveIndex to the first element move
  const [currentMoveIndex, setCurrentMoveIndex] = useState(() => {
    return element.moves.length > 0 ? element.moves[0] : 0
  })

  // Notify parent when move changes
  useEffect(() => {
    const currentMove = allMoves[currentMoveIndex]
    const isElementMove = currentMove && element.moves.includes(currentMove.index)
    if (onMoveChange && currentMove) {
      onMoveChange(currentMoveIndex, currentMove, isElementMove)
    }
  }, [currentMoveIndex, allMoves, element.moves]) // Removed onMoveChange from dependencies to prevent infinite loop

  useEffect(() => {
    const updateBoardWidth = () => {
      if (window.innerWidth < 640) {
        setBoardWidth(180) // Small screens
      } else if (window.innerWidth < 768) {
        setBoardWidth(220) // Medium screens
      } else if (window.innerWidth < 1024) {
        setBoardWidth(260) // Large screens
      } else if (window.innerWidth < 1280) {
        setBoardWidth(300) // XL screens
      } else {
        setBoardWidth(320) // 2XL screens and up
      }
    }
    
    updateBoardWidth()
    window.addEventListener('resize', updateBoardWidth)
    return () => window.removeEventListener('resize', updateBoardWidth)
  }, [])

  const chess = useMemo(() => {
    console.log('PositionalAnalysisBoard - constructing chess game, currentMoveIndex:', currentMoveIndex)
    const game = new Chess()
    // Replay moves up to the current move index
    for (let i = 0; i <= currentMoveIndex; i++) {
      if (allMoves[i]) {
        console.log(`PositionalAnalysisBoard - applying move ${i}:`, allMoves[i].san)
        try {
          // Try SAN first (most common format)
          game.move(allMoves[i].san)
        } catch (err) {
          console.warn('PositionalAnalysisBoard - SAN failed, trying UCI:', allMoves[i].san, err)
          // If SAN fails, try UCI parsing
          try {
            const moveData = allMoves[i]
            const { from, to, promotion } = parseUciMove(moveData.san)
            game.move({ from, to, promotion })
          } catch (uciErr) {
            console.warn('Failed to apply move:', allMoves[i].san, uciErr)
          }
        }
      }
    }
    console.log('PositionalAnalysisBoard - final FEN:', game.fen())
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
    try {
      const fen = chess.fen()
      console.log('PositionalAnalysisBoard - getCurrentFen:', fen, 'currentMoveIndex:', currentMoveIndex)
      return fen
    } catch (error) {
      console.error('PositionalAnalysisBoard - getCurrentFen error:', error)
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' // Starting position
    }
  }

  const getMoveHighlight = () => {
    if (currentMoveIndex >= allMoves.length) return {}
    
    try {
      const currentMove = allMoves[currentMoveIndex]
      if (!currentMove) return {}
      
      const game = new Chess()
      // Replay moves up to the current move
      for (let i = 0; i < currentMoveIndex; i++) {
        if (allMoves[i]) {
          try {
            game.move(allMoves[i].san)
          } catch (err) {
            try {
              const { from, to, promotion } = parseUciMove(allMoves[i].san)
              game.move({ from, to, promotion })
            } catch (uciErr) {
              console.warn('Failed to apply move:', allMoves[i].san, uciErr)
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

  const getElementMoveHighlight = () => {
    const currentMove = allMoves[currentMoveIndex]
    if (!currentMove || !element.moves.includes(currentMove.index)) return {}
    
    try {
      const game = new Chess()
      // Replay moves up to the current move
      for (let i = 0; i < currentMoveIndex; i++) {
        if (allMoves[i]) {
          try {
            game.move(allMoves[i].san)
          } catch (err) {
            try {
              const { from, to, promotion } = parseUciMove(allMoves[i].san)
              game.move({ from, to, promotion })
            } catch (uciErr) {
              console.warn('Failed to apply move:', allMoves[i].san, uciErr)
            }
          }
        }
      }
      
      const moveObj = game.move(currentMove.san)
      if (moveObj) {
        return {
          [moveObj.from]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' },
          [moveObj.to]: { backgroundColor: 'rgba(0, 255, 0, 0.4)' }
        }
      }
    } catch (err) {
      console.warn('Failed to highlight element move:', currentMove.san, err)
    }
    return {}
  }

  // Note: Square highlighting removed for simplicity with custom board

  const currentMove = allMoves[currentMoveIndex]
  const isElementMove = currentMove && element.moves.includes(currentMove.index)
  const canGoBack = currentMoveIndex > 0
  const canGoForward = currentMoveIndex < allMoves.length - 1

  const navigateToMove = (direction: 'prev' | 'next' | 'first' | 'last' | 'element') => {
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
      case 'element':
        // Go to the first move of this element
        const firstElementMove = element.moves[0]
        const elementMoveIndex = allMoves.findIndex(m => m.index === firstElementMove)
        if (elementMoveIndex !== -1) {
          setCurrentMoveIndex(elementMoveIndex)
        }
        break
    }
  }

  const getElementTypeColor = () => {
    if ('strength' in element) {
      // PositionalElement
      switch (element.strength) {
        case 'strong': return 'text-emerald-300'
        case 'moderate': return 'text-amber-300'
        case 'weak': return 'text-rose-300'
        default: return 'text-slate-300'
      }
    } else {
      // StrategicTheme
      switch (element.importance) {
        case 'critical': return 'text-rose-300'
        case 'important': return 'text-sky-300'
        case 'minor': return 'text-slate-300'
        default: return 'text-slate-300'
      }
    }
  }

  return (
    <div className={`space-y-2 w-full max-w-[400px] ${className}`}>
      {/* Board */}
      <div className="relative bg-slate-800/20 rounded-lg p-4 pb-6">
        <div className="flex justify-center">
          <Chessboard
            id={`positional-analysis-${element.name.replace(/\s+/g, '-').toLowerCase()}`}
            position={getCurrentFen()}
            arePiecesDraggable={false}
            boardOrientation={playerColor}
            boardWidth={boardWidth}
            showNotation={true}
            customSquareStyles={{
              ...getMoveHighlight(),
              ...getElementMoveHighlight()
            }}
            {...getDarkChessBoardTheme('default')}
          />
        </div>
      </div>

      {/* Move Info Header */}
      <div className="text-center bg-slate-800/30 rounded-lg p-2">
        <div className="text-base font-bold text-white">
          Move {Math.floor(currentMoveIndex / 2) + 1} • {currentMove?.player === 'white' ? 'White' : 'Black'}
        </div>
        <div className="text-sm font-bold text-emerald-300 mt-0.5">
          {currentMove?.san}
        </div>
        {isElementMove && (
          <div className={`text-xs font-semibold ${getElementTypeColor()} mt-0.5`}>
            • {element.name}
          </div>
        )}
      </div>

      {/* Navigation Arrows */}
      <div className="flex items-center justify-center gap-1.5">
        <button
          onClick={() => navigateToMove('first')}
          disabled={!canGoBack}
          className="rounded bg-slate-600/20 p-1.5 text-sm text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="First move"
        >
          ⏮
        </button>
        <button
          onClick={() => navigateToMove('prev')}
          disabled={!canGoBack}
          className="rounded bg-slate-600/20 p-1.5 text-sm text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous move"
        >
          ◀
        </button>
        <button
          onClick={() => navigateToMove('element')}
          className={`rounded p-1.5 text-sm transition ${
            isElementMove 
              ? 'bg-green-500/30 text-green-200' 
              : 'bg-green-600/20 text-slate-300 hover:bg-green-600/40'
          }`}
          title={`Go to ${element.name} move`}
        >
          🎯
        </button>
        <button
          onClick={() => navigateToMove('next')}
          disabled={!canGoForward}
          className="rounded bg-slate-600/20 p-1.5 text-sm text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next move"
        >
          ▶
        </button>
        <button
          onClick={() => navigateToMove('last')}
          disabled={!canGoForward}
          className="rounded bg-slate-600/20 p-1.5 text-sm text-slate-300 transition hover:bg-slate-600/40 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Last move"
        >
          ⏭
        </button>
      </div>

      {/* Evaluation Bar */}
      {currentMove?.evaluation && (
        <div className="space-y-1">
          <div className="text-center text-xs text-slate-400">Position Evaluation</div>
          <div className="relative h-3 w-full rounded-full bg-slate-700 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                currentMove.evaluation.type === 'mate' 
                  ? currentMove.evaluation.value > 0 ? 'bg-green-500' : 'bg-red-500'
                  : currentMove.evaluation.value > 200 ? 'bg-green-500' :
                    currentMove.evaluation.value > 50 ? 'bg-green-400' :
                    currentMove.evaluation.value > -50 ? 'bg-slate-500' :
                    currentMove.evaluation.value > -200 ? 'bg-red-400' : 'bg-red-500'
              }`}
              style={{ 
                width: `${currentMove.evaluation.type === 'mate' 
                  ? (currentMove.evaluation.value > 0 ? 100 : 0)
                  : Math.max(0, Math.min(100, 50 + (currentMove.evaluation.value / 10)))
                }%` 
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow-lg">
                {currentMove.evaluation.type === 'mate' 
                  ? (currentMove.evaluation.value > 0 ? `+M${currentMove.evaluation.value}` : `-M${Math.abs(currentMove.evaluation.value)}`)
                  : currentMove.evaluation.value > 0 ? `+${(currentMove.evaluation.value / 100).toFixed(1)}` : `${(currentMove.evaluation.value / 100).toFixed(1)}`
                }
              </span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-500 px-1">
            <span>Black</span>
            <span>Equal</span>
            <span>White</span>
          </div>
        </div>
      )}

      {/* Centipawn loss indicator */}
      {currentMove?.centipawnLoss && Math.abs(currentMove.centipawnLoss) > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs bg-slate-800/30 rounded-lg px-2 py-1.5">
          <div className={`h-3 w-3 rounded-full flex-shrink-0 ${
            currentMove.centipawnLoss > 500 ? 'bg-red-500' : 
            currentMove.centipawnLoss > 200 ? 'bg-orange-500' : 
            currentMove.centipawnLoss > 50 ? 'bg-yellow-500' : 'bg-green-500'
          }`}></div>
          <span className="text-slate-200 font-medium">
            {currentMove.centipawnLoss > 0 ? 'Lost' : 'Gained'} {Math.round(Math.abs(currentMove.centipawnLoss))} cp
          </span>
        </div>
      )}
    </div>
  )
}
