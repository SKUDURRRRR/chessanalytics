# Import More Games - Extended Search Fix

## Problem Identified

The import system was **stopping too early** when looking for new games. Here's what was happening:

1. **Your account has 242 games** in the database (most recent)
2. **Chess.com has MORE games** (including older ones not yet imported)
3. **Import checked only 300 games** (most recent) and found they were all imported
4. **Stopped after 3 batches** with no new games
5. **Never reached the older unimported games**

## Root Cause

Two limitations were preventing full import:

1. **Too few batches checked**: Stopped after just 3 consecutive batches (300 games) with no new games
2. **Limited time range**: Only looked back 12 months by default, missing older games

## Fixes Applied

### 1. Extended Batch Checking (python/core/unified_api_server.py:2869)

**Before:**
```python
max_consecutive_no_new = 3  # Stop after 3 batches (300 games)
```

**After:**
```python
max_consecutive_no_new = 10  # Stop after 10 batches (1000 games)
```

Now checks up to **1000 games** before stopping, much more likely to find gaps.

### 2. Extended Time Range (python/core/unified_api_server.py:2082)

**Before:**
```python
# Default to 12 months ago
start_date = datetime.now() - timedelta(days=365)
```

**After:**
```python
# Default to 10 years ago to catch all games
start_date = datetime.now() - timedelta(days=365 * 10)
```

Now looks back **10 years** instead of just 1 year, catching all historical games.

### 3. Better Progress Reporting (python/core/unified_api_server.py:3012-3015)

Added tracking of total games checked vs new games found:

```python
if total_imported == 0:
    message = f"Import complete! Checked {total_games_checked} games, all were already imported."
else:
    message = f"Import complete! {total_imported} new games imported (checked {total_games_checked} total)."
```

Now you can see exactly how many games were checked and how many were new.

### 4. Auto-Dismiss Completion Messages (src/pages/SimpleAnalyticsPage.tsx:357)

Messages now auto-dismiss after 8 seconds to keep UI clean.

## Expected Behavior Now

When you click "Import More Games":

1. **Will fetch games going back 10 years** (instead of just 1 year)
2. **Will check up to 1000 consecutive games** before stopping (instead of 300)
3. **Will find older unimported games** that were missed before
4. **Will show clear message** like:
   - "Import complete! 150 new games imported (checked 450 total)."
   - OR "Import complete! Checked 1000 games, all were already imported."

## Testing Instructions

1. **Restart the backend server** to load the new code
2. **Refresh your browser** to get the updated frontend
3. Click **"Import More Games"**
4. Watch the backend console for detailed logs:
   ```
   [chess.com] No date range specified, will fetch games back to 2014/10
   [chess.com] Starting fetch loop from 2024/10 to 2014/10
   ```
5. **Should now find older games** that weren't imported before
6. Progress message will show: "Checked X games, Y were new"

## What This Fixes

✅ **Finds older games** that were missed in previous imports  
✅ **Checks more games** before giving up (1000 vs 300)  
✅ **Goes back further in time** (10 years vs 1 year)  
✅ **Shows clear progress** (total checked vs new found)  
✅ **Better user feedback** with informative completion messages  

## Example Scenario

**Before:**
- Import checks most recent 300 games
- All 300 are already imported
- Stops, reports "0 games imported"
- **Misses 500 older games** from 2020-2022

**After:**
- Import checks up to 1000 games going back 10 years
- Finds 500 older games from 2020-2022
- Imports them successfully
- Reports "500 new games imported (checked 700 total)"

