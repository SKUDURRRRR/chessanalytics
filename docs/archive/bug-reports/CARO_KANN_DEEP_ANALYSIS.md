# Caro-Kann Still Appearing - Deep Root Cause Analysis

## The Problem
Despite multiple filtering layers, Caro-Kann Defense still appears in "Most Played White Openings".

## The Critical Bug - FOUND!

### Issue: `identifyOpening` Ignores Input Parameter

When we call:
```typescript
const normalizedOpening = getOpeningNameWithFallback(rawOpening, game)
```

The flow is:
1. `getOpeningNameWithFallback('Caro-Kann Defense', game)`
2. Calls `getOpeningName(game, moves, playerColor)`
3. Calls `identifyOpening(gameRecord, moves, playerColor)`
4. **BUG**: `identifyOpening` does NOT use the `opening` parameter we passed in!
5. Instead, at Priority 2 (line 263-264), it reads from `gameRecord.opening` or `gameRecord.opening_family` directly
6. This means if `game.opening_family` has a different value (e.g., ECO code "B10"), it uses THAT instead of "Caro-Kann Defense"

### Why This Breaks Filtering

Scenario:
1. `rawOpening = game.opening_normalized = "Caro-Kann Defense"`
2. First filter (line 708): `getOpeningColor("Caro-Kann Defense")` → 'black' ✓ (should filter)
3. BUT if `game.opening_family = "B10"` (ECO code):
4. `getOpeningNameWithFallback("Caro-Kann Defense", game)` → calls `identifyOpening(game)`
5. `identifyOpening` checks `game.opening_family = "B10"` first (Priority 2)
6. Returns "Caro-Kann Defense" (correct)
7. BUT if `game.opening_family` has something ELSE, it might return a different opening!
8. OR if `game.opening` has a variation like "Caro-Kann Defense, Advance Variation", it uses that
9. The normalized result might not match what we filtered on!

### The Real Issue: Inconsistent Data Sources

The problem is that we're using `rawOpening = game.opening_normalized || game.opening_family || game.opening`, but then:
- We filter based on `rawOpening` (which might be from `opening_normalized`)
- But `getOpeningNameWithFallback` uses `game.opening_family` or `game.opening` internally
- If these fields have DIFFERENT values, we get inconsistent results

## Solution

We need to ensure that:
1. The raw opening we filter on matches what `getOpeningNameWithFallback` will return
2. OR we need to check the color AFTER normalization, not before
3. OR we need to pass the raw opening consistently to avoid double normalization

The best fix: Use the SAME source for filtering and normalization - ensure we're filtering based on what `getOpeningNameWithFallback` will actually return.
