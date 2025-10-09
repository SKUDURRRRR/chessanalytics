# Move Classification Fix Report

## Issue Summary

**Problem:** Games were showing **0 mistakes** despite having 70.8% accuracy and 2 blunders. The move classification thresholds were completely misaligned with Chess.com standards.

**Root Cause:** Both backend and frontend were using **doubled thresholds** for move classification, making the system too lenient.

## The Bug

### Wrong Thresholds (Before Fix)

**Backend (`python/core/analysis_engine.py`):**
```python
# WRONG - All thresholds doubled!
is_inaccuracy = 100 < centipawn_loss <= 200  # Should be 50-100
is_mistake = 200 < centipawn_loss <= 400     # Should be 100-200
is_blunder = centipawn_loss > 400             # Should be 200+
```

**Frontend (`src/utils/accuracyCalculator.ts`):**
```typescript
// WRONG - Same bug as backend!
else if (centipawn_loss <= 200) {
  inaccuracies++  // Should be mistakes!
} else if (centipawn_loss <= 400) {
  mistakes++  // Should be blunders!
} else {
  blunders++  // Only catches extreme blunders!
}
```

### Why This Caused 0 Mistakes

With the wrong thresholds:
- Moves with 100-200 cp loss were classified as **inaccuracies** (should be **mistakes**)
- Moves with 200-400 cp loss were classified as **mistakes** (should be **blunders**)
- Only moves with 400+ cp loss were classified as **blunders**

This meant that actual mistakes (100-200 cp) were being mislabeled as inaccuracies, resulting in games showing 0 mistakes even when the player made significant errors.

## The Fix

### Correct Thresholds (Chess.com Standard)

| Classification | Centipawn Loss Range | Description |
|---------------|---------------------|-------------|
| **Best** | 0-5 cp | Engine's top choice |
| **Great** | 5-15 cp | Very strong moves |
| **Excellent** | 15-25 cp | Nearly optimal moves |
| **Good** | 25-50 cp | Solid play |
| **Inaccuracy** | 50-100 cp | Weak move |
| **Mistake** | 100-200 cp | Bad move that worsens position |
| **Blunder** | 200+ cp | Very bad move, loses material/game |

### Files Modified

#### 1. Backend Constants (`python/core/analysis_engine.py` lines 113-123)

```python
# Chess.com-aligned move classification thresholds
BASIC_BEST_THRESHOLD = 5  # Best moves (0-5cp loss)
BASIC_GREAT_THRESHOLD = 15  # Great moves (5-15cp loss)
BASIC_EXCELLENT_THRESHOLD = 25  # Excellent moves (15-25cp loss)
BASIC_GOOD_THRESHOLD = 25  # Good moves threshold for basic analysis
BASIC_ACCEPTABLE_THRESHOLD = 50  # Acceptable moves (25-50cp loss)
BASIC_INACCURACY_THRESHOLD = 100  # Inaccuracies (50-100cp loss)
BASIC_MISTAKE_THRESHOLD = 200  # Mistakes (100-200cp loss)
BASIC_BLUNDER_THRESHOLD = 200  # Blunders (200+cp loss)
```

#### 2. Stockfish Analysis Logic (`python/core/analysis_engine.py` lines 1402-1410)

```python
# Chess.com-aligned thresholds:
is_best = centipawn_loss <= 5
is_great = 5 < centipawn_loss <= 15
is_excellent = 15 < centipawn_loss <= 25
is_good = 25 < centipawn_loss <= 50
is_acceptable = 25 < centipawn_loss <= 50
is_inaccuracy = 50 < centipawn_loss <= 100  # Fixed: was 100-200
is_mistake = 100 < centipawn_loss <= 200    # Fixed: was 200-400
is_blunder = centipawn_loss > 200           # Fixed: was >400
```

#### 3. Frontend Classification (`src/utils/accuracyCalculator.ts` lines 69-82)

```typescript
// Chess.com-aligned move classification (CORRECTED)
if (centipawn_loss <= 5) {
  brilliant_moves++  // Best moves (0-5cp)
} else if (centipawn_loss <= 50) {
  good_moves++  // Includes Great, Excellent, Good (5-50cp)
} else if (centipawn_loss <= 100) {
  inaccuracies++  // Fixed: 50-100cp (was acceptable_moves++)
} else if (centipawn_loss <= 200) {
  mistakes++  // Fixed: 100-200cp (was inaccuracies++)
} else {
  blunders++  // Fixed: 200+cp (was only 400+cp)
}
```

#### 4. Documentation (`docs/MOVE_CLASSIFICATION_STANDARDS.md`)

Updated with correct thresholds and added key points section explaining the Chess.com alignment.

## Impact of the Fix

### Before Fix
- **Game shows:** 0 mistakes, 4 inaccuracies, 2 blunders
- **Reality:** Player made mistakes but they were mislabeled as inaccuracies

### After Fix (Expected)
- **Game will show:** More accurate classification
- Moves with 100-200 cp loss will now correctly appear as **mistakes**
- Moves with 200+ cp loss will correctly appear as **blunders**
- Moves with 50-100 cp loss will correctly appear as **inaccuracies**

## Testing Recommendations

1. **Re-analyze existing games** - Games analyzed with old thresholds will have incorrect classifications
2. **Verify mistake counts** - Games should now show realistic mistake counts
3. **Check accuracy alignment** - Compare with Chess.com analysis for the same games
4. **Test edge cases** - Verify moves at threshold boundaries (e.g., exactly 100cp, 200cp)

## Chess.com Alignment

The fix ensures our analysis matches industry standards:

✅ **Inaccuracy threshold:** 50-100 cp (matches Lichess and Chess.com)  
✅ **Mistake threshold:** 100-200 cp (Chess.com standard)  
✅ **Blunder threshold:** 200+ cp (Chess.com standard)

## References

- Chess.com CAPS2 algorithm: Uses similar thresholds for accuracy scoring
- Lichess standards: Inaccuracy starts at 50 centipawn loss
- Internal docs: `docs/MOVE_CLASSIFICATION_STANDARDS.md`

## Action Items

- [ ] Re-analyze games to get correct classifications
- [ ] Notify users about the fix if they've seen incorrect statistics
- [ ] Consider adding a migration script to reclassify old analyses
- [ ] Add automated tests to prevent threshold regression

---

**Fix Date:** October 8, 2025  
**Issue:** Move classification thresholds misaligned with Chess.com standards  
**Status:** ✅ Fixed in backend, frontend, and documentation

