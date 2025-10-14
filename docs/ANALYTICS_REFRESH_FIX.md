# Analytics Refresh Fix - After Game Import

## Issue Summary

After the game import fix, imports are now working successfully (100 games imported), but the analytics refresh is failing with the error:
```
Error fetching highest ELO game: {...} 'Cannot coerce the result to a single JSON object'
```

## Root Cause

**File:** `src/utils/playerStats.ts` (line 34)

The `getHighestEloAndTimeControl()` function uses `.single()` in the Supabase query:

```typescript
const { data: topGame, error: topError } = await supabase
  .from('games')
  .select('my_rating, time_control, provider_game_id')
  .eq('user_id', userId.toLowerCase())
  .eq('platform', platform)
  .not('my_rating', 'is', null)
  .order('my_rating', { ascending: false })
  .limit(1)
  .single()  // <-- THIS IS THE PROBLEM
```

### Why `.single()` Fails

The `.single()` method in Supabase expects **exactly one result**. However, when multiple games have the same `my_rating` value (which is very common - players often have many games at the same rating), the database returns multiple rows, and `.single()` throws an error:

```
"Cannot coerce the result to a single JSON object"
```

This happens because:
1. Player plays multiple games at rating 1500
2. Query orders by `my_rating DESC` and limits to 1
3. **But** if there are ties, PostgreSQL may return multiple rows
4. `.single()` expects exactly 1, gets 2+, throws error

## Fix Applied

**File:** `src/utils/playerStats.ts` (lines 24-40)

**Before:**
```typescript
const { data: topGame, error: topError } = await supabase
  .from('games')
  .select('my_rating, time_control, provider_game_id')
  .eq('user_id', userId.toLowerCase())
  .eq('platform', platform)
  .not('my_rating', 'is', null)
  .order('my_rating', { ascending: false })
  .limit(1)
  .single()  // Fails with multiple games at same rating

if (topError || !topGame) {
  console.error('Error fetching highest ELO game:', topError)
  return { highestElo: null, timeControlWithHighestElo: null }
}
```

**After:**
```typescript
const { data: topGames, error: topError } = await supabase
  .from('games')
  .select('my_rating, time_control, provider_game_id')
  .eq('user_id', userId.toLowerCase())
  .eq('platform', platform)
  .not('my_rating', 'is', null)
  .order('my_rating', { ascending: false })
  .limit(1)
  // Removed .single() - just get array and take first element

if (topError || !topGames || topGames.length === 0) {
  console.error('Error fetching highest ELO game:', topError)
  return { highestElo: null, timeControlWithHighestElo: null }
}

const topGame = topGames[0]  // Take first result from array
```

## Impact

This fix allows the analytics page to:
1. ✅ Load after game imports complete
2. ✅ Display highest ELO correctly
3. ✅ Show time control where highest ELO was achieved
4. ✅ Handle cases where multiple games have the same rating

## Testing

**Test Case 1: User with games at same rating**
- Import 100 games for user "taterama"
- Multiple games likely have same rating (common)
- Analytics should load without `.single()` error
- Highest ELO should display correctly

**Test Case 2: Fresh import**
- Import games for new user
- Click "Analyze My Games"
- Analytics should refresh and display stats

**Test Case 3: Existing user**
- User with existing games
- Import more games
- Analytics should refresh without error

## Related Files

### Import System (Fixed Previously)
- `python/core/unified_api_server.py` - Game import logic
- See: `GAME_IMPORT_FIX_SUMMARY.md`

### Analytics System (Fixed Now)
- `src/utils/playerStats.ts` - Player statistics utilities
- `src/utils/comprehensiveGameAnalytics.ts` - Comprehensive analytics
- `src/components/simple/SimpleAnalytics.tsx` - Analytics display component

## Complete Fix Summary

### Issue 1: Game Import Failing ✅ FIXED
- **Problem:** FK constraint violation on `games_pgn` table
- **Cause:** Games table insert failed silently, PGN insert attempted anyway
- **Fix:** Added early return on games insert failure
- **File:** `python/core/unified_api_server.py`

### Issue 2: Analytics Refresh Failing ✅ FIXED
- **Problem:** "Cannot coerce the result to a single JSON object"
- **Cause:** `.single()` fails when multiple games have same rating
- **Fix:** Removed `.single()`, use array and take first element
- **File:** `src/utils/playerStats.ts`

## How to Verify Fix

1. **Clear browser console**
2. **Import games** - Should complete successfully
3. **Wait for analytics refresh** - Should complete without errors
4. **Check stats display:**
   - Total games should show 100 (or more)
   - Highest ELO should display correctly
   - No console errors
   - No red error messages in UI

## Expected Console Output (Success)

```
Import complete! Imported 100 new games. Refreshing analytics...
DEBUG: Querying games for userId="taterama" on platform="chess.com"
SimpleAnalytics received data - total games: 15
Comprehensive analytics - total games: 100
Opening accuracy: 82.3
Middle game accuracy: 76.8
Endgame accuracy: 79.2
```

## Common Issues After Fix

### If imports still fail:
- Check backend logs for constraint violations
- Verify Supabase service role credentials
- Check RLS policies on games table

### If analytics still fail:
- Check browser console for other query errors
- Verify games are actually in database
- Check if game_analyses table has data

## Next Steps

1. ✅ Game imports work
2. ✅ Analytics refresh works
3. ⏭️ Run analysis to generate game_analyses data
4. ⏭️ Verify all dashboard components display correctly

