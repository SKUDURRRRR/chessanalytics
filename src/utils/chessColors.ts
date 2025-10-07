/**
 * Centralized color scheme for chess analysis terms
 * Ensures consistent color coding across all components
 */

export const CHESS_ANALYSIS_COLORS = {
  // Positive stats - Green
  accuracy: 'text-emerald-400',
  bestMoves: 'text-emerald-400',
  best: 'text-emerald-400',
  
  // Brilliant moves - Electric blue (special highlight)
  brilliants: 'text-cyan-400',
  brilliant: 'text-cyan-400',
  brilliantMoves: 'text-cyan-400',
  
  // Negative stats - Red
  blunders: 'text-red-400',
  blunder: 'text-red-400',
  
  // Moderate negative stats - Orange
  mistakes: 'text-orange-400',
  mistake: 'text-orange-400',
  
  // Minor negative stats - Yellow
  inaccuracies: 'text-yellow-400',
  inaccuracy: 'text-yellow-400',
  
  // Neutral/acceptable moves - Blue
  good: 'text-blue-400',
  acceptable: 'text-blue-400',
} as const

export const CHESS_ANALYSIS_BG_COLORS = {
  // Positive stats - Green backgrounds
  accuracy: 'bg-emerald-500/20 text-emerald-200',
  bestMoves: 'bg-emerald-500/20 text-emerald-200',
  best: 'bg-emerald-500/20 text-emerald-200',
  
  // Brilliant moves - Electric blue backgrounds
  brilliants: 'bg-cyan-500/20 text-cyan-200',
  brilliant: 'bg-cyan-500/20 text-cyan-200',
  brilliantMoves: 'bg-cyan-500/20 text-cyan-200',
  
  // Negative stats - Red backgrounds
  blunders: 'bg-red-500/20 text-red-200',
  blunder: 'bg-red-500/20 text-red-200',
  
  // Moderate negative stats - Orange backgrounds
  mistakes: 'bg-orange-500/20 text-orange-200',
  mistake: 'bg-orange-500/20 text-orange-200',
  
  // Minor negative stats - Yellow backgrounds
  inaccuracies: 'bg-yellow-500/20 text-yellow-200',
  inaccuracy: 'bg-yellow-500/20 text-yellow-200',
  
  // Neutral/acceptable moves - Blue backgrounds
  good: 'bg-blue-500/20 text-blue-200',
  acceptable: 'bg-blue-500/20 text-blue-200',
} as const

/**
 * Get color class for a chess analysis term
 */
export function getChessColor(term: string): string {
  const normalizedTerm = term.toLowerCase().replace(/[^a-z]/g, '')
  return CHESS_ANALYSIS_COLORS[normalizedTerm as keyof typeof CHESS_ANALYSIS_COLORS] || 'text-slate-400'
}

/**
 * Get background color class for a chess analysis term
 */
export function getChessBgColor(term: string): string {
  const normalizedTerm = term.toLowerCase().replace(/[^a-z]/g, '')
  return CHESS_ANALYSIS_BG_COLORS[normalizedTerm as keyof typeof CHESS_ANALYSIS_BG_COLORS] || 'bg-slate-500/20 text-slate-200'
}

/**
 * Get color for move classification
 */
export function getMoveClassificationColor(classification: string): string {
  return getChessColor(classification)
}

/**
 * Get background color for move classification
 */
export function getMoveClassificationBgColor(classification: string): string {
  return getChessBgColor(classification)
}
