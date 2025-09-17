// Opening Utilities - Normalize opening names and families
export function normalizeOpeningName(opening: string): string {
  if (!opening || opening === 'Unknown') {
    return 'Unknown'
  }

  // Common opening family mappings
  const openingFamilies: Record<string, string> = {
    // King's Pawn Openings
    'Sicilian Defense': 'Sicilian Defense',
    'Sicilian': 'Sicilian Defense',
    'French Defense': 'French Defense',
    'French': 'French Defense',
    'Caro-Kann Defense': 'Caro-Kann Defense',
    'Caro-Kann': 'Caro-Kann Defense',
    'Scandinavian Defense': 'Scandinavian Defense',
    'Scandinavian': 'Scandinavian Defense',
    'Alekhine Defense': 'Alekhine Defense',
    'Alekhine': 'Alekhine Defense',
    'Pirc Defense': 'Pirc Defense',
    'Pirc': 'Pirc Defense',
    'Modern Defense': 'Modern Defense',
    'Modern': 'Modern Defense',
    
    // Queen's Pawn Openings
    'Queen\'s Gambit': 'Queen\'s Gambit',
    'Queen\'s Gambit Declined': 'Queen\'s Gambit Declined',
    'Queen\'s Gambit Accepted': 'Queen\'s Gambit Accepted',
    'Slav Defense': 'Slav Defense',
    'Slav': 'Slav Defense',
    'Nimzo-Indian Defense': 'Nimzo-Indian Defense',
    'Nimzo-Indian': 'Nimzo-Indian Defense',
    'Queen\'s Indian Defense': 'Queen\'s Indian Defense',
    'Queen\'s Indian': 'Queen\'s Indian Defense',
    'King\'s Indian Defense': 'King\'s Indian Defense',
    'King\'s Indian': 'King\'s Indian Defense',
    'Grünfeld Defense': 'Grünfeld Defense',
    'Grünfeld': 'Grünfeld Defense',
    'Benoni Defense': 'Benoni Defense',
    'Benoni': 'Benoni Defense',
    
    // English Opening
    'English Opening': 'English Opening',
    'English': 'English Opening',
    
    // Reti Opening
    'Reti Opening': 'Reti Opening',
    'Reti': 'Reti Opening',
    
    // Other Openings
    'Ruy Lopez': 'Ruy Lopez',
    'Italian Game': 'Italian Game',
    'Italian': 'Italian Game',
    'Two Knights Defense': 'Two Knights Defense',
    'Two Knights': 'Two Knights Defense',
    'Petrov Defense': 'Petrov Defense',
    'Petrov': 'Petrov Defense',
    'Philidor Defense': 'Philidor Defense',
    'Philidor': 'Philidor Defense',
    'Vienna Game': 'Vienna Game',
    'Vienna': 'Vienna Game',
    'King\'s Gambit': 'King\'s Gambit',
    'Evans Gambit': 'Evans Gambit',
    'Evans': 'Evans Gambit',
    'Scotch Game': 'Scotch Game',
    'Scotch': 'Scotch Game',
    'Four Knights Game': 'Four Knights Game',
    'Four Knights': 'Four Knights Game',
    'Three Knights Game': 'Three Knights Game',
    'Three Knights': 'Three Knights Game',
  }

  // Try to find exact match first
  if (openingFamilies[opening]) {
    return openingFamilies[opening]
  }

  // Try to find partial match
  const normalizedOpening = opening.toLowerCase()
  for (const [key, value] of Object.entries(openingFamilies)) {
    if (normalizedOpening.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedOpening)) {
      return value
    }
  }

  // If no match found, return the original opening name
  return opening
}

export function getOpeningIcon(opening: string): string {
  if (opening === 'Unknown') {
    return '❓'
  }

  // Common opening patterns
  if (opening.toLowerCase().includes('sicilian')) {
    return '♟️'
  } else if (opening.toLowerCase().includes('queen\'s gambit')) {
    return '👑'
  } else if (opening.toLowerCase().includes('king\'s indian')) {
    return '♔'
  } else if (opening.toLowerCase().includes('french')) {
    return '🇫🇷'
  } else if (opening.toLowerCase().includes('ruy lopez')) {
    return '🇪🇸'
  } else if (opening.toLowerCase().includes('italian')) {
    return '🇮🇹'
  } else if (opening.toLowerCase().includes('english')) {
    return '🇬🇧'
  } else {
    return '♟️'
  }
}

export function getOpeningColor(opening: string): string {
  if (opening === 'Unknown') {
    return 'text-gray-600'
  }

  // Color based on opening type
  if (opening.toLowerCase().includes('sicilian')) {
    return 'text-red-600'
  } else if (opening.toLowerCase().includes('queen\'s gambit')) {
    return 'text-purple-600'
  } else if (opening.toLowerCase().includes('king\'s indian')) {
    return 'text-blue-600'
  } else if (opening.toLowerCase().includes('french')) {
    return 'text-indigo-600'
  } else if (opening.toLowerCase().includes('ruy lopez')) {
    return 'text-orange-600'
  } else if (opening.toLowerCase().includes('italian')) {
    return 'text-green-600'
  } else if (opening.toLowerCase().includes('english')) {
    return 'text-teal-600'
  } else {
    return 'text-gray-700'
  }
}
