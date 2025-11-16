# Brilliant Move Detection - Chronological Changes

This document lists all changes made to `python/core/analysis_engine.py` during this conversation, in chronological order.

## Initial Problem
- User reported: Bf6 (queen sacrifice for mate) was not marked as brilliant
- Issue: Stockfish was showing high CP evaluation (857cp) instead of mate score because mate was beyond current depth

---

## Change #1: Enhanced PV Analysis for Mate Detection
**Location:** Lines ~1666-1672
**Purpose:** Capture Principal Variation (PV) after move to detect mate sequences even when Stockfish doesn't show mate evaluation

**Old Code:**
```python
info_after = engine.analyse(board, chess.engine.Limit(time=time_limit))
eval_after = info_after.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
```

**New Code:**
```python
# Use depth for better PV line to detect mate sequences
info_after = engine.analyse(board, chess.engine.Limit(depth=depth))
eval_after = info_after.get("score", chess.engine.PovScore(chess.engine.Cp(0), chess.WHITE))
# Capture PV after move to check for mate sequences
pv_after_moves = info_after.get("pv", [])
pv_after = [mv.uci() for mv in pv_after_moves] if pv_after_moves else []
```

**Impact:** Now captures PV line which can be analyzed for mate sequences

---

## Change #2: Enhanced Forced Mate Detection with PV Analysis
**Location:** Lines ~1877-1921
**Purpose:** Check PV for mate sequences in addition to immediate mate evaluation

**Old Code:**
```python
forcing_mate_trigger = (
    eval_after.pov(player_color).is_mate() and
    not eval_before.pov(player_color).is_mate() and
    abs(eval_after.pov(player_color).mate()) <= rating_thresholds['mate_in_moves']
)
```

**New Code:**
```python
# Method 1: Direct mate evaluation
immediate_mate = (
    eval_after.pov(player_color).is_mate() and
    not eval_before.pov(player_color).is_mate() and
    abs(eval_after.pov(player_color).mate()) <= rating_thresholds['mate_in_moves']
)

# Method 2: Check PV for mate sequence (handles cases where mate is beyond depth)
pv_contains_mate = False
if pv_after and len(pv_after) > 0:
    try:
        # Create a temporary board and play through the PV to check for mate
        temp_board = board.copy()
        mate_found = False
        for i, pv_move_uci in enumerate(pv_after[:10]):  # Check first 10 moves of PV
            try:
                pv_move = chess.Move.from_uci(pv_move_uci)
                if pv_move in temp_board.legal_moves:
                    temp_board.push(pv_move)
                    # Check if this position is mate
                    if temp_board.is_checkmate():
                        # Found mate in PV - count moves
                        mate_in_moves = (i + 1) // 2 + 1
                        if mate_in_moves <= rating_thresholds['mate_in_moves']:
                            pv_contains_mate = True
                            mate_found = True
                            break
            except Exception:
                continue
        # Don't use high evaluation alone as indicator - only if combined with sacrifice
    except Exception as e:
        print(f"[BRILLIANT DEBUG] Error checking PV for mate: {e}")

forcing_mate_trigger = immediate_mate or pv_contains_mate
```

**Impact:** Now detects mate sequences in PV even if Stockfish doesn't show immediate mate

---

## Change #3: Explicit Brilliant Marking for Sacrifice Leading to Mate
**Location:** Lines ~2332-2336
**Purpose:** Ensure sacrifice leading to mate is always marked brilliant

**Old Code:**
```python
elif forcing_mate_trigger:
    # Forced mate: must be best move (0-5cp)
    brilliant_via_sacrifice = sacrifice_trigger and centipawn_loss <= 5
```

**New Code:**
```python
elif forcing_mate_trigger:
    # Forced mate: must be best move (0-5cp) AND non-obvious
    # Only mark as brilliant if:
    # 1. It's a sacrifice leading to mate (always brilliant), OR
    # 2. It finds mate when there wasn't one AND it's non-obvious
    if sacrifice_trigger:
        # Sacrifice leading to mate is always brilliant (if non-obvious)
        brilliant_via_sacrifice = True
        print(f"[BRILLIANT DEBUG] {move_san_debug}: Sacrifice leading to mate detected - marking as brilliant")
    elif is_non_obvious and centipawn_loss <= 5:
        # Finding mate when there wasn't one before - but only if non-obvious
        brilliant_via_sacrifice = True
        print(f"[BRILLIANT DEBUG] {move_san_debug}: Found forced mate (non-obvious) - marking as brilliant")
    else:
        brilliant_via_sacrifice = False
```

**Impact:** Sacrifice leading to mate is now explicitly marked brilliant

---

## Change #4: Include Forcing Mate in Compensation Check
**Location:** Lines ~2067-2070
**Purpose:** Consider PV-detected mate as compensation for sacrifice

**Old Code:**
```python
# For mates, always consider as having compensation
if eval_after.pov(player_color).is_mate():
    has_compensation = True
```

**New Code:**
```python
# For mates, always consider as having compensation
# Check both immediate mate evaluation and PV for mate sequences
if eval_after.pov(player_color).is_mate():
    has_compensation = True
# Also check if PV contains mate or very high evaluation suggests mate
elif pv_after and len(pv_after) > 0:
    # Check if evaluation is extremely high (>700cp) which suggests mate
    if actual_cp > 700:
        has_compensation = True
```

**Impact:** High evaluations (suggesting mate) now count as compensation

---

## Change #5: Remove High Evaluation Alone as Brilliant Trigger
**Location:** Lines ~1915-1917
**Purpose:** Prevent false positives from high CP evaluations alone

**Old Code:**
```python
if not mate_found and actual_cp > 700:  # Very high evaluation suggests mate is coming
    # If evaluation is extremely high (>700cp) and we're not already winning, it's likely mate
    if not eval_before.pov(player_color).is_mate() and actual_cp > 700:
        pv_contains_mate = True
        print(f"[BRILLIANT DEBUG] {move_san_debug}: Very high evaluation ({actual_cp:.1f}cp) suggests mate sequence")
```

**New Code:**
```python
# Don't use high evaluation alone as indicator - only if combined with sacrifice
# High evaluation alone could just be winning material, not brilliant
# Only check PV for actual mate sequences, not just high evaluations
```

**Impact:** Removed false positive trigger from high CP alone

---

## Change #6: Add Forced Move Detection (CRITERION 0)
**Location:** Lines ~1836-1848
**Purpose:** Block forced moves (check evasions) from being brilliant

**New Code Added:**
```python
# -----------------------------------------------------------------------
# CRITERION 0: Check if move is forced (CRITICAL - must pass for ALL brilliants)
# -----------------------------------------------------------------------
# Forced moves (check evasion, only 1-3 legal moves) are NEVER brilliant
# Check this FIRST before other criteria
board.pop()  # Undo move to check position before move
num_legal_moves_before = len(list(board.legal_moves))
board.push(move)  # Restore move

# Check if move is forced (only 1-2 legal moves = forced, 3+ = might have choice)
# For sacrifices leading to mate, be more lenient (sometimes brilliant moves happen in tactical positions)
is_forced_move = num_legal_moves_before <= 2  # Only 1-2 moves = definitely forced

# Check if this is a king move (especially to escape check) - these are almost never brilliant
board.pop()  # Undo to check piece type
moving_piece_type = None
if board.piece_at(move.from_square):
    moving_piece_type = board.piece_at(move.from_square).piece_type
board.push(move)  # Restore

is_king_move = (moving_piece_type == chess.KING)
if is_king_move:
    print(f"[BRILLIANT DEBUG] {move_san_debug}: King move detected - rarely brilliant unless it's a sacrifice")

if is_forced_move:
    print(f"[BRILLIANT DEBUG] {move_san_debug}: Move appears forced (only {num_legal_moves_before} legal moves)")
```

**Impact:** Detects forced moves and king moves early

---

## Change #7: Final Brilliant Check with Overrides
**Location:** Lines ~2379-2396
**Purpose:** Add final safety checks to block false positives

**Old Code:**
```python
is_brilliant = brilliant_via_mate or brilliant_via_sacrifice
```

**New Code:**
```python
# FINAL CHECK: Brilliant moves must be non-obvious (not forced)
# Exception: Sacrifices leading to mate can be brilliant even in tactical positions
# CRITICAL: King moves to escape check are almost never brilliant
if is_king_move and not sacrifice_trigger:
    # King moves (especially to escape check) are almost never brilliant
    # Only allow if it's a sacrifice leading to mate
    if not (sacrifice_trigger and forcing_mate_trigger):
        is_brilliant = False
        print(f"[BRILLIANT DEBUG] {move_san_debug}: OVERRIDE - king move without sacrifice, not brilliant")

if brilliant_via_sacrifice and forcing_mate_trigger:
    # Sacrifice for mate is brilliant even if slightly forced (3-4 legal moves)
    # But still require it's not completely forced (1-2 moves) AND not a king move
    if not is_brilliant:  # Only set if not already blocked
        is_brilliant = not is_forced_move and not (is_king_move and not sacrifice_trigger)
    if is_brilliant:
        print(f"[BRILLIANT DEBUG] {move_san_debug}: Sacrifice for mate - allowing even with {num_legal_moves_before} legal moves")
else:
    # For other brilliant moves, require non-obvious AND not forced AND not a king move
    if not is_brilliant:  # Only set if not already blocked
        is_brilliant = (brilliant_via_mate or brilliant_via_sacrifice) and is_non_obvious and not is_forced_move and not (is_king_move and not sacrifice_trigger)

if is_forced_move:
    is_brilliant = False
    print(f"[BRILLIANT DEBUG] {move_san_debug}: OVERRIDE - forced move (only {num_legal_moves_before} legal moves), not brilliant")

# Final safety check: If move is a check that just wins material (not a sacrifice), it's not brilliant
board.pop()  # Check if move is a check
board.push(move)
is_check = board.is_check()
if is_check and not sacrifice_trigger and not forcing_mate_trigger:
    # Check that just wins material (fork/pin) is not brilliant
    is_brilliant = False
    print(f"[BRILLIANT DEBUG] {move_san_debug}: OVERRIDE - check that just wins material (not a sacrifice), not brilliant")
```

**Impact:** Multiple safety checks to prevent false positives

---

## Change #8: Stricter Sacrifice Detection (Only Clear Tactical Sacrifices)
**Location:** Lines ~2055
**Purpose:** Block forks/pins that just win material from being brilliant

**Old Code:**
```python
sacrifice_detected = is_true_sacrifice or is_clear_tactical_sacrifice
```

**New Code:**
```python
# For brilliant moves, ONLY accept clear tactical sacrifices (piece can be captured)
# Don't accept "true sacrifices" that don't involve piece being capturable
# This prevents forks/pins from being marked as brilliant
sacrifice_detected = is_clear_tactical_sacrifice  # Only clear tactical sacrifices for brilliant
```

**Impact:** Only moves where piece can be captured after sacrifice are considered (prevents forks/pins)

---

## Current Issues

Based on the user's feedback:
1. **Still getting false positives:** `Nxg3+`, `Qxf2+` are marked brilliant for opponent
2. **User moves not detected:** Real brilliant moves for user aren't being found
3. **Formula still inaccurate:** The balance is still off

## Root Cause Analysis

The issue is that moves like `Nxg3+` and `Qxf2+` are:
- Checks (giving check)
- Winning material (forks/pins)
- BUT NOT sacrifices (piece can't be captured after the move)

The current logic should block these, but they're still getting through. This suggests:
1. The `is_check` check might not be working correctly
2. The `sacrifice_detected` might be incorrectly set to True
3. The `moving_piece_can_be_captured` check might be failing

## Change #9: Improved Check Detection for Non-Sacrifice Moves
**Location:** Lines ~2419-2433
**Purpose:** Fix check detection to properly block checks that just win material

**Old Code:**
```python
# Final safety check: If move is a check that just wins material (not a sacrifice), it's not brilliant
board.pop()  # Check if move is a check
board.push(move)
is_check = board.is_check()
if is_check and not sacrifice_trigger and not forcing_mate_trigger:
    # Check that just wins material (fork/pin) is not brilliant
    is_brilliant = False
    print(f"[BRILLIANT DEBUG] {move_san_debug}: OVERRIDE - check that just wins material (not a sacrifice), not brilliant")
```

**New Code:**
```python
# Final safety check: If move is a check that just wins material (not a sacrifice), it's not brilliant
# CRITICAL: Checks that fork/pin (win material) without sacrifice are NOT brilliant
# The board currently has the move applied, so we can check if it gives check
move_gives_check = board.is_check()

# Block checks that just win material (forks/pins) without sacrifice
# This is the KEY fix: Nxg3+, Qxf2+ are checks that win material, not sacrifices
if move_gives_check:
    if not sacrifice_trigger and not forcing_mate_trigger:
        # Check that just wins material (fork/pin) is not brilliant
        is_brilliant = False
        print(f"[BRILLIANT DEBUG] {move_san_debug}: OVERRIDE - check that just wins material (not a sacrifice), not brilliant")
        print(f"[BRILLIANT DEBUG] {move_san_debug}: move_gives_check={move_gives_check}, sacrifice_trigger={sacrifice_trigger}, forcing_mate_trigger={forcing_mate_trigger}")
    else:
        print(f"[BRILLIANT DEBUG] {move_san_debug}: Check move allowed - sacrifice_trigger={sacrifice_trigger}, forcing_mate_trigger={forcing_mate_trigger}")
```

**Impact:** Simplified check detection (board already has move applied, no need to pop/push)

---

## Change #10: Enhanced Non-Capture Sacrifice Detection
**Location:** Lines ~2160-2197
**Purpose:** Ensure non-capture moves only count as sacrifices if piece can be captured

**Old Code:**
```python
# Type 2: Non-Capture Sacrifices (moving piece to hanging square)
elif moving_value >= rating_thresholds['min_sacrifice_value']:
    board.push(move)
    to_square = move.to_square
    attackers = board.attackers(not player_color, to_square)
    defenders = board.attackers(player_color, to_square)
    piece_hangs = len(attackers) > len(defenders)
    board.pop()

    if piece_hangs:
        # ... sacrifice logic ...
        sacrifice_trigger = (not_already_crushing and has_compensation)
```

**New Code:**
```python
# Type 2: Non-Capture Sacrifices (moving piece to hanging square)
elif moving_value >= rating_thresholds['min_sacrifice_value']:
    board.push(move)
    to_square = move.to_square
    attackers = board.attackers(not player_color, to_square)
    defenders = board.attackers(player_color, to_square)
    piece_hangs = len(attackers) > len(defenders)
    piece_can_be_captured = len(attackers) > 0  # Can be captured if attacked
    board.pop()

    # CRITICAL: For non-capture moves, only consider it a sacrifice if:
    # 1. Piece can be captured (attacked), AND
    # 2. It's a significant sacrifice (moving_value >= min_sacrifice_value)
    # This prevents moves that just win material from being marked as sacrifices
    if piece_can_be_captured and piece_hangs:
        # ... sacrifice logic ...
        sacrifice_trigger = (not_already_crushing and has_compensation)
    else:
        # Piece can't be captured or doesn't hang - not a sacrifice
        sacrifice_trigger = False
        print(f"[BRILLIANT DEBUG] {move_san_debug}: Non-capture move - piece can't be captured, not a sacrifice")
else:
    # Piece value too low to be a sacrifice
    sacrifice_trigger = False
    print(f"[BRILLIANT DEBUG] {move_san_debug}: Moving piece value too low, not a sacrifice")
```

**Impact:** Non-capture moves must have piece capturable to be considered sacrifices

---

## Change #11: Added Debug Logging for Piece Capture Detection
**Location:** Lines ~2359-2360
**Purpose:** Better debugging for why moves aren't marked as sacrifices

**New Code Added:**
```python
else:
    # Piece can't be captured - this is just winning material, not a sacrifice
    # Not brilliant (even if it's a fork/pin)
    brilliant_via_sacrifice = False
    print(f"[BRILLIANT DEBUG] {move_san_debug}: Piece can't be captured after move - not a sacrifice, just winning material (fork/pin)")
```

**Impact:** Better visibility into why moves like Nxg3+, Qxf2+ aren't marked brilliant

---

## Current Status

### Issues Remaining:
1. **Opponent moves still marked brilliant:** `Nxg3+`, `Qxf2+` are checks that win material but not sacrifices
2. **User brilliants not detected:** Real brilliant moves for user aren't being found

### Root Cause Analysis:
The logic should now:
- ✅ Block checks that just win material (if `sacrifice_trigger = False`)
- ✅ Block king moves without sacrifice
- ✅ Block forced moves (1-2 legal moves)
- ✅ Only accept clear tactical sacrifices (piece can be captured)

**But the issue might be:**
1. `sacrifice_trigger` is incorrectly `True` for these moves
2. The check detection happens too late in the flow
3. Non-capture moves might be incorrectly detecting sacrifices

### Next Steps:
1. **Check logs** to see why `Nxg3+` and `Qxf2+` have `sacrifice_trigger = True`
2. **Verify** the final check override is working correctly
3. **Test** with the specific game to see debug output
