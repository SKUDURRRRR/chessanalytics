# Follow-Up Task: Improve Tactical Context Recognition

## 📋 Issue Description

While captures are now consistently mentioned in comments (✅ fixed), the **tactical context** is sometimes inaccurate.

### Example:
**Move 3-4 Sequence:**
- Move 3: **Bc4** (White plays)
- Move 4: **Nf3** (White plays - BLUNDER, leaves bishop on c4 hanging)
- Move 4: **Bxc4** (Black captures - Excellent move)

**Current Comment:**
> "Book move. Bxc4 is a well-known opening continuation that maintains good piece coordination."

**Expected Comment:**
> "Excellent! By capturing the hanging bishop on c4, you exploit your opponent's blunder and win material. The opponent left this piece undefended on their previous move."

## 🎯 Goal

Improve AI's ability to recognize and describe tactical contexts:
1. **Punishing blunders** (capturing hanging pieces)
2. **Trading pieces** (equal exchanges)
3. **Sacrifices** (giving up material for compensation)
4. **Book moves** (actual opening theory)
5. **Tactical sequences** (captures as part of combinations)

## 🔍 Root Cause Analysis

### Current System Behavior:
1. Move is in opening phase (move ≤10)
2. Move is classified as "Excellent" or "Best"
3. System assumes it's opening theory
4. Uses "book move" template/context

### What's Missing:
- **Hanging piece detection** not connected to capture commentary
- **Previous move analysis** not referenced ("opponent just blundered")
- **Material balance tracking** not emphasized in capture context
- **Tactical pattern recognition** (pin, fork, skewer leading to capture) not integrated

## 💡 Proposed Solutions

### Option 1: Enhanced Hanging Piece Context (Easiest)
**When a capture occurs:**
1. Check if captured piece was hanging (`heuristic_details.new_hanging_pieces`)
2. If yes, modify AI prompt to emphasize "exploiting hanging piece"
3. Add context about opponent's previous move being a blunder

**Implementation:**
```python
# In ai_comment_generator.py
if captured_piece and is_capture:
    # Check if this piece was hanging
    heuristic_details = move_analysis.get('heuristic_details', {})
    hanging_pieces = heuristic_details.get('new_hanging_pieces', [])

    was_hanging = False
    for hanging in hanging_pieces:
        if hanging.get('square') == chess.square_name(move.to_square):
            was_hanging = True
            break

    if was_hanging:
        capture_info += f"""
- CRITICAL TACTICAL CONTEXT: This piece was HANGING (undefended)
- You are exploiting your opponent's previous move which left this piece unprotected
- This is winning material due to your opponent's blunder, not a book move
"""
```

### Option 2: Previous Move Analysis Integration (Better)
**Track tactical relationships between moves:**
1. Store opponent's previous move classification
2. If opponent's previous move was a blunder → Current capture is "punishing blunder"
3. If opponent's previous move was good → Current capture is "tactical opportunity" or "book move"

**Implementation:**
```python
# Add to move_analysis data structure
move_analysis['opponent_previous_move_quality'] = 'blunder' | 'mistake' | 'good' | 'best'

# In comment generation
if is_capture and opponent_previous_move_quality == 'blunder':
    tactical_context = "EXPLOITING_BLUNDER"
elif is_capture and game_phase == 'opening':
    tactical_context = "OPENING_THEORY"
```

### Option 3: Tactical Pattern Recognition (Most Complete)
**Add tactical pattern detector:**
1. Detect common patterns: hanging pieces, pins, forks, skewers, discovered attacks
2. Link captures to specific tactical patterns
3. Generate context-aware comments based on pattern type

**Patterns to detect:**
- **Hanging piece capture**: Opponent left piece undefended
- **Breaking pin**: Capturing a pinning piece
- **Fork result**: Capturing piece after a fork forced a move
- **Trade**: Equal or favorable exchange
- **Sacrifice response**: Capturing a sacrificed piece

## 🔧 Recommended Approach

**Phase 1 (Quick Win):** Implement Option 1
- Check if captured piece was hanging
- Add "exploiting blunder" context to AI prompt
- Override "book move" classification if piece was hanging

**Phase 2 (Medium Term):** Implement Option 2
- Track opponent's previous move quality
- Link current capture to opponent's mistake
- Add "in response to opponent's blunder" phrasing

**Phase 3 (Long Term):** Implement Option 3
- Build comprehensive tactical pattern recognition
- Create pattern-specific comment templates
- Integrate with AI generation for nuanced descriptions

## 📁 Files to Modify

### Primary:
- `python/core/ai_comment_generator.py` - Add hanging piece context to capture_info
- `python/core/coaching_comment_generator.py` - Pass hanging piece data to AI generator

### Secondary (Phase 2):
- `python/core/analysis_engine.py` - Track opponent's previous move quality
- `python/core/game_phase_detector.py` - Better opening theory detection

### Future (Phase 3):
- `python/core/tactical_pattern_detector.py` - New module for pattern recognition
- `python/core/heuristic_evaluator.py` - Enhance existing tactical detection

## 🧪 Test Cases

Create test games with:
1. ✅ Opponent blunders, player captures hanging piece
2. ✅ Forced sacrifice accepted (captures sacrificed piece)
3. ✅ Equal trade in opening (real book move)
4. ✅ Capture as part of tactical combination (fork → capture)
5. ✅ Breaking pin with capture

## 🎯 Success Criteria

- Hanging piece captures correctly identified as "exploiting blunder" ✅
- Book moves accurately distinguished from tactical opportunities ✅
- Previous move context included ("after opponent's mistake...") ✅
- Tactical patterns (pin, fork, etc.) recognized and mentioned ✅
- Comment accuracy improved by 80%+ on tactical captures ✅

## 📊 Priority

**Medium Priority** - This is about improving comment quality, not fixing broken functionality. The core issue (captures not mentioned) is already resolved.

**Estimated Effort:**
- Phase 1: 2-3 hours
- Phase 2: 4-6 hours
- Phase 3: 8-12 hours

## 🔗 Related Issues

- Sacrifice detection accuracy (see previous fixes)
- Opening book move detection vs tactical moves
- Hanging piece detection reliability
- AI prompt optimization for tactical understanding
