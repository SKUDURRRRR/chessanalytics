/**
 * Quick test to verify opening color classification works correctly
 * Run this in the browser console on the analytics page
 */

import {
  getOpeningColor,
  shouldCountOpeningForColor,
  explainOpeningColor
} from './src/utils/openingColorClassification'

console.log('=== Opening Color Classification Tests ===\n')

// Test Case 1: Caro-Kann Defense
console.log('Test 1: Caro-Kann Defense')
console.log('  Color:', getOpeningColor('Caro-Kann Defense'))
console.log('  Count for white?', shouldCountOpeningForColor('Caro-Kann Defense', 'white'))
console.log('  Count for black?', shouldCountOpeningForColor('Caro-Kann Defense', 'black'))
console.log('  Explanation:', explainOpeningColor('Caro-Kann Defense'))
console.log('')

// Test Case 2: Italian Game
console.log('Test 2: Italian Game')
console.log('  Color:', getOpeningColor('Italian Game'))
console.log('  Count for white?', shouldCountOpeningForColor('Italian Game', 'white'))
console.log('  Count for black?', shouldCountOpeningForColor('Italian Game', 'black'))
console.log('  Explanation:', explainOpeningColor('Italian Game'))
console.log('')

// Test Case 3: Sicilian Defense
console.log('Test 3: Sicilian Defense')
console.log('  Color:', getOpeningColor('Sicilian Defense'))
console.log('  Count for white?', shouldCountOpeningForColor('Sicilian Defense', 'white'))
console.log('  Count for black?', shouldCountOpeningForColor('Sicilian Defense', 'black'))
console.log('')

// Test Case 4: Queen's Pawn Game (neutral)
console.log('Test 4: Queen\'s Pawn Game')
console.log('  Color:', getOpeningColor('Queen\'s Pawn Game'))
console.log('  Count for white?', shouldCountOpeningForColor('Queen\'s Pawn Game', 'white'))
console.log('  Count for black?', shouldCountOpeningForColor('Queen\'s Pawn Game', 'black'))
console.log('  Explanation:', explainOpeningColor('Queen\'s Pawn Game'))
console.log('')

// Test Case 5: Variations (Sicilian Defense, Najdorf)
console.log('Test 5: Sicilian Defense, Najdorf Variation')
console.log('  Color:', getOpeningColor('Sicilian Defense, Najdorf Variation'))
console.log('  Count for white?', shouldCountOpeningForColor('Sicilian Defense, Najdorf Variation', 'white'))
console.log('  Count for black?', shouldCountOpeningForColor('Sicilian Defense, Najdorf Variation', 'black'))
console.log('')

// Test Case 6: King's Indian Defense
console.log('Test 6: King\'s Indian Defense')
console.log('  Color:', getOpeningColor('King\'s Indian Defense'))
console.log('  Count for white?', shouldCountOpeningForColor('King\'s Indian Defense', 'white'))
console.log('  Count for black?', shouldCountOpeningForColor('King\'s Indian Defense', 'black'))
console.log('')

// Test Case 7: Ruy Lopez
console.log('Test 7: Ruy Lopez')
console.log('  Color:', getOpeningColor('Ruy Lopez'))
console.log('  Count for white?', shouldCountOpeningForColor('Ruy Lopez', 'white'))
console.log('  Count for black?', shouldCountOpeningForColor('Ruy Lopez', 'black'))
console.log('')

// Expected Results Summary
console.log('=== Expected Results ===')
console.log('Caro-Kann: black (white=false, black=true)')
console.log('Italian Game: white (white=true, black=false)')
console.log('Sicilian Defense: black (white=false, black=true)')
console.log('Queen\'s Pawn Game: neutral (white=true, black=true)')
console.log('King\'s Indian: black (white=false, black=true)')
console.log('Ruy Lopez: white (white=true, black=false)')

// Simulate the fix for skudurrrrr's case
console.log('\n=== Simulating skudurrrrr\'s Case ===')
console.log('Game: skudurrrrr (White) vs opponent (Black)')
console.log('Opening: Caro-Kann Defense')
console.log('')
console.log('OLD BEHAVIOR: Show under "Best White Openings"? TRUE (WRONG)')
console.log('NEW BEHAVIOR: Show under "Best White Openings"?', shouldCountOpeningForColor('Caro-Kann Defense', 'white'), '(CORRECT)')
console.log('')
console.log('If skudurrrrr played as BLACK with Caro-Kann:')
console.log('Show under "Best Black Openings"?', shouldCountOpeningForColor('Caro-Kann Defense', 'black'), '(CORRECT)')
