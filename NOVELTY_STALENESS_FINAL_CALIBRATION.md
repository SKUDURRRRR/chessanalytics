# Novelty/Staleness Final Calibration

## Summary

Balanced the weighting between move-level and game-level signals to properly reflect that:
- **Novelty** = creativity in both openings AND in-game moves
- **Staleness** = primarily about opening repertoire repetition

---

## The Issue

After increasing staleness scores, Novelty became too low (33-36) because we set 90% game-level weight, which suppressed in-game creativity signals.

**User feedback**: "Remember, we evaluate not only openings but moves as well"

✅ **Correct!** In-game creative moves should contribute significantly to Novelty.

---

## The Solution: Asymmetric Weighting

### Novelty Weighting
```python
final_novelty = move_novelty * 0.4 + game_novelty * 0.6
```

**Rationale**:
- **40% in-game creativity**: Matters a lot! Players who find creative tactical shots, unusual plans, or novel ideas should score high
- **60% opening variety**: Still important but not dominant

### Staleness Weighting  
```python
final_staleness = move_staleness * 0.2 + game_staleness * 0.8
```

**Rationale**:
- **80% opening repetition**: Primary signal - playing the same opening repeatedly IS staleness
- **20% move patterns**: Secondary - in-game repetition is less important

---

## Why Asymmetric Makes Sense

### Novelty = Active Creativity
- Trying new openings ✓
- Finding creative moves in positions ✓
- Unusual plans and tactics ✓
- → **Both signals matter equally**

### Staleness = Passive Repetition
- Relying on same opening repeatedly ✓✓✓
- Repetitive move patterns (secondary) ✓
- → **Opening repetition is the main indicator**

---

## Expected Results

### Example: Krecetas (Creative Player)

**Opening repertoire**:
- 29 unique openings, King's Pawn 23.4%
- Game-level novelty: 38.6
- Game-level staleness: 56.6

**In-game creativity** (hypothetical):
- Move-level novelty: 70 (plays creative moves)
- Move-level staleness: 20 (not repetitive in games)

**Final scores**:
- **Novelty**: 70 × 0.4 + 38.6 × 0.6 = **51.2** ✅
- **Staleness**: 20 × 0.2 + 56.6 × 0.8 = **49.3** ✅
- Sum: 100.5 (natural opposition maintained)

### Example: Skudurelis (Methodical Player)

**Opening repertoire**:
- 27 unique openings, Caro-Kann 25.7%
- Game-level novelty: 35.6
- Game-level staleness: 60.6

**In-game creativity** (hypothetical):
- Move-level novelty: 50 (moderate creativity)
- Move-level staleness: 30

**Final scores**:
- **Novelty**: 50 × 0.4 + 35.6 × 0.6 = **41.4** ✅
- **Staleness**: 30 × 0.2 + 60.6 × 0.8 = **54.4** ✅
- Sum: 95.8 (natural opposition maintained)

---

## Differentiation

**If Krecetas is more creative in-game:**
- Novelty: Krecetas 51 vs Skudurelis 41 (**10 points apart**)
- Staleness: Krecetas 49 vs Skudurelis 54 (5 points apart)

**Now in-game creativity MATTERS!** ✅

---

## Comparison of Weighting Schemes

| Weighting | Novelty Focus | Staleness Focus | Issue |
|-----------|---------------|-----------------|-------|
| 70/30 (old) | Balanced | Balanced | Move-level staleness too low → dragged down final score |
| 90/10 (overcorrection) | Opening-heavy | Opening-heavy | Suppressed in-game creativity → Novelty too low |
| **60/40 & 80/20 (final)** | **Balanced** | **Opening-heavy** | **✅ Proper asymmetric weighting** |

---

## Formula Summary

### Game-Level Novelty (60% weight)
```python
base = 25.0
diversity_bonus = sqrt(unique_openings) * 0.6
repetition_penalty = (most_common / total) * 80.0
```

### Game-Level Staleness (80% weight)
```python
base = 35.0
repetition_bonus = (most_common / total) * 150.0
diversity_penalty = sqrt(unique_openings) * 0.25
```

### Move-Level (from PersonalityScorer)
- Novelty (40% weight): Pattern diversity, creative moves, piece diversity
- Staleness (20% weight): Repetition count, pattern consistency

---

## Natural Opposition Check

**Expected sums**:
- Creative player: ~100 (high novelty, balanced staleness)
- Methodical player: ~95 (moderate novelty, high staleness)
- Both: 85-105 range ✅

**Maintained!**

---

## Files Changed

**`python/core/unified_api_server.py`** (lines 1372-1377):
```python
# BEFORE:
final_novelty = move_novelty * 0.1 + novelty_signal * 0.9
final_staleness = move_staleness * 0.1 + staleness_signal * 0.9

# AFTER:
final_novelty = move_novelty * 0.4 + novelty_signal * 0.6
final_staleness = move_staleness * 0.2 + staleness_signal * 0.8
```

---

## Testing

1. ✅ Backend restarted with balanced weighting
2. ⏳ Refresh browser
3. ⏳ Verify Novelty scores are reasonable (not too low)
4. ⏳ Verify Staleness scores remain good (50-60)
5. ⏳ Check natural opposition (sum ~85-105)

---

## Key Insights

1. **Novelty and Staleness are different concepts**
   - Don't need identical weighting
   - Asymmetric weighting reflects their different natures

2. **In-game creativity matters for Novelty**
   - Player who finds tactical brilliancies should score high
   - Even if they have limited opening repertoire

3. **Opening repetition defines Staleness**
   - Player who plays Caro-Kann 80% of time is stale
   - Even if they play creative moves within games

4. **Natural opposition still maintained**
   - Shared metrics ensure balance
   - Sum remains in healthy 85-105 range

---

## Expected Personality Radar

After refresh, you should see:

**For creative players** (like Krecetas if high move-novelty):
- Novelty: ~50-65 (good range)
- Staleness: ~45-55 (moderate)

**For methodical players** (like Skudurelis if lower move-novelty):
- Novelty: ~40-50 (moderate)
- Staleness: ~50-60 (higher)

**Both properly differentiated** by in-game creativity! 🎯

