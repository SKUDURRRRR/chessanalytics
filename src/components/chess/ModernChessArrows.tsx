import React, { useRef } from 'react'
import type { Square } from 'chess.js'
import type { ModernArrow } from '../../utils/chessArrows'

export type { ModernArrow }

interface ModernChessArrowsProps {
  arrows: ModernArrow[]
  boardWidth: number
  boardOrientation: 'white' | 'black'
  boardId?: string
}

/**
 * Convert chess square to pixel coordinates using measured square size and actual board offset
 *
 * This function calculates the center point of a chess square in SVG coordinate space.
 * The boardOffset parameter is critical - it accounts for any padding, margins, or
 * internal offsets in the chessboard component that shift squares from the expected (0,0) position.
 *
 * ⚠️ IMPORTANT: The boardOffset is calculated by measuring the actual a1 square position
 * and comparing it to the expected position. Do not remove this offset calculation
 * or arrows will be misaligned with squares.
 */
function squareToPixels(
  square: Square,
  boardOrientation: 'white' | 'black',
  squareSize: number,
  boardOffset: { x: number; y: number }
): { x: number; y: number } {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0) // 0-7 (a-h)
  const rank = parseInt(square[1]) - 1 // 0-7 (1-8)

  let x: number, y: number

  if (boardOrientation === 'white') {
    // White view: a1 is at bottom-left
    // In pixel coordinates: x increases left-to-right, y increases top-to-bottom
    // So rank 1 should be at bottom (high y), rank 8 at top (low y)
    x = file * squareSize + squareSize / 2 + boardOffset.x
    y = (7 - rank) * squareSize + squareSize / 2 + boardOffset.y
  } else {
    // Black view: board is flipped
    // h1 is at bottom-left, a8 at top-right
    x = (7 - file) * squareSize + squareSize / 2 + boardOffset.x
    y = rank * squareSize + squareSize / 2 + boardOffset.y
  }

  return { x, y }
}

/**
 * Calculate shortened arrow body endpoint to prevent overlap with arrowhead
 */
function getShortenedEndpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  shortenBy: number
): { x: number; y: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.sqrt(dx * dx + dy * dy)

  if (length === 0) return { x: x2, y: y2 }

  // Move back from endpoint by shortenBy pixels
  const ratio = (length - shortenBy) / length
  return {
    x: x1 + dx * ratio,
    y: y1 + dy * ratio
  }
}

/**
 * Calculate arrow head points
 * Size is proportional to board width for consistent appearance
 */
function getArrowHead(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  boardWidth: number
): { points: string; tipOffset: number } {
  const angle = Math.atan2(y2 - y1, x2 - x1)

  // Arrow head size scales with board size - larger and wider for better visibility
  const headLength = boardWidth / 25 // Length of arrow head
  const headWidth = boardWidth / 35 // Half-width at the base

  // Tip point should be exactly at the destination square center
  const tipX = x2
  const tipY = y2

  // Arrow head points forming a triangle
  const point1 = {
    x: tipX - headLength * Math.cos(angle) - headWidth * Math.sin(angle),
    y: tipY - headLength * Math.sin(angle) + headWidth * Math.cos(angle)
  }

  const point2 = {
    x: tipX - headLength * Math.cos(angle) + headWidth * Math.sin(angle),
    y: tipY - headLength * Math.sin(angle) - headWidth * Math.cos(angle)
  }

  return {
    points: `${tipX},${tipY} ${point1.x},${point1.y} ${point2.x},${point2.y}`,
    tipOffset: headLength
  }
}

/**
 * ModernChessArrows component
 * Renders straight SVG arrows on top of the chess board (like chess.com)
 */
export function ModernChessArrows({
  arrows,
  boardWidth,
  boardOrientation,
  boardId = 'default'
}: ModernChessArrowsProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [squareSize, setSquareSize] = React.useState(boardWidth / 8)
  const [boardOffset, setBoardOffset] = React.useState({ x: 0, y: 0 })

  // Measure actual board to align arrows perfectly to square centers
  // This uses requestAnimationFrame to ensure DOM is fully rendered before measuring
  // Measures multiple squares for more accurate alignment
  React.useEffect(() => {
    let rafId: number
    let timeoutId: NodeJS.Timeout

    const measure = () => {
      if (!svgRef.current) return

      const container = svgRef.current.parentElement
      if (!container) return

      // Measure a1 and h8 to get more accurate alignment
      const a1Square = container.querySelector('[data-square="a1"]') as HTMLElement
      const h8Square = container.querySelector('[data-square="h8"]') as HTMLElement

      if (!a1Square || !h8Square) return

      const a1Rect = a1Square.getBoundingClientRect()
      const h8Rect = h8Square.getBoundingClientRect()
      const svgRect = svgRef.current.getBoundingClientRect()

      if (a1Rect.width <= 0 || svgRect.width <= 0) return

      const actualSquareSize = a1Rect.width
      setSquareSize(actualSquareSize)

      // Calculate where a1 center actually is in SVG coordinate space
      const a1CenterX = a1Rect.left + a1Rect.width / 2 - svgRect.left
      const a1CenterY = a1Rect.top + a1Rect.height / 2 - svgRect.top

      // Calculate where a1 center should be based on our coordinate system
      // For white orientation: a1 is at file 0, rank 0 (but displayed at bottom)
      // For black orientation: a1 is at file 7, rank 7 (but displayed at top-right)
      let expectedA1X: number, expectedA1Y: number

      if (boardOrientation === 'white') {
        // a1 is bottom-left: file 0, rank 0 -> x = 0 * squareSize + squareSize/2, y = 7 * squareSize + squareSize/2
        expectedA1X = actualSquareSize / 2
        expectedA1Y = 7 * actualSquareSize + actualSquareSize / 2
      } else {
        // a1 is top-right when board is flipped: file 7, rank 7 -> x = 7 * squareSize + squareSize/2, y = 0 * squareSize + squareSize/2
        expectedA1X = 7 * actualSquareSize + actualSquareSize / 2
        expectedA1Y = actualSquareSize / 2
      }

      // Calculate offset from a1
      let offsetX = a1CenterX - expectedA1X
      let offsetY = a1CenterY - expectedA1Y

      // Verify with h8 for better accuracy
      const h8CenterX = h8Rect.left + h8Rect.width / 2 - svgRect.left
      const h8CenterY = h8Rect.top + h8Rect.height / 2 - svgRect.top

      let expectedH8X: number, expectedH8Y: number
      if (boardOrientation === 'white') {
        // h8 is top-right: file 7, rank 7 -> x = 7 * squareSize + squareSize/2, y = 0 * squareSize + squareSize/2
        expectedH8X = 7 * actualSquareSize + actualSquareSize / 2
        expectedH8Y = actualSquareSize / 2
      } else {
        // h8 is bottom-left when flipped: file 0, rank 0 -> x = 0 * squareSize + squareSize/2, y = 7 * squareSize + squareSize/2
        expectedH8X = actualSquareSize / 2
        expectedH8Y = 7 * actualSquareSize + actualSquareSize / 2
      }

      // Average the offsets for more accuracy
      const offsetXFromH8 = h8CenterX - expectedH8X
      const offsetYFromH8 = h8CenterY - expectedH8Y

      // Use average of both measurements
      offsetX = (offsetX + offsetXFromH8) / 2
      offsetY = (offsetY + offsetYFromH8) / 2

      setBoardOffset({ x: offsetX, y: offsetY })
    }

    const scheduleMeasure = () => {
      // Use requestAnimationFrame to ensure DOM is ready
      rafId = requestAnimationFrame(() => {
        timeoutId = setTimeout(measure, 50)
      })
    }

    scheduleMeasure()
    window.addEventListener('resize', scheduleMeasure)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (timeoutId) clearTimeout(timeoutId)
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [boardWidth, boardOrientation])

  // Debug mode - can be enabled for troubleshooting
  const debugMode = false

  if (arrows.length === 0) {
    return null
  }

  return (
    <svg
      ref={svgRef}
      width={boardWidth}
      height={boardWidth}
      viewBox={`0 0 ${boardWidth} ${boardWidth}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 10,
        overflow: 'visible'
      }}
    >
      <defs>
        {/* Define gradients for different classifications */}
        <linearGradient id="best-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
        </linearGradient>

        {/* Filter for drop shadow */}
        <filter id="arrow-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Filter for glow effect on best moves */}
        <filter id="arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {arrows.map((arrow, index) => {
        const from = squareToPixels(arrow.from, boardOrientation, squareSize, boardOffset)
        const to = squareToPixels(arrow.to, boardOrientation, squareSize, boardOffset)

        // Calculate arrow head pointing at the destination square center
        const arrowHead = getArrowHead(from.x, from.y, to.x, to.y, boardWidth)

        // Shorten the arrow body to end before the arrowhead begins
        const shortenedEnd = getShortenedEndpoint(from.x, from.y, to.x, to.y, arrowHead.tipOffset)

        // Determine stroke width based on classification (scales with board size)
        // Increased base width to be thicker like chess.com
        const baseStrokeWidth = boardWidth / 50 // 2% of board width (was 1%)
        const strokeWidth = arrow.isBestMove ? baseStrokeWidth * 1.3 :
                           arrow.classification === 'blunder' ? baseStrokeWidth * 1.1 :
                           baseStrokeWidth

        // Apply glow to best move suggestions
        const filter = arrow.isBestMove ? 'url(#arrow-glow)' : 'url(#arrow-shadow)'

        const pathId = `arrow-${boardId}-${index}`

        return (
          <g key={pathId}>
            {/* Straight arrow path (like chess.com) - stops before arrowhead */}
            <path
              d={`M ${from.x},${from.y} L ${shortenedEnd.x},${shortenedEnd.y}`}
              stroke={arrow.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
              opacity={0.85}
              filter={filter}
            />

            {/* Arrow head */}
            <polygon
              points={arrowHead.points}
              fill={arrow.color}
              opacity={0.9}
              filter={filter}
            />

            {/* Pulsing glow animation for best moves */}
            {arrow.isBestMove && (
              <path
                d={`M ${from.x},${from.y} L ${shortenedEnd.x},${shortenedEnd.y}`}
                stroke={arrow.color}
                strokeWidth={strokeWidth * 1.8}
                strokeLinecap="round"
                fill="none"
                opacity={0.3}
              >
                <animate
                  attributeName="opacity"
                  values="0.3;0.6;0.3"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </path>
            )}
          </g>
        )
      })}

      {/* Debug visualization */}
      {debugMode && (
        <g opacity="1.0">
          {/* Draw grid lines to match the SVG viewBox */}
          {Array.from({ length: 9 }).map((_, i) => {
            return (
              <g key={`grid-${i}`}>
                {/* Vertical lines */}
                <line
                  x1={i * squareSize}
                  y1={0}
                  x2={i * squareSize}
                  y2={boardWidth}
                  stroke="red"
                  strokeWidth="2"
                />
                {/* Horizontal lines */}
                <line
                  x1={0}
                  y1={i * squareSize}
                  x2={boardWidth}
                  y2={i * squareSize}
                  stroke="red"
                  strokeWidth="2"
                />
              </g>
            )
          })}

          {/* Draw center dots for each square */}
          {Array.from({ length: 8 }).map((_, rank) =>
            Array.from({ length: 8 }).map((_, file) => {
              const square = `${String.fromCharCode(97 + file)}${rank + 1}` as Square
              const pos = squareToPixels(square, boardOrientation, squareSize, boardOffset)
              return (
                <g key={square}>
                  {/* Center dot */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="3"
                    fill="lime"
                  />
                  {/* Square label */}
                  <text
                    x={pos.x}
                    y={pos.y - 8}
                    fontSize="10"
                    fill="yellow"
                    textAnchor="middle"
                  >
                    {square}
                  </text>
                </g>
              )
            })
          )}

          {/* Show grid origin point */}
          {(() => {
            return (
              <>
                <circle
                  cx={0}
                  cy={0}
                  r="8"
                  fill="magenta"
                />
                <text
                  x={10}
                  y={15}
                  fontSize="14"
                  fill="magenta"
                  fontWeight="bold"
                >
                  GRID ORIGIN
                </text>
              </>
            )
          })()}

          {/* Show arrow endpoints */}
          {arrows.map((arrow, idx) => {
            const from = squareToPixels(arrow.from, boardOrientation, squareSize, boardOffset)
            const to = squareToPixels(arrow.to, boardOrientation, squareSize, boardOffset)
            return (
              <g key={`debug-arrow-${idx}`}>
                {/* From point */}
                <circle cx={from.x} cy={from.y} r="6" fill="cyan" />
                {/* To point */}
                <circle cx={to.x} cy={to.y} r="6" fill="orange" />
                {/* Straight line showing what we think the arrow should be */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="white"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}
