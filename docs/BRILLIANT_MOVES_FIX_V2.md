# Brilliant Moves Classification Fix

## Issue
After deploying the Stockfish fix, analysis is working but showing **unrealistic brilliant move counts** (3 brilliant moves in a single game). This is far too high - brilliant moves should appear in less than 1% of games.

## Root Cause Analysis

### Old Logic (Too Lenient)
```python
# Line 1348 - OLD
material_sacrificed = moving_value > captured_value + 2  # Too lenient!
position_still_good = actual_cp >= -50  # -50cp is LOSING!
```

**Problems:**
1. ❌ `-50cp` threshold means you can be **losing** by half a pawn and still get brilliant
2. ❌ `+2` material difference is too small (Knight takes pawn could be marked brilliant)
3. ❌ No check for forced mate length (mate in 20 moves marked same as mate in 2)
4. ❌ No requirement that position must be **winning** after sacrifice
5. ❌ Centipawn loss threshold was 10cp (too lenient for "brilliant")

### Chess.com/Lichess Standards for Brilliant Moves

**Official criteria:**
- Must be the **best or near-best move** (0-5cp loss maximum)
- Either:
  - **Find forced mate** (short, within 5 moves)
  - **Spectacular sacrifice** (3+ points of material) that **maintains winning advantage**
- Must be difficult to find (not obvious)
- Should appear in **~1% of games** or less for average players

## New Logic (Stricter)

### Requirements
```python
# Must be near-perfect move
if is_best and centipawn_loss <= 5:  # Stricter: 0-5cp, not 0-10cp
```

### For Forced Mate
```python
forcing_mate_trigger = (
    eval_after.pov(player_color).is_mate() and 
    not eval_before.pov(player_color).is_mate() and
    abs(eval_after.pov(player_color).mate()) <= 5  # NEW: Short forced mate only
)
```

**Examples:**
- ✅ Find mate in 3 when there wasn't mate before → Brilliant
- ❌ Find mate in 10 when there wasn't mate before → Just "Best"
- ❌ Continue mate in 3 when already had mate in 4 → Just "Best"

### For Spectacular Sacrifice
```python
# 1. Significant sacrifice (3+ points NET)
net_material_sacrificed = moving_value - captured_value
significant_sacrifice = net_material_sacrificed >= 3

# 2. Position WINNING after sacrifice
position_winning_after = actual_cp >= 100  # At least +1.0 pawns

# 3. Maintained or improved evaluation
eval_maintained_or_improved = (
    (actual_cp >= optimal_cp - 20) and  # Didn't get worse
    (actual_cp >= 50 or optimal_cp >= 50)  # Was/is winning
)

sacrifice_trigger = (
    significant_sacrifice and 
    position_winning_after and 
    eval_maintained_or_improved
)
```

**Examples:**
- ✅ Sacrifice Rook for pawn (5-1=4 points) to win: Eval goes from +50cp to +150cp → Brilliant
- ✅ Sacrifice Queen for Rook (9-5=4 points) to force mate: Eval +200cp → Brilliant
- ❌ Exchange (Rook for Knight+Pawn = 5-4=1 point) → Just "Best"
- ❌ Sacrifice Knight (3 points) but position goes from +30cp to +20cp → Just "Best"
- ❌ Sacrifice piece but position is only +50cp after → Just "Best" (not "winning enough")

## Comparison: Old vs New

| Criteria | Old Threshold | New Threshold | Impact |
|----------|---------------|---------------|--------|
| CP Loss | 0-10cp | **0-5cp** | Much stricter |
| Sacrifice Material | 2+ points | **3+ points** | No small exchanges |
| Position After | -50cp (losing!) | **+100cp (winning)** | Must be clearly better |
| Forced Mate Length | Any length | **5 moves or less** | Only short tactics |
| Position Maintained | Not checked | **Must stay winning** | No deterioration |

## Expected Results

### Before Fix
- 3 brilliant moves per game ❌
- ~5-10% of games have brilliant moves ❌
- Simple exchanges marked as brilliant ❌

### After Fix
- 0-1 brilliant moves per 100+ games ✅
- Only truly spectacular moves ✅
- High-level tactical sacrifices only ✅

## Real Examples

### Should Be Brilliant ✅
1. **Rxe8+ Rxe8 Qxf7+!** - Queen sacrifice forcing mate in 3
2. **Nxf7!** - Knight sacrifice destroying king safety, eval from +50 to +300
3. **Bxh7+!** - Bishop sacrifice forcing mate in 4 when no mate was available

### Should NOT Be Brilliant ❌
1. **Rxe5** - Just winning a pawn cleanly (no sacrifice)
2. **Qxf8** - Trading queens when winning (not a sacrifice)
3. **Nxc6** - Winning piece with equal trade (exchange, not sacrifice)
4. **Any book opening move** - Even if perfect, not "brilliant" in opening

## Files Changed

### 1. `python/core/analysis_engine.py`
- Lines 1320-1383: Complete rewrite of brilliant move detection
- Added stricter thresholds
- Added forced mate length check
- Added position evaluation requirements
- Added material sacrifice validation

## Deployment

### Commit and Deploy
```bash
git add python/core/analysis_engine.py
git commit -m "Fix: Stricter brilliant move classification to match Chess.com/Lichess standards"
git push origin development
```

Railway will auto-deploy (~2 minutes).

### Verify Fix

1. **Re-analyze previously analyzed games:**
   - Games that showed 3 brilliants should now show 0-1
   - Most "brilliants" should be reclassified as "Best" moves

2. **Test with known brilliant moves:**
   - Find games with famous sacrifices (Tal, Kasparov)
   - Verify those ARE marked brilliant

3. **Check statistics:**
   - Brilliant moves should appear in <1% of games
   - Average game: 0 brilliants
   - Exceptional game: 1 brilliant

## Testing Locally (Optional)

```bash
# In python directory
python -m pytest tests/ -v -k brilliant
```

Or test manually with a known brilliant move position:
```python
from python.core.analysis_engine import ChessAnalysisEngine
import chess

engine = ChessAnalysisEngine()
board = chess.Board("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4")
move = chess.Move.from_uci("f3g5")  # Ng5 - not brilliant, just aggressive
# Should NOT be marked brilliant

board2 = chess.Board("r2qr1k1/1p3pbp/p2p1np1/2pP4/4P3/2N2N2/PP2BPPP/R2QR1K1 w - - 0 15")
move2 = chess.Move.from_uci("f3g5")  # Ng5 attacking f7, might be brilliant if forces mate
# Should only be brilliant if it forces short mate
```

## Monitoring

After deployment, monitor:
- **Brilliant move frequency**: Should drop from ~3-5% to <1% of games
- **User feedback**: Check if brilliant moves feel "special" again
- **No false negatives**: Truly brilliant moves (famous sacrifices) should still be detected

## Rollback Plan

If too strict (missing obvious brilliant moves):
```bash
git revert HEAD
git push origin development
```

Then adjust thresholds:
- Increase CP loss threshold to 8cp
- Decrease winning position threshold to +75cp
- Increase forced mate length to 7 moves

## Success Criteria

- ✅ Brilliant moves appear in <2% of games (ideally <1%)
- ✅ Average game: 0 brilliant moves
- ✅ Famous sacrifices (Immortal Game, etc.) still detected
- ✅ No simple exchanges marked as brilliant
- ✅ Only forced mates within 5 moves marked brilliant

## Notes

This is a **conservative fix** - it's better to miss some borderline brilliant moves than to mark ordinary moves as brilliant. The goal is to make brilliant moves feel **special and rare**, which matches the Chess.com/Lichess standard.

If we find we're missing too many legitimate brilliant moves, we can slightly relax the thresholds in a future update.

