import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FollowUpExplorer } from '../FollowUpExplorer'

const mockMove = {
  index: 10,
  ply: 11,
  moveNumber: 6,
  player: 'white' as const,
  isUserMove: true,
  san: 'Nf3',
  bestMoveSan: 'Nc3',
  evaluation: { type: 'cp' as const, value: -50 },
  scoreForPlayer: -0.5,
  displayEvaluation: '-0.5',
  centipawnLoss: 30,
  classification: 'mistake' as const,
  explanation: 'This move allows Black to gain a better position',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  fenAfter: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1'
}

const mockGoodMove = {
  ...mockMove,
  san: 'e4',
  bestMoveSan: 'e4',
  classification: 'best' as const,
  centipawnLoss: 0
}

describe('FollowUpExplorer', () => {
  it('should not render anything for good moves', () => {
    const { container } = render(
      <FollowUpExplorer
        currentMove={mockGoodMove}
        isExploring={false}
        explorationMoves={[]}
        onExploringChange={vi.fn()}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('should render "Show Follow-Up" button for mistakes', () => {
    render(
      <FollowUpExplorer
        currentMove={mockMove}
        isExploring={false}
        explorationMoves={[]}
        onExploringChange={vi.fn()}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    expect(screen.getByText('Show Follow-Up')).toBeInTheDocument()
  })

  it('should call onExploringChange when clicking "Show Follow-Up"', () => {
    const mockOnChange = vi.fn()

    render(
      <FollowUpExplorer
        currentMove={mockMove}
        isExploring={false}
        explorationMoves={[]}
        onExploringChange={mockOnChange}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Show Follow-Up'))

    expect(mockOnChange).toHaveBeenCalledWith(true)
  })

  it('should display exploration interface when exploring', () => {
    render(
      <FollowUpExplorer
        currentMove={mockMove}
        isExploring={true}
        explorationMoves={[]}
        onExploringChange={vi.fn()}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    expect(screen.getByText(/Exploring Best Line/i)).toBeInTheDocument()
    expect(screen.getByText('Hide Follow-Up')).toBeInTheDocument()
  })

  it('should display the best move in exploration info', () => {
    render(
      <FollowUpExplorer
        currentMove={mockMove}
        isExploring={true}
        explorationMoves={[]}
        onExploringChange={vi.fn()}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    expect(screen.getByText(/Nc3/i)).toBeInTheDocument()
  })

  it('should call onExploringChange(false) when clicking "Hide Follow-Up"', () => {
    const mockOnChange = vi.fn()

    render(
      <FollowUpExplorer
        currentMove={mockMove}
        isExploring={true}
        explorationMoves={[]}
        onExploringChange={mockOnChange}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Hide Follow-Up'))

    expect(mockOnChange).toHaveBeenCalledWith(false)
  })

  it('should show undo button when exploration moves exist', () => {
    render(
      <FollowUpExplorer
        currentMove={mockMove}
        isExploring={true}
        explorationMoves={['d5', 'Nf3']}
        onExploringChange={vi.fn()}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    expect(screen.getByText('Undo')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('should display exploration moves history', () => {
    render(
      <FollowUpExplorer
        currentMove={mockMove}
        isExploring={true}
        explorationMoves={['d5', 'Nf3']}
        onExploringChange={vi.fn()}
        onResetExploration={vi.fn()}
        onUndoExplorationMove={vi.fn()}
      />
    )

    expect(screen.getByText(/Nc3 d5 Nf3/i)).toBeInTheDocument()
  })
})
