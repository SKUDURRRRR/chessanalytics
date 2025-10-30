# Testing Instructions for Personality Scores Cache Fix

## Overview
This document provides step-by-step instructions to test the personality scores cache fix for player maine49 (and any other players experiencing the same issue).

## Prerequisites
- Backend Python server running (`START_BACKEND_LOCAL.ps1`)
- Frontend development server running (if testing locally)
- Player maine49 has games imported and analyzed

## Test Steps

### 1. Clear Backend Cache (Quick Fix for Immediate Results)

Since the fix automatically clears cache after analysis, but maine49 already has analyzed games, you need to manually clear the backend cache once:

**Option A: Via API (Recommended)**
```powershell
# Replace {player_name} and {platform} with actual values
curl -X DELETE "http://localhost:8000/api/v1/clear-cache/maine49/lichess"
```

**Option B: Restart Backend**
```powershell
# Stop the backend (Ctrl+C)
# Start it again
.\START_BACKEND_LOCAL.ps1
```

### 2. Refresh the Analytics Page

1. Navigate to maine49's analytics page
2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
3. Wait for all data to load

### 3. Verify Personality Radar

**Before the fix:**
- All traits show score of 50 (neutral)
- Circular radar chart looks perfectly symmetrical

**After the fix:**
- Traits show different scores based on analyzed games
- Scores should be between 0-100 (not all 50)
- Radar chart should show personality variation

Example expected values:
```
Tactical: 65
Positional: 55
Aggressive: 72
Patient: 48
Novelty: 60
Staleness: 40
```

### 4. Verify Game Style Section

**Before the fix:**
```
"You are a advanced player across 0 games."
"Data insufficient - run detailed analysis to populate deep insights."
```

**After the fix:**
```
"You are a [level] player across X games."
Shows player comparison with famous players (e.g., José Raúl Capablanca)
```

### 5. Verify Opening Analysis

**Before the fix:**
- Shows "0% Opening Win Rate"
- BUT also mentions specific openings like "Scotch Game at 100% win rate" (contradictory)

**After the fix:**
- Shows correct opening win rate (e.g., "47% Opening Win Rate")
- Opening statistics are consistent throughout

### 6. Test Automatic Cache Clearing (Future Analysis)

1. Click "Analyze My Games" button
2. Wait for analysis to complete
3. Personality radar should automatically update with new scores
4. No manual cache clearing should be needed

## Expected Console Output

### Backend Logs
```
[INFO] Clearing cache for user_id=maine49, platform=lichess
[CACHE] Deleted key: deep_analysis:maine49:lichess
[CACHE] Deleted key: stats:maine49:lichess
[CACHE] Deleted key: comprehensive_analytics:maine49:lichess
```

### Frontend Console
```
[Cache] Cleared 3 cache entries for user maine49 on lichess
[Cache] Backend cache cleared: {success: true, message: "Cache cleared for user maine49 on lichess", cleared_keys: 3}
[DeepAnalysis] Force refresh - bypassing cache
```

## Troubleshooting

### Problem: Still seeing all 50s after clearing cache

**Check 1: Verify games are analyzed**
- Navigate to Match History tab
- Check if games show analysis data (accuracy, classifications)
- If not analyzed, click "Analyze My Games"

**Check 2: Check database for moves_analysis**
```sql
SELECT game_id, user_id, platform,
       CASE WHEN moves_analysis IS NULL THEN 'NULL'
            WHEN jsonb_array_length(moves_analysis) = 0 THEN 'EMPTY'
            ELSE 'HAS DATA' END as moves_status
FROM game_analyses
WHERE user_id = 'maine49' AND platform = 'lichess'
LIMIT 5;
```

Expected: `moves_status` should be 'HAS DATA'

**Check 3: Verify backend is running updated code**
- Check backend logs for `[CACHE] Deleted key:` messages
- If not seeing these, restart the backend server

### Problem: Cache clears but personality scores are still neutral

**Check 1: Verify analyses have moves_analysis field**
Backend should log:
```
[DEBUG] game_analyses query found X records
[DEBUG] First analysis has moves_analysis: True
[DEBUG] Number of moves in first analysis: Y
```

If `has_moves_analysis: False`, the analyses don't have move data:
- Re-run analysis for the player
- Check that Stockfish is working properly

**Check 2: Check personality scoring logs**
Backend should log:
```
[INFO] Personality scoring: X analyses provided, Y had moves_analysis, Z contributed to scores
```

If Z is 0, no analyses had valid move data → Re-analyze games

## Success Criteria

✅ Personality radar shows varied scores (not all 50s)
✅ Game style section shows correct game count
✅ Opening analysis shows consistent data
✅ Future analyses automatically update personality scores
✅ Backend cache clearing endpoint works
✅ Frontend automatically calls cache clearing after analysis

## Files Changed

- `python/core/unified_api_server.py` - Added cache clearing endpoint and force_refresh parameter
- `src/services/unifiedAnalysisService.ts` - Added clearBackendCache method
- `src/utils/apiCache.ts` - Updated clearUserCache to also clear backend
- `docs/PERSONALITY_SCORES_CACHE_FIX.md` - Documentation of the fix

## Next Steps After Testing

1. Test with multiple players to ensure fix works universally
2. Monitor cache hit rates to optimize TTL values
3. Consider implementing automatic cache invalidation in backend when analysis completes
4. Add cache version tracking to detect stale data automatically
