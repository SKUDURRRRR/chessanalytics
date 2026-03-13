# Import More Games Fix - Two-Phase Import

## Problem Summary

The "Import More Games" button was not working properly for users like pakrovejas69 who have more games on Lichess. The system was showing "Import completed: Created 0 games, all were already imported. No new games found."

### Root Cause

The import system had a **critical flaw** in its "smart resume" logic:

1. When a user clicked "Import More Games", the system would query the database for the **oldest** imported game
2. It would then fetch games **older than** that oldest game (using `until` parameter)
3. This meant it was **completely missing NEW games** that were played after the newest imported game!

**Example:**
- User has games from Jan 1 - Jan 31 already imported
- User plays new games on Feb 1, Feb 2, Feb 3
- User clicks "Import More Games"
- System fetches games **older than Jan 1** (Dec, Nov, etc.)
- **Result:** Feb games are never imported! ❌

## Solution Implemented

Implemented a **TWO-PHASE IMPORT** system:

### Phase 1: Check for NEW Games First
- Query database for the **newest** imported game
- Fetch games **AFTER** that timestamp using Lichess `since` parameter
- Import any new games found

### Phase 2: Backfill OLD Games (if no new games found)
- If Phase 1 finds no new games after 3 batches, automatically switch to Phase 2
- Query database for the **oldest** imported game
- Fetch games **BEFORE** that timestamp using Lichess `until` parameter
- Import older games that haven't been imported yet

## Changes Made

### 1. Updated `_perform_large_import()` function (lines 5787-5844)

Added two-phase logic:
```python
# Phase 1: Check for NEW games (after newest imported game)
if has_existing_games:
    newest_dt = datetime.fromisoformat(newest_played_at.replace('Z', '+00:00'))
    check_new_from = newest_dt + timedelta(seconds=1)

    if platform == 'lichess':
        since_timestamp = int(check_new_from.timestamp() * 1000)
        print(f"[large_import] PHASE 1: Checking for NEW games after {check_new_from.isoformat()}")
```

Added phase switching logic (lines 5884-5899):
```python
# Switch to Phase 2 if Phase 1 finds no new games after 3 batches
if import_phase == "new_games" and consecutive_no_new_games >= 3 and not phase_switched:
    print(f"[large_import] Switching to PHASE 2: Backfilling OLD games...")
    if platform == 'lichess':
        until_timestamp = backfill_until_timestamp
        since_timestamp = None  # Clear since for backfill
```

### 2. Updated `_fetch_lichess_games()` function (lines 4556-4610)

Added support for `since` parameter:
```python
async def _fetch_lichess_games(
    user_id: str,
    limit: int,
    until_timestamp: Optional[int] = None,
    since_timestamp: Optional[int] = None  # NEW
) -> List[Dict[str, Any]]:
    # ...
    if since_timestamp:
        params['since'] = since_timestamp  # Fetch games AFTER this time
```

### 3. Updated `_fetch_games_from_platform()` function (lines 4633-4683)

Added `since_timestamp` parameter:
```python
async def _fetch_games_from_platform(
    # ... existing params ...
    since_timestamp: Optional[str] = None  # NEW
) -> List[Dict[str, Any]]:
    # Convert since_timestamp to int if provided
    if since_timestamp:
        since_ts = int(since_timestamp) if isinstance(since_timestamp, str) else since_timestamp

    raw_games = await _fetch_lichess_games(user_id, limit, until_ts, since_ts)
```

### 4. Updated fetch call (line 5928-5930)

Pass `since_timestamp` to the fetch function:
```python
games_data = await _fetch_games_from_platform(
    user_id, platform, batch_limit, until_timestamp, from_date, to_date,
    oldest_game_month, since_timestamp  # NEW
)
```

## Expected Behavior After Fix

### Scenario 1: User has games, plays new ones
1. User clicks "Import More Games"
2. **Phase 1**: System checks for games newer than most recent imported game
3. Finds and imports new games (e.g., Feb 1-3 games)
4. ✅ Success!

### Scenario 2: User has games, no new ones played
1. User clicks "Import More Games"
2. **Phase 1**: System checks for new games (finds none after 3 batches)
3. **Phase 2**: System automatically switches to backfilling old games
4. Imports older games (e.g., Dec, Nov games)
5. ✅ Success!

### Scenario 3: First import (no games in database)
1. User clicks "Import More Games"
2. System starts from most recent games
3. Imports up to 1000 games
4. ✅ Success!

## Testing

To test the fix:

1. **Restart the backend** to load the updated code
2. Navigate to pakrovejas69's dashboard
3. Click "Import More Games"
4. Should see:
   - "PHASE 1: Checking for NEW games" in logs
   - If new games exist, they'll be imported
   - If not, will automatically switch to "PHASE 2: Backfilling OLD games"

## Benefits

- ✅ **Never misses new games** - Always checks for recent games first
- ✅ **Automatic backfill** - If no new games, automatically fills in historical games
- ✅ **Efficient** - Stops early if no new games found (Phase 1 only tries 3 batches)
- ✅ **Backwards compatible** - Works for first-time imports and subsequent imports
- ✅ **Better UX** - Users can now reliably import all their games

## Lichess API Parameters Used

- **`since`**: Fetch games played AFTER this timestamp (in milliseconds)
  - Used in Phase 1 to get new games
- **`until`**: Fetch games played BEFORE this timestamp (in milliseconds)
  - Used in Phase 2 to backfill old games
- **`max`**: Maximum number of games to fetch per request

## Related Files

- `python/core/unified_api_server.py` - Main import logic
- `docs/IMPORT_MORE_GAMES_FIX_TWO_PHASE.md` - This document
