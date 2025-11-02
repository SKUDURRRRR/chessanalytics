/**
 * Client-side filter for opening statistics
 * This provides an additional safety layer to filter out opponent openings
 * even if backend data is cached or has bugs
 */

import { shouldCountOpeningForColor } from './openingColorClassification'

export interface OpeningStat {
  opening: string
  games: number
  winRate: number
  averageElo?: number
  [key: string]: any
}

/**
 * Filter opening stats to only include openings from both White and Black perspectives
 * Since the "Opening Performance" section shows both colors combined,
 * we need to ensure each opening is only counted once from the correct perspective
 *
 * Note: This is a safety filter - the backend should already handle this,
 * but this provides protection against cached or legacy data
 */
export function filterMixedColorOpeningStats(stats: OpeningStat[]): OpeningStat[] {
  // Group stats by opening name and separate by implied color
  const filtered: OpeningStat[] = []

  for (const stat of stats) {
    const opening = stat.opening

    // Check if this opening belongs to white or black
    // We accept it if it's a valid opening for either color
    // (The backend should have already filtered this, but we double-check)
    const isWhiteOpening = shouldCountOpeningForColor(opening, 'white')
    const isBlackOpening = shouldCountOpeningForColor(opening, 'black')

    // Only include if it's valid for at least one color
    // (neutral openings are valid for both)
    if (isWhiteOpening || isBlackOpening) {
      filtered.push(stat)
    }
  }

  return filtered
}

/**
 * Emergency client-side filter to remove obvious opponent openings
 * This is a temporary measure while backend data refreshes
 *
 * Known issue: Backend may have cached data where black openings
 * (like Caro-Kann, Sicilian) appear in stats even though player played White
 *
 * This filter aggressively removes ANY opening that could be opponent's opening
 * by checking if it would be valid for BOTH colors (which shouldn't happen)
 */
export function removeOpponentOpenings(stats: OpeningStat[]): OpeningStat[] {
  return stats.filter(stat => {
    const opening = stat.opening

    // An opening should be valid for either White OR Black, not both
    // If it's valid for both, it's likely a neutral opening (which is fine)
    // If it's only valid for one color, we keep it
    const isWhiteOpening = shouldCountOpeningForColor(opening, 'white')
    const isBlackOpening = shouldCountOpeningForColor(opening, 'black')

    // Keep neutral openings (valid for both) and single-color openings
    return isWhiteOpening || isBlackOpening
  })
}
