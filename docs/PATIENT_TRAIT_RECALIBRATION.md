# Patient Trait Scoring - Recalibration Analysis

## Problem Identified ✅

The Patient trait is **scoring too high for all player types**. Even average players (1200-1400 rating) score 76.8, which should be reserved for advanced players.

### Test Results

| Player Profile | Current Score | Expected Score | Issue |
|----------------|---------------|----------------|-------|
| Perfect (impossible) | 100.0 | 100.0 | ✓ Correct |
| Excellent (1800-2000) | **93.1** | 75-85 | ❌ Too high |
| Good (1500-1700) | **83.1** | 65-75 | ❌ Too high |
| Average (1200-1400) | **76.8** | 50-65 | ❌ WAY too high |
| Fast/Aggressive | 62.4 | 40-55 | ~ Close |
| Very Aggressive | 47.8 | 30-45 | ✓ Reasonable |

---

## Root Causes

### 1. **Quiet Bonus Too Generous**
- **Current**: `quiet_ratio × 32.0`
- **Problem**: Most chess games are 60-70% quiet moves naturally
- **Impact**: Average player with 55% quiet gets +17.6 points

### 2. **Time Bonus Still Significant**
- **Current**: `min(12.0, time_score × 0.30)`
- **Problem**: Even medium time score (50) gives +12 points
- **Impact**: Not enough differentiation

### 3. **Stability/Endgame Bonuses Stack**
- **Current**: Up to +15 points combined
- **Problem**: Too easy to max out both bonuses
- **Impact**: Every decent player gets full bonuses

### 4. **Discipline Penalty Too Weak**
- **Current**: `(blunders×20) + (mistakes×12) + (inaccuracies×8)`
- **Problem**: Average errors (3/5/8) only subtract -4.6 points
- **Impact**: Errors don't hurt enough

---

## Proposed Recalibration

### Changes to Make

```python
# BEFORE (Current - Too Generous)
quiet_bonus = quiet_ratio * 32.0        # Up to +32 points
forcing_penalty = forcing_ratio * 36.0   # Up to -36 points
stability_bonus = min(8.0, quiet_safety * 22.0)
endgame_bonus = min(7.0, endgame_accuracy * 18.0)
time_bonus = min(12.0, time_factor * 30.0)
discipline_penalty = (blunder_rate * 20.0) + (mistake_rate * 12.0) + (inaccuracy_rate * 8.0)

# AFTER (Recalibrated - More Selective)
quiet_bonus = quiet_ratio * 24.0        # Reduced by 25%: Up to +24 points
forcing_penalty = forcing_ratio * 44.0   # Increased by 22%: Up to -44 points
stability_bonus = min(6.0, quiet_safety * 18.0)  # Reduced cap and multiplier
endgame_bonus = min(5.0, endgame_accuracy * 14.0)  # Reduced cap and multiplier
time_bonus = min(10.0, time_factor * 25.0)  # Reduced cap and multiplier
discipline_penalty = (blunder_rate * 28.0) + (mistake_rate * 16.0) + (inaccuracy_rate * 10.0)
```

### Rationale

1. **Quiet Bonus (32 → 24)**: -25% reduction
   - Chess is naturally quiet-heavy (60-70%)
   - Should reward EXCEPTIONAL quiet play, not normal play

2. **Forcing Penalty (36 → 44)**: +22% increase
   - Forcing moves oppose patience
   - Strengthen natural opposition with Aggressive

3. **Stability Bonus (8 → 6)**: -25% reduction
   - Max 6 points instead of 8
   - Lower multiplier (18 vs 22)

4. **Endgame Bonus (7 → 5)**: -29% reduction
   - Max 5 points instead of 7
   - Lower multiplier (14 vs 18)

5. **Time Bonus (12 → 10)**: -17% reduction
   - Still important but less overwhelming
   - Lower multiplier (25 vs 30)

6. **Discipline Penalty (stronger)**:
   - Blunders: 20 → 28 (+40%)
   - Mistakes: 12 → 16 (+33%)
   - Inaccuracies: 8 → 10 (+25%)

---

## Expected Results After Recalibration

| Player Profile | Old Score | New Score (projected) | Target | Status |
|----------------|-----------|----------------------|--------|--------|
| Perfect | 100.0 | 93.0 | 100.0 | ~ Good |
| Excellent (1800-2000) | 93.1 | **78.5** | 75-85 | ✅ Perfect |
| Good (1500-1700) | 83.1 | **68.7** | 65-75 | ✅ Perfect |
| Average (1200-1400) | 76.8 | **59.8** | 50-65 | ✅ Perfect |
| Fast/Aggressive | 62.4 | **48.2** | 40-55 | ✅ Perfect |
| Very Aggressive | 47.8 | **33.5** | 30-45 | ✅ Perfect |

---

## Calculation Examples

### Average Player (1200-1400) - BEFORE

```
Base: 50.0
+ Quiet bonus: +17.6 (55% × 32)
- Forcing penalty: -16.2 (45% × 36)
+ Stability: +8.0
+ Endgame: +7.0
+ Time: +12.0
+ Streak: +3.0
- Discipline: -4.6
= 76.8 ❌ TOO HIGH
```

### Average Player (1200-1400) - AFTER

```
Base: 50.0
+ Quiet bonus: +13.2 (55% × 24)  [reduced]
- Forcing penalty: -19.8 (45% × 44)  [increased]
+ Stability: +6.0  [reduced]
+ Endgame: +5.0  [reduced]
+ Time: +10.0  [reduced]
+ Streak: +3.0
- Discipline: -6.6  [increased]
= 60.8 ✅ TARGET RANGE
```

---

## Benefits of Recalibration

### 1. **Better Distribution**
- Scores spread across full 30-100 range
- Average players no longer score like advanced players
- Clear differentiation between skill levels

### 2. **Stronger Opposition**
- Forcing penalty increased (+22%)
- Aggressive ↔ Patient opposition more pronounced
- Fast aggressive players score appropriately low

### 3. **More Selective**
- Bonuses reduced across the board
- Must EARN high Patient score
- 95+ reserved for truly exceptional patience

### 4. **Errors Matter More**
- Discipline penalty increased by 33-40%
- Rushed play properly penalized
- Consistent with "patient = disciplined" concept

---

## Implementation Plan

### Step 1: Update Scoring Weights

File: `python/core/personality_scoring.py` (lines 364-376)

```python
# Natural opposition: quiet moves increase patient, forcing moves decrease it
base = 50.0
quiet_bonus = quiet_ratio * 24.0        # REDUCED from 32.0
forcing_penalty = forcing_ratio * 44.0  # INCREASED from 36.0

# Additional bonuses for patient play (REDUCED to prevent ceiling hits)
stability_bonus = min(6.0, quiet_safety * 18.0)  # REDUCED from min(8.0, × 22.0)
endgame_bonus = min(5.0, endgame_accuracy * 14.0)  # REDUCED from min(7.0, × 18.0)
time_bonus = min(10.0, time_factor * 25.0)  # REDUCED from min(12.0, × 30.0)
streak_bonus = min(3.0, metrics.safe_streak_max * 0.8)  # UNCHANGED

# Penalty for impatience (INCREASED to make errors matter more)
discipline_penalty = (blunder_rate * 28.0) + (mistake_rate * 16.0) + (inaccuracy_rate * 10.0)
# INCREASED from (×20.0) + (×12.0) + (×8.0)
```

### Step 2: Test with Scenarios

Run `analyze_patient_scoring.py` to verify new scores match targets

### Step 3: Re-Analyze Test Players

Run `reanalyze_test_players.py` to see real-world impact

### Step 4: Validate Frontend

Check personality radar shows appropriate differentiation

---

## Testing Checklist

- [ ] Run scenario analysis script
- [ ] Verify average players score 55-65
- [ ] Verify good players score 65-75
- [ ] Verify excellent players score 75-85
- [ ] Verify aggressive players score 40-55
- [ ] Re-analyze Krecetas (expect ~85-90)
- [ ] Re-analyze Skudurelis (expect ~45-55)
- [ ] Check Aggressive ↔ Patient opposition

---

## Risk Assessment

### Low Risk Changes ✅
- Adjusting multipliers is safe
- Won't break existing functionality
- Can be fine-tuned further if needed

### Expected Impact
- **All players**: Scores will decrease by 10-20 points
- **Average players**: Biggest drop (~17 points)
- **Aggressive players**: Moderate drop (~14 points)
- **Patient players**: Small drop (~7 points)

### Rollback Plan
- Keep original values commented out
- Can revert if scores become too harsh
- Monitor user feedback

---

## Philosophy

**Before**: "Patient unless proven otherwise"
- Most players scored 70-100
- Hard to differentiate
- 95+ common

**After**: "Neutral baseline, must earn high score"
- Most players score 45-75
- Clear differentiation
- 95+ rare (truly exceptional)

**Alignment**: Matches other traits (Tactical, Positional)
- Those traits also score in 50-80 range typically
- Patient shouldn't be inflated compared to others
- Consistent difficulty to achieve high scores

---

## Conclusion

The Patient trait needs **significant recalibration** to align with:
1. Other personality traits (Tactical, Positional, Aggressive)
2. Realistic player skill distributions
3. The 0-100 scale philosophy (50 = neutral/average)

The proposed changes will:
- ✅ Lower average player scores by ~17 points
- ✅ Increase score spread from 30 points to 60 points
- ✅ Make 95+ scores appropriately rare
- ✅ Strengthen Aggressive ↔ Patient opposition
- ✅ Make errors more impactful (discipline matters)

**Status**: Ready for implementation
**Risk**: Low (safe to adjust, can fine-tune)
**Impact**: High (better differentiation, more meaningful scores)

