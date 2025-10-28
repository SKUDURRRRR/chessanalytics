# Fix: Missing best_move_san in Stockfish Analysis

## Issue

The "Show Follow-Up" button was not appearing for Mistakes and Inaccuracies because the `best_move_san` field was missing from Stockfish analysis results.

## Root Cause

In `python/core/analysis_engine.py`, the Stockfish analysis function (`_analyze_move_stockfish`) was creating `MoveAnalysis` objects **without** the `best_move_san` field, while the heuristic analysis function had it.

This caused the FollowUpExplorer component to hide itself because:
```typescript
const hasBetterMove = useMemo(() => {
  return currentMove.bestMoveSan &&  // ❌ This was null/empty!
         currentMove.bestMoveSan !== currentMove.san &&
         !['best', 'brilliant'].includes(currentMove.classification)
}, [currentMove])
```

## Fix Applied

Added `best_move_san` conversion in the Stockfish analysis path:

```python
# Convert best move to SAN notation for frontend display
best_move_san = ""
if best_move_before:
    try:
        # Temporarily undo the actual move to get back to "before" state
        board.pop()
        best_move_san = board.san(best_move_before)
        # Restore the actual move
        board.push(move)
    except Exception as e:
        logger.warning(f"Failed to convert best move to SAN: {e}")
        best_move_san = best_move_before.uci()

# Create basic move analysis
move_analysis = MoveAnalysis(
    # ... other fields ...
    best_move_san=best_move_san,  # ✅ Now included!
    # ... rest of fields ...
)
```

## Impact

**Before Fix:**
- Mistakes/Inaccuracies showed suggestion arrows ✅
- BUT "Show Follow-Up" button was missing ❌

**After Fix:**
- Mistakes/Inaccuracies show suggestion arrows ✅
- "Show Follow-Up" button now appears ✅
- Users can explore better variations ✅

## Testing Needed

1. Re-analyze a game (or analyze a new game)
2. Navigate to a Mistake or Inaccuracy move
3. Verify:
   - ✅ Suggestion arrow appears (green arrow for best move)
   - ✅ "Show Follow-Up" button appears
   - ✅ Clicking button shows the best move variation
   - ✅ Auto-play through the PV line works

## Files Modified

- ✅ `python/core/analysis_engine.py` - Added `best_move_san` conversion in Stockfish analysis

## Related Issues

- This fix complements the earlier changes that expanded suggestion arrows to all non-best moves
- The frontend logic was correct, but the backend data was incomplete

---

**Date**: October 28, 2025
**Priority**: High (core feature not working)
**Status**: ✅ Fixed - Ready for testing
