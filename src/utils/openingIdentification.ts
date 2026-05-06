// Opening Identification Utility - Unified opening identification across the app
import { normalizeOpeningName, getOpeningNameFromECOCode } from './openingUtils'

export interface OpeningIdentificationResult {
  name: string
  description: string
  popularity: 'common' | 'uncommon' | 'rare'
  evaluation: 'equal' | 'slight-advantage' | 'advantage' | 'disadvantage'
  source: 'game_record' | 'eco_code' | 'move_matching' | 'fallback'
  confidence: 'high' | 'medium' | 'low'
}

// Comprehensive opening variations database
const OPENING_VARIATIONS: Record<string, Array<{
  name: string
  moves: string[]
  description: string
  popularity: 'common' | 'uncommon' | 'rare'
  evaluation: 'equal' | 'slight-advantage' | 'advantage' | 'disadvantage'
}>> = {
  'e4': [
    {
      name: 'Sicilian Defense',
      moves: ['e4', 'c5'],
      description: 'Most popular response to 1.e4',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'French Defense',
      moves: ['e4', 'e6'],
      description: 'Solid defensive setup',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Caro-Kann Defense',
      moves: ['e4', 'c6'],
      description: 'Solid and reliable',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Ruy Lopez',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
      description: 'Classical Spanish opening',
      popularity: 'common',
      evaluation: 'slight-advantage'
    },
    {
      name: 'Italian Game',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      description: 'Classical Italian opening',
      popularity: 'common',
      evaluation: 'slight-advantage'
    },
    {
      name: 'Petrov Defense',
      moves: ['e4', 'e5', 'Nf3', 'Nf6'],
      description: 'Symmetrical response to 1.e4',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Scandinavian Defense',
      moves: ['e4', 'd5'],
      description: 'Direct counter-attack',
      popularity: 'uncommon',
      evaluation: 'equal'
    },
    {
      name: 'Alekhine Defense',
      moves: ['e4', 'Nf6'],
      description: 'Provocative knight move',
      popularity: 'uncommon',
      evaluation: 'equal'
    },
    {
      name: 'Pirc Defense',
      moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6'],
      description: 'Hypermodern setup',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Modern Defense',
      moves: ['e4', 'g6'],
      description: 'Hypermodern approach',
      popularity: 'uncommon',
      evaluation: 'equal'
    }
  ],
  'd4': [
    {
      name: 'Queen\'s Gambit',
      moves: ['d4', 'd5', 'c4'],
      description: 'Classical opening with central control',
      popularity: 'common',
      evaluation: 'slight-advantage'
    },
    {
      name: 'King\'s Indian Defense',
      moves: ['d4', 'Nf6', 'c4', 'g6'],
      description: 'Dynamic counter-attacking setup',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'King\'s Indian Defense',
      moves: ['e3', 'd6', 'Nc3', 'Nf6', 'b3', 'g6'],
      description: 'King\'s Indian setup against unusual White opening',
      popularity: 'uncommon',
      evaluation: 'equal'
    },
    {
      name: 'King\'s Indian Defense',
      moves: ['e3', 'd6', 'Nc3', 'Nf6', 'b3', 'g6', 'Bb2', 'Bg7'],
      description: 'King\'s Indian setup with fianchetto development',
      popularity: 'uncommon',
      evaluation: 'equal'
    },
    {
      name: 'King\'s Indian Defense',
      moves: ['d4', 'Nf6', 'Nf3', 'g6', 'c4', 'Bg7'],
      description: 'King\'s Indian Defense - Classical Variation',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'King\'s Indian Defense',
      moves: ['d4', 'Nf6', 'Nf3', 'g6', 'g3', 'Bg7', 'Bg2', 'O-O'],
      description: 'King\'s Indian Defense - Fianchetto Variation',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Nimzo-Indian Defense',
      moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
      description: 'Classical Indian defense',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Queen\'s Indian Defense',
      moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'],
      description: 'Flexible Indian setup',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Grunfeld Defense',
      moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'],
      description: 'Dynamic counter-gambit',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Benoni Defense',
      moves: ['d4', 'Nf6', 'c4', 'c5', 'd5'],
      description: 'Counter-attacking setup',
      popularity: 'uncommon',
      evaluation: 'equal'
    },
    {
      name: 'Dutch Defense',
      moves: ['d4', 'f5'],
      description: 'Unusual but solid defense',
      popularity: 'uncommon',
      evaluation: 'equal'
    },
    {
      name: 'Slav Defense',
      moves: ['d4', 'd5', 'c4', 'c6'],
      description: 'Solid Queen\'s Gambit declined',
      popularity: 'common',
      evaluation: 'equal'
    }
  ],
  'Nf3': [
    {
      name: 'English Opening',
      moves: ['Nf3', 'c5'],
      description: 'Flank opening with flexibility',
      popularity: 'common',
      evaluation: 'equal'
    },
    {
      name: 'Reti Opening',
      moves: ['Nf3', 'd5', 'c4'],
      description: 'Hypermodern approach',
      popularity: 'uncommon',
      evaluation: 'equal'
    }
  ],
  'c4': [
    {
      name: 'English Opening',
      moves: ['c4'],
      description: 'Flank opening with central control',
      popularity: 'common',
      evaluation: 'equal'
    }
  ],
  'b3': [
    {
      name: 'Nimzowitsch-Larsen Attack',
      moves: ['b3'],
      description: 'Flank opening with bishop development',
      popularity: 'uncommon',
      evaluation: 'equal'
    }
  ],
  'f4': [
    {
      name: 'Bird Opening',
      moves: ['f4'],
      description: 'Flank opening with kingside attack',
      popularity: 'uncommon',
      evaluation: 'equal'
    }
  ],
  'g3': [
    {
      name: 'King\'s Fianchetto',
      moves: ['g3'],
      description: 'Flank opening with kingside fianchetto',
      popularity: 'uncommon',
      evaluation: 'equal'
    }
  ]
}

/**
 * Identify opening from game record data and moves
 * This is the main function that should be used throughout the app
 */
export function identifyOpening(
  gameRecord: any,
  moves?: string[],
  playerColor?: 'white' | 'black'
): OpeningIdentificationResult {
  const firstMoves = moves ? moves.slice(0, 6) : []

  // Priority 1: Use ECO code from game record (highest confidence)
  // ECO codes can be in gameRecord.eco or gameRecord.opening_family (if it looks like an ECO code)
  // BUT: Skip generic openings (like A00 -> "Uncommon Opening") to allow move-based detection
  const genericOpenings = ['Unknown', 'Unknown Opening', 'Uncommon Opening', 'Rare Opening', 'Irregular Opening']
  const ecoCode = gameRecord?.eco || (gameRecord?.opening_family && /^[A-E]\d{2}/.test(gameRecord.opening_family) ? gameRecord.opening_family : null)
  if (ecoCode) {
    const ecoName = getOpeningNameFromECOCode(ecoCode)
    // Only use ECO code if it gives us a specific opening (not a generic placeholder)
    if (ecoName && ecoName !== ecoCode && !genericOpenings.includes(ecoName)) {
      return {
        name: ecoName,
        description: `ECO: ${ecoCode} - Opening from ${gameRecord.platform || 'game data'}`,
        popularity: 'common',
        evaluation: 'equal',
        source: 'eco_code',
        confidence: 'high'
      }
    }
  }

  // Priority 2: Use opening data from game record
  // BUT: Skip generic placeholders like "Uncommon Opening", "Unknown", etc.
  // These generic names prevent proper move-based detection
  // (genericOpenings already defined above for Priority 1)
  if (gameRecord?.opening || (gameRecord?.opening_family && !/^[A-E]\d{2}/.test(gameRecord.opening_family))) {
    const rawOpening = (gameRecord.opening_family && !/^[A-E]\d{2}/.test(gameRecord.opening_family)) ? gameRecord.opening_family : gameRecord.opening
    const normalizedOpening = normalizeOpeningName(rawOpening)

    // Only use game record data if it's a specific opening (not a generic placeholder)
    if (normalizedOpening &&
        normalizedOpening !== 'Unknown' &&
        !genericOpenings.includes(normalizedOpening)) {
      return {
        name: normalizedOpening,
        description: `Opening from ${gameRecord.platform || 'game data'}`,
        popularity: 'common',
        evaluation: 'equal',
        source: 'game_record',
        confidence: 'high'
      }
    }
  }

  // Priority 3: Match against comprehensive opening database
  if (firstMoves.length > 0) {
    // First, try to detect KID/Pirc by Black's setup (run before move-by-move matching)
    // This catches cases where White starts with unusual moves like g3, but Black sets up KID/Pirc
    if (firstMoves.length >= 4) {
      const blackMoves = firstMoves.filter((_, index) => index % 2 === 1) // Black moves (odd indices)
      const whiteMoves = firstMoves.filter((_, index) => index % 2 === 0) // White moves (even indices)

      // Check if Black is setting up King's Indian Defense structure
      // KID characteristic moves: Nf6, g6, Bg7 (and sometimes d6, but not always)
      if (blackMoves.length >= 2) {
        const hasD6 = blackMoves.includes('d6')
        const hasNf6 = blackMoves.includes('Nf6')
        const hasG6 = blackMoves.includes('g6')
        const hasBg7 = blackMoves.includes('Bg7')

        // King's Indian Defense: Nf6 + g6 + Bg7 (typically vs d4, but can occur vs other moves)
        // Can also have d6 or castling
        if (hasNf6 && hasG6 && hasBg7) {
          // Distinguish between KID and Pirc based on White's first move
          const whiteFirstMove = whiteMoves[0] || ''
          if (whiteFirstMove === 'e4' && hasD6) {
            // Pirc Defense: e4 d6 Nf6 g6 Bg7
            return {
              name: 'Pirc Defense',
              description: 'Pirc Defense setup by Black',
              popularity: 'common',
              evaluation: 'equal',
              source: 'move_matching',
              confidence: 'medium'
            }
          } else {
            // King's Indian Defense: typically vs d4, but can occur vs other moves
            return {
              name: 'King\'s Indian Defense',
              description: 'King\'s Indian Defense setup by Black',
              popularity: 'common',
              evaluation: 'equal',
              source: 'move_matching',
              confidence: 'medium'
            }
          }
        }

        // Pirc Defense: e4 d6 (then typically Nf6, g6, Bg7)
        // If White played e4 and Black has d6 + (Nf6 or g6), it's likely Pirc
        if (whiteMoves[0] === 'e4' && hasD6 && (hasNf6 || hasG6)) {
          return {
            name: 'Pirc Defense',
            description: 'Pirc Defense setup by Black',
            popularity: 'common',
            evaluation: 'equal',
            source: 'move_matching',
            confidence: 'medium'
          }
        }
      }
    }

    // Then try move-by-move matching against opening database
    for (const [firstMove, variations] of Object.entries(OPENING_VARIATIONS)) {
      for (const variation of variations) {
        if (variation.moves.every((move, index) =>
          index < firstMoves.length && firstMoves[index] === move
        )) {
          return {
            name: variation.name,
            description: variation.description,
            popularity: variation.popularity,
            evaluation: variation.evaluation,
            source: 'move_matching',
            confidence: 'medium'
          }
        }
      }
    }

    // Priority 4: Try partial matching (first 3 moves)
    const firstThreeMoves = firstMoves.slice(0, 3)
    for (const [firstMove, variations] of Object.entries(OPENING_VARIATIONS)) {
      for (const variation of variations) {
        if (variation.moves.length >= 3 &&
            variation.moves.slice(0, 3).every((move, index) =>
              index < firstThreeMoves.length && firstThreeMoves[index] === move
            )) {
          return {
            name: variation.name,
            description: variation.description,
            popularity: variation.popularity,
            evaluation: variation.evaluation,
            source: 'move_matching',
            confidence: 'low'
          }
        }
      }
    }

    // Priority 5: Basic identification by first move
    const firstMove = firstMoves[0]
    if (firstMove === 'e4') {
      return {
        name: 'King\'s Pawn Opening',
        description: 'Classical opening move',
        popularity: 'common',
        evaluation: 'equal',
        source: 'fallback',
        confidence: 'low'
      }
    } else if (firstMove === 'd4') {
      return {
        name: 'Queen\'s Pawn Opening',
        description: 'Classical opening move',
        popularity: 'common',
        evaluation: 'equal',
        source: 'fallback',
        confidence: 'low'
      }
    } else if (firstMove === 'Nf3') {
      return {
        name: 'Reti Opening',
        description: 'Flank opening',
        popularity: 'common',
        evaluation: 'equal',
        source: 'fallback',
        confidence: 'low'
      }
    } else if (firstMove === 'c4') {
      return {
        name: 'English Opening',
        description: 'Flank opening',
        popularity: 'common',
        evaluation: 'equal',
        source: 'fallback',
        confidence: 'low'
      }
    } else if (firstMove === 'b3') {
      return {
        name: 'Nimzowitsch-Larsen Attack',
        description: 'Flank opening',
        popularity: 'uncommon',
        evaluation: 'equal',
        source: 'fallback',
        confidence: 'low'
      }
    } else if (firstMove === 'f4') {
      return {
        name: 'Bird Opening',
        description: 'Flank opening',
        popularity: 'uncommon',
        evaluation: 'equal',
        source: 'fallback',
        confidence: 'low'
      }
    } else if (firstMove === 'g3') {
      return {
        name: 'King\'s Fianchetto',
        description: 'Flank opening',
        popularity: 'uncommon',
        evaluation: 'equal',
        source: 'fallback',
        confidence: 'low'
      }
    }
  }

  // Fallback: Unknown opening
  return {
    name: 'Unknown Opening',
    description: 'Unable to identify specific opening variation',
    popularity: 'rare',
    evaluation: 'equal',
    source: 'fallback',
    confidence: 'low'
  }
}

/**
 * Get opening name for display purposes
 * This is a simplified version that just returns the name
 */
export function getOpeningName(
  gameRecord: any,
  moves?: string[],
  playerColor?: 'white' | 'black'
): string {
  return identifyOpening(gameRecord, moves, playerColor).name
}

/**
 * Get opening name with fallback to normalizeOpeningName for backward compatibility
 * This maintains the existing API while using the improved logic
 *
 * ⚠️ WARNING: This function returns the RAW opening name from database (board perspective).
 * For DISPLAY purposes on Game Analysis Page or Match History, use getPlayerPerspectiveOpeningShort() instead!
 *
 * This function should only be used for:
 * - Opening identification/classification (not display)
 * - Internal data processing
 * - Fallback when player color is unknown
 *
 * ❌ DO NOT USE for displaying openings to users - use getPlayerPerspectiveOpeningShort() instead!
 * See docs/OPENING_DISPLAY_REGRESSION_PREVENTION.md for details.
 */
export function getOpeningNameWithFallback(
  opening: string | null | undefined,
  gameRecord?: any,
  moves?: string[],
  playerColor?: 'white' | 'black'
): string {
  // If we have a game record, use the comprehensive identification
  // Pass moves explicitly if provided (this allows move-based identification even when DB has generic opening)
  if (gameRecord) {
    return getOpeningName(gameRecord, moves, playerColor)
  }

  // Fallback to the original normalizeOpeningName for backward compatibility
  return normalizeOpeningName(opening || 'Unknown')
}
