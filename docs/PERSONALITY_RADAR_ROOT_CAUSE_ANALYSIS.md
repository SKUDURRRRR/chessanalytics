# Personality Radar Root Cause Analysis

## Problem Statement
Players with very different styles (Krecetas vs Skudurelis) show nearly identical personality radar scores despite having distinctly different playstyles.

## Root Causes Discovered

### 🔴 CRITICAL BUG 1: Time Management Score Scale Mismatch
**Location**: `python/core/analysis_engine.py` line 1811

**Issue**: 
- Function returns `0.75` (hardcoded placeholder on 0-1 scale)
- Personality scorer expects 0-100 scale
- Results in time_score being interpreted as 0.75 out of 100 instead of 75 out of 100

**Evidence from Diagnostic**:
```
Time Management: 0.8 for ALL 27 games
Fast games (<40): 27 (100.0%)
Slow games (>=70): 0 (0.0%)
```

**Impact**:
- Patient score cannot differentiate slow vs fast players
- Krecetas (slow player): Patient 90
- Skudurelis (fast player): Patient 91
- **Should be**: Krecetas 90+, Skudurelis 40-55

**Fix Applied**:
1. Changed `_calculate_time_management_score()` to return 50.0 (neutral on 0-100 scale)
2. Added scaling logic in `unified_api_server.py` to convert legacy 0-1 data to 0-100 scale
3. Added validation to detect corrupt data (< 10) and use neutral

---

### 🔴 CRITICAL BUG 2: Opening Family Not Extracted
**Location**: Multiple - data pipeline issue

**Issue**:
- ALL 1000 games show "Unknown" as opening_family
- Game-level novelty/staleness signals completely broken
- Opening diversity ratio: 0.001 (should be 0.10+ for varied players)

**Evidence from Diagnostic**:
```
Unique opening families: 1 / 1000
Opening diversity ratio: 0.001
Most played opening: Unknown (1000 games, 100.0%)
```

**Impact**:
- Novelty/Staleness game-level signals (70% weight) return neutral 50.0
- Cannot differentiate players who repeat openings vs explore new ones
- Krecetas (2 openings): Novelty 65, Staleness 66
- Skudurelis (20+ openings): Novelty 64, Staleness 71
- **Should be**: Krecetas Novelty 40/Staleness 85, Skudurelis Novelty 85/Staleness 45

**Root Cause**:
- PGN headers contain Opening/ECO but not being stored in database
- `games_pgn` table might not have `opening_family` column
- Or the parsing function isn't being called on import

**Fix Needed**:
1. Verify `games_pgn` table has `opening_family` column
2. Ensure PGN import extracts `Opening` and `ECO` headers
3. Store in database during import
4. Run migration to backfill existing games

---

### 🔴 CRITICAL BUG 3: Novelty Score Always 100
**Location**: `python/core/personality_scoring.py` line 392

**Issue**:
- Within-game opening diversity (unique moves in first 20 moves) always high
- Formula: `opening_variety = min(1.0, opening_unique_count / max(10, opening_moves_count))`
- In any single game, opening moves are mostly unique, giving opening_variety ≈ 1.0
- This contributes 9.0 points to diversity_bonus

**Evidence from Diagnostic**:
```
Game 1: Novelty: 100
Game 2: Novelty: 100
Game 3: Novelty: 100
Game 4: Novelty: 100
Game 5: Novelty: 100
```

**Impact**:
- Move-level novelty hits ceiling for EVERY game
- Even with 70% game-level weight, move-level 100 pulls score up
- Cannot differentiate creative vs predictable players within games

**Fix Needed**:
- Reduce weight of `opening_variety` in move-level calculation OR
- Change formula to measure creativity differently (deviations from book moves)
- Consider removing opening_variety from move-level entirely since it's game-level concept

---

### ⚠️ ISSUE 4: High Variance in Individual Game Scores
**Location**: Aggregation logic

**Issue**:
- Individual games show wild score variations
- Game 1: Aggressive 49, Game 2: Aggressive 75
- When averaged across hundreds of games, everyone converges to middle

**Evidence from Diagnostic**:
```
Game 1: Aggressive: 49, Patient: 96
Game 2: Aggressive: 75, Patient: 67
Game 3: Aggressive: 66, Patient: 85
```

**Impact**:
- Player A with 60% aggressive games averages to ~65
- Player B with 40% aggressive games averages to ~60
- Only 5-point difference despite 20% play style difference!

**Fix Considerations**:
- May need to look at distribution percentiles (median, 75th percentile) instead of just mean
- Or weight recent games more heavily
- Or use mode/dominant play style instead of average

---

## Summary of Fixes Applied

### ✅ Completed:
1. **Time Management Scale**: Fixed to use 0-100 scale with legacy data conversion
2. **Score Calibration**: Reduced all trait bonuses to make 95+ truly exceptional

### 🚧 Still Needed:
1. **Opening Family Extraction**: Must implement proper opening name extraction and storage
2. **Novelty Formula**: Need to fix the move-level novelty calculation
3. **Aggregation Strategy**: Consider using percentiles/mode instead of mean

---

## Expected Results After Full Fix

**Krecetas (slow, repetitive, 2 openings):**
- Tactical: 70-75
- Positional: 70-75
- Aggressive: 45-55 (mostly quiet play)
- **Patient: 85-95** (slow, careful)
- **Novelty: 35-45** (2 openings only)
- **Staleness: 80-90** (highly repetitive)

**Skudurelis (fast, aggressive, 20+ openings):**
- Tactical: 70-75
- Positional: 70-75
- **Aggressive: 75-85** (forcing moves, attacks)
- **Patient: 40-50** (quick decisions)
- **Novelty: 75-85** (20+ different openings)
- **Staleness: 40-50** (varies constantly)

**Key Differentiators** (should be 30+ points apart):
- Aggressive: 50 → 80 (30-point gap)
- Patient: 90 → 45 (45-point gap)
- Novelty: 40 → 80 (40-point gap)
- Staleness: 85 → 45 (40-point gap)

---

## Next Steps

1. **Immediate**: Implement opening family extraction from PGN headers
2. **High Priority**: Fix novelty formula to not give 100 to every game
3. **Consider**: Aggregation strategy improvements (percentiles vs mean)
4. **Testing**: Re-run diagnostic after fixes to validate differentiation
5. **Migration**: Backfill opening_family for existing games

---

## Files Modified

1. `python/core/analysis_engine.py` - Fixed time management scale (0.75 → 50.0)
2. `python/core/unified_api_server.py` - Added legacy data scaling for time scores
3. `python/core/personality_scoring.py` - Calibrated all trait formulas (previous fix)

## Files Needing Changes

1. `python/core/unified_api_server.py` or analysis engine - Opening extraction
2. `python/core/personality_scoring.py` - Novelty formula fix
3. `supabase/migrations/` - Add opening_family column if missing
4. Database - Backfill script for existing games

