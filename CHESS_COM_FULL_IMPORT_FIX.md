# Chess.com Full Import Fix - Missing Games Within Months

## Problem Discovered

**Symptom:** User has 3,686 total games on Chess.com, but only 1,742 were imported (missing ~1,944 games)

**Root Cause:** The Chess.com fetching function had a critical bug that caused it to **skip games within months** that had more than 100 games.

## How the Bug Worked

### Original Flawed Logic

1. **Batch 1**: Fetch up to 100 games
   - September 2025 has **328 total games**
   - Fetches first **100 games** from September
   - Hits limit, breaks out of month loop
   - Sets `oldest_game_month = (2025, 9)`

2. **Batch 2**: Continue from September
   - Pagination fix moves to **August** (previous month)
   - Fetches games from August
   - **Never returns to get remaining 228 games from September!**

3. **Result**: Permanently skipped **228 games** from just September alone

This happened for **every month with more than 100 games**, causing massive data loss.

## The Fix

### Changed Strategy for Chess.com

**Before:** Fetch in batches of 100, paginating month-by-month
**After:** Fetch ALL games at once (up to 5000 limit) in a single call

### Code Changes

#### 1. Single Fetch for Chess.com (lines 2885-2892)
```python
# For Chess.com, fetch all games at once to avoid missing games within months
# For Lichess, use batched approach with timestamps
if platform == 'chess.com':
    fetch_iterations = 1  # Single fetch for all games
    fetch_limit = limit   # 5000
else:
    fetch_iterations = limit // batch_size  # 50 iterations
    fetch_limit = batch_size  # 100 per batch
```

**Why this works:**
- Chess.com API returns games month-by-month completely
- A single call with limit=5000 will fetch from all months until reaching 5000 games
- No risk of missing games within months
- The existing duplicate filtering in the import loop handles already-imported games

#### 2. Updated Loop Structure (line 2894)
Changed from:
```python
for batch_start in range(0, limit, batch_size):
```

To:
```python
for batch_num in range(fetch_iterations):
```

For Chess.com: Runs once
For Lichess: Runs 50 times with timestamp-based pagination

### Why Lichess Doesn't Have This Problem

Lichess uses `until_timestamp` parameter which fetches games **chronologically** up to a timestamp. Each batch naturally continues from where the previous batch left off without missing any games.

## Expected Behavior After Fix

### For Chess.com (like skudurrrrr):

**Import More Games:**
1. Single fetch gets up to 5000 games from Chess.com API
2. Should retrieve all 3,686 games in one go
3. Filters out 1,742 already imported
4. Imports remaining ~1,944 new games
5. Completes successfully

**Console Output:**
```
[large_import] ===== STARTING LARGE IMPORT =====
[large_import] Will stop after 50 consecutive batches with no new games
[large_import] ===== BATCH 1 =====
[chess.com] Fetching games for user: skudurrrrr, limit: 5000
[chess.com] Month 2025/10: Found 150 games
[chess.com] Month 2025/09: Found 328 games
[chess.com] Month 2025/08: Found 280 games
... (continues through all months with games)
[chess.com] Fetch complete. Total games fetched: 3686
[large_import] Batch 1: fetched 3686, new: 1944, total checked: 3686
[large_import] Import completed successfully: 1944 new games, 3686 total checked
```

### For Lichess:

No change - continues to use batched fetching with `until_timestamp` pagination (50 batches of 100 games each).

## Testing Instructions

1. **Restart backend server** to load new code
2. **Click "Import More Games"** 
3. **Watch backend console** - should see:
   - Single batch for Chess.com
   - All months being fetched
   - Total games matching Chess.com profile
4. **Verify in UI** - Total games should update to match Chess.com (3,686)

## Files Modified

- `python/core/unified_api_server.py` (lines 2885-2935)
  - Changed batch iteration logic
  - Single fetch for Chess.com
  - Batched fetch for Lichess (unchanged)
  - Updated logging to use `current_batch` instead of `batch_start`

## Summary

This fix ensures that Chess.com imports retrieve **100% of available games** by fetching all games in a single API call, eliminating the pagination bug that caused games within large months to be skipped.

**Before Fix:** 1,742 / 3,686 games (47% imported)  
**After Fix:** Should import all 3,686 games (100%)

