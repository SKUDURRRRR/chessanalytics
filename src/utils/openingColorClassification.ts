/**
 * Opening Color Classification Utility
 *
 * This utility determines which color (white or black) "owns" a particular opening.
 * This is crucial for correctly displaying opening statistics by color.
 *
 * Key Concepts:
 * - Some openings are defined by Black's moves (e.g., Caro-Kann: 1.e4 c6)
 * - Some openings are defined by White's moves (e.g., English: 1.c4)
 * - When a player plays AS WHITE against Caro-Kann, they are NOT playing Caro-Kann
 *   (they're playing e4 against Caro-Kann)
 */

export type OpeningColor = 'white' | 'black' | 'neutral'

/**
 * Opening classification database
 * Maps opening names (and common variations) to the color that plays them
 */
const OPENING_COLOR_MAP: Record<string, OpeningColor> = {
  // === BLACK OPENINGS (Defenses) ===
  // These are defined by Black's response to White's opening moves

  // 1.e4 openings (Black's defenses)
  'Sicilian Defense': 'black',
  'Sicilian': 'black',
  'French Defense': 'black',
  'French': 'black',
  'Caro-Kann Defense': 'black',
  'Caro-Kann': 'black',
  'Pirc Defense': 'black',
  'Pirc': 'black',
  'Modern Defense': 'black',
  'Modern': 'black',
  'Scandinavian Defense': 'black',
  'Scandinavian': 'black',
  'Alekhine Defense': 'black',
  'Alekhine': 'black',
  'Nimzowitsch Defense': 'black',
  'Nimzowitsch': 'black',
  'Petrov Defense': 'black',
  'Petrov': 'black',
  'Philidor Defense': 'black',
  'Philidor': 'black',
  'Two Knights Defense': 'black',
  'Hungarian Defense': 'black',
  'Latvian Gambit': 'black',
  'Elephant Gambit': 'black',
  'Damiano Defense': 'black',
  'Portuguese Opening': 'black',

  // 1.d4 openings (Black's defenses)
  'King\'s Indian Defense': 'black',
  'King\'s Indian': 'black',
  'Grünfeld Defense': 'black',
  'Grunfeld Defense': 'black',
  'Grünfeld': 'black',
  'Grunfeld': 'black',
  'Nimzo-Indian Defense': 'black',
  'Nimzo-Indian': 'black',
  'Queen\'s Gambit Declined': 'black',
  'Queen\'s Gambit Accepted': 'black',
  'Slav Defense': 'black',
  'Slav': 'black',
  'Semi-Slav Defense': 'black',
  'Semi-Slav': 'black',
  'Queen\'s Indian Defense': 'black',
  'Queen\'s Indian': 'black',
  'Benoni Defense': 'black',
  'Benoni': 'black',
  'Benko Gambit': 'black',
  'Dutch Defense': 'black',
  'Dutch': 'black',
  'Budapest Gambit': 'black',
  'Tarrasch Defense': 'black',
  'Tarrasch': 'black',

  // === WHITE OPENINGS (Systems) ===
  // These are defined by White's opening choices

  // White's 1.e4 systems
  'Italian Game': 'white',
  'Italian': 'white',
  'Giuoco Piano': 'white',
  'Ruy Lopez': 'white',
  'Spanish Game': 'white',
  'Scotch Game': 'white',
  'Scotch': 'white',
  'Four Knights Game': 'white',
  'Vienna Game': 'white',
  'Vienna': 'white',
  'King\'s Gambit': 'white',
  'King\'s Gambit Accepted': 'white',
  'King\'s Gambit Declined': 'white',
  'Bishop\'s Opening': 'white',
  'Center Game': 'white',
  'Ponziani Opening': 'white',
  'Danish Gambit': 'white',
  'Evans Gambit': 'white',
  'Fried Liver Attack': 'white',
  'Max Lange Attack': 'white',
  'Italian Gambit': 'white',

  // White's 1.d4 systems
  'Queen\'s Gambit': 'white',
  'London System': 'white',
  'London': 'white',
  'Colle System': 'white',
  'Torre Attack': 'white',
  'Trompowsky Attack': 'white',
  'Blackmar-Diemer Gambit': 'white',
  'Catalan Opening': 'white',
  'Catalan': 'white',
  'Stonewall Attack': 'white',

  // White's other first moves
  'English Opening': 'white',
  'English': 'white',
  'Réti Opening': 'white',
  'Reti Opening': 'white',
  'Réti': 'white',
  'Reti': 'white',
  'Bird\'s Opening': 'white',
  'Bird': 'white',
  'Larsen\'s Opening': 'white',
  'Larsen': 'white',
  'Nimzowitsch-Larsen Attack': 'white',
  'Polish Opening': 'white',
  'Orangutan': 'white',
  'Sokolsky Opening': 'white',
  'Zukertort Opening': 'white',
  'Old Indian Attack': 'white',

  // === NEUTRAL OPENINGS ===
  // These describe the game structure rather than a specific color's choice
  'King\'s Pawn Game': 'neutral',
  'King\'s Pawn': 'neutral',
  'Queen\'s Pawn Game': 'neutral',
  'Queen\'s Pawn': 'neutral',
  'Indian Game': 'neutral',
  'Indian': 'neutral',
  'Unknown': 'neutral',
}

/**
 * Determine which color "owns" a particular opening
 *
 * @param opening - The opening name to classify
 * @returns 'white', 'black', or 'neutral'
 *
 * @example
 * getOpeningColor('Caro-Kann Defense') // returns 'black'
 * getOpeningColor('Italian Game') // returns 'white'
 * getOpeningColor('Queen\'s Pawn Game') // returns 'neutral'
 */
export function getOpeningColor(opening: string): OpeningColor {
  if (!opening || opening === 'Unknown') {
    return 'neutral'
  }

  // Normalize the opening name for matching
  const normalizedOpening = opening.trim()

  // Try exact match first
  if (normalizedOpening in OPENING_COLOR_MAP) {
    return OPENING_COLOR_MAP[normalizedOpening]
  }

  // Try partial matches (for variations like "Sicilian Defense, Najdorf")
  for (const [key, color] of Object.entries(OPENING_COLOR_MAP)) {
    if (normalizedOpening.startsWith(key)) {
      return color
    }
  }

  // Heuristic fallback based on naming patterns
  const lowerOpening = normalizedOpening.toLowerCase()

  // Most "Defense" openings are black openings (exceptions handled above)
  if (lowerOpening.includes('defense') || lowerOpening.includes('defence')) {
    return 'black'
  }

  // Most "Gambit" openings where Black accepts/declines are white openings
  if (lowerOpening.includes('gambit accepted') || lowerOpening.includes('gambit declined')) {
    // If it mentions "accepted" or "declined", it's describing Black's response
    // But the gambit itself is typically White's
    return 'white'
  }

  // "Attack", "System", "Opening" in the name usually indicates White's choice
  if (lowerOpening.includes('attack') ||
      lowerOpening.includes('system') ||
      lowerOpening.includes('opening')) {
    return 'white'
  }

  // If it mentions "Game" it's often neutral (describes the resulting position)
  if (lowerOpening.includes('game')) {
    return 'neutral'
  }

  // Default to neutral if we can't determine
  return 'neutral'
}

/**
 * Check if a game's opening should be counted for a specific player color
 *
 * This is the key function for fixing the opening statistics bug:
 * - If player played WHITE and opening is a BLACK opening (e.g., Caro-Kann), return FALSE
 * - If player played BLACK and opening is a WHITE opening (e.g., Italian), return FALSE
 * - If opening is NEUTRAL, return TRUE (it describes the game, not a specific side)
 *
 * @param opening - The opening name from the game
 * @param playerColor - The color the player played in this game ('white' or 'black')
 * @returns true if this opening should be counted for this player's color statistics
 *
 * @example
 * // Player played white against Caro-Kann
 * shouldCountOpeningForColor('Caro-Kann Defense', 'white') // returns false
 *
 * // Player played black with Caro-Kann
 * shouldCountOpeningForColor('Caro-Kann Defense', 'black') // returns true
 *
 * // Player played white with Italian
 * shouldCountOpeningForColor('Italian Game', 'white') // returns true
 */
export function shouldCountOpeningForColor(
  opening: string,
  playerColor: 'white' | 'black'
): boolean {
  const openingColor = getOpeningColor(opening)

  // Neutral openings count for both colors
  if (openingColor === 'neutral') {
    return true
  }

  // Only count if the opening color matches the player's color
  return openingColor === playerColor
}

/**
 * Get a human-readable explanation of why an opening belongs to a color
 * Useful for debugging and user education
 *
 * @param opening - The opening name
 * @returns An explanation string
 */
export function explainOpeningColor(opening: string): string {
  const color = getOpeningColor(opening)

  if (color === 'black') {
    return `${opening} is a Black opening (Black's defensive choice against White's first move)`
  } else if (color === 'white') {
    return `${opening} is a White opening (White's attacking choice)`
  } else {
    return `${opening} is a neutral opening (describes the game structure, not a specific color's choice)`
  }
}
