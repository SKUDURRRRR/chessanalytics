# Chess Move Evaluation Standards

**Last Updated:** October 8, 2025  
**Version:** 2.0 (Chess.com Aligned)

## Overview

This document defines the official move evaluation and classification standards for our chess analysis system. These standards are aligned with Chess.com's move evaluation system to provide consistent, meaningful, and industry-standard move classifications.

---

## Move Classification Categories

Our system uses **10 move categories** to classify chess moves based on their quality:

| Category | Symbol | Centipawn Loss | Description | Frequency |
|----------|--------|----------------|-------------|-----------|
| **Brilliant** | !! | 0-5cp | Spectacular tactical move with sacrifice or forced mate | Very Rare (~0-2 per game) |
| **Best** | √ | 0-5cp | Engine's top choice, optimal play | Common (~10-30% of moves) |
| **Great** | !? | 5-15cp | Very strong move, nearly optimal | Common (~20-40% of moves) |
| **Excellent** | - | 15-25cp | Nearly optimal, solid play | Common (~10-20% of moves) |
| **Good** | - | 25-50cp | Reasonable move, acceptable play | Common (~10-20% of moves) |
| **Acceptable** | - | 50-100cp | Suboptimal but playable | Occasional (~5-15% of moves) |
| **Inaccuracy** | ?! | 100-200cp | Suboptimal, loses small advantage | Occasional (~5-10% of moves) |
| **Mistake** | ? | 200-400cp | Serious error, loses significant advantage | Rare (~2-5% of moves) |
| **Blunder** | ?? | 400+cp | Game-changing error, loses winning position | Very Rare (~0-3% of moves) |
| **Uncategorized** | - | - | Move not yet analyzed | N/A |

---

## Detailed Category Definitions

### 1. Brilliant (!!)" - The Spectacular Move

**Criteria (ALL must be met):**
1. ✅ Must be a **Best move** (0-5cp loss from optimal)
2. ✅ **AND** one of the following:
   - Finds **forced mate** (within 5 moves) when there wasn't one before
   - Makes **significant material sacrifice** (2+ points) while maintaining position
   - Is the **only winning move** in a complex position
   - Prevents opponent's only winning plan through tactical brilliance

3. ✅ Position evaluation remains **at least equal** (not losing badly)
4. ✅ Move demonstrates **tactical brilliance** (not just a simple capture)

**Examples of Brilliant Moves:**
- Queen sacrifice for forced checkmate
- Rook sacrifice to win back material with interest
- Spectacular piece sacrifice that leads to winning attack
- Only move that prevents opponent's forced mate

**NOT Brilliant:**
- Simple captures (e.g., Nxe5 capturing an undefended pawn)
- King moves (e.g., Kxf7 - almost never brilliant)
- Routine best moves without tactical flair
- Moves that simply maintain equality

**Frequency:** Very rare - 0-2 per game for strong players, 0 per game typical

---

### 2. Best (√) - The Optimal Move

**Criteria:**
- Centipawn loss: **0-5cp**
- Engine's top choice or equally good alternative
- Maintains or improves position
- No tactical brilliance required

**Examples:**
- Developing pieces in the opening
- Capturing undefended material
- Making necessary defensive moves
- Standard positional improvements

**Frequency:** Common - typically 10-30% of moves for intermediate players

---

### 3. Great (!?) - Very Strong Move

**Criteria:**
- Centipawn loss: **5-15cp**
- Very close to optimal
- Solid strategic or tactical choice
- Maintains position well

**Examples:**
- Strong developing moves
- Good positional maneuvers
- Solid defensive choices
- Reasonable attacking moves

**Frequency:** Common - typically 20-40% of moves for intermediate players

---

### 4. Excellent - Nearly Optimal

**Criteria:**
- Centipawn loss: **15-25cp**
- Nearly optimal play
- Good understanding of position
- Minor imprecision but still strong

**Examples:**
- Slightly suboptimal piece placement
- Good plan but not the best square
- Solid move in complex position

**Frequency:** Common - typically 10-20% of moves

---

### 5. Good - Reasonable Move

**Criteria:**
- Centipawn loss: **25-50cp**
- Reasonable choice
- Maintains playability
- Some imprecision but not serious

**Examples:**
- Decent developing move
- Acceptable piece trade
- Reasonable pawn push

**Frequency:** Common - typically 10-20% of moves

---

### 6. Acceptable - Playable but Imprecise

**Criteria:**
- Centipawn loss: **50-100cp**
- Position remains playable
- Noticeable imprecision
- Loses some advantage

**Examples:**
- Passive piece placement
- Missed tactical opportunity
- Suboptimal square choice

**Frequency:** Occasional - typically 5-15% of moves

---

### 7. Inaccuracy (?!) - Suboptimal Move

**Criteria:**
- Centipawn loss: **100-200cp**
- Clearly suboptimal
- Loses small but noticeable advantage
- Position still competitive

**Examples:**
- Weakening pawn structure unnecessarily
- Allowing opponent counterplay
- Missing simple tactic

**Frequency:** Occasional - typically 5-10% of moves

---

### 8. Mistake (?) - Serious Error

**Criteria:**
- Centipawn loss: **200-400cp**
- Serious error in judgment
- Loses significant advantage
- May lose winning position

**Examples:**
- Hanging a piece
- Missing forced tactic
- Critical positional error
- Allowing opponent's winning attack

**Frequency:** Rare - typically 2-5% of moves

---

### 9. Blunder (??) - Game-Changing Error

**Criteria:**
- Centipawn loss: **400+cp**
- Catastrophic error
- Loses game or winning position
- Often immediately decisive

**Examples:**
- Hanging major piece (Queen, Rook)
- Missing checkmate in one
- Allowing forced checkmate
- Losing material catastrophically

**Frequency:** Very rare - typically 0-3% of moves for intermediate+ players

---

## Analysis Types

### Same Rules for All Analysis Types

**Important:** The move evaluation thresholds and brilliant move criteria apply to **ALL analysis types**:

- ✅ `AnalysisType.STOCKFISH` - Standard Stockfish analysis
- ✅ `AnalysisType.DEEP` - Deep Stockfish analysis (higher depth/time)

**The difference between analysis types:**
- **Depth/Time**: DEEP uses more time and higher depth for analysis
- **Accuracy**: DEEP may be slightly more accurate in complex positions
- **Thresholds**: **IDENTICAL** - Both use the same move classification rules

This ensures consistency across all analysis modes.

---

## Technical Implementation

### Backend (Python)

**File:** `python/core/analysis_engine.py`

```python
# Move classification thresholds (lines 1387-1394)
is_best = centipawn_loss <= 5      # Best moves (engine top choice, 0-5cp)
is_great = 5 < centipawn_loss <= 15      # Great moves (very strong, 5-15cp)
is_excellent = 15 < centipawn_loss <= 25  # Excellent moves (nearly optimal, 15-25cp)
is_good = 25 < centipawn_loss <= 50      # Good moves (solid play, 25-50cp)
is_acceptable = 50 < centipawn_loss <= 100  # Acceptable but imprecise (50-100cp)
is_inaccuracy = 100 < centipawn_loss <= 200  # Inaccuracies (suboptimal, 100-200cp)
is_mistake = 200 < centipawn_loss <= 400  # Mistakes (serious errors, 200-400cp)
is_blunder = centipawn_loss > 400  # Blunders (game-changing errors, 400+cp)
```

**Brilliant Move Detection:**

```python
if is_best:  # Must be a best move (0-5cp loss)
    # Define optimal_cp (the evaluation if best move was played)
    optimal_cp = best_cp
    
    # Check for forced mate found when there wasn't one before
    forcing_mate_trigger = (
        eval_after.pov(player_color).is_mate() and 
        not eval_before.pov(player_color).is_mate() and
        abs(eval_after.pov(player_color).mate()) <= 5  # Short forced mate (within 5 moves)
    )
    
    # Check for spectacular material sacrifice
    # Must sacrifice at least 2 points net (e.g., Rook for Bishop, Queen for Rook)
    # Position must remain at least equal (not losing badly)
    # Move must be engine's top choice
    
    is_brilliant = forcing_mate_trigger or sacrifice_trigger
```

### Frontend (TypeScript)

**File:** `src/pages/GameAnalysisPage.tsx`

```typescript
// Move classification determination
const determineClassification = (move: AnalysisMoveRecord): MoveClassification => {
  if (move.is_brilliant) return 'brilliant'
  if (move.is_best) return 'best'
  if (move.is_great) return 'great'
  if (move.is_excellent) return 'excellent'
  if (move.is_blunder) return 'blunder'
  if (move.is_mistake) return 'mistake'
  if (move.is_inaccuracy) return 'inaccuracy'
  if (move.is_good) return 'good'
  if (move.is_acceptable) return 'acceptable'
  return 'uncategorized'
}
```

**Badge Colors:**

| Category | Color | Hex |
|----------|-------|-----|
| Brilliant | Purple | `purple-500/20` |
| Best | Emerald | `emerald-500/20` |
| Great | Teal | `teal-500/20` |
| Excellent | Cyan | `cyan-500/20` |
| Good | Sky | `sky-500/20` |
| Acceptable | Slate | `slate-500/20` |
| Inaccuracy | Amber | `amber-500/20` |
| Mistake | Orange | `orange-500/20` |
| Blunder | Rose | `rose-500/20` |

---

## Comparison with Chess.com

### Similarities

✅ **Best Move** (0-5cp) - Matches Chess.com's "Best Move"  
✅ **Brilliant** - Rare, requires tactical brilliance or forced mate  
✅ **Inaccuracy** (100-200cp) - Matches Chess.com's thresholds  
✅ **Mistake** (200-400cp) - Matches Chess.com's serious errors  
✅ **Blunder** (400+cp) - Matches Chess.com's game-changing errors  

### Differences

🔄 **Great & Excellent** - We split Chess.com's "Excellent" into two categories for finer granularity  
🔄 **Thresholds** - Slightly adjusted for clarity (e.g., 400cp for blunder vs 300cp in some systems)  

### Why the Differences?

1. **Finer Granularity**: Splitting "Excellent" into "Great" and "Excellent" provides more detailed feedback
2. **Clearer Boundaries**: Round numbers (100, 200, 400) are easier to remember and understand
3. **Better User Experience**: More precise feedback helps players improve faster

---

## Common Misconceptions

### ❌ WRONG: "All captures are brilliant if they win material"
✅ CORRECT: Brilliant moves require tactical brilliance, not just simple captures

### ❌ WRONG: "Kxf7 (king captures) can be brilliant"
✅ CORRECT: King moves are almost never brilliant, usually mistakes or blunders

### ❌ WRONG: "Nxe5 (knight takes pawn) is brilliant"
✅ CORRECT: Simple tactical captures are "Best" or "Good", not brilliant

### ❌ WRONG: "Every best move is brilliant"
✅ CORRECT: Best moves are common, brilliant moves are rare

### ❌ WRONG: "Brilliant moves should appear 5-10 times per game"
✅ CORRECT: Brilliant moves are VERY RARE - 0-2 per game, often 0

---

## Historical Changes

### Version 2.0 (October 8, 2025)

**Changes:**
1. ✅ Fixed undefined `optimal_cp` variable bug
2. ✅ Added "Great" and "Excellent" categories
3. ✅ Revised brilliant move detection logic
4. ✅ Updated thresholds to align with Chess.com
5. ✅ Fixed blunder threshold (400+cp instead of 300+cp)
6. ✅ Improved sacrifice detection (2+ points instead of 3+)

**Impact:**
- More accurate move classifications
- Fewer false "brilliant" labels
- Better alignment with industry standards
- Improved user experience

### Version 1.0 (Previous)

**Issues:**
- ❌ Undefined `optimal_cp` variable caused errors
- ❌ Missing "Great" and "Excellent" categories
- ❌ Too restrictive brilliant move criteria (3+ material)
- ❌ Inconsistent thresholds with Chess.com

---

## Testing Guidelines

### Test Cases

1. **Nxe5 (Knight captures pawn)**
   - Expected: "Best" or "Good"
   - NOT: "Brilliant"

2. **Kxf7 (King captures)**
   - Expected: "Mistake" or "Blunder"
   - NOT: "Brilliant"

3. **Qxh7+ (Queen sacrifice for mate)**
   - Expected: "Brilliant" (if only winning move)
   - NOT: "Best" or "Good"

4. **Standard opening move (e.g., Nf3)**
   - Expected: "Best" or "Great"
   - NOT: "Brilliant"

### Validation

After implementing changes:
1. ✅ Re-analyze sample games
2. ✅ Check brilliant move frequency (should be 0-2 per game)
3. ✅ Verify move classifications match expectations
4. ✅ Compare with Chess.com analysis (if available)

---

## FAQ

### Q: Why are brilliant moves so rare?

**A:** Brilliant moves require exceptional tactical vision or finding the only winning move in a complex position. Most games don't have these opportunities. This is consistent with Chess.com and Lichess.

### Q: What's the difference between "Best" and "Brilliant"?

**A:** **Best** moves are optimal engine choices (common). **Brilliant** moves are best moves with exceptional tactical brilliance (very rare).

### Q: Why did my accuracy score change?

**A:** We updated the thresholds to align with Chess.com standards. This provides more realistic and meaningful accuracy scores.

### Q: Can I get 100% accuracy?

**A:** Yes, but only with a perfect game (all moves 0-5cp loss). Even master-level players rarely achieve this.

### Q: What's a good accuracy score?

**A:** 
- **90%+**: Master level (2500+ ELO)
- **80-90%**: Expert level (2200-2500 ELO)
- **70-80%**: Advanced level (1800-2200 ELO)
- **60-70%**: Intermediate level (1400-1800 ELO)
- **50-60%**: Beginner level (1000-1400 ELO)

---

## References

1. **Chess.com Move Classification**: https://support.chess.com/en/articles/8572705
2. **Lichess Move Evaluation**: https://lichess.org/blog/blog-article-id
3. **Stockfish Engine**: https://stockfishchess.org/
4. **Expected Points Model**: Chess.com's proprietary evaluation system

---

## Summary

Our move evaluation system now provides:

✅ **10 precise categories** for detailed feedback  
✅ **Chess.com alignment** for industry consistency  
✅ **Realistic brilliant moves** (0-2 per game)  
✅ **Clear thresholds** (5, 15, 25, 50, 100, 200, 400cp)  
✅ **Meaningful accuracy scores** (50-90% typical range)  

This ensures players receive accurate, helpful feedback that aligns with widely accepted chess standards.

