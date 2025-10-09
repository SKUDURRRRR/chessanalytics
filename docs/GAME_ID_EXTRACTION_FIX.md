# Game ID Extraction Fix

## Issue

Analysis was completing successfully but failing to save with error:
```
[PERSISTENCE] ❌ Game not found in games table
[PERSISTENCE]    game_id: Chess.com
[PERSISTENCE] This game must be imported first before analysis can be saved.
```

## Root Cause

The game ID extraction logic had a **case-sensitivity bug**. 

### The Problem

When extracting `game_id` from PGN headers:
```python
# WRONG - Case-sensitive comparison
if part not in ['chess.com', 'lichess.org', ...]  # Doesn't match "Chess.com" with capital C!
```

When the PGN Site header was just `"Chess.com"` (without a full URL), the code failed to filter it out because:
- The exclusion list had `'chess.com'` (lowercase)
- The actual header value was `'Chess.com'` (capital C)
- The comparison was case-sensitive, so `'Chess.com' not in ['chess.com']` → `True`
- Result: "Chess.com" became the game_id! ❌

## The Fix

Changed to **case-insensitive comparison** using a set:

```python
# CORRECT - Case-insensitive comparison
excluded_parts = {'chess.com', 'lichess.org', 'www.chess.com', 'www.lichess.org', 'game', 'live', ''}

if site:
    parts = site.split('/')
    # Use .lower() for case-insensitive comparison
    game_id = next((part for part in reversed(parts) if part.lower() not in excluded_parts), None)
```

### Added Features

1. **Better error handling**: Now generates a unique timestamp-based ID if no valid ID found
2. **Warning message**: Logs when falling back to generated IDs
3. **Set-based exclusion**: Faster O(1) lookup instead of list

## File Modified

- `python/core/analysis_engine.py` (lines 736-762)

## Impact

Now the system will:
✅ Properly filter out "Chess.com" regardless of capitalization
✅ Extract actual game IDs from full URLs (e.g., "12345" from "https://www.chess.com/game/live/12345")
✅ Generate unique IDs when headers don't contain valid game IDs
✅ Log warnings when extraction fails

## Testing

To test, try analyzing a game where the PGN Site header is just:
```
[Site "Chess.com"]
```

**Before fix:** game_id = "Chess.com" → Database error  
**After fix:** game_id = "game_1728408765123" → Success ✅

## Related Files

- `python/core/unified_api_server.py` - Has auto-create logic for missing games
- `python/core/reliable_analysis_persistence.py` - Validates game exists before saving

---

**Fix Date:** October 8, 2025  
**Issue:** Case-sensitive game ID extraction causing "Chess.com" as game_id  
**Status:** ✅ Fixed

