# Analysis Priority Fix - "Analyze My Games" Now Prioritizes Recent Games

## Problem Identified

The "Analyze My Games" button was analyzing older games instead of the most recent ones. Here's why:

### Root Cause

When clicking "Analyze My Games", the system would:

1. **Fetch** only `limit × 3` games (e.g., 10 × 3 = 30 games) from the database, ordered by `played_at` DESC (most recent first)
2. **Filter** out games that were already analyzed
3. **Return** up to 10 unanalyzed games from what remained

**The Issue:** If you had already analyzed your 10 most recent games, and you had many older unanalyzed games, the system would:
- Fetch the 30 most recent games
- Find that 10-15 of them were already analyzed
- Return 10 unanalyzed games from the remaining 15-20 games
- **These would be older games, not your most recent ones**

### Why This Matters

When you play new games after running an analysis:
- The new games might be among the 30 fetched games
- But if there were enough older unanalyzed games in that batch, the system would analyze those older games first
- Your newest games would be skipped until you ran analysis multiple times

## Solution Implemented

### 1. Increased Fetch Multiplier (3× → 10×)

Changed the fetch limit from `limit × 3` to `max(limit × 10, 100)`:

```python
# Before
fetch_limit = limit * 3  # Get 3x the limit

# After  
fetch_limit = max(limit * 10, 100)  # Get 10x the limit (minimum 100)
```

**Impact:**
- When analyzing 10 games, now fetches up to 100 most recent games
- Much higher chance of finding all recent unanalyzed games
- Even if you have 50 already-analyzed games, the system will find the next 10 most recent unanalyzed ones

### 2. Added Comprehensive Logging

Added detailed logging to help diagnose what's happening:

```python
print(f"[info] Fetching up to {fetch_limit} most recent games to find {limit} unanalyzed games")
print(f"[info] Found {len(provider_game_ids)} games in database (ordered by most recent)")
print(f"[info] Found {len(all_games)} games with PGN data")
print(f"[info] Found {len(unanalyzed_games)} unanalyzed games out of {len(all_games)} total games fetched")
print(f"[info] Skipped {analyzed_count} already-analyzed games from the fetched set")
print(f"[info] Total analyzed games in database for this user: {len(analyzed_game_ids)}")
print(f"[info] First unanalyzed game ID: {unanalyzed_games[0].get('provider_game_id')}")
print(f"[info] Last unanalyzed game ID: {unanalyzed_games[-1].get('provider_game_id')}")
```

**Benefits:**
- You can now see exactly what games are being selected for analysis
- Easier to verify that the most recent games are being analyzed
- Better debugging for future issues

## Files Modified

1. `python/core/unified_api_server.py`:
   - Updated `_perform_batch_analysis()` (parallel mode)
   - Updated `_perform_sequential_batch_analysis()` (sequential mode)
   - Enhanced `_filter_unanalyzed_games()` with better logging

2. `python/core/api_server.py`:
   - Updated `perform_batch_analysis()` 
   - Enhanced `_filter_unanalyzed_games()` with better logging

## Testing

To verify the fix works:

1. **Import new games** using "Import Games" button
2. **Check console logs** when clicking "Analyze My Games" - you should see:
   ```
   [info] Fetching up to 100 most recent games to find 10 unanalyzed games
   [info] Found 100 games in database (ordered by most recent)
   [info] Found 100 games with PGN data
   [info] Found 10 unanalyzed games out of 100 total games fetched
   [info] Skipped 15 already-analyzed games from the fetched set
   ```
3. **Verify** that the first unanalyzed game ID matches your most recent unanalyzed game

## Future Improvements

Consider these enhancements:

1. **Smart fetch limit**: Dynamically adjust based on the ratio of analyzed/unanalyzed games
2. **Date-based filtering**: Only fetch games newer than the last analyzed game's date
3. **UI feedback**: Show which games will be analyzed before starting
4. **Incremental analysis**: Add a "Analyze New Games Only" button that only analyzes games newer than the most recent analyzed game

## Configuration

The current settings are:
- **Fetch multiplier**: 10× (was 3×)
- **Minimum fetch**: 100 games (ensures good coverage even for small batches)
- **Analysis limit**: 10 games per batch (configurable in `SimpleAnalyticsPage.tsx` via `ANALYSIS_TEST_LIMIT`)

To analyze more games per batch, update `ANALYSIS_TEST_LIMIT` in `src/pages/SimpleAnalyticsPage.tsx`.

