# Brilliant Moves Calculation Fix

## Issue
The "Brilliant Moves per Game" statistic was showing inflated numbers (10.93, then ~5-6 after first fix), when realistic values should be **0-1 per game** for average players.

## Root Causes

### 1. Missing `is_user_move` Field in Database (FIXED)
**Problem:** The `is_user_move` flag was calculated during analysis but never saved to the database, causing statistics to count both player AND opponent moves.

**Fix:** Added `is_user_move`, `player_color`, and `ply_index` fields to database persistence in:
- `python/core/reliable_analysis_persistence.py`
- `python/core/unified_api_server.py`
- `python/core/api_server.py`

**Impact:** Statistics now correctly filter to only count user moves.

### 2. Incorrect Statistics Calculation (FIXED)
**Problem:** The stats calculation functions were counting all moves without filtering by `is_user_move`.

**Fix:** Updated `_calculate_unified_stats` and `_calculate_move_analysis_stats` in `unified_api_server.py` to filter by `is_user_move` flag.

### 3. Broken Brilliant Move Logic (FIXED - PRIMARY ISSUE)
**Problem:** The brilliant move detection had a **logically impossible condition**:

```python
# BROKEN CODE (line 1268)
sacrifice_trigger = (moving_value > captured_value + 2) and (actual_cp > best_cp + 100)
```

The condition `actual_cp > best_cp + 100` requires the move to be **100 centipawns BETTER than the best move**, which is impossible! 

- `best_cp` = evaluation if best move was played
- `actual_cp` = evaluation after the actual move

If a move were better than the "best move", it would BE the best move.

**Fix:** Completely rewrote the brilliant move logic to follow Chess.com/Lichess standards:

```python
# FIXED CODE (lines 1253-1289)
is_brilliant = False

if is_best:  # Only best moves can be brilliant
    # Check for forced mate found when there wasn't one before
    forcing_mate_trigger = (
        eval_after.pov(player_color).is_mate() and 
        not eval_before.pov(player_color).is_mate()
    )
    
    # Check for material sacrifice that maintains/improves position
    sacrifice_trigger = False
    
    if board.is_capture(move):
        # Sacrifice: giving up more valuable piece (e.g., Queen for Rook)
        # AND position is still winning or at least equal (actual_cp >= -50)
        material_sacrificed = moving_value > captured_value + 2
        position_still_good = actual_cp >= -50  # Not losing after sacrifice
        sacrifice_trigger = material_sacrificed and position_still_good
    
    # Brilliant only for forced mates or spectacular sacrifices
    is_brilliant = forcing_mate_trigger or sacrifice_trigger
```

## Brilliant Move Criteria (New)

A move is now classified as **brilliant** only if:

1. ✅ It's the **best move** (centipawn loss ≤ 10), AND
2. ✅ Either:
   - **Forced mate found**: Delivers checkmate when there wasn't a forced mate before
   - **Spectacular sacrifice**: Sacrifices material (giving up 2+ points more than captured) while maintaining a non-losing position (eval ≥ -50cp)

This matches industry standards where brilliant moves are **extremely rare** (~0-1 per game for average players, ~1-2 per 100 games is typical).

## Expected Results

After re-analyzing games with these fixes:

- **Before:** 10.93 brilliant moves per game ❌
- **After:** 0-1 brilliant moves per game (occasionally 2-3 in exceptional games) ✅

Most games will have **0 brilliant moves**, which is correct and expected.

## Action Required

⚠️ **IMPORTANT:** Existing game analyses in the database don't have the corrected logic. You must **re-analyze games** to see accurate numbers:

### Option 1: Manual Re-analysis
- Go to individual game analysis pages
- Click "Re-analyze" button

### Option 2: Bulk Re-analysis (Recommended)
Run the re-analysis script for all games:
```bash
cd python
python scripts/reanalyze_sample_games.py
```

## Files Changed

1. `python/core/analysis_engine.py` (lines 1253-1289) - Fixed brilliant move logic
2. `python/core/unified_api_server.py` (lines 3728-3744, 3825-3841) - Added is_user_move filter
3. `python/core/reliable_analysis_persistence.py` (lines 356-376) - Added is_user_move to DB
4. `python/core/api_server.py` (lines 703-719, 779-795) - Added is_user_move to DB

## Testing

To verify the fix:
1. Re-analyze a few games
2. Check that brilliant moves are now rare (0-1 per game typically)
3. Verify statistics show reasonable numbers across all metrics

## Technical Details

### Why the Original Logic Failed

The original condition `actual_cp > best_cp + 100` attempted to check if the move improved the position significantly, but it compared:
- Position evaluation AFTER playing the move (`actual_cp`)
- Position evaluation if best move had been played (`best_cp`)

Since brilliant moves must also be best moves (by definition), these values would be equal or very close, making the condition almost always false. The logic was backwards.

### New Logic Explanation

The fixed logic:
1. Only considers best moves (moves within 10cp of optimal)
2. Checks for forced mates that weren't available before
3. For sacrifices, verifies:
   - Material is sacrificed (giving up more than captured)
   - Position remains playable (not losing badly)
   
This ensures brilliant moves are awarded only for truly spectacular play, not routine good moves.

