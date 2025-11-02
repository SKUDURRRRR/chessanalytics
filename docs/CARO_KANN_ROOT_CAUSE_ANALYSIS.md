# Caro-Kann Root Cause Analysis

## The Problem

Caro-Kann Defense keeps appearing in "Most Played White Openings" despite multiple filtering attempts.

## Current Logic Flow

1. **Filter Stage 1**: Check raw opening color (line 708-719)
   - If raw opening is black → filter out ✓

2. **Normalize**: `getOpeningNameWithFallback(rawOpening, game)` (line 723)
   - This might transform the opening name

3. **Filter Stage 2**: Check if should count (line 729-739)
   - Uses `shouldCountOpeningForColor(normalizedOpening, 'white')`

4. **Filter Stage 3**: Final color check (line 747-759)
   - If normalized opening is black → filter out ✓

5. **Group Stage**: Group by player perspective (line 765)
   - `getPlayerPerspectiveOpeningShort(normalizedOpening, 'white', game)`
   - This should transform "Caro-Kann Defense" → "King's Pawn Opening"

## Potential Issues

### Issue 1: `getOpeningNameWithFallback` Transformation
When we call `getOpeningNameWithFallback(rawOpening, game)` at line 723:
- If `rawOpening` is already "Caro-Kann Defense" (normalized)
- AND `game` object contains opening data
- It calls `identifyOpening(gameRecord, moves, playerColor)` which might:
  - Use ECO codes to transform
  - Use move matching to transform
  - Return a DIFFERENT opening name

**Example**: Raw "Caro-Kann Defense" → normalized to "King's Pawn Game" → filter check fails (not black anymore)

### Issue 2: `getPlayerPerspectiveOpeningShort` Re-normalization
At line 765, we call:
```typescript
getPlayerPerspectiveOpeningShort(normalizedOpening, 'white', game)
```

But `getPlayerPerspectiveOpeningShort` internally calls `getPlayerPerspectiveOpening` which:
1. Re-normalizes: `getOpeningNameWithFallback(opening, game)` (line 38)
2. This might transform "Caro-Kann Defense" to something else
3. Then checks color
4. If the transformed name has a different color, it might return the original name

### Issue 3: Edge Case - Neutral Openings
If `getOpeningNameWithFallback` transforms "Caro-Kann Defense" to something neutral (like "King's Pawn Game"):
- `getOpeningColor("King's Pawn Game")` returns 'neutral'
- `shouldCountOpeningForColor("King's Pawn Game", 'white')` returns `true` (neutral counts for both)
- Game passes all filters
- Groups under "King's Pawn Game" (not "King's Pawn Opening")

## Root Cause - FOUND!

**The Real Issue**: Double Normalization Bug

1. At line 723: We normalize: `normalizedOpening = getOpeningNameWithFallback(rawOpening, game)`
2. We filter based on `normalizedOpening` (which might be "Caro-Kann Defense" or transformed)
3. At line 765: We group using: `getPlayerPerspectiveOpeningShort(normalizedOpening, 'white', game)`
4. **BUT** `getPlayerPerspectiveOpeningShort` internally calls `getOpeningNameWithFallback` AGAIN (line 38)
5. This double normalization causes:
   - First normalization might transform "Caro-Kann Defense" → something else
   - Filters check the transformed name
   - Second normalization might transform it back or to something different
   - Grouping uses inconsistent name

**The Fix**: Pass `rawOpening` to `getPlayerPerspectiveOpeningShort` instead of `normalizedOpening`
- This lets it normalize once and convert to player perspective correctly
- Filters still use `normalizedOpening` for accurate color checking
- Grouping uses proper player perspective transformation from raw value
