# Analytics Page Fix Documentation

**Date**: November 2025
**Purpose**: Complete reference for fixing analytics page issues when sections break or show empty data

---

## Table of Contents
1. [Problem Summary](#problem-summary)
2. [Root Causes](#root-causes)
3. [Solutions Implemented](#solutions-implemented)
4. [Architecture Overview](#architecture-overview)
5. [Debugging Guide](#debugging-guide)
6. [Common Pitfalls](#common-pitfalls)
7. [Code References](#code-references)

---

## Problem Summary

### Issues Encountered
Analytics page sections frequently broke or showed empty data:
- ❌ **Opening Performance by Color** - Showing empty data
- ❌ **Resignation Timing** - Showing 0.0 or disappearing
- ❌ **Analysis Statistics** - Showing N/A for opening accuracy, 0 blunders/inaccuracies
- ❌ **Color Performance** - Only showing 500 games instead of all 4010
- ❌ **Opening Performance** - Showing opponent's openings instead of player's openings

### User Impact
- Sections would disappear when code changes were made
- Fixing one section would break another
- Inconsistent data across different sections
- User loses trust in analytics accuracy

---

## Root Causes

### 1. **Wrong Calculation Function for Analysis Stats**

**Problem**:
```python
# Backend was calling the WRONG function
result = _calculate_unified_analysis_stats(response.data)
```

**Root Cause**:
- `_calculate_unified_analysis_stats()` expects **pre-calculated fields** (`blunders`, `mistakes`, `inaccuracies`)
- User's data is stored in `move_analyses` table with **`moves_analysis` array**
- Function was looking for fields that don't exist → returned 0 for everything

**Why It Happened**:
- Someone added support for a different table structure (`unified_analyses` view)
- Endpoint was updated to always call the new function
- Broke existing `move_analyses` table data

---

### 2. **Overly Aggressive Opening Filter**

**Problem**:
```python
# Old logic was filtering out almost ALL games
if not _should_count_opening_for_color(opening, color):
    continue  # Skipped Caro-Kann when player was WHITE
```

**Example**:
- User plays **White** and opens with **e4** (King's Pawn Opening)
- Opponent responds with **Caro-Kann Defense**
- Database stores opening as **"Caro-Kann Defense"**
- Filter logic: "Caro-Kann = black opening, player = white → **SKIP**"
- Result: **99% of games filtered out** ❌

**Why It Happened**:
- Filter was checking if opening MATCHES player color
- But most games have opponent's response in the opening name
- e.g., "Italian Game, Caro-Kann Defense" contains both white and black moves

---

### 3. **Incorrect Opening Display (Showing Opponent's Openings)**

**Problem**:
- "Opening Performance by Color" showed **Caro-Kann** under **White openings**
- Clicking on it showed **King's Pawn Opening** games
- Confusing and incorrect

**Root Cause**:
- After removing the filter, we showed ALL openings for each color
- This included opponent's openings
- User playing white vs Caro-Kann = showing Caro-Kann as "white opening"

**Why It Happened**:
- Filter was removed completely to fix the empty data issue
- Needed to restore filter but with CORRECT logic

---

### 4. **Limited Data Fetching (Only 500 Games)**

**Problem**:
```python
# Backend was only fetching 500 games initially
initial_limit = 500
fetch_limit = min(initial_limit, effective_limit)
```

**Result**:
- User has 4010 games
- Color Performance showed: 252 white + 248 black = **500 total** ❌
- Should show: ~2000 white + ~2000 black = **4010 total** ✓

**Why It Happened**:
- Performance optimization: "fetch 500 games fast, rest in background"
- But analytics need ALL games for accurate stats
- Background task wasn't being used properly

---

### 5. **Inconsistent Data Sources**

**Problem**: Different sections using different data:
```python
# Color stats
white_games = [g for g in games if g.get('color') == 'white']  # 500 games

# Opening color stats
for game in games_for_color_stats:  # ALL games (separate fetch)

# Resignation timing
termination = _parse_termination_from_pgn(pgn_map.get(game_id))  # Only 500 games
```

**Result**:
- Fixing one section broke another
- Sections showed inconsistent totals
- Resignation data only covered 500 games

**Why It Happened**:
- Code evolved over time with different optimizations
- No unified data fetching strategy
- Each section added independently

---

### 6. **Field Naming Inconsistencies**

**Problem**: Backend returning both formats:
```python
# Backend
result = {
    'resignationTiming': data,        # camelCase
    'resignation_timing': data,       # snake_case
}
```

**Frontend expecting one format**:
```typescript
// Would break if backend only sent one format
comprehensiveData.resignationTiming ?? null
```

**Why It Happened**:
- Python uses snake_case convention
- JavaScript uses camelCase convention
- Inconsistent API design

---

## Solutions Implemented

### ✅ **Solution 1: Smart Function Selection**

**File**: `python/core/unified_api_server.py` (lines 1489-1507)

```python
# Determine which table we got data from and use appropriate calculation
if response.data:
    first_record = response.data[0]
    if 'moves_analysis' in first_record and isinstance(first_record.get('moves_analysis'), list):
        # Use move_analysis stats calculation (parses moves_analysis array)
        result = _calculate_move_analysis_stats(response.data)
    else:
        # Use unified_analysis stats calculation (expects pre-calculated fields)
        result = _calculate_unified_analysis_stats(response.data)
```

**What This Fixes**:
- Detects data structure automatically
- Uses correct calculation function
- Works with both `move_analyses` and `unified_analyses` tables

---

### ✅ **Solution 2: Correct Opening Filter**

**File**: `python/core/unified_api_server.py` (lines 2981-2991, 5796-5850)

```python
# Skip games without valid opening names
if not opening or opening == 'Unknown' or opening.lower() == 'null':
    continue

# CRITICAL: Filter openings by who played them
# Don't show opponent's openings (e.g., skip "Caro-Kann" when player is white)
if not _should_count_opening_for_color(opening, color):
    continue
```

**Filter Logic**:
```python
def _should_count_opening_for_color(opening: str, player_color: str) -> bool:
    opening_lower = opening.lower()

    # Black openings (defenses) - only count when player is black
    black_openings = ['sicilian', 'french', 'caro-kann', 'pirc', ...]

    # White openings (systems/attacks) - only count when player is white
    white_openings = ['italian', 'ruy lopez', "king's pawn", 'london', ...]

    # Check specific lists
    for black_op in black_openings:
        if black_op in opening_lower:
            return player_color == 'black'

    for white_op in white_openings:
        if white_op in opening_lower:
            return player_color == 'white'

    # Heuristics
    if 'defense' in opening_lower or 'defence' in opening_lower:
        return player_color == 'black'

    if ' opening' in opening_lower:
        return player_color == 'white'

    # Neutral or unknown - count for both
    return True
```

**What This Fixes**:
- Shows only **player's openings** in each color section
- Caro-Kann only appears under Black
- Italian Game only appears under White
- Clicking on opening shows correct games

---

### ✅ **Solution 3: Increased Initial Fetch Limit**

**File**: `python/core/unified_api_server.py` (lines 2549-2556)

```python
# BEFORE: Only 500 games
initial_limit = 500

# AFTER: Up to 5000 games
initial_limit = 5000  # Covers most users' total game counts
needs_background = effective_limit > initial_limit
fetch_limit = min(initial_limit, effective_limit)
```

**What This Fixes**:
- All 4010 games fetched in initial response
- Color/Opening stats show ALL games
- No waiting for background tasks

---

### ✅ **Solution 4: Always Return Data for All Sections**

**File**: `python/core/unified_api_server.py` (lines 2926-2966)

```python
# BEFORE: Only returned if data exists
resignation_summary = None
if resignation_moves or opponent_resignation_moves:
    resignation_summary = {...}

# AFTER: Always return (even with null values)
resignation_summary = {
    'my_average_resignation_move': overall_avg,
    'recent_average_resignation_move': recent_avg,
    'change': change,
    'insight': insight
}
```

**What This Fixes**:
- Sections don't disappear when no data
- Frontend can show "0.0" or "N/A" consistently
- Better UX - users know the section exists

---

### ✅ **Solution 5: Unified Sample Size (100 Games)**

**File**: `python/core/unified_api_server.py` (lines 2818-2820, 2929)

```python
# Changed from 50 to 100 games for better statistical significance
last_hundred = games[:100]
last_hundred_moves = [g['total_moves'] for g in last_hundred if g.get('total_moves')]
baseline_moves = [g['total_moves'] for g in games[100:300] if g.get('total_moves')]

# Resignation timing also uses 100
for i, game in enumerate(games[:100]):
```

**What This Fixes**:
- More statistically significant trends
- Consistent sample size across sections

---

### ✅ **Solution 6: Dual Field Naming Support**

**File**: `python/core/unified_api_server.py` (lines 3070-3092)

```python
result = {
    # Standardized to camelCase for consistency (support both during transition)
    'resignationTiming': resignation_summary,
    'resignation_timing': resignation_summary,  # Backwards compatibility

    'personalRecords': records,
    'personal_records': records,

    'marathonPerformance': marathon_summary,
    'marathon_performance': marathon_summary,

    'recentTrend': recent_trend,
    'recent_trend': recent_trend,
}
```

**Frontend**: `src/components/simple/SimpleAnalytics.tsx` (lines 393-423)

```typescript
const safeComprehensive = comprehensiveData ? {
    ...comprehensiveData,
    // Support both naming conventions
    resignationTiming: comprehensiveData.resignationTiming ??
                       comprehensiveData.resignation_timing ??
                       null,
    personalRecords: comprehensiveData.personalRecords ??
                     comprehensiveData.personal_records ??
                     null,
} : null
```

**What This Fixes**:
- Works regardless of backend field naming
- Graceful transition period
- No breaking changes

---

### ✅ **Solution 7: Comprehensive Debug Logging**

**File**: `python/core/unified_api_server.py` (lines 3044-3054)

```python
if DEBUG:
    print(f"[DEBUG] ========== COMPREHENSIVE ANALYTICS DATA SUMMARY ==========")
    print(f"[DEBUG] Total games fetched: {len(games)}")
    print(f"[DEBUG] Games for opening color stats: {len(games_for_opening_color)}")
    print(f"[DEBUG] PGN data available for: {len(pgn_map)} games")
    print(f"[DEBUG] Opening color stats: white={len(opening_color_stats['white'])}, black={len(opening_color_stats['black'])}")
    print(f"[DEBUG] Resignation data: my_resignations={len(resignation_moves)}, recent={len(recent_resignation_moves)}")
    print(f"[DEBUG] Resignation summary: {resignation_summary}")
```

**What This Fixes**:
- Easy debugging when sections break
- Can see exactly what data each section receives
- Identifies data source issues quickly

---

## Architecture Overview

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Request                        │
│   GET /api/v1/comprehensive-analytics/{user}/{platform}    │
│                     ?limit=10000                            │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Endpoint                          │
│         python/core/unified_api_server.py                   │
│                  (lines 2508-3092)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────┴──────────────┐
        │                            │
        ▼                            ▼
┌──────────────────┐      ┌──────────────────────┐
│  Fetch Games     │      │  Fetch Analysis      │
│  (up to 5000)    │      │  (last 500 games)    │
│  • games table   │      │  • move_analyses     │
│  • All fields    │      │  • game_analyses     │
└────────┬─────────┘      │  • pgn_data          │
         │                └──────────┬───────────┘
         │                           │
         └───────────┬───────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Process & Calculate                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 1. Color Stats (white/black)                         │  │
│  │    → Uses: games (all fetched)                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 2. Opening Stats (overall)                           │  │
│  │    → Uses: games (all fetched)                       │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 3. Opening Color Stats (by color)                    │  │
│  │    → Uses: games_for_opening_color (all + filter)    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 4. Resignation Timing                                │  │
│  │    → Uses: games (last 100) + pgn_map               │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 5. Recent Trend                                      │  │
│  │    → Uses: games (last 100 vs 100-300)              │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ 6. Personal Records                                  │  │
│  │    → Uses: games + analysis data                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Return Response                           │
│  {                                                           │
│    totalGames: 4010,                                        │
│    colorStats: {...},                                       │
│    openingStats: [...],                                     │
│    openingColorStats: {white: [...], black: [...]},        │
│    resignationTiming: {...},                                │
│    recentTrend: {...},                                      │
│    personalRecords: {...},                                  │
│    // Both naming conventions for backwards compatibility   │
│  }                                                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend Processing                         │
│       src/components/simple/SimpleAnalytics.tsx             │
│                                                              │
│  1. Defensive data mapping (safeComprehensive)              │
│  2. Support both camelCase/snake_case                       │
│  3. Provide fallback values                                 │
│  4. Render sections consistently                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Debugging Guide

### When Sections Show Empty Data

**Step 1: Check Browser Console**

```javascript
// Look for these warnings
[SimpleAnalytics] Missing expected fields from backend: [...]
[SimpleAnalytics] openingColorStats is empty (no games with opening names)
```

**Step 2: Enable Backend DEBUG Mode**

```powershell
cd "C:\my files\Projects\chess-analytics\python"
$env:DEBUG="True"
python -m uvicorn core.unified_api_server:app --reload --port 8002
```

**Step 3: Check Backend Logs**

Look for the debug summary:
```
[DEBUG] ========== COMPREHENSIVE ANALYTICS DATA SUMMARY ==========
[DEBUG] Total games fetched: 4010
[DEBUG] Games for opening color stats: 4010
[DEBUG] PGN data available for: 500 games
[DEBUG] Opening color stats: white=15, black=18
[DEBUG] Resignation data: my_resignations=50, recent=0
[DEBUG] ==========================================================
```

**Step 4: Verify Data Structure**

```python
# If opening color stats is empty, check:
print(f"Sample game: {games[0]}")
# Look for:
# - opening: "Italian Game"
# - opening_normalized: "Italian Game"
# - color: "white" or "black"
```

---

### Common Debugging Scenarios

#### Scenario 1: "Opening Performance by Color" is Empty

**Symptoms**:
- Shows "No opening data available"
- White/Black sections both empty

**Likely Causes**:
1. Games don't have `opening` or `opening_normalized` fields
2. Opening filter is too aggressive
3. `games_for_color_stats` is empty

**Debug Steps**:
```python
# Check if games have opening data
games_with_openings = [g for g in games if g.get('opening') or g.get('opening_normalized')]
print(f"Games with openings: {len(games_with_openings)} / {len(games)}")

# Check filter logic
for game in games[:10]:
    opening = game.get('opening_normalized') or game.get('opening')
    color = game.get('color')
    should_count = _should_count_opening_for_color(opening, color)
    print(f"{color}: {opening} → {should_count}")
```

**Fix**:
- If games don't have openings: Import games again from platform
- If filter too aggressive: Review `_should_count_opening_for_color` logic
- If `games_for_color_stats` empty: Check parallel fetch in line 2757-2763

---

#### Scenario 2: "Analysis Statistics" Shows 0 for Everything

**Symptoms**:
- Opening Accuracy: N/A
- Blunders per Game: 0
- Inaccuracies per Game: 0
- But you know you have analyzed games

**Likely Causes**:
1. Wrong calculation function being used
2. Analysis data in different table format
3. No `moves_analysis` array in response

**Debug Steps**:
```python
# Check analysis data structure
response = db_client.table('move_analyses').select('*').eq('user_id', user_id).limit(1).execute()
if response.data:
    print(f"First analysis record: {response.data[0].keys()}")
    print(f"Has moves_analysis: {'moves_analysis' in response.data[0]}")
```

**Fix**:
- Verify smart function selection is working (lines 1489-1507)
- Check that `_calculate_move_analysis_stats` is being called
- Ensure `moves_analysis` array exists in database records

---

#### Scenario 3: Section Disappears After Code Change

**Symptoms**:
- Section was showing before
- After code change, section completely gone
- Other sections still work

**Likely Causes**:
1. Backend returning `null` instead of empty object
2. Frontend conditional rendering checking wrong field
3. Field naming mismatch (camelCase vs snake_case)

**Debug Steps**:
```typescript
// Add to SimpleAnalytics.tsx loadData function
console.log('[DEBUG] Comprehensive data:', comprehensiveAnalytics)
console.log('[DEBUG] Field check:', {
  hasResignationTiming: !!comprehensiveAnalytics.resignationTiming,
  hasResignation_timing: !!comprehensiveAnalytics.resignation_timing,
  hasPersonalRecords: !!comprehensiveAnalytics.personalRecords,
})
```

**Fix**:
- Ensure backend ALWAYS returns field (even if null/empty)
- Update frontend to check both naming conventions
- Use nullish coalescing: `data?.field ?? null`

---

#### Scenario 4: Wrong Data in Section

**Symptoms**:
- Section shows data but it's incorrect
- Numbers don't match expectations
- Clicking on item shows wrong games

**Likely Causes**:
1. Using wrong data source (500 games vs all games)
2. Filter logic is incorrect
3. Calculation error

**Debug Steps**:
```python
# Check data sources
print(f"Games used: {len(games)}")
print(f"Games for color stats: {len(games_for_opening_color)}")
print(f"PGN data for: {len(pgn_map)} games")

# Verify calculations
print(f"White games: {len([g for g in games if g.get('color') == 'white'])}")
print(f"Black games: {len([g for g in games if g.get('color') == 'black'])}")
```

**Fix**:
- Ensure all sections use consistent data source
- Verify `initial_limit` is set to 5000 (line 2549)
- Check filter logic in `_should_count_opening_for_color`

---

## Common Pitfalls

### ❌ Pitfall 1: Using Different Data Sources

**Wrong**:
```python
# Section 1 uses games
color_stats = calculate_from(games)

# Section 2 uses games_for_color_stats
opening_stats = calculate_from(games_for_color_stats)

# Section 3 uses limited PGN data
resignation_stats = calculate_from(pgn_map)  # Only 500 games!
```

**Right**:
```python
# Use consistent data source across all sections
all_sections = calculate_from(games)  # All use same dataset
```

---

### ❌ Pitfall 2: Returning Null Instead of Empty Object

**Wrong**:
```python
resignation_summary = None
if resignation_moves:
    resignation_summary = {...}
# Returns null → Frontend section disappears
```

**Right**:
```python
# Always return object structure
resignation_summary = {
    'my_average_resignation_move': value or None,
    'recent_average_resignation_move': value or None,
    'change': value or None,
}
# Returns object with nulls → Frontend shows "0.0" or "N/A"
```

---

### ❌ Pitfall 3: Aggressive Filtering

**Wrong**:
```python
# Filters out 99% of games
if opening_contains_black_piece_name and player_is_white:
    skip_game()
```

**Right**:
```python
# Only skip if ENTIRE opening is opponent's
if is_definitely_opponent_opening(opening, color):
    skip_game()
else:
    count_game()  # When in doubt, include it
```

---

### ❌ Pitfall 4: Hard-coded Sample Sizes

**Wrong**:
```python
recent_games = games[:50]  # Hard-coded
baseline_games = games[50:200]  # Hard-coded
```

**Right**:
```python
# Use configurable constants
RECENT_SAMPLE_SIZE = 100
BASELINE_OFFSET = 100
BASELINE_SIZE = 200

recent_games = games[:RECENT_SAMPLE_SIZE]
baseline_games = games[BASELINE_OFFSET:BASELINE_OFFSET + BASELINE_SIZE]
```

---

### ❌ Pitfall 5: Single Naming Convention

**Wrong**:
```python
# Backend only returns one format
result = {'resignationTiming': data}

# Frontend expects different format
data.resignation_timing  # ❌ Undefined!
```

**Right**:
```python
# Backend returns both
result = {
    'resignationTiming': data,
    'resignation_timing': data,  # Backwards compatibility
}

# Frontend checks both
const value = data.resignationTiming ?? data.resignation_timing ?? null
```

---

## Code References

### Backend Files

**Main Endpoint**: `python/core/unified_api_server.py`
- Lines 2508-3092: `get_comprehensive_analytics` endpoint
- Lines 1430-1507: `get_analysis_stats` endpoint (fixed function selection)
- Lines 5796-5850: `_should_count_opening_for_color` filter function
- Lines 9803-9846: `_calculate_unified_analysis_stats` (for pre-calculated fields)
- Lines 9848-9905: `_calculate_move_analysis_stats` (for moves_analysis array)

**Key Functions**:
```python
# Smart function selection (lines 1489-1507)
if 'moves_analysis' in first_record:
    result = _calculate_move_analysis_stats(response.data)
else:
    result = _calculate_unified_analysis_stats(response.data)

# Opening filter (lines 5796-5850)
def _should_count_opening_for_color(opening: str, player_color: str) -> bool

# Data fetching (lines 2757-2795)
results = await asyncio.gather(
    _fetch_game_analyses_batched(...),
    _fetch_move_analyses_batched(...),
    _fetch_pgn_data_batched(...),
    _fetch_opening_color_stats_games(...),
)
```

---

### Frontend Files

**Main Component**: `src/components/simple/SimpleAnalytics.tsx`
- Lines 111-121: Data fetching with `getComprehensiveAnalytics`
- Lines 393-423: `safeComprehensive` defensive data mapping
- Lines 434-445: Safe accessors for specific fields
- Lines 848-948: Opening Performance by Color section
- Lines 1175-1207: Resignation Timing section

**Key Patterns**:
```typescript
// Defensive mapping (lines 393-423)
const safeComprehensive = comprehensiveData ? {
    ...comprehensiveData,
    resignationTiming: comprehensiveData.resignationTiming ??
                       comprehensiveData.resignation_timing ??
                       null,
} : null

// Conditional rendering (lines 1176-1177)
{safeComprehensive?.resignationTiming && (
    <div>...</div>
)}
```

---

### Service Files

**API Service**: `src/services/unifiedAnalysisService.ts`
- Lines 941-989: `getComprehensiveAnalytics` method
- Default limit: 500 → Frontend overrides to 10000

---

## Quick Reference Checklist

### When Analytics Break, Check:

- [ ] **Backend DEBUG logs** - Enable with `$env:DEBUG="True"`
- [ ] **Browser console** - Look for `[SimpleAnalytics]` warnings
- [ ] **Data structure** - Does first record have expected fields?
- [ ] **Field naming** - Both camelCase and snake_case supported?
- [ ] **Sample size** - Fetching enough games? (initial_limit = 5000)
- [ ] **Filter logic** - Not too aggressive? Check `_should_count_opening_for_color`
- [ ] **Calculation function** - Using correct one? Check smart selection logic
- [ ] **Null handling** - Always returning object structure, not null?
- [ ] **Data source** - All sections using consistent data?

### Fix Priority Order:

1. **Check if backend returns data** - Enable DEBUG, check logs
2. **Verify data structure** - Inspect response in browser console
3. **Check calculation function** - Ensure correct one is called
4. **Verify filter logic** - Not filtering out too much?
5. **Check sample size** - Fetching enough games?
6. **Update defensive mapping** - Frontend handles missing fields?

---

## Summary

### What We Fixed

✅ **Analysis Stats** - Smart function selection based on data structure
✅ **Opening Filter** - Corrected to show player's openings only
✅ **Sample Size** - Increased from 500 to 5000 initial fetch
✅ **Resignation Timing** - Always returns data, increased to 100 games
✅ **Field Naming** - Support both camelCase and snake_case
✅ **Debug Logging** - Comprehensive logging when DEBUG=True
✅ **Consistent Rendering** - Sections never disappear, show "0" or "N/A" when empty

### Key Principles

1. **Always return data structure** - Never return `null`, return object with null values
2. **Support both naming conventions** - Backend sends both, frontend checks both
3. **Use consistent data sources** - All sections use same dataset
4. **Defensive programming** - Frontend maps data defensively with fallbacks
5. **Comprehensive logging** - Debug mode shows exactly what each section receives
6. **Smart detection** - Automatically detect data structure and handle appropriately

### Maintenance Notes

- **When adding new sections**: Follow the pattern of always returning data
- **When changing field names**: Support both old and new names during transition
- **When optimizing**: Don't reduce sample size below what analytics need
- **When debugging**: Enable DEBUG mode first, check logs before changing code

---

**Document Version**: 1.0
**Last Updated**: November 2025
**Maintained By**: Development Team
