# Opening Name Display Fix

## Issue
The application was showing "Unknown Opening" in the "Most Played Opening" section and other places, even though games had proper opening information in the database.

## Root Causes

### 1. Incorrect Function Calls in `comprehensiveGameAnalytics.ts`
The `getOpeningNameWithFallback()` function was being called incorrectly throughout the file:

**Problem:**
```typescript
const openingName = getOpeningNameWithFallback(
  game.opening,
  game.opening_family,  // ❌ Wrong! This is a string
  null
)
```

**Expected:**
```typescript
const openingName = getOpeningNameWithFallback(
  game.opening,
  game  // ✅ Correct! Pass the full game object
)
```

The function signature expects:
- Parameter 1: `opening` (string) - fallback value
- Parameter 2: `gameRecord` (object) - full game object for comprehensive identification
- Parameter 3: `moves` (optional array)
- Parameter 4: `playerColor` (optional)

When a string was passed as the second parameter instead of the game object, the function couldn't access ECO codes, opening_family, or other game metadata needed for proper identification.

### 2. Missing ECO Code Detection in `openingIdentification.ts`
The `identifyOpening()` function was only looking for `gameRecord.eco`, but in the database schema, ECO codes are stored in the `opening_family` field.

**Problem:**
```typescript
if (gameRecord?.eco) {  // ❌ This field doesn't exist in DB
  const ecoName = getOpeningNameFromECOCode(gameRecord.eco)
  // ...
}
```

**Fix:**
```typescript
// ECO codes can be in gameRecord.eco or gameRecord.opening_family (if it looks like an ECO code)
const ecoCode = gameRecord?.eco || 
  (gameRecord?.opening_family && /^[A-E]\d{2}/.test(gameRecord.opening_family) 
    ? gameRecord.opening_family 
    : null)
```

The fix now:
- Checks both `eco` and `opening_family` fields
- Uses regex to detect ECO codes (format: A00-E99)
- Properly extracts ECO codes from `opening_family` when present

## Files Modified

1. **src/utils/comprehensiveGameAnalytics.ts**
   - Fixed 8 occurrences of incorrect `getOpeningNameWithFallback()` calls
   - Updated in functions:
     - `getMostPlayedOpeningForTimeControl()` (line 195)
     - `calculateOpeningStats()` (line 536)
     - `calculateOpeningColorStats()` (lines 660, 677)
     - `getOpeningPerformance()` (line 1336)
     - `getOpeningColorPerformance()` (lines 1430, 1448)
     - `getWinningOpenings()` (line 1556)

2. **src/utils/openingIdentification.ts**
   - Enhanced ECO code detection to check `opening_family` field
   - Added regex pattern matching for ECO codes (`/^[A-E]\d{2}/`)
   - Improved logic to avoid processing ECO codes as regular opening names

## How It Works Now

The opening identification now follows this priority order:

1. **ECO Code (Highest Priority)**
   - Looks for `gameRecord.eco` OR ECO-formatted `gameRecord.opening_family`
   - Maps ECO code to opening name using comprehensive mapping (500+ ECO codes)
   - Example: "B90" → "Sicilian Defense, Najdorf Variation"

2. **Game Record Opening Data**
   - Uses `gameRecord.opening` or non-ECO `gameRecord.opening_family`
   - Normalizes opening names for consistency
   - Example: "Sicilian" → "Sicilian Defense"

3. **Move-Based Matching**
   - Analyzes first 6 moves if game record data is unavailable
   - Matches against 20+ common opening patterns
   - Provides medium confidence identification

4. **Basic First Move Detection**
   - Falls back to first-move identification if nothing else matches
   - Example: "e4" → "King's Pawn Opening"

5. **Unknown Fallback**
   - Only shows "Unknown Opening" if all identification methods fail

## Expected Result

- Opening names should now display properly in:
  - Recent Performance "Most Played Opening" widget
  - Opening statistics throughout the app
  - Match history
  - Game analysis pages
  
- Instead of "Unknown Opening", users will see proper names like:
  - "Sicilian Defense"
  - "Italian Game"
  - "Queen's Gambit"
  - "King's Indian Defense"
  - etc.

## Testing

To verify the fix:
1. Check the "Recent Performance" section - "Most Played Opening" should show a real opening name
2. View opening statistics - should display proper opening names with game counts
3. Check match history - openings should be properly identified
4. Import new games - opening names should be correctly extracted and displayed

## Database Note

The database stores opening information in these fields:
- `opening`: Full opening name (e.g., "Sicilian Defense: Najdorf Variation")
- `opening_family`: Either ECO code (e.g., "B90") or opening family name (e.g., "Sicilian Defense")

Both fields are now properly utilized for identification.

