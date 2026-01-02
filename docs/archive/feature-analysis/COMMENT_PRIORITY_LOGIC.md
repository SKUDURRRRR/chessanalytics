# Comment Generation Priority Logic

## Problem Statement
Comments were being generated with incorrect priorities, leading to:
- Generic position descriptions overriding tactical mistakes
- "Solid and positional character" comments when the Queen is hanging
- Sacrifices mentioned when no pieces were captured

---

## Solution: Clear Priority Hierarchy

### **Priority 1: Critical Tactical Issues (HIGHEST)**
**Always commented on, never overridden**

- ✅ **Blunders** (400+ centipawn loss)
  - Hanging Queen or Rook
  - Checkmate in one missed
  - Losing major material

- ✅ **Forced Mate Sequences**
  - Mate in 2-3 moves
  - Unstoppable mating attacks

**Example:** "This move leaves your Queen on b5 hanging! Your opponent can capture it with Nc3xb5."

---

### **Priority 2: Major Tactical Issues**
**Must be highlighted, not generic commentary**

- ✅ **Mistakes** (200-400 centipawn loss)
  - Hanging valuable pieces (Knight, Bishop)
  - Poor exchanges (losing material)
  - Missing forced wins

- ✅ **Significant Material Loss**
  - SEE score < -100 (losing ≥1 pawn without compensation)

**Example:** "This move hangs your Knight on f6. Look for ways to defend it or find a better square."

---

### **Priority 3: Move-Specific Analysis**
**Important moves that deserve specific commentary**

- ✅ **Brilliant Moves**
  - Tactical sacrifices with compensation
  - Forcing sequences (mate threats, checks)
  - Non-obvious best moves

- ✅ **Inaccuracies** (100-200 centipawn loss)
  - Suboptimal moves that weaken position
  - Missed better alternatives

- ✅ **Excellent/Best Moves**
  - Strong moves worth celebrating
  - Teaching moments for good play

**Example:** "Excellent! This knight fork wins material and maintains your advantage."

---

### **Priority 4: Contextual Commentary (LOWEST)**
**Generic advice, only when no tactical issues**

- ✅ **Position Descriptions** (moves 5-10, 14-17, etc.)
  - "The position is becoming sharp..."
  - "Piece coordination is improving..."

- ✅ **Phase Transitions**
  - "Entering the middlegame..."
  - "The endgame has begun..."

- ✅ **Generic Positional Advice**
  - Opening principles
  - General strategy

**Example:** "This position is starting to take on a solid character. Control the center and develop pieces."

---

## Implementation

### `generate_coaching_comment()` Flow

```python
def generate_coaching_comment(...):
    # 1. Determine move quality
    move_quality = self._determine_move_quality(move_analysis)

    # 2. CHECK FOR CRITICAL TACTICAL ISSUES FIRST
    has_critical_tactical_issue = self._has_critical_tactical_issue(move_analysis)

    # 3. Only use special comments (position descriptions) if NO tactical issues
    special_comment = None
    if not has_critical_tactical_issue:
        special_comment = self._check_for_special_comments(...)

    # 4. Use special comment OR generate move-specific comment
    if special_comment:
        main_comment = special_comment  # Only if no tactical issues
    else:
        main_comment = self._generate_main_comment(...)  # Tactical/move-specific
```

### `_has_critical_tactical_issue()` Logic

```python
def _has_critical_tactical_issue(self, move_analysis):
    """Returns True if move has tactical issues that MUST be highlighted."""

    # Priority 1: Blunders
    if move_analysis.get('is_blunder'):
        return True

    # Priority 2: Mistakes
    if move_analysis.get('is_mistake'):
        return True

    # Priority 3: Inaccuracies
    if move_analysis.get('is_inaccuracy'):
        return True

    # Priority 3: Brilliant moves (always highlight!)
    if move_analysis.get('is_brilliant'):
        return True

    # Check hanging pieces (critical if Queen/Rook)
    new_hanging = heuristic_details.get('new_hanging_pieces', [])
    for piece in new_hanging:
        if piece['symbol'] in ['Q', 'R']:
            return True
        if piece['symbol'] in ['N', 'B'] and is_mistake:
            return True

    # Check material loss
    if see_score < -100:  # Losing ≥1 pawn worth
        return True

    # Check evaluation drop
    if centipawn_loss > 100:  # Inaccuracy threshold
        return True

    return False
```

---

## Key Rules

### ✅ **DO:**
1. Always prioritize tactical accuracy over generic commentary
2. Highlight hanging pieces (especially Queen, Rook, minor pieces in mistakes)
3. Mention specific tactical issues (what's hanging, where, why)
4. Use position descriptions only for good/routine moves
5. Let brilliant moves shine through (don't override with generic text)

### ❌ **DON'T:**
1. Use generic position descriptions when there's a tactical mistake
2. Override blunders/mistakes with "solid character" commentary
3. Mention sacrifices when no pieces were captured
4. Confuse centipawn loss with material sacrifice
5. Use position descriptions for inaccuracies/mistakes/blunders

---

## Testing Examples

### Example 1: Move 6 d3 (Mistake - Hanging Queen)
**Before (WRONG):**
> "This position is starting to take on a rather solid and positional character..."

**After (CORRECT):**
> "This move is a mistake because it leaves your Queen on b5 hanging and undefended. Your opponent can capture it with Nc3xb5, winning significant material."

### Example 2: Move 9 Bxg5 (Good capture, no issues)
**Before (CORRECT):**
> "Good move! This captures the white knight and improves your position."

**After (STILL CORRECT):**
> "Good move! This captures the white knight and improves your position."

### Example 3: Move 7 Nxe5 (Brilliant sacrifice)
**Before (might be overridden):**
> Generic position description

**After (CORRECT):**
> "Brilliant! This knight sacrifice opens up devastating tactical threats. The follow-up pressure on f7 creates a forced sequence leading to checkmate!"

---

## Result

Comments now follow a clear priority hierarchy:
1. **Tactical issues** → Specific tactical commentary
2. **Good/routine moves** → Position descriptions (if in update window)
3. **No more generic comments** → When hanging pieces/mistakes occur

The system will now properly highlight the hanging Queen in move 6 instead of giving generic positional advice.
