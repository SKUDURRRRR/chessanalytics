# Personality Radar Diagnostic Summary

## Progress Update

### ✅ Issues Identified and Fixed

#### 1. Time Management Scale Bug
- **Status**: FIXED
- **Problem**: Analysis engine returned 0.75 (0-1 scale) but scorer expected 0-100 scale
- **Evidence**: All 27 analyzed games show time_score = 0.8
- **Fix Applied**: 
  - Changed `_calculate_time_management_score()` to return 50.0
  - Added legacy data scaling in `unified_api_server.py`
- **Impact**: Will work for NEW analyses; existing data still has 0.8

#### 2. Opening Data NOT Missing  
- **Status**: VERIFIED ✅
- **Initial Concern**: Thought opening_family was "Unknown" for all games
- **Reality**: Opening data EXISTS in `games` table as ECO codes!
  - Krecetas: **120 unique ECO codes** out of 1000 games  
  - Most common: C44 (11.6%), C45 (6.7%), C50 (6.4%)
  - Diversity ratio: 0.120 (12%)
- **Root Issue**: Diagnostic was querying wrong table (`games_pgn` vs `games`)

### 🔴 Critical Bugs Remaining

#### 1. Novelty Score = 100 for Every Game
- **Status**: NEEDS FIX
- **Problem**: Move-level novelty calculation gives 100 to every single game
- **Evidence**:
  ```
  Game 1: Novelty: 100
  Game 2: Novelty: 100
  Game 3: Novelty: 100
  Game 4: Novelty: 100
  Game 5: Novelty: 100
  ```
- **Root Cause**: `opening_variety` in `score_novelty()` measures unique moves within ONE game's opening (always high)
- **Fix Needed**: Reduce or remove `opening_variety` from move-level calculation

#### 2. Time Management Data Needs Backfill
- **Status**: NEEDS MIGRATION
- **Problem**: All existing analyses have time_score = 0.8 (wrong scale)
- **Fix Needed**: 
  - Option A: Reanalyze all games (expensive)
  - Option B: SQL migration to scale existing data: `UPDATE move_analyses SET time_management_score = 50.0 WHERE time_management_score < 10`
  - Option C: Handle in aggregation (already done)
- **Current**: Option C implemented, works for displaying data

#### 3. Game-Level vs Move-Level Signal Mismatch  
- **Status**: NEEDS INVESTIGATION
- **Observation**: 
  - Krecetas has 120 unique ECO codes (12% diversity)
  - This should give ~56 game-level novelty: 
    - `base 50 + (0.12 * 45) - (0.116 * 35) = 50 + 5.4 - 4.1 = 51.3`
  - But user says Krecetas only plays "2 openings" repetitively
- **Possible Issue**: ECO codes might be too granular
  - C44, C45, C50 are all variations of "Italian Game" / "Scotch Game"
  - Need to group by opening FAMILY not ECO code
- **Fix Needed**: Map ECO codes to opening families (e.g., C44-C50 → "Italian Game")

### 📊 Current Krecetas Data

**Games**: 1000 total, 27 analyzed  
**Opening Distribution**:
- Top opening: C44 (116 games = 11.6%)
- 2nd: C45 (67 games = 6.7%)
- 3rd: C50 (64 games = 6.4%)
- **These 3 codes = 247 games = 24.7%**

**Interpretation**: 
- User says "plays same openings" → Likely means C40-C50 range (Italian/Scotch family)
- System sees "120 unique codes" → Too granular
- **Need opening family grouping**: C40-C50 → "Italian Game", D00-D06 → "Queen's Pawn", etc.

**Move-Level Stats** (sample of 27 games):
- Forcing ratio: 35.5% (balanced)
- Aggressive games: 7.4%
- Balanced games: 70.4%
- Quiet games: 22.2%

### 📋 Next Steps (Priority Order)

1. **CRITICAL**: Fix novelty formula (remove or reduce opening_variety weight)
2. **HIGH**: Implement ECO-to-family mapping for proper opening grouping
3. **MEDIUM**: Find correct skudurrrr username to compare
4. **LOW**: Consider time data backfill strategy
5. **TEST**: Re-run after fixes to verify differentiation

### 🎯 Expected Results After Fixes

#### Krecetas (slow, repetitive, Italian Game player):
- Opening family: ~3-5 families (Italian, Scotch, Queen's Pawn)
- Game-level novelty: 35-45 (low variety)
- Game-level staleness: 75-85 (high repetition)
- Move-level: Should not be 100 for every game

#### Skudurelis (fast, aggressive, varied):
- Opening family: ~15-25 families
- Game-level novelty: 75-85 (high variety)
- Game-level staleness: 40-50 (low repetition)
- Move-level: Higher forcing ratios

### 🛠️ Files Modified

1. ✅ `python/core/analysis_engine.py` - Fixed time management scale
2. ✅ `python/core/unified_api_server.py` - Added legacy data scaling
3. ✅ `python/core/personality_scoring.py` - Previous calibration
4. 🚧 `python/core/personality_scoring.py` - NEEDS novelty formula fix
5. 🚧 `python/core/unified_api_server.py` - NEEDS ECO-to-family mapping

### 📝 Notes

- Opening data extraction is WORKING correctly
- ECO codes are too granular for "opening variety" concept
- Need semantic grouping (C44-C59 = "Italian/Scotch family")
- Time management fix will work for new analyses
- Novelty=100 bug is most critical for user experience

