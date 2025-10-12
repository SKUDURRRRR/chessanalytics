# Data Freshness Calculation Fix

## Problem

The data freshness indicator was showing incorrect "days ago" values (e.g., "635 days ago") even when recent games were imported.

## Root Cause

The data freshness calculation was using the **wrong date** due to array reversal:

1. **Data Processing Flow**:
   ```typescript
   // 1. Filter and sort games (newest first)
   const filteredGames = allGames
     .filter(game => /* time control match */)
     .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
     .slice(0, gameLimit)
   
   // 2. Process for display (oldest first for graph)
   let processedData = filteredGames
     .map(game => ({ date: game.played_at, ... }))
     .reverse()  // ← This reverses the order!
   
   // 3. WRONG: Get "most recent" from reversed array
   const mostRecentGameDate = eloData[eloData.length - 1]?.date  // This is actually the OLDEST!
   ```

2. **The Bug**: 
   - `filteredGames[0]` = most recent game
   - After `.reverse()`, `processedData[processedData.length - 1]` = **oldest** game
   - So we were calculating days since the **oldest** game in the displayed set, not the newest!

## Solution

### 1. Calculate Most Recent Date Correctly

**Before** (Wrong):
```typescript
const mostRecentGameDate = useMemo(() => {
  return eloData.length > 0 ? eloData[eloData.length - 1]?.date : null
}, [eloData])
```

**After** (Correct):
```typescript
const mostRecentGameDate = useMemo(() => {
  if (allGames.length === 0 || !activeTimeControl) return null
  
  const filteredGames = allGames
    .filter(game => {
      const category = getTimeControlCategory(game.time_control || 'Unknown')
      return category === activeTimeControl
    })
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
    .slice(0, gameLimit === 0 ? undefined : gameLimit)
  
  return filteredGames.length > 0 ? filteredGames[0].played_at : null
}, [allGames, activeTimeControl, gameLimit])
```

### 2. Added Debug Logging

```typescript
console.log('Data Freshness Debug:', {
  mostRecentGameDate,
  parsedDate: new Date(mostRecentGameDate),
  now: new Date(),
  daysSinceLastGame: days,
  activeTimeControl,
  totalGamesInDB: allGames.length
})
```

## Why This Happened

The graph needs data in chronological order (oldest → newest) for proper line chart display, but the freshness calculation needs the actual most recent date. The original code tried to get both from the same reversed array.

## Files Modified

- ✅ `src/components/simple/EloTrendGraph.tsx` - Fixed data freshness calculation

## Testing

1. **Check Console Logs**: Look for "Data Freshness Debug" logs
2. **Verify Date**: Most recent game date should be today/recent
3. **Check Warning**: Should show "0 days ago" or "today" for recent games

## Expected Results

- ✅ Data freshness shows correct "days ago" value
- ✅ Recent games show "0 days ago" or "today"
- ✅ Console logs show actual most recent game date
- ✅ No more "635 days ago" for recent games

## Debug Information

The console will now show:
```javascript
Data Freshness Debug: {
  mostRecentGameDate: "2025-01-10T15:30:00Z",
  parsedDate: Date(2025-01-10T15:30:00Z),
  now: Date(2025-01-10T20:45:00Z),
  daysSinceLastGame: 0,
  activeTimeControl: "Rapid",
  totalGamesInDB: 773
}
```

This helps verify that:
- The most recent game date is correct
- The calculation is working properly
- The time control filtering is applied
- The total games count matches expectations
