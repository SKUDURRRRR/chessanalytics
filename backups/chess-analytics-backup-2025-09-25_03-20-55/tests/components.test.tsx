import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { SimpleAnalytics } from '../src/components/simple/SimpleAnalytics'

// Mock the analysis service
vi.mock('../src/services/analysisService', () => ({
  AnalysisService: {
    getAnalysisStats: vi.fn().mockResolvedValue({
      total_games_analyzed: 10,
      average_accuracy: 75.5,
      total_blunders: 2,
      total_mistakes: 5,
      total_inaccuracies: 8,
      total_brilliant_moves: 1,
      average_opening_accuracy: 80.0,
      average_middle_game_accuracy: 70.0,
      average_endgame_accuracy: 65.0,
    }),
  },
}))

describe('Components', () => {
  it('should render SimpleAnalytics component', async () => {
    render(React.createElement(SimpleAnalytics, { userId: 'testuser', platform: 'lichess' }))
    
    // Wait for the component to load and check for actual content
    await screen.findByText('Analysis Statistics')
    
    expect(screen.getByText('Analysis Statistics')).toBeInTheDocument()
    expect(screen.getByText('Total Games Analyzed')).toBeInTheDocument()
  })

  it('should handle loading state', () => {
    render(React.createElement(SimpleAnalytics, { userId: 'testuser', platform: 'lichess' }))
    
    // Should show loading state initially
    expect(screen.getByText('Chess Analytics')).toBeInTheDocument()
  })
})
