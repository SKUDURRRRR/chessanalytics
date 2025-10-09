import React from 'react'
import { Square } from 'react-chessboard'

export interface ModernArrow {
  from: Square
  to: Square
  color: string
  classification: string
  isBestMove?: boolean
}

interface ModernChessArrowsProps {
  arrows: ModernArrow[]
  boardWidth: number
  boardOrientation: 'white' | 'black'
}

export function ModernChessArrows({ arrows, boardWidth, boardOrientation }: ModernChessArrowsProps) {
  const squareSize = boardWidth / 8

  // Convert square to pixel coordinates
  const squareToPixels = (square: Square) => {
    const file = square.charCodeAt(0) - 97 // 'a' = 0, 'b' = 1, etc.
    const rank = parseInt(square[1]) - 1 // '1' = 0, '2' = 1, etc.
    
    // Calculate base coordinates (center of square)
    let x = file * squareSize + squareSize / 2
    let y = rank * squareSize + squareSize / 2
    
    // Adjust for board orientation
    if (boardOrientation === 'black') {
      x = (7 - file) * squareSize + squareSize / 2
      y = (7 - rank) * squareSize + squareSize / 2
    }
    
    return { x, y }
  }

  // Calculate arrow head base point for straight arrows
  const getArrowHeadBase = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Calculate the base point of the arrow head (where the line ends)
    const headLength = squareSize * 0.4
    const ratio = headLength / distance
    
    const baseX = to.x - dx * ratio
    const baseY = to.y - dy * ratio
    
    return { baseX, baseY }
  }

  // Get arrow head points for a filled triangle
  const getArrowHead = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const angle = Math.atan2(dy, dx)
    
    const headLength = squareSize * 0.4
    const headWidth = squareSize * 0.25 // Slightly smaller for more professional look
    
    // Arrow tip point
    const tipX = to.x
    const tipY = to.y
    
    // Base of arrow head - calculated from the new function
    const { baseX, baseY } = getArrowHeadBase(from, to)
    
    // Left and right points of arrow head
    const leftX = baseX - headWidth * Math.cos(angle + Math.PI / 2)
    const leftY = baseY - headWidth * Math.sin(angle + Math.PI / 2)
    
    const rightX = baseX - headWidth * Math.cos(angle - Math.PI / 2)
    const rightY = baseY - headWidth * Math.sin(angle - Math.PI / 2)
    
    return { tipX, tipY, leftX, leftY, rightX, rightY, baseX, baseY }
  }

  // Get gradient colors based on classification
  const getGradientColors = (classification: string, isBestMove: boolean = false) => {
    if (isBestMove) {
      return {
        start: '#10b981', // Bright green for best move suggestion
        end: '#059669',
        strokeWidth: 4 // More professional thickness
      }
    }

    switch (classification) {
      case 'brilliant':
        return { start: '#8b5cf6', end: '#7c3aed', strokeWidth: 3 } // Purple gradient
      case 'best':
        return { start: '#10b981', end: '#059669', strokeWidth: 3 } // Green gradient
      case 'great':
      case 'excellent':
        return { start: '#3b82f6', end: '#2563eb', strokeWidth: 3 } // Blue gradient
      case 'good':
        return { start: '#06b6d4', end: '#0891b2', strokeWidth: 3 } // Cyan gradient
      case 'acceptable':
        return { start: '#f59e0b', end: '#d97706', strokeWidth: 3 } // Yellow gradient
      case 'inaccuracy':
        return { start: '#f97316', end: '#ea580c', strokeWidth: 3 } // Orange gradient
      case 'mistake':
        return { start: '#ef4444', end: '#dc2626', strokeWidth: 3 } // Red gradient
      case 'blunder':
        return { start: '#dc2626', end: '#991b1b', strokeWidth: 4 } // Dark red gradient - slightly thicker for emphasis
      default:
        return { start: '#6b7280', end: '#4b5563', strokeWidth: 3 } // Gray gradient
    }
  }

  if (arrows.length === 0) {
    return null
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none"
      style={{ 
        width: boardWidth, 
        height: boardWidth
      }}
    >
      <svg
        width={boardWidth}
        height={boardWidth}
        className="absolute inset-0"
        style={{ zIndex: 10 }}
      >
        
        {arrows.map((arrow, index) => {
          const from = squareToPixels(arrow.from)
          const to = squareToPixels(arrow.to)
          const { baseX, baseY } = getArrowHeadBase(from, to)
          const { tipX, tipY, leftX, leftY, rightX, rightY } = getArrowHead(from, to)
          const gradientColors = getGradientColors(arrow.classification, arrow.isBestMove)
          
          const gradientId = `arrow-gradient-${index}`
          
          return (
            <g key={index}>
              {/* Gradient definition */}
              <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={gradientColors.start} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={gradientColors.end} stopOpacity="0.8" />
                </linearGradient>
                
                {/* Arrow shadow filter - more subtle */}
                <filter id={`shadow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0.5" dy="1" stdDeviation="1.5" floodColor="rgba(0,0,0,0.3)" />
                </filter>
              </defs>
              
              {/* Glow effect for best moves (behind everything) */}
              {arrow.isBestMove && (
                <>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={baseX}
                    y2={baseY}
                    stroke={gradientColors.start}
                    strokeWidth={gradientColors.strokeWidth * 1.5}
                    strokeLinecap="round"
                    opacity="0.4"
                    className="animate-pulse"
                  />
                  <polygon
                    points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
                    fill={gradientColors.start}
                    opacity="0.4"
                    className="animate-pulse"
                  />
                </>
              )}
              
              {/* Straight arrow body */}
              <line
                x1={from.x}
                y1={from.y}
                x2={baseX}
                y2={baseY}
                stroke={`url(#${gradientId})`}
                strokeWidth={gradientColors.strokeWidth}
                strokeLinecap="round"
                filter={`url(#shadow-${index})`}
              />
              
              {/* Filled triangular arrow head */}
              <polygon
                points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
                fill={`url(#${gradientId})`}
                filter={`url(#shadow-${index})`}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
