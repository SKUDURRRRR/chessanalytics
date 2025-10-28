/**
 * Centralized color scheme for chess analysis terms
 * Ensures consistent color coding across all components
 */

export const CHESS_ANALYSIS_COLORS = {
  // Positive stats - Green
  accuracy: 'text-emerald-400',
  bestMoves: 'text-emerald-400',
  best: 'text-emerald-400',

  // Brilliant moves - Purple (special highlight)
  brilliants: 'text-purple-400',
  brilliant: 'text-purple-400',
  brilliantMoves: 'text-purple-400',

  // Great moves - Teal
  great: 'text-teal-400',

  // Excellent moves - Cyan
  excellent: 'text-cyan-400',

  // Good moves - Sky blue
  good: 'text-sky-400',

  // Acceptable/Book moves - Slate
  acceptable: 'text-slate-400',

  // Minor negative stats - Amber
  inaccuracies: 'text-amber-400',
  inaccuracy: 'text-amber-400',

  // Moderate negative stats - Orange
  mistakes: 'text-orange-400',
  mistake: 'text-orange-400',

  // Negative stats - Rose/Red
  blunders: 'text-rose-400',
  blunder: 'text-rose-400',
} as const

export const CHESS_ANALYSIS_BG_COLORS = {
  // Positive stats - Green backgrounds
  accuracy: 'bg-emerald-500/20 text-emerald-200',
  bestMoves: 'bg-emerald-500/20 text-emerald-200',
  best: 'bg-emerald-500/20 text-emerald-200',

  // Brilliant moves - Purple backgrounds
  brilliants: 'bg-purple-500/20 text-purple-200',
  brilliant: 'bg-purple-500/20 text-purple-200',
  brilliantMoves: 'bg-purple-500/20 text-purple-200',

  // Great moves - Teal backgrounds
  great: 'bg-teal-500/20 text-teal-200',

  // Excellent moves - Cyan backgrounds
  excellent: 'bg-cyan-500/20 text-cyan-200',

  // Good moves - Sky blue backgrounds
  good: 'bg-sky-500/20 text-sky-200',

  // Acceptable/Book moves - Slate backgrounds
  acceptable: 'bg-slate-500/20 text-slate-200',

  // Minor negative stats - Amber backgrounds
  inaccuracies: 'bg-amber-500/20 text-amber-200',
  inaccuracy: 'bg-amber-500/20 text-amber-200',

  // Moderate negative stats - Orange backgrounds
  mistakes: 'bg-orange-500/20 text-orange-200',
  mistake: 'bg-orange-500/20 text-orange-200',

  // Negative stats - Rose/Red backgrounds
  blunders: 'bg-rose-500/20 text-rose-200',
  blunder: 'bg-rose-500/20 text-rose-200',
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
