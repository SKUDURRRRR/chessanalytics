# Lichess Username Case Sensitivity Fix

## Issue
ELO data was not showing for Lichess player "Stranger66" despite having games in the database. The page showed "No ELO data available" in the ELO trend graph.

## Root Cause
**Lichess usernames are case-sensitive**, but the ELO graph component was incorrectly lowercasing all usernames regardless of platform.

The bug was in `src/components/simple/EloTrendGraph.tsx`:
```typescript
// BEFORE (incorrect - always lowercased)
.eq('user_id', userId.toLowerCase())
```

This caused the component to search for "stranger66" (lowercase) when the actual data was stored as "Stranger66" (with capital S).

## Platform Differences
- **Chess.com**: Usernames are case-insensitive → should be lowercased (see [Chess.com Published-Data API](https://www.chess.com/news/view/published-data-api))
- **Lichess**: Usernames are case-sensitive → should only be trimmed (preserve original case)

## Fix Applied
Added proper username canonicalization in `EloTrendGraph.tsx`:

```typescript
// Canonicalize user ID based on platform
const canonicalUserId = useMemo(() => {
  if (platform === 'chess.com') {
    return userId.trim().toLowerCase()
  } else { // lichess
    return userId.trim()
  }
}, [userId, platform])

// Use canonicalized ID in query
.eq('user_id', canonicalUserId)
```

## Files Fixed
1. ✅ `src/components/simple/EloTrendGraph.tsx` - Added canonicalization logic
2. ✅ `src/utils/comprehensiveGameAnalytics.ts` - Fixed 6 exported functions:
   - `getWinRateAnalysis`
   - `getOpeningPerformance`
   - `getOpeningColorPerformance`
   - `getTimeControlPerformance`
   - `getColorPerformance`
   - `getRecentPerformance`
3. ✅ `src/utils/playerStats.ts` - Fixed 3 functions:
   - `getHighestEloAndTimeControl`
   - `getHighestEloAndTimeControlDetailed`
   - `getMostPlayedTimeControl`

## Files Already Correct
These files already had proper canonicalization:
- ✅ `src/components/simple/MatchHistory.tsx` - Has `canonicalizeUserId` function
- ✅ `src/services/gameAnalysisService.ts` - Has `canonicalizeUserId` function
- ✅ `src/services/profileService.ts` - Uses `normalizeUserId` from lib/security
- ✅ `src/utils/databaseQuery.ts` - Has `canonicalizeUserId` function
- ✅ `src/lib/security.ts` - Has `normalizeUserId` function (source of truth)

## Testing
After this fix:
- Lichess players like "Stranger66" should now see their ELO data correctly
- Chess.com players continue to work as before (lowercased)
- All opening stats, opponent stats, and other analytics should display correctly for both platforms

## Related Code Pattern
The canonical pattern for username handling:
```typescript
const canonicalUserId = platform === 'chess.com' 
  ? userId.trim().toLowerCase() 
  : userId.trim()
```

This pattern is now consistently used across all database queries in the frontend.

