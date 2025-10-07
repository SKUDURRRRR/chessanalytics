import React from 'react'
import { Chessboard } from 'react-chessboard'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'

export function ChessBoardTest() {
  return (
    <div className="p-4">
      <h2 className="text-white text-xl mb-4">Chess Board Test</h2>
      <div className="flex justify-center">
        <Chessboard
          id="test-board"
          position="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
          arePiecesDraggable={false}
          boardOrientation="white"
          boardWidth={200}
          {...getDarkChessBoardTheme('default')}
        />
      </div>
    </div>
  )
}
