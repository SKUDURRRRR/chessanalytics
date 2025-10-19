# Personality Trait Variance Increase - Summary

## Problem Identified

**All players were getting nearly identical scores:**
- Average difference between Krecetas & Skudurelis: **0.8 points**
- All scores clustered in 70-85 range (only 15-point spread)
- Radar shapes looked almost identical
- ❌ No meaningful differentiation between playing styles

## Root Cause

1. **Base scores too high** (50) - left little room for variation
2. **Bonuses too small** (max 7-10 points)
3. **Penalties moderate** (20-40 points)
4. **Conservative calibration** - prevented scores from spreading

## Solution Applied

### Systematic Recalibration Across ALL Traits

**Changes:**
1. **Base scores: 50 → 35** (lowered 30%)
2. **Bonuses: Increased 1.5x - 2x**
3. **Penalties: Increased 1.5x - 1.8x**
4. **Caps: Raised to allow higher maximum scores**

---

## Detailed Changes by Trait

### 1. Tactical
```python
# BEFORE:
base = 50.0
error_penalty = (blunder * 40) + (mistake * 25) + (inaccuracy * 15)
accuracy_bonus = min(7.0, best_rate * 18.0)
forcing_bonus = min(3.5, forcing_accuracy * 10.0)

# AFTER:
base = 35.0  # -30%
error_penalty = (blunder * 60) + (mistake * 38) + (inaccuracy * 22)  # +50%
accuracy_bonus = min(15.0, best_rate * 35.0)  # +100%
forcing_bonus = min(8.0, forcing_accuracy * 20.0)  # +100%
```

### 2. Positional
```python
# BEFORE:
base = 50.0
error_penalty = (blunder * 35) + (mistake * 20)
quiet_bonus = min(7.0, quiet_accuracy * 18.0)
safety_bonus = min(5.0, quiet_safety * 13.0)

# AFTER:
base = 35.0  # -30%
error_penalty = (blunder * 55) + (mistake * 32)  # +60%
quiet_bonus = min(15.0, quiet_accuracy * 35.0)  # +100%
safety_bonus = min(10.0, quiet_safety * 25.0)  # +100%
```

### 3. Aggressive
```python
# BEFORE:
base = 50.0
forcing_bonus = forcing_ratio * 38.0
quiet_penalty = quiet_ratio * 32.0
attack_bonus = min(10.0, check * 24 + capture * 18)

# AFTER:
base = 35.0  # -30%
forcing_bonus = forcing_ratio * 60.0  # +58%
quiet_penalty = quiet_ratio * 50.0  # +56%
attack_bonus = min(18.0, check * 40 + capture * 30)  # +80%
```

### 4. Patient
```python
# BEFORE:
base = 50.0
quiet_bonus = quiet_ratio * 24.0
forcing_penalty = forcing_ratio * 44.0
time_bonus = min(10.0, time_factor * 25.0)

# AFTER:
base = 35.0  # -30%
quiet_bonus = quiet_ratio * 38.0  # +58%
forcing_penalty = forcing_ratio * 68.0  # +55%
time_bonus = min(18.0, time_factor * 42.0)  # +80%
```

### 5. Novelty (Move-Level)
```python
# BEFORE:
base = 50.0
diversity_bonus = (pattern * 20 + piece * 12)
creative_bonus = min(6.0, creative_ratio * 22.0)

# AFTER:
base = 35.0  # -30%
diversity_bonus = (pattern * 35 + piece * 22)  # +75%
creative_bonus = min(12.0, creative_ratio * 38.0)  # +100%
```

### 6. Staleness (Move-Level)
```python
# BEFORE:
base = 50.0
repetition_bonus = min(18.0, repetition * 2.5)
pattern_consistency = (1 - diversity) * 18.0

# AFTER:
base = 35.0  # -30%
repetition_bonus = min(30.0, repetition * 4.2)  # +67%
pattern_consistency = (1 - diversity) * 32.0  # +78%
```

---

## Expected Impact

### Before Recalibration:
- Score range: 48-84 (36-point spread)
- Average difference: 0.8 points
- All players clustered together
- ❌ No differentiation

### After Recalibration:
- **Score range: 20-95 (75-point spread)** ✅
- **Average difference: 10-25 points** ✅
- **Distinct radar shapes** ✅
- **Clear playing style differences** ✅

---

## Example Projections

### Excellent Tactical Player
- **Before**: Tactical 78, others 70-75
- **After**: Tactical 90, others 45-65
- **Difference**: Clear spike in tactical

### Very Patient Player
- **Before**: Patient 84, others 70-75
- **After**: Patient 88, Aggressive 35, others 50-70
- **Difference**: Strong patient, low aggressive (natural opposition)

### Aggressive Attacker
- **Before**: Aggressive 70, others 68-75
- **After**: Aggressive 85, Patient 40, others 55-70
- **Difference**: High aggression, low patience

### Balanced Player
- **Before**: All traits 70-75 (boring!)
- **After**: All traits 50-60 (still balanced but in middle range)
- **Difference**: Clear they're balanced, not just compressed

---

## Natural Opposition Preserved

The increased variance maintains natural opposition:
- **Aggressive ↔ Patient**: Still use shared metrics, opposite signs
- **Novelty ↔ Staleness**: Still use shared metrics, opposite signs
- **Tactical ⊥ Positional**: Still independent

**Key**: Multipliers increased proportionally, so relationships preserved!

---

## Testing Recommendations

1. **Check score spread**: Refresh browser, verify scores vary 20-95
2. **Check differences**: Players should differ by 10-25 points per trait
3. **Check natural opposition**: High aggressive → low patient
4. **Check radar shapes**: Should see distinct patterns now

---

## Rollback Plan

If scores become TOO varied (unstable):
1. Reduce multipliers back to 1.25x instead of 1.5-2x
2. Raise base back to 40-42 instead of 35
3. Lower caps slightly

But current calibration should provide good differentiation! 🎯

