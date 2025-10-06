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
      case 'win': return 'bg-green-100 border-green-300'
      case 'loss': return 'bg-red-100 border-red-300'
      case 'draw': return 'bg-yellow-100 border-yellow-300'
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
      <div className={`w-16 h-16 border-2 rounded-lg ${getResultColor(result)} flex items-center justify-center`}>
        <div className="text-center">
          <div className="text-lg font-bold">{getResultIcon(result)}</div>
          <div className="text-xs">{getResultText(result)}</div>
        </div>
      </div>
      
      {/* Game Info Overlay */}
      <div className="absolute -bottom-1 -right-1 bg-white border border-gray-300 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-600">
        {totalMoves || '?'}
      </div>
      
      {/* Opening Info */}
      {opening && (
        <div className="absolute -top-8 left-0 right-0 text-center">
          <div className="text-xs text-gray-600 bg-white px-1 rounded truncate max-w-20">
            {opening.length > 12 ? opening.substring(0, 12) + '...' : opening}
          </div>
        </div>
      )}
    </div>
  )
}
