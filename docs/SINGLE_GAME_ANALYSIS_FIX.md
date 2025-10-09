# Single Game Analysis Fix

## Problem Identified

When users clicked "Analyze" next to a specific game in the match history, the system was **incorrectly analyzing multiple games** instead of just the selected game.

### Root Cause

The issue was in the backend API logic in `unified_api_server.py`:

1. **Frontend Request**: Match history sends `game_id` and `provider_game_id` but **no PGN data**
2. **Backend Logic**: The API only checked for `request.pgn` to determine single game analysis
3. **Fallback Behavior**: Since no PGN was provided, it fell through to **batch analysis**
4. **Result**: Instead of analyzing 1 game, it analyzed up to 10 games (the default limit)

### Code Evidence

**Frontend Request (MatchHistory.tsx):**
```typescript
const response = await fetch(`${baseUrl}/api/v1/analyze?use_parallel=false`, {
  method: 'POST',
  body: JSON.stringify({
    user_id: userId,
    platform,
    analysis_type: 'stockfish',
    game_id: gameIdentifier,        // ✅ Game ID provided
    provider_game_id: game.provider_game_id ?? null,
    // ❌ No PGN data provided
  }),
})
```

**Backend Logic (Before Fix):**
```python
if request.pgn:
    # Single game analysis
    return await _handle_single_game_analysis(request)
elif request.fen:
    # Position/move analysis
    ...
else:
    # Batch analysis - ❌ This was triggered!
    background_tasks.add_task(_perform_batch_analysis, ...)
```

## Solution Implemented

### 1. Added Game ID Detection
Updated the API logic to detect single game analysis by game_id:

```python
# Determine analysis type based on provided parameters
if request.pgn:
    # Single game analysis with PGN
    return await _handle_single_game_analysis(request)
elif request.game_id or request.provider_game_id:  # ✅ New condition
    # Single game analysis by game_id - fetch PGN from database
    return await _handle_single_game_by_id(request)
elif request.fen:
    # Position/move analysis
    ...
else:
    # Batch analysis
```

### 2. Created New Handler Function
Implemented `_handle_single_game_by_id()` that:

1. **Fetches PGN**: Looks up the game in the `games_pgn` table
2. **Validates Game**: Ensures the game exists and belongs to the user
3. **Analyzes Single Game**: Uses the same analysis engine but only for one game
4. **Saves Results**: Stores the analysis in the database

```python
async def _handle_single_game_by_id(request: UnifiedAnalysisRequest) -> UnifiedAnalysisResponse:
    """Handle single game analysis by game_id - fetch PGN from database."""
    # 1. Get game_id from request
    game_id = request.game_id or request.provider_game_id
    
    # 2. Fetch PGN from database
    game_response = db_client.table('games_pgn').select('pgn, provider_game_id').or_(
        f'provider_game_id.eq.{game_id},game_id.eq.{game_id}'
    ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()
    
    # 3. Analyze the single game
    game_analysis = await engine.analyze_game(pgn_data, request.user_id, request.platform, analysis_type_enum, game_id)
    
    # 4. Save results
    success = await _save_game_analysis(game_analysis)
```

## Testing

Created test script `test_single_game_analysis.py` to verify:
- Single game analysis by game_id works correctly
- Only one game is analyzed (not multiple)
- Proper error handling for missing games

## Impact

### Before Fix
- **User clicks "Analyze" on 1 game** → **System analyzes up to 10 games**
- **Performance**: Unnecessary resource usage
- **User Experience**: Confusing behavior, longer wait times

### After Fix
- **User clicks "Analyze" on 1 game** → **System analyzes exactly 1 game**
- **Performance**: Efficient single game analysis
- **User Experience**: Predictable, fast analysis

## Files Modified

1. **`python/core/unified_api_server.py`**:
   - Updated API routing logic to detect game_id requests
   - Added `_handle_single_game_by_id()` function
   - Improved error handling and validation

## Verification

To verify the fix works:

1. **Click "Analyze" on any game in match history**
2. **Check backend logs** - should show single game analysis
3. **Verify database** - only one analysis record should be created
4. **Check performance** - analysis should complete much faster

## Conclusion

The fix ensures that when users click "Analyze" on a specific game in match history, only that single game is analyzed, providing the expected behavior and better performance.
