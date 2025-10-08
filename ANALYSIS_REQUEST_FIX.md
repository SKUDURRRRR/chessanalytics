# Analysis Request Error Fix

## Issues Identified

### 1. Frontend Circular Reference Error
**Error:** `Converting circular structure to JSON --> starting at object with constructor 'HTMLButtonElement'`

**Root Cause:** Error objects in catch blocks were being logged directly, and some of these errors contained references to React event objects (with DOM elements and React Fiber nodes), which create circular references when serialized.

**Solution:** Updated all error logging in frontend to extract only the error message string before logging:
- `MatchHistory.tsx`: Fixed 4 catch blocks to use `String(error)` fallback
- `GameAnalysisPage.tsx`: Fixed 2 catch blocks to use `String(error)` fallback

### 2. Backend Game Not Found Error
**Error:** `Game not found in games_pgn table: {game_id}. Please ensure the game has been imported first.`

**Root Causes:**
1. Games may not have been imported yet (user clicks Analyze before Import)
2. Game might be older than last 100 games (outside import range)
3. Import may have failed silently

**Solution - Two Approaches:**

#### A. Auto-Fetch Fallback (New Safety Net)
Added automatic PGN fetching from chess platforms when game not found in database:

1. **New Helper Functions:**
   - `_fetch_single_lichess_game(game_id)`: Fetches a single game PGN from Lichess API
   - `_fetch_single_chesscom_game(user_id, game_id)`: Fetches a single game PGN from Chess.com API by searching recent archives

2. **Enhanced `_handle_single_game_by_id` Function:**
   - First tries to find PGN in database (existing behavior)
   - If not found, automatically fetches from the chess platform
   - Saves fetched PGN to database for future use
   - Continues with analysis using the fetched PGN

## Changes Made

### Frontend Files

#### `src/components/simple/MatchHistory.tsx`
- Line 276-277: Fixed error logging to use `String(refreshError)`
- Line 283: Fixed error logging to use `String(error) || 'Failed to request analysis.'`
- Line 409-410: Fixed error logging to use `String(analysisError)`
- Line 418-419: Fixed error logging to use `String(err)`

#### `src/pages/GameAnalysisPage.tsx`
- Line 489-490: Fixed error logging to use `String(error)`
- Line 543-544: Fixed error logging to use `String(err)`

### Backend Files

#### `python/core/unified_api_server.py`

**New Functions (lines 1880-1941):**
```python
async def _fetch_single_lichess_game(game_id: str) -> Optional[str]:
    """Fetch a single game PGN from Lichess by game ID"""
    
async def _fetch_single_chesscom_game(user_id: str, game_id: str) -> Optional[str]:
    """Fetch a single game PGN from Chess.com by searching recent games"""
```

**Modified Function (lines 2762-2804):**
- `_handle_single_game_by_id`: Added fallback to fetch PGN from platform if not in database

#### B. Enhanced Import Debugging (Fixing Root Cause)
Added detailed logging to diagnose why imports might not be working:
- Log sample games from database when query fails
- Log exact query parameters being used
- Log PGN upsert details during import
- Verify game IDs match between import and analysis

**Key Fix:** Removed incorrect `game_id` field from auto-fetch upsert (games_pgn table doesn't have this column)

## Benefits

1. **No More Circular Reference Errors:** All error logging now safely extracts string messages
2. **Seamless Analysis:** Users can click "Analyze" even if import hasn't run or failed
3. **Automatic Import as Fallback:** PGNs are automatically fetched and saved for future use
4. **Better Error Messages:** More informative error messages when games truly can't be found
5. **Improved Debugging:** Detailed logs help diagnose import issues

## Root Cause Analysis - Why Import Might Fail

Potential issues to investigate:

1. **User ID Canonicalization Mismatch:**
   - Chess.com: user IDs are lowercased (`hikaru` → `hikaru`)
   - Lichess: user IDs preserve case (`Hikaru` → `Hikaru`)
   - Import and analysis must use same canonicalization

2. **Game ID Format Issues:**
   - Chess.com: URLs like `https://www.chess.com/game/live/123456`
   - Lichess: Direct game IDs like `abc123xyz`
   - Must extract correctly during import

3. **Silent Import Failures:**
   - Network issues during fetch
   - API rate limits
   - Database constraint violations
   - Missing error reporting

## Testing Recommendations

### Test Auto-Fetch Fallback:
1. Click "Analyze" on a game that hasn't been imported
2. Check Railway logs for:
   - `[SINGLE GAME ANALYSIS] Game not found in database, attempting to fetch from {platform}`
   - `[SINGLE GAME ANALYSIS] ✓ Successfully fetched PGN from {platform}`
3. Verify the analysis completes successfully
4. Check that subsequent analysis uses cached PGN from database

### Test Import System:
1. Click "Import Games" in the UI
2. Check Railway logs for:
   - `[import_games] Upserting X PGN rows`
   - `[import_games] Sample PGN row: {...}`
   - `[import_games] pgn upsert response: count= X`
3. Verify imported games appear in Match History
4. Click "Analyze" on an imported game
5. Check logs show:
   - `[SINGLE GAME ANALYSIS] Sample games for this user: [...]`
   - Game found in database without fetching from platform

### Verify No Circular References:
1. Open browser console (F12)
2. Click "Analyze" on any game
3. Verify no errors about "Converting circular structure to JSON"

## Debugging Guide

If analysis still fails after these changes, check Railway logs for:

1. **User ID Mismatch:**
   ```
   [SINGLE GAME ANALYSIS] Query params: user_id=hikaru, platform=chess.com
   [SINGLE GAME ANALYSIS] Sample games for this user: []
   ```
   → User ID canonicalization issue

2. **Game ID Mismatch:**
   ```
   [SINGLE GAME ANALYSIS] Sample games for this user: [{'provider_game_id': '12345', ...}]
   [SINGLE GAME ANALYSIS] Querying games_pgn by provider_game_id: 67890
   ```
   → Wrong game ID being passed

3. **Import Failure:**
   ```
   [import_games] ❌ PGN upsert error: ...
   ```
   → Database constraint or permission issue

## Notes

### API Endpoints:
- **Lichess:** Direct game export `https://lichess.org/game/export/{game_id}`
- **Chess.com:** Must search monthly archives (checks last 3 months)

### Database Schema:
- **games_pgn table:** (user_id, platform, provider_game_id, pgn, created_at, updated_at)
- **Unique constraint:** (user_id, platform, provider_game_id)
- **No game_id column** - uses provider_game_id only

### Flow:
1. User clicks "Analyze"
2. Backend queries games_pgn by (user_id, platform, provider_game_id)
3. If found → use cached PGN
4. If not found → fetch from platform → save to DB → analyze
5. Analysis uses PGN to generate move-by-move insights

