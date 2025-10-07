import React from 'react'

interface MiniChessBoardProps {
  gameId: string
  result: 'win' | 'loss' | 'draw'
  opening?: string
  totalMoves?: number
  className?: string
}

export function MiniChessBoard({ gameId, result, opening, totalMoves, className = '' }: MiniChessBoardProps) {
  const getResultColor = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win':
        return 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
      case 'loss':
        return 'border-rose-400/40 bg-rose-500/20 text-rose-100'
      case 'draw':
        return 'border-amber-400/40 bg-amber-500/20 text-amber-100'
    }
  }

  const getResultIcon = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win': return 'W'
      case 'loss': return 'L'
      case 'draw': return '='
    }
  }

  const getResultText = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win': return 'Win'
      case 'loss': return 'Loss'
      case 'draw': return 'Draw'
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Mini Chess Board Placeholder */}
      <div className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 ${getResultColor(result)} shadow-lg shadow-black/30`}>
        <div className="text-center font-semibold">
          <div className="text-lg">{getResultIcon(result)}</div>
          <div className="text-[10px] uppercase tracking-wide">{getResultText(result)}</div>
        </div>
      </div>
      
      
    </div>
  )
}
