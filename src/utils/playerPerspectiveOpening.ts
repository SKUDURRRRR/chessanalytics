/**
 * Player Perspective Opening Display
 *
 * Converts board-perspective opening names (from PGN) to player-perspective display.
 * This ensures consistency between analytics and match history.
 *
 * Example:
 * - Game: Player (White) vs Opponent (Black playing Caro-Kann)
 * - PGN Header: [Opening "Caro-Kann Defense"]
 * - Board perspective: "Caro-Kann Defense"
 * - Player perspective: "e4 vs Caro-Kann Defense"
 */

import { getOpeningColor, OpeningColor } from './openingColorClassification'
import { getOpeningNameWithFallback } from './openingIdentification'

interface PlayerPerspectiveResult {
  display: string
  isPlayerOpening: boolean
  explanation: string
}

/**
 * Get opening display from player's perspective
 *
 * @param opening - Opening name from database (board perspective)
 * @param playerColor - The color the player played
 * @param game - Optional full game object for fallback logic
 * @returns Player-perspective opening display
 */
export function getPlayerPerspectiveOpening(
  opening: string | null | undefined,
  playerColor: 'white' | 'black',
  game?: any
): PlayerPerspectiveResult {
  // Normalize and get the opening name
  const openingName = opening
    ? (game ? getOpeningNameWithFallback(opening, game) : opening)
    : 'Unknown'

  if (openingName === 'Unknown' || !openingName) {
    return {
      display: 'Unknown Opening',
      isPlayerOpening: true,
      explanation: 'Opening information not available'
    }
  }

  // Determine which color owns this opening
  const openingColor = getOpeningColor(openingName)

  // Case 1: Neutral opening - describe both perspectives
  if (openingColor === 'neutral') {
    return {
      display: openingName,
      isPlayerOpening: true,
      explanation: `Standard opening setup - describes the position, not a specific player's choice`
    }
  }

  // Case 2: Player's opening matches their color - they played this opening
  if (openingColor === playerColor) {
    return {
      display: openingName,
      isPlayerOpening: true,
      explanation: `You played this opening as ${playerColor}`
    }
  }

  // Case 3: Opponent's opening - show what player faced
  return getOpponentOpeningDisplay(openingName, playerColor, openingColor)
}

/**
 * Format display when player faced an opponent's opening
 */
function getOpponentOpeningDisplay(
  openingName: string,
  playerColor: 'white' | 'black',
  openingColor: OpeningColor
): PlayerPerspectiveResult {
  if (playerColor === 'white' && openingColor === 'black') {
    // White player faced a black opening
    // Show White's opening family/system
    const whiteOpeningFamily = getWhiteOpeningFamily(openingName)

    return {
      display: whiteOpeningFamily,
      isPlayerOpening: true, // Changed to true - this IS what white played
      explanation: `You played ${whiteOpeningFamily} as White (opponent responded with ${openingName})`
    }
  } else {
    // Black player faced a white opening
    return {
      display: openingName,
      isPlayerOpening: false,
      explanation: `Opponent played ${openingName} as White`
    }
  }
}

/**
 * Get White's opening family/system based on Black's defense
 *
 * This shows what White actually played, not just the first move
 */
function getWhiteOpeningFamily(blackOpening: string): string {
  const lower = blackOpening.toLowerCase()

  // 1.e4 e5 responses (Open Games)
  if (lower.includes('petrov') ||
      lower.includes('philidor') ||
      lower.includes('latvian') ||
      lower.includes('elephant') ||
      lower.includes('damiano')) {
    return 'Open Game'
  }

  // 1.e4 other responses (King's Pawn Opening)
  if (lower.includes('caro-kann') ||
      lower.includes('french') ||
      lower.includes('sicilian') ||
      lower.includes('pirc') ||
      lower.includes('modern') ||
      lower.includes('alekhine') ||
      lower.includes('scandinavian')) {
    return "King's Pawn Opening"
  }

  // 1.d4 d5 responses (Closed Games)
  if (lower.includes('queen\'s gambit declined') ||
      lower.includes('queen\'s gambit accepted') ||
      lower.includes('slav') ||
      lower.includes('semi-slav') ||
      lower.includes('tarrasch')) {
    return "Queen's Pawn Game"
  }

  // 1.d4 Nf6 responses (Indian Systems)
  if (lower.includes('king\'s indian') ||
      lower.includes('grünfeld') ||
      lower.includes('grunfeld') ||
      lower.includes('nimzo-indian') ||
      lower.includes('queen\'s indian') ||
      lower.includes('benoni') ||
      lower.includes('benko')) {
    return "Indian Game"
  }

  // 1.d4 other responses
  if (lower.includes('dutch')) {
    return "Queen's Pawn Game"
  }

  // 1.c4 responses
  if (lower.includes('english defense')) {
    return 'English Opening'
  }

  // 1.Nf3 responses
  if (lower.includes('réti') || lower.includes('reti')) {
    return 'Réti Opening'
  }

  // Fallback based on typical responses
  if (lower.includes('defense') || lower.includes('defence')) {
    // Most defenses are to 1.e4 or 1.d4
    return "King's Pawn Opening"
  }

  return 'Open Game'
}

/**
 * Get a short display version (for compact views)
 *
 * ✅ USE THIS for displaying openings in UI components!
 * This converts board-perspective openings (from database) to player-perspective.
 *
 * Examples:
 * - White vs Caro-Kann → "King's Pawn Opening" (not "Caro-Kann Defense")
 * - Black with Caro-Kann → "Caro-Kann Defense" (correct)
 *
 * ⚠️ DO NOT use getOpeningNameWithFallback() for display - it returns raw DB names!
 *
 * @param opening - Opening name from database (board perspective)
 * @param playerColor - The color the player played
 * @param game - Optional full game object
 * @returns Short display string (player perspective)
 */
export function getPlayerPerspectiveOpeningShort(
  opening: string | null | undefined,
  playerColor: 'white' | 'black',
  game?: any
): string {
  const result = getPlayerPerspectiveOpening(opening, playerColor, game)
  return result.display
}

/**
 * Check if the displayed opening is the player's choice or opponent's
 *
 * Useful for styling/icons
 */
export function isPlayerOpening(
  opening: string | null | undefined,
  playerColor: 'white' | 'black',
  game?: any
): boolean {
  const result = getPlayerPerspectiveOpening(opening, playerColor, game)
  return result.isPlayerOpening
}

/**
 * Get explanation text for tooltips
 */
export function getOpeningExplanation(
  opening: string | null | undefined,
  playerColor: 'white' | 'black',
  game?: any
): string {
  const result = getPlayerPerspectiveOpening(opening, playerColor, game)
  return result.explanation
}
