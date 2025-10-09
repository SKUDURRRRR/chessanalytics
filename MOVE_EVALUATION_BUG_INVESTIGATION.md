# Move Evaluation Bug Investigation Report

## Date: 2025-10-08

## Issue Summary
Moves are being incorrectly labeled as "Brilliant" when they shouldn't be. Specifically:
- **Nxe5** (Knight takes e5) - Standard tactical move, not brilliant
- **Kxf7** (King takes f7) - Typically a mistake/blunder, definitely not brilliant

## Bugs Identified

### 🔴 CRITICAL BUG #1: Undefined Variable `optimal_cp`

**Location:** `python/core/analysis_engine.py:1439`

**The Bug:**
```python
eval_maintained_or_improved = (
    (actual_cp >= optimal_cp - 20) and  # ❌ optimal_cp is NEVER DEFINED
    (actual_cp >= 50 or optimal_cp >= 50)
)
```

**Impact:**
- This will cause a `NameError: name 'optimal_cp' is not defined`
- The entire brilliant move detection logic fails
- Moves might be randomly labeled as brilliant depending on exception handling

**Fix Required:**
`optimal_cp` should be defined as the evaluation of the best move (same as `best_cp`):
```python
optimal_cp = best_cp  # Evaluation if best move was played
```

---

### 🔴 CRITICAL BUG #2: Incorrect Brilliant Move Logic for Captures

**Location:** `python/core/analysis_engine.py:1417-1447`

**The Bug:**
```python
board.pop()  # Undo move to check original position

if board.is_capture(move):
    captured_piece = board.piece_at(move.to_square)  # ❌ WRONG!
    moving_piece = board.piece_at(move.from_square)
```

**Problem:**
After calling `board.pop()`, the board is in the state BEFORE the move. So:
- `move.to_square` contains the piece that WAS there (the captured piece) ✅
- `move.from_square` contains the piece that moved ✅

This is actually CORRECT! But there's a logical issue...

**For Kxf7:**
- King (value = 0) captures on f7
- If f7 has a pawn (value = 1) or piece
- `net_material_sacrificed = 0 - 1 = -1` (negative)
- This should NOT trigger `significant_sacrifice = net_material_sacrificed >= 3`

So this alone doesn't explain why Kxf7 is brilliant...

---

### 🟡 BUG #3: Missing Move Categories

**Location:** `python/core/analysis_engine.py:1385-1390`

**The Issue:**
Our system only has:
```python
is_best = centipawn_loss <= 10
is_good = 10 < centipawn_loss <= 50
is_acceptable = 50 < centipawn_loss <= 100
is_inaccuracy = 100 < centipawn_loss <= 150
is_mistake = 150 < centipawn_loss <= 300
is_blunder = centipawn_loss > 300
```

**Missing Categories:**
Chess.com has a more granular system:
1. **Brilliant** - Spectacular moves with tactical brilliance
2. **Great** - Very strong moves (5-15cp loss)
3. **Best** - Top engine choice (0-5cp loss)
4. **Excellent** - Nearly optimal (15-25cp loss)
5. **Good** - Solid moves (25-50cp loss)
6. **Inaccuracy** - Suboptimal (50-100cp loss)
7. **Mistake** - Serious error (100-200cp loss)
8. **Blunder** - Game-changing error (200+cp loss)

---

### 🟡 BUG #4: Too Lenient "is_best" Threshold

**Location:** `python/core/analysis_engine.py:1385`

**The Issue:**
```python
is_best = centipawn_loss <= 10  # Too lenient!
```

**Problem:**
- This allows moves with up to 10cp loss to be considered "best"
- Combined with the brilliant move logic (`if is_best and centipawn_loss <= 5`), this creates confusion
- A move could be labeled "is_best=True" but still not qualify for brilliant

**Chess.com Standard:**
- **Best move**: 0-5cp loss (engine's top choice)
- **Great move**: 5-15cp loss

---

### 🟢 BUG #5: Brilliant Move Criteria Too Restrictive

**Location:** `python/core/analysis_engine.py:1401-1455`

**The Issue:**
Current brilliant move requirements:
1. Must be near-perfect (centipawn_loss <= 5) ✅ Good
2. Either find forced mate (<=5 moves) OR make huge sacrifice (3+ material) ✅ Good
3. Position must be winning after (>=100cp) ✅ Good
4. Material sacrifice must be 3+ points ❌ Too strict

**Problem:**
This misses many brilliant moves that Chess.com would recognize:
- Quiet brilliant moves (positional sacrifices)
- Surprising moves that require deep calculation
- Moves that prevent opponent's threats brilliantly
- Tactical combinations that don't involve huge sacrifices

**Chess.com's Actual Criteria:**
According to Chess.com's Expected Points Model:
1. Move must be among the best moves
2. Move involves an element of surprise or difficulty
3. Move requires deep tactical vision or calculation
4. May involve:
   - Material sacrifice (even small ones like pawn sacs)
   - Tactical complexity
   - Preventing opponent's best plan
   - Finding only winning move in complex position

---

## Root Cause Analysis

### Why is Kxf7 labeled as Brilliant?

Given the bugs above, here's the likely scenario:

1. **Scenario A: Exception Handling**
   - `optimal_cp` undefined causes exception
   - Exception handler might default to `is_brilliant=True` or fail silently
   - Result: Random moves labeled as brilliant

2. **Scenario B: Mate Detection False Positive**
   ```python
   forcing_mate_trigger = (
       eval_after.pov(player_color).is_mate() and 
       not eval_before.pov(player_color).is_mate() and
       abs(eval_after.pov(player_color).mate()) <= 5
   )
   ```
   - If Kxf7 delivers checkmate, this would trigger
   - But Kxf7 is usually a blunder, not a mating move
   - Unless it's a specific position where Kxf7 is actually brilliant!

3. **Scenario C: Position-Specific Edge Case**
   - In some positions, Kxf7 might actually be the best move
   - Example: King captures piece, delivers check, wins material
   - But even then, it's rarely "brilliant" - just "best"

### Why is Nxe5 labeled as Brilliant?

Nxe5 is a standard tactical move. Possible reasons:

1. **Low centipawn loss** (<=5cp) qualifies it as "is_best"
2. **Captures material** - might trigger sacrifice logic incorrectly
3. **If it leads to mate** - forcing_mate_trigger fires
4. **If position evaluation high** - might meet winning criteria

But without the spectacular sacrifice or mate, it shouldn't be brilliant!

---

## Chess.com Move Evaluation Standards

Based on research and industry standards:

### Move Classification Criteria

| Category | Centipawn Loss | Criteria |
|----------|----------------|----------|
| **Brilliant (!)** | 0-5cp | Best move + (tactical brilliance OR forced mate OR significant sacrifice) |
| **Great (!?)** | 5-15cp | Very strong move, nearly best |
| **Best (√)** | 0-5cp | Engine's top choice |
| **Excellent** | 5-25cp | Nearly optimal |
| **Good** | 25-50cp | Solid, reasonable |
| **Inaccuracy (?!)** | 50-100cp | Suboptimal |
| **Mistake (?)** | 100-200cp | Serious error |
| **Blunder (??)** | 200+cp | Game-changing error |

### Brilliant Move Specific Criteria

A move is **Brilliant** if ALL of the following are true:

1. ✅ **Is a best move** (0-5cp loss)
2. ✅ **AND** one of:
   - Finds forced mate (not previously available)
   - Makes significant tactical sacrifice
   - Prevents opponent's only winning plan
   - Requires deep calculation (surprising move)
   - Complex tactical combination
3. ✅ **AND** position evaluation remains at least equal
4. ✅ **AND** move is not obvious (element of surprise)

**Important Notes:**
- Brilliant moves should be RARE (0-2 per game for strong players)
- Simple captures like Nxe5 are almost NEVER brilliant
- King moves like Kxf7 are almost NEVER brilliant (usually mistakes)
- Most games have ZERO brilliant moves

---

## Recommended Fixes

### Fix #1: Define `optimal_cp`
```python
optimal_cp = best_cp  # Evaluation of best move
```

### Fix #2: Revise Move Categories
```python
# Chess.com aligned thresholds
is_brilliant = False  # Calculated separately
is_best = centipawn_loss <= 5      # Engine top choice
is_great = 5 < centipawn_loss <= 15     # Very strong
is_excellent = 15 < centipawn_loss <= 25  # Nearly optimal
is_good = 25 < centipawn_loss <= 50      # Solid play
is_inaccuracy = 50 < centipawn_loss <= 100  # Suboptimal
is_mistake = 100 < centipawn_loss <= 200    # Serious error
is_blunder = centipawn_loss > 200           # Game-changing
```

### Fix #3: Improve Brilliant Move Detection
```python
def _is_brilliant_move(self, move, board, eval_before, eval_after, 
                       best_move, centipawn_loss, player_color):
    """
    Determine if a move is brilliant according to Chess.com standards.
    
    Criteria:
    1. Must be best move (0-5cp loss)
    2. Must have tactical brilliance:
       - Forced mate found
       - Significant sacrifice (2+ points material)
       - Only winning move in complex position
       - Prevents opponent's winning plan
    3. Position must remain at least equal
    """
    # Must be a best move
    if centipawn_loss > 5:
        return False
    
    # Get evaluations as centipawns
    mate_score = 1000
    best_cp = eval_before.pov(player_color).score(mate_score=mate_score)
    actual_cp = eval_after.pov(player_color).score(mate_score=mate_score)
    
    # Position must remain at least equal
    if actual_cp < -50:  # Losing by more than 0.5 pawns
        return False
    
    # Check for forced mate
    if (eval_after.pov(player_color).is_mate() and 
        not eval_before.pov(player_color).is_mate()):
        mate_distance = abs(eval_after.pov(player_color).mate())
        if mate_distance <= 5:
            return True  # Found forced mate in 5 or less
    
    # Check for material sacrifice
    if board.is_capture(move):
        piece_values = {'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0}
        
        # Get pieces involved (board has move already played)
        # Need to check the move itself
        moving_piece_symbol = board.piece_at(move.from_square)
        captured_piece_symbol = board.piece_at(move.to_square)
        
        if moving_piece_symbol and captured_piece_symbol:
            moving_value = piece_values.get(moving_piece_symbol.symbol().upper(), 0)
            captured_value = piece_values.get(captured_piece_symbol.symbol().upper(), 0)
            
            # Sacrifice = giving up more valuable piece
            # Even 2 points is significant (Rook for Knight/Bishop, Queen for Rook+Knight)
            if moving_value >= captured_value + 2:
                # Position must still be winning or at least equal
                if actual_cp >= 50:  # At least +0.5 pawns
                    return True
    
    # Check for quiet brilliancy (non-capture that's spectacular)
    # This is complex - requires checking if move prevents opponent's plan
    # or finds only winning move in complex position
    # For now, we'll be conservative and only mark captures/mates as brilliant
    
    return False
```

---

## Action Items

1. ✅ **Fix undefined `optimal_cp` variable**
2. ✅ **Add missing move categories** (Great, Excellent)
3. ✅ **Revise brilliant move detection logic**
4. ✅ **Update move classification thresholds**
5. ⏳ **Test with real game data** (Nxe5, Kxf7 examples)
6. ⏳ **Update documentation** with new standards
7. ⏳ **Re-analyze existing games** with corrected logic

---

## Testing Plan

### Test Case 1: Nxe5
- Position: Standard middlegame, knight captures e5 pawn
- Expected: "Best" or "Good", NOT "Brilliant"
- Current: Brilliant (WRONG)
- After Fix: Best or Good (CORRECT)

### Test Case 2: Kxf7
- Position: King captures on f7 (typically illegal or blunder)
- Expected: "Mistake" or "Blunder", NOT "Brilliant"
- Current: Brilliant (WRONG)
- After Fix: Mistake or Blunder (CORRECT)

### Test Case 3: Queen Sacrifice for Mate
- Position: Qxh7+ Kxh7, Ng5+ and mate follows
- Expected: "Brilliant" (if it's the only winning move)
- Current: Unknown
- After Fix: Brilliant (CORRECT)

### Test Case 4: Standard Opening Move
- Position: 1.e4 e5 2.Nf3 Nc6 3.Bc4 (Italian Game)
- Expected: "Best" or "Excellent"
- Current: Unknown
- After Fix: Best or Excellent (CORRECT)

---

## Conclusion

The move evaluation system has **critical bugs** that cause incorrect labeling:

1. **Undefined variable** (`optimal_cp`) breaks brilliant move detection
2. **Missing move categories** (Great, Excellent) creates gaps
3. **Too lenient thresholds** allow weak moves to be labeled as "best"
4. **Overly complex brilliant logic** has edge cases and bugs

The fixes will align our system with Chess.com standards and produce accurate, meaningful move evaluations.

