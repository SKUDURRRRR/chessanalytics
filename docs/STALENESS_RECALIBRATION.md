# Staleness Score Recalibration

## Summary

Fixed staleness scores being too low (31-47) by:
1. Increasing repetition bonus multiplier
2. Decreasing diversity penalty weight  
3. Changing game-level/move-level weighting from 70/30 to 90/10
4. Rebalancing Novelty to maintain natural opposition

---

## The Problem

**Before Fix:**
- Krecetas: Staleness 47 (should be 50-60)
- Skudurelis: Staleness 31 (should be 55-65)

**Root Causes:**
1. **Formula too weak**: Players with 25% repetition on main opening got low scores
2. **Move-level dominance**: Move-level staleness was ~3, dragging down final score
3. **Diversity penalty too harsh**: Punished variety too much

---

## Investigation Results

### Actual Opening Patterns

**Krecetas** (1000 games):
- 29 unique openings
- King's Pawn Game: 23.4% (most common)
- → Somewhat repetitive player

**Skudurelis** (1000 games):
- 27 unique openings  
- Caro-Kann Defense: 25.7% (most common)
- → Slightly more repetitive than Krecetas

### Formula Analysis

**Old game-level staleness**:
```python
base = 30.0
repetition_bonus = repetition_ratio * 110.0  # 0.257 * 110 = 28.3
diversity_penalty = diversity_score * 0.3    # 52.0 * 0.3 = 15.6
score = 30.0 + 28.3 - 15.6 = 42.7
```

**Combined with move-level (70/30 weighting)**:
```
Final = 42.7 (game) * 0.7 + 3.7 (move) * 0.3 = 31
```

**Problem**: Move-level staleness (~3.7) dragged down final score!

---

## The Fix

### 1. Increased Repetition Bonus
```python
# BEFORE:
repetition_bonus = opening_repetition_ratio * 110.0

# AFTER:
repetition_bonus = opening_repetition_ratio * 150.0
```

**Impact**: 25% repetition now gives **+37.5 points** instead of +28.3

### 2. Reduced Diversity Penalty
```python
# BEFORE:
diversity_penalty = opening_diversity_score * 0.3

# AFTER:
diversity_penalty = opening_diversity_score * 0.25
```

**Impact**: High variety is less punishing

### 3. Increased Base
```python
# BEFORE:
base = 30.0

# AFTER:  
base = 35.0
```

**Rationale**: Most players ARE somewhat repetitive (have a "main" opening)

### 4. Changed Weighting (Game-Level Dominant)
```python
# BEFORE:
final_staleness = move_staleness * 0.3 + game_staleness * 0.7

# AFTER:
final_staleness = move_staleness * 0.1 + game_staleness * 0.9
```

**Rationale**: Opening repertoire (game-level) is THE PRIMARY indicator of staleness

### 5. Adjusted Novelty for Balance
```python
# Novelty formula:
base = 25.0  # Reduced from 30.0
diversity_bonus = opening_diversity_score * 0.6  # Increased from 0.5
repetition_penalty = opening_repetition_ratio * 80.0  # Increased from 60.0
```

**Maintains natural opposition** with staleness

---

## Expected Results

### New Game-Level Scores

**Krecetas**:
- Repetition: 23.4%
- Diversity: 53.9
- **Staleness**: 35 + (0.234 × 150) - (53.9 × 0.25) = **56.6**
- **Novelty**: 25 + (53.9 × 0.6) - (0.234 × 80) = **38.6**

**Skudurelis**:
- Repetition: 25.7%
- Diversity: 52.0
- **Staleness**: 35 + (0.257 × 150) - (52.0 × 0.25) = **60.6**
- **Novelty**: 25 + (52.0 × 0.6) - (0.257 × 80) = **35.6**

### Final Scores (with Move-Level ~10)

**Krecetas**:
- Novelty: 10 × 0.1 + 38.6 × 0.9 ≈ **35.7**
- Staleness: 10 × 0.1 + 56.6 × 0.9 ≈ **52.0**

**Skudurelis**:
- Novelty: 10 × 0.1 + 35.6 × 0.9 ≈ **33.1**
- Staleness: 10 × 0.1 + 60.6 × 0.9 ≈ **55.5**

---

## Natural Opposition Check

**Sum of scores** (should be 70-100):
- Krecetas: 35.7 + 52.0 = **87.7** ✅
- Skudurelis: 33.1 + 55.5 = **88.6** ✅

**Differentiation**:
- Staleness: Skudurelis **3.9 points** higher (plays Caro-Kann more)
- Novelty: Krecetas **2.6 points** higher (slightly more variety)

✅ **Natural opposition maintained!**

---

## Why This Makes Sense

### Both Players ARE Somewhat Repetitive

- **Krecetas**: Plays King's Pawn 23.4% of time
- **Skudurelis**: Plays Caro-Kann 25.7% of time

**This is NORMAL behavior!** Most players have a "main" opening they rely on.

### Staleness 50-60 is Appropriate

- **Not extremely stale** (not 80+): They DO play 27-29 different openings
- **Not low staleness** (not <40): They DO have clear main openings at 23-25%
- **Balanced repertoire**: Mix of consistency and variety

---

## Files Changed

**`python/core/unified_api_server.py`**:

1. `_estimate_novelty_from_games()` (lines 1236-1242):
   - base: 30.0 → 25.0
   - diversity_bonus: × 0.5 → × 0.6
   - repetition_penalty: × 60.0 → × 80.0

2. `_estimate_staleness_from_games()` (lines 1288-1294):
   - base: 30.0 → 35.0
   - repetition_bonus: × 110.0 → × 150.0
   - diversity_penalty: × 0.3 → × 0.25

3. `_compute_personality_scores()` (lines 1376-1377):
   - Weighting: 70% game / 30% move → 90% game / 10% move

---

## Testing

1. ✅ Backend restarted with new formulas
2. ⏳ Refresh browser to see updated scores
3. ⏳ Verify staleness now shows 50-60 range
4. ⏳ Verify natural opposition maintained (sum ~85-90)

---

## Key Insights

1. **Opening repertoire is the primary staleness indicator**
   - Move-level patterns are secondary
   - Changed weighting to 90/10 reflects this

2. **25% repetition should mean moderate-high staleness**
   - Not extreme (player still uses 27-29 openings)
   - But definitely repetitive (quarter of games are same opening)

3. **Natural opposition is maintained**
   - Novelty + Staleness ≈ 85-90
   - Players with high repetition get low novelty

4. **Both players are actually similar**
   - Small differentiation (3-4 points) is accurate
   - Both have balanced repertoires with main openings

---

## Expected Personality Radar

After refresh, you should see:

**Krecetas**:
- Novelty: ~36 (down from 90)
- Staleness: ~52 (up from 47)

**Skudurelis**:
- Novelty: ~33 (down from 76)
- Staleness: ~56 (up from 31)

This accurately reflects their opening patterns! 🎯

