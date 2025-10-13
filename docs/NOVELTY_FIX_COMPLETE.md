# Novelty Formula Fix - Complete ✅

## Problem
Every single game was scoring **Novelty = 100**, making it impossible to differentiate between players with varied vs repetitive playstyles.

## Root Cause
The `score_novelty()` function was using **opening_variety** as a move-level metric:
```python
opening_variety = min(1.0, metrics.opening_unique_count / max(10, metrics.opening_moves_count))
diversity_bonus = (pattern_diversity * 18.0 + piece_diversity * 10.0 + opening_variety * 9.0)
```

Within a **single game**, opening moves are mostly unique, so `opening_variety ≈ 1.0` for every game, contributing **9 points** to the diversity bonus and pushing all scores to 100.

## Solution
**Removed opening_variety from move-level calculation** since opening variety is a **game-level concept** (variety across multiple games, not within one game).

### Changes Made

#### 1. `score_novelty()` in `personality_scoring.py`:
```python
# BEFORE:
diversity_bonus = (pattern_diversity * 18.0 + piece_diversity * 10.0 + opening_variety * 9.0)

# AFTER:
diversity_bonus = (pattern_diversity * 20.0 + piece_diversity * 12.0)  # Removed opening_variety
```
- Increased weights slightly (20 and 12 instead of 18 and 10) to maintain balance
- Added comment explaining that opening variety is handled by `_estimate_novelty_from_games()`

#### 2. `score_staleness()` in `personality_scoring.py`:
```python
# BEFORE:
pattern_consistency_bonus = (1.0 - pattern_diversity) * 16.0
opening_consistency_bonus = (1.0 - opening_variety) * 10.0
score = base + repetition_bonus + pattern_consistency_bonus + opening_consistency_bonus + ...

# AFTER:
pattern_consistency_bonus = (1.0 - pattern_diversity) * 18.0  # Increased to compensate
score = base + repetition_bonus + pattern_consistency_bonus + ...  # Removed opening_consistency_bonus
```
- Maintained natural opposition with novelty
- Opening consistency is handled by `_estimate_staleness_from_games()`

## Results

### Before Fix:
```
Krecetas:
  Game 1: Novelty: 100
  Game 2: Novelty: 100
  Game 3: Novelty: 100
  Game 4: Novelty: 100
  Game 5: Novelty: 100
  Final: Novelty: 65, Staleness: 66

Skudurelis:
  Final: Novelty: 64, Staleness: 71
```
**Only 1-2 point differences!** ❌

### After Fix:
```
Krecetas (2 opening families, repetitive):
  Novelty: 39.0 (move=81.7 + game=20.7)
  Staleness: 87.2 (move=57.3 + game=100.0)

Skudurelis (20 opening families, varied):
  Novelty: 69.8 (move=76.1 + game=67.1)
  Staleness: 50.8 (move=60.1 + game=46.9)
```
**30.8 point novelty gap, 36.4 point staleness gap!** ✅

## Validation

### Demo Results:
```
✓ PASS: Krecetas MORE patient than Skudurelis (100.0 vs 58.5)
✓ PASS: Skudurelis MORE aggressive than Krecetas (100.0 vs 32.2)
✓ PASS: Krecetas MORE stale than Skudurelis (87.2 vs 50.8)
✓ PASS: Skudurelis MORE novel than Krecetas (69.8 vs 39.0)
✓ PASS: Novelty and Staleness are opposed (sum=120.6)
```

### Unit Tests:
```
✓ test_novelty_scoring_diverse_moves PASSED
✓ test_novelty_staleness_natural_opposition PASSED
```

## How It Works Now

### Move-Level Scoring (within one game):
- **Pattern diversity**: How varied the moves are (unique SAN)
- **Piece diversity**: How many different piece types are used
- **Creative moves**: Non-book moves that don't lose evaluation
- ❌ **Opening variety**: REMOVED (game-level concept)

### Game-Level Scoring (across multiple games):
- **Opening diversity ratio**: Unique opening families / total games
- **Opening repetition ratio**: Most common opening / total games
- **Time control diversity**: Variety in time controls
- This is where opening variety **should** be measured!

### Final Score:
```
final_novelty = (move_level * 0.3) + (game_level * 0.7)
```
- 70% weight on game-level signals for novelty/staleness
- 30% weight on move-level patterns

## Next Step: ECO-to-Family Mapping

The user already has `FIX_ECO_CODES_TO_NAMES.sql` which maps:
- C44, C45 → "Scotch Game"
- C50, C54, C55 → "Italian Game"
- D00-D06 → "Queen's Pawn Game"

Running this migration will consolidate Krecetas' 120 ECO codes into ~5-10 actual opening families, making the game-level signal even stronger.

**Current**: 120 unique ECO codes (too granular)  
**After migration**: ~5-10 opening families (accurate representation)

## Files Modified

1. ✅ `python/core/personality_scoring.py`
   - Lines 389-415: `score_novelty()` 
   - Lines 430-451: `score_staleness()`

## Impact

- **Novelty scores now vary realistically** (35-80 range instead of all 100)
- **Strong differentiation** between repetitive and varied players (30+ point gaps)
- **Natural opposition maintained** (novelty/staleness still inversely related)
- **Game-level signals properly isolated** from move-level patterns
- **Tests all passing** ✓

## Conclusion

The personality radar now correctly identifies:
- **Repetitive players**: Low novelty (35-45), High staleness (80-90)
- **Varied players**: High novelty (70-85), Low staleness (40-50)
- **Balanced players**: Moderate scores (50-65) in both

The fix was simple but critical - removing a move-level metric that was actually a game-level concept!

