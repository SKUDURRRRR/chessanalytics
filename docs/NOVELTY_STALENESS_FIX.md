# Novelty/Staleness Formula Fix

## Summary

Fixed Novelty/Staleness calculations to work correctly with large datasets (1000+ games) by using `opening_normalized` and improved scaling formulas.

---

## What Was Wrong

### Issue 1: Opening Data Missing
**Initial Investigation**: Thought games had `opening = "Unknown"`
**Reality**: Data was in `opening_normalized` field, not `opening`!

**Actual Data**:
- Krecetas: 1000 games, 29 unique openings (King's Pawn Game 23.4%)
- Skudurelis: 1000 games, 27 unique openings (Caro-Kann 25.7%)

### Issue 2: Broken Diversity Formula
**Old Formula**:
```python
diversity_ratio = unique_openings / total
# With 79 ECO codes out of 1000 games: 79/1000 = 0.08
# Formula treated 0.08 as "low diversity" → WRONG!
```

**Problem**: Naive ratio doesn't scale for large datasets
- 79 unique ECO codes is VERY DIVERSE
- But 79/1000 = 0.08 looked "low" to the formula
- Both players maxed out or bottomed out → no differentiation

### Issue 3: Using ECO Codes Instead of Normalized Names
**ECO codes** (opening_family): Too granular
- Krecetas: 79 unique codes (C44, C45, C50, C53, C54...)
- Skudurelis: 59 unique codes

**Normalized openings**: Better grouping
- Krecetas: 29 unique (Italian Game, Scotch Game, etc.)
- Skudurelis: 27 unique (Caro-Kann, Queen's Pawn, etc.)

---

## The Fix

### 1. Use `opening_normalized` Field
```python
# BEFORE:
opening_counts = Counter(
    (game.get('opening_family') or game.get('opening') or 'Unknown')
    for game in games
)

# AFTER:
opening_counts = Counter(
    (game.get('opening_normalized') or game.get('opening_family') or game.get('opening') or 'Unknown')
    for game in games
)
```

**Why**: Groups opening variations properly (e.g., all Italian Game variations → "Italian Game")

### 2. Fixed Diversity Scaling
```python
# For large datasets (>20 games): use square root scaling
opening_diversity_score = min(100, (math.sqrt(unique_openings) / math.sqrt(100)) * 100)

# Examples:
# 1 opening  → 10.0 (very low)
# 9 openings → 30.0 (low)
# 25 openings → 50.0 (medium)
# 49 openings → 70.0 (high)
# 100 openings → 100.0 (very high)
```

**Why**: Square root provides diminishing returns that works for both small and large datasets

### 3. Rebalanced Formula Weights

**Novelty Formula**:
```python
base = 30.0  # Moderate baseline
diversity_bonus = opening_diversity_score * 0.5  # 0-50 bonus
repetition_penalty = opening_repetition_ratio * 60.0  # Strong penalty

score = base + diversity_bonus - repetition_penalty
```

**Staleness Formula**:
```python
base = 30.0  # Moderate baseline
repetition_bonus = opening_repetition_ratio * 110.0  # Very strong bonus
diversity_penalty = opening_diversity_score * 0.3  # Moderate penalty

score = base + repetition_bonus - diversity_penalty
```

**Natural Opposition**: Maintained through shared metrics but opposite interpretations

---

## Results with New Formula

### Game-Level Scores (70% of final)

**Krecetas**:
- 29 unique openings, King's Pawn Game 23.4%
- Novelty: **42.9**
- Staleness: **39.6**

**Skudurelis**:
- 27 unique openings, Caro-Kann 25.7%
- Novelty: **40.6**
- Staleness: **42.7**

**Differentiation**: 
- Only 2-3 points apart on game-level
- This is accurate! Both players have similar opening variety
- **Move-level** (30%) will add more differentiation based on in-game creativity

### Expected Final Scores

After combining with move-level (30% weight):
- **Krecetas**: Moderate novelty/staleness (balanced repertoire)
- **Skudurelis**: Slightly more stale (relies on Caro-Kann 25.7%)

---

## Why Both Players Look Similar

The data reveals they **actually are similar** in opening variety:
- Both play ~27-29 unique openings (very close)
- Both have a "main" opening at ~23-25% frequency
- Neither is extremely repetitive (not 50%+ on one opening)
- Neither is extremely diverse (not playing 100+ openings)

**This is not a bug - it's accurate!**

The personality radar correctly identifies that:
- Both players have balanced opening repertoires
- Neither is a "one-trick pony"
- Neither is a "chameleon" trying everything

The real differentiation will come from:
1. **Move-level Novelty/Staleness** (30%): In-game creativity patterns
2. **Other traits**: Aggressive, Patient, Tactical, Positional
3. **Time management**: How they handle critical positions

---

## Testing

To verify the fix works:
1. ✅ Backend restarted with new code
2. ⏳ Refresh browser to see updated scores
3. ⏳ Check that scores use `opening_normalized` data
4. ⏳ Verify natural opposition maintained (sum ~70-90)

---

## Files Changed

- `python/core/unified_api_server.py`:
  - `_estimate_novelty_from_games()`: Lines 1194-1241
  - `_estimate_staleness_from_games()`: Lines 1244-1292
  - Changed to use `opening_normalized` first
  - Implemented square root scaling for large datasets
  - Rebalanced formula weights

---

## Key Insights

1. **ECO codes are too granular** for personality analysis
   - Use `opening_normalized` for meaningful grouping

2. **Naive ratios break with large datasets**
   - Use logarithmic or square root scaling

3. **Similar players should get similar scores**
   - If two players have similar repertoires, that's what the radar should show!

4. **Game-level vs Move-level**
   - Game-level (70%): Opening repertoire variety
   - Move-level (30%): In-game creative patterns
   - Both needed for complete picture

---

## Next Steps

1. Wait 10 seconds for backend to fully restart
2. Refresh browser to fetch updated personality scores
3. Verify scores now properly reflect opening variety
4. Check natural opposition maintained (Novelty + Staleness ~70-90)

